import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import {
  isMetaConfigured, createCustomAudience, addHashedBuyers, createLookalikeAudience,
  MetaApiError, MetaConfigError,
} from '@/lib/meta/client'
import { createAudience } from '@/lib/freehold/audiences'
import { formSeedContacts, LOOKALIKE_SEED_FLOOR } from '@/lib/freehold/form-analysis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

// A Custom Audience under this is pointless even for retargeting.
const MIN_SEED = 20

/**
 * POST — the sellable click: turn a form's leads into a Meta Custom Audience,
 * optionally with a ready-to-go Lookalike on top.
 *
 * body: { formId: string | null, formName?: string, scope: 'qualified'|'all',
 *         lookalike?: boolean, ratio?: number, country?: string, confirm: true }
 *
 * formId null = every Meta-form lead in the CRM, combined. scope 'qualified'
 * seeds ONLY value-rated ≥6 leads — a lookalike of the leads a human judged
 * worth buying more of, which is the whole point of the rating system.
 * Contacts are SHA-256-hashed in addHashedBuyers before reaching Meta; raw
 * PII is never stored in the audience record.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res

  if (!(await isMetaConfigured())) {
    return NextResponse.json({ error: 'Meta is not connected. Connect Meta Ads under Integrations first.' }, { status: 409 })
  }

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Confirmation required before uploading contact data to Meta.' }, { status: 400 })
  }

  // An explicit selection of forms beats the single-form and all-forms modes:
  // "lookalike from THESE three forms" is a deliberate seed choice.
  const formIds = Array.isArray(body.formIds)
    ? (body.formIds as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, 100)
    : null
  const formId = typeof body.formId === 'string' && body.formId.trim() ? body.formId.trim() : null
  const target: string | string[] | null = formIds && formIds.length ? formIds : formId
  const scope: 'qualified' | 'all' = body.scope === 'qualified' ? 'qualified' : 'all'
  const wantLookalike = body.lookalike === true
  const country = typeof body.country === 'string' && /^[A-Z]{2}$/.test(String(body.country)) ? String(body.country) : 'AE'
  const rawRatio = Number(body.ratio)
  const ratio = Number.isFinite(rawRatio) ? Math.min(0.2, Math.max(0.01, rawRatio)) : 0.03
  // Label only — the seed rows come from OUR database, never from the client.
  const formName = typeof body.formName === 'string' && body.formName.trim()
    ? body.formName.trim().slice(0, 80)
    : Array.isArray(target) ? `${target.length} selected forms`
    : formId ? `Form ${formId.slice(0, 12)}` : 'All Meta forms'

  const contacts = await formSeedContacts(target, scope)
  if (contacts.length < MIN_SEED) {
    return NextResponse.json(
      { error: scope === 'qualified'
          ? `Only ${contacts.length} leads are rated 6+ with a usable contact — need at least ${MIN_SEED}. Rate more leads first.`
          : `Only ${contacts.length} leads have a usable phone or email — need at least ${MIN_SEED}.` },
      { status: 400 },
    )
  }
  if (wantLookalike && contacts.length < LOOKALIKE_SEED_FLOOR) {
    return NextResponse.json(
      { error: `A reliable lookalike needs ${LOOKALIKE_SEED_FLOOR}+ seed contacts — this ${scope === 'qualified' ? 'qualified ' : ''}seed has ${contacts.length}. Create the Custom Audience now and build the lookalike when the seed grows.` },
      { status: 400 },
    )
  }

  const scopeLabel = scope === 'qualified' ? 'Qualified (value 6+)' : 'All leads'
  try {
    const source = await createCustomAudience(
      `${formName} — ${scopeLabel}`,
      `Seed audience from Meta lead-form submissions (hashed identifiers only). Scope: ${scopeLabel.toLowerCase()}.`,
    )
    const uploaded = await addHashedBuyers(source.id, contacts)

    let lookalikeId: string | null = null
    if (wantLookalike) {
      const lal = await createLookalikeAudience({
        name: `${formName} — ${scopeLabel} Lookalike (${country}, ${Math.round(ratio * 100)}%)`,
        sourceAudienceId: source.id,
        country,
        ratio,
      })
      lookalikeId = lal.id
    }

    // Persist as a saved audience so the campaign wizard and the Ads Machine
    // planner can attach it in one click — the audience is not just created on
    // Meta, it enters the platform's own targeting vocabulary.
    const audience = await createAudience({
      name: wantLookalike
        ? `${formName} — ${scopeLabel} Lookalike ${Math.round(ratio * 100)}% ${country}`
        : `${formName} — ${scopeLabel}`,
      description: wantLookalike
        ? `Lookalike of ${uploaded.toLocaleString()} ${scope === 'qualified' ? 'value-rated 6+ ' : ''}form leads (top ${Math.round(ratio * 100)}% most similar in ${country}).`
        : `Custom audience of ${uploaded.toLocaleString()} ${scope === 'qualified' ? 'value-rated 6+ ' : ''}form leads (hashed).`,
      kind: wantLookalike ? 'lookalike' : 'custom_list',
      spec: { countries: [country], customAudienceIds: [wantLookalike ? (lookalikeId as string) : source.id] },
      metaSourceAudienceId: source.id,
      metaLookalikeId: lookalikeId,
      uploadedCount: uploaded,
      createdBy: auth.user.email,
    })

    return NextResponse.json(
      { audience, uploaded, sourceAudienceId: source.id, lookalikeAudienceId: lookalikeId },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof MetaConfigError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof MetaApiError) return NextResponse.json({ error: `Meta rejected the audience: ${error.message}` }, { status: 502 })
    console.error('[forms/audience] failed', error)
    return NextResponse.json({ error: 'Could not build the audience.' }, { status: 500 })
  }
}
