/**
 * SMART LOOKALIKE — one seed, analysed and tiered, then similar people at
 * every level the operator asked for.
 *
 * Sources are the company's own records: closed deals, the whole CRM, or the
 * lists it imported. The seed is not "whatever rows exist" — rows are TIERED
 * (closed > qualified > well-rated > the rest), quarantined leads are dropped
 * (Layer 10: a purged lead must not reach Meta either), and the analysis is
 * returned so the operator sees what their list is actually made of before
 * anything uploads.
 *
 * One upload, many levels: Meta builds every requested lookalike (1%, 3%,
 * 5%…) from the SAME hashed seed, and each level is saved as its own
 * audience with the real-estate MUST already in its spec.
 *
 * Contacts are SHA-256-hashed by the Meta client before leaving the server
 * and are never echoed back to the browser.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { query } from '@/lib/db'
import {
  isMetaConfigured, createCustomAudience, addHashedBuyers, createLookalikeAudience,
  MetaApiError, MetaConfigError, type BuyerContact,
} from '@/lib/meta/client'
import { createAudience, forClient } from '@/lib/freehold/audiences'
import { hardenRealEstate } from '@/lib/freehold/audience-pattern'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

const MIN_CONTACTS = 100
const MAX_CONTACTS = 50_000
const MAX_LEVELS = 3

type Source = 'closed' | 'crm' | 'imported'
const SOURCES = new Set<Source>(['closed', 'crm', 'imported'])

interface LeadRow {
  id: string
  email: string | null
  phone: string | null
  status: string | null
  source: string | null
  value_rating: number | null
}

/** The WHERE that distinguishes an imported row: bulk imports stamp their
 *  source, hand-entered and synced leads carry channel names. */
const IMPORTED_SQL = `source ILIKE 'import%'`

async function loadRows(source: Source): Promise<LeadRow[]> {
  const where =
    source === 'closed' ? `status = 'closed'` :
    source === 'imported' ? IMPORTED_SQL :
    `TRUE`
  return query<LeadRow>(
    `SELECT id, email, phone, status, source, value_rating
     FROM freehold_site_leads
     WHERE ${where}
       AND (COALESCE(NULLIF(email,''), NULLIF(phone,'')) IS NOT NULL)`,
    [],
  )
}

/** Tier the list: what a row is worth as a lookalike seed. This is the
 *  "rearrange" — the seed leads with its best rows, and the analysis names
 *  what the list is made of. */
function tierOf(r: LeadRow): 0 | 1 | 2 | 3 {
  if (r.status === 'closed') return 0
  if (r.status === 'qualified') return 1
  if ((r.value_rating ?? 0) >= 7) return 2
  return 3
}

const TIER_KEYS = ['closed', 'qualified', 'wellRated', 'other'] as const

// GET — what each source can seed, before anything uploads.
export async function GET() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  const metaConnected = await isMetaConfigured()
  const sources: Record<string, { total: number; tiers: Record<string, number> }> = {}
  for (const s of ['closed', 'crm', 'imported'] as Source[]) {
    try {
      const rows = await loadRows(s)
      const tiers: Record<string, number> = { closed: 0, qualified: 0, wellRated: 0, other: 0 }
      for (const r of rows) tiers[TIER_KEYS[tierOf(r)]]++
      sources[s] = { total: rows.length, tiers }
    } catch { sources[s] = { total: 0, tiers: { closed: 0, qualified: 0, wellRated: 0, other: 0 } } }
  }
  return NextResponse.json({ sources, min: MIN_CONTACTS, maxLevels: MAX_LEVELS, metaConnected })
}

// POST — analyse, upload once, build every requested level.
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

  const source: Source = SOURCES.has(body.source as Source) ? (body.source as Source) : 'closed'
  const name = (typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Our buyers').slice(0, 80)
  const country = typeof body.country === 'string' && /^[A-Z]{2}$/.test(String(body.country)) ? String(body.country) : 'AE'
  const ratios = (Array.isArray(body.ratios) ? body.ratios : [])
    .map(Number)
    .filter((r) => Number.isFinite(r) && r >= 0.01 && r <= 0.2)
  const levels = [...new Set(ratios)].sort((a, b) => a - b).slice(0, MAX_LEVELS)
  if (levels.length === 0) {
    return NextResponse.json({ error: 'Pick at least one similarity level (1–20%).' }, { status: 400 })
  }

  let rows: LeadRow[]
  try { rows = await loadRows(source) } catch {
    return NextResponse.json({ error: 'Could not read the lead records.' }, { status: 500 })
  }

  // Layer 10: quarantined leads never reach Meta.
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
  rows = rows.filter((r) => !untrusted.has(r.id))

  // The rearrange: best tiers first, so a capped seed keeps its best rows.
  rows.sort((a, b) => tierOf(a) - tierOf(b))
  const tiers: Record<string, number> = { closed: 0, qualified: 0, wellRated: 0, other: 0 }
  for (const r of rows) tiers[TIER_KEYS[tierOf(r)]]++

  const contacts: BuyerContact[] = rows
    .map((r) => ({ email: r.email, phone: r.phone }))
    .slice(0, MAX_CONTACTS)

  if (contacts.length < MIN_CONTACTS) {
    return NextResponse.json(
      { error: 'not_enough', count: contacts.length, min: MIN_CONTACTS, analysis: { total: rows.length, tiers } },
      { status: 422 },
    )
  }

  try {
    const seed = await createCustomAudience(
      `${name} — Seed (${source})`,
      'Seed audience from this account’s own records, tiered best-first. Identifiers hashed before leaving the server.',
    )
    const uploaded = await addHashedBuyers(seed.id, contacts)

    const audiences = []
    for (const ratio of levels) {
      const pct = Math.round(ratio * 100)
      const lookalike = await createLookalikeAudience({
        name: `${name} — Lookalike ${pct}% (${country})`,
        sourceAudienceId: seed.id,
        country,
        ratio,
      })
      const audience = await createAudience({
        name: `${name} — Lookalike ${pct}% ${country}`,
        description: `Top ${pct}% most similar in ${country} to ${uploaded.toLocaleString()} of our own ${source} contacts (tiered best-first). Real-estate interest required on top.`,
        kind: 'lookalike',
        // The one hard rule applies to lookalikes too: similar-to-our-buyers
        // AND showing a property signal, not similar alone.
        spec: hardenRealEstate({
          countries: [country], cityKeys: [], ageMin: 30, ageMax: 65,
          publisherPlatforms: ['facebook', 'instagram'],
          interests: [], behaviors: [], narrowing: [],
          customAudienceIds: [lookalike.id],
        }),
        metaSourceAudienceId: seed.id,
        metaLookalikeId: lookalike.id,
        uploadedCount: uploaded,
        createdBy: auth.user.email,
      })
      audiences.push(forClient(audience))
    }

    return NextResponse.json(
      { uploaded, analysis: { total: rows.length, tiers, usedTop: contacts.length }, audiences },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof MetaConfigError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof MetaApiError) return NextResponse.json({ error: `Meta rejected the audience: ${error.message}` }, { status: 502 })
    console.error('[audiences/smart-lookalike] failed', error)
    return NextResponse.json({ error: 'Could not build the lookalike audiences.' }, { status: 500 })
  }
}
