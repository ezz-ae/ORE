/**
 * CRM AUDIENCES — the company's own leads, turned into Meta audiences.
 *
 * Two direct audiences (no lookalike — these ARE our people, matched on Meta
 * by hashed email/phone):
 *
 *   · RATED — every lead rated at or above the mark the operator picks
 *     (5 up to 10, the same 0–10 rating used everywhere in the system).
 *   · RETARGETING — leads who showed interest but never bought. Anyone the
 *     team is still working (new, contacted, qualified, viewing, negotiation
 *     and recent) is EXCLUDED — you do not pay Meta to interrupt a follow-up
 *     that is already happening.
 *
 * These audiences are NOT hardened with the interest anchor on purpose: the
 * people in them already enquired with this company about property, which is
 * a stronger signal than any Meta interest. Narrowing them further would only
 * cut the match rate of an already-small list.
 *
 * Identifiers are hashed before they reach Meta and are never echoed back.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { query } from '@/lib/db'
import {
  isMetaConfigured, createCustomAudience, addHashedBuyers,
  MetaApiError, MetaConfigError, type BuyerContact,
} from '@/lib/meta/client'
import { createAudience, forClient } from '@/lib/freehold/audiences'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/** Meta matches reliably from ~100 hashed contacts; below that the audience
 *  exists but cannot deliver. */
const MIN_CONTACTS = 100
const MAX_CONTACTS = 50_000

/** A lead still being worked: recent, and in a live follow-up status. */
const ACTIVE_STATUSES = ['new', 'contacted', 'qualified', 'viewing', 'negotiation']
/** Bought — never retargeted as a cold prospect. */
const BOUGHT_STATUSES = ['closed', 'converted']
/** After this long with no result, a lead in a "live" status is cold in
 *  practice, whatever the field says. */
const STALE_DAYS = 90

interface Row { id: string; email: string | null; phone: string | null }

const contactable = `(COALESCE(NULLIF(email,''), NULLIF(phone,'')) IS NOT NULL)`

async function ratedRows(minRating: number): Promise<Row[]> {
  return query<Row>(
    `SELECT id, email, phone FROM freehold_site_leads
     WHERE value_rating >= $1 AND ${contactable}`,
    [minRating],
  )
}

async function retargetRows(): Promise<Row[]> {
  return query<Row>(
    `SELECT id, email, phone FROM freehold_site_leads
     WHERE ${contactable}
       AND status NOT IN (${BOUGHT_STATUSES.map((s) => `'${s}'`).join(',')})
       AND (status = 'lost'
            OR (status IN (${ACTIVE_STATUSES.map((s) => `'${s}'`).join(',')})
                AND created_at < NOW() - INTERVAL '${STALE_DAYS} days'))`,
    [],
  )
}

// GET — what each type would contain, before anything is created.
export async function GET() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  const metaConnected = await isMetaConfigured()
  const rated: Record<number, number> = {}
  for (const m of [5, 6, 7, 8, 9, 10]) {
    try { rated[m] = (await ratedRows(m)).length } catch { rated[m] = 0 }
  }
  let retargeting = 0
  try { retargeting = (await retargetRows()).length } catch { /* stays 0 */ }
  return NextResponse.json({ rated, retargeting, min: MIN_CONTACTS, metaConnected })
}

// POST — create the chosen audience.
export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Confirmation required before uploading contact data to Meta.' }, { status: 400 })
  }
  if (!(await isMetaConfigured())) {
    return NextResponse.json({ error: 'Meta is not connected. Connect Meta Ads under Integrations first.' }, { status: 409 })
  }

  const type = body.type === 'retargeting' ? 'retargeting' : 'rated'
  const minRating = Math.min(10, Math.max(5, Math.round(Number(body.minRating)) || 5))

  let rows: Row[]
  try {
    rows = type === 'rated' ? await ratedRows(minRating) : await retargetRows()
  } catch {
    return NextResponse.json({ error: 'Could not read the lead records.' }, { status: 500 })
  }

  // A quarantined lead never reaches Meta, whatever list it is on.
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
  const contacts: BuyerContact[] = rows
    .filter((r) => !untrusted.has(r.id))
    .map((r) => ({ email: r.email, phone: r.phone }))
    .slice(0, MAX_CONTACTS)

  if (contacts.length < MIN_CONTACTS) {
    return NextResponse.json(
      { error: 'not_enough', count: contacts.length, min: MIN_CONTACTS },
      { status: 422 },
    )
  }

  const fallbackName = type === 'rated' ? `Leads rated ${minRating}+` : 'Interested, never bought'
  const name = (typeof body.name === 'string' && body.name.trim() ? body.name.trim() : fallbackName).slice(0, 80)

  try {
    const audienceMeta = await createCustomAudience(
      name,
      type === 'rated'
        ? `This account's own leads rated ${minRating} or higher. Hashed identifiers only.`
        : 'This account\'s own leads who showed interest but never bought — active follow-ups excluded. Hashed identifiers only.',
    )
    const uploaded = await addHashedBuyers(audienceMeta.id, contacts)

    const audience = await createAudience({
      name,
      description: type === 'rated'
        ? `Your leads rated ${minRating}+ (${uploaded.toLocaleString()} people).`
        : `Your leads who never bought (${uploaded.toLocaleString()} people).`,
      kind: 'custom_list',
      spec: {
        countries: ['AE'], cityKeys: [], ageMin: 18, ageMax: 65,
        publisherPlatforms: ['facebook', 'instagram'],
        interests: [], behaviors: [], narrowing: [],
        customAudienceIds: [audienceMeta.id],
      },
      metaSourceAudienceId: audienceMeta.id,
      uploadedCount: uploaded,
      createdBy: auth.user.email,
    })

    return NextResponse.json({ audience: forClient(audience), uploaded }, { status: 201 })
  } catch (error) {
    if (error instanceof MetaConfigError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof MetaApiError) return NextResponse.json({ error: `Meta rejected the audience: ${error.message}` }, { status: 502 })
    console.error('[audiences/crm] failed', error)
    return NextResponse.json({ error: 'Could not build the audience.' }, { status: 500 })
  }
}
