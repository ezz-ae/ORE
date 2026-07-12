import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import type { Role } from '@/lib/freehold/session-types'
import {
  isMetaConfigured, createCustomAudience, addHashedBuyers, createLookalikeAudience,
  MetaApiError, MetaConfigError, type BuyerContact,
} from '@/lib/meta/client'
import { createAudience } from '@/lib/freehold/audiences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

// Meta's floor for a reliable lookalike seed.
const MIN_CONTACTS = 100
const MAX_CONTACTS = 50_000

// POST — build a Lookalike from an UPLOADED lead list (e.g. a 10k lead-form
// export). The browser parses the CSV and sends bare {email, phone} rows;
// contacts are SHA-256-hashed before they reach Meta and are never stored on
// our side — the saved audience record keeps only the count and the Meta ids.
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

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : 'Lead list'
  const country = typeof body.country === 'string' && /^[A-Z]{2}$/.test(String(body.country)) ? String(body.country) : 'AE'
  const rawRatio = Number(body.ratio)
  const ratio = Number.isFinite(rawRatio) ? Math.min(0.2, Math.max(0.01, rawRatio)) : 0.03

  const contacts: BuyerContact[] = Array.isArray(body.contacts)
    ? (body.contacts as Array<Record<string, unknown>>)
        .map((c) => ({
          email: typeof c?.email === 'string' ? c.email : null,
          phone: typeof c?.phone === 'string' ? c.phone : null,
        }))
        .filter((c) => (c.email && c.email.includes('@')) || (c.phone && c.phone.replace(/\D/g, '').length >= 7))
        .slice(0, MAX_CONTACTS)
    : []

  if (contacts.length < MIN_CONTACTS) {
    return NextResponse.json(
      { error: `Need at least ${MIN_CONTACTS} rows with a usable email or phone — got ${contacts.length}. Check the column mapping.` },
      { status: 400 },
    )
  }

  try {
    const source = await createCustomAudience(
      `${name} — Seed list`,
      'Seed audience uploaded from a lead list (hashed identifiers only).',
    )
    const uploaded = await addHashedBuyers(source.id, contacts)
    const lookalike = await createLookalikeAudience({
      name: `${name} — Lookalike (${country}, ${Math.round(ratio * 100)}%)`,
      sourceAudienceId: source.id,
      country,
      ratio,
    })

    // Persist as a saved audience so the wizard can attach it in one click.
    const audience = await createAudience({
      name: `${name} — Lookalike ${Math.round(ratio * 100)}% ${country}`,
      description: `Lookalike of ${uploaded.toLocaleString()} uploaded lead contacts (top ${Math.round(ratio * 100)}% most similar in ${country}).`,
      kind: 'lookalike',
      spec: { countries: [country], customAudienceIds: [lookalike.id] },
      metaSourceAudienceId: source.id,
      metaLookalikeId: lookalike.id,
      uploadedCount: uploaded,
      createdBy: auth.user.email,
    })

    return NextResponse.json({ audience, uploaded, sourceAudienceId: source.id, lookalikeAudienceId: lookalike.id }, { status: 201 })
  } catch (error) {
    if (error instanceof MetaConfigError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof MetaApiError) return NextResponse.json({ error: `Meta rejected the audience: ${error.message}` }, { status: 502 })
    console.error('[audiences/seed] failed', error)
    return NextResponse.json({ error: 'Could not build the lookalike audience.' }, { status: 500 })
  }
}
