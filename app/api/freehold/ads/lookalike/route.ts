import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import {
  buildLookalikeFromBuyers, isMetaConfigured, MetaApiError, MetaConfigError,
  type BuyerContact,
} from '@/lib/meta/client'
import { createAudience } from '@/lib/freehold/audiences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Meta's minimum source size for a reliable lookalike. Below this, Meta rejects
// or produces a weak audience — so we gate honestly instead of trying.
const MIN_BUYERS = 100

// Closed buyers = leads that reached 'closed'. We only pull rows that actually
// carry a usable email or phone (a lookalike seed needs real identifiers).
async function closedBuyerContacts(): Promise<BuyerContact[]> {
  const rows = await query<{ email: string | null; phone: string | null }>(
    `SELECT email, phone FROM freehold_site_leads
     WHERE status = 'closed'
       AND (COALESCE(NULLIF(email,''), NULLIF(phone,'')) IS NOT NULL)`,
  )
  return rows.map((r) => ({ email: r.email, phone: r.phone }))
}

// GET — how many closed buyers can seed a lookalike, and is Meta connected.
// Powers the honest UI state (count + gate) WITHOUT uploading anything.
export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let count = 0
  try { count = (await closedBuyerContacts()).length } catch { /* DB down → 0 */ }
  const metaConnected = await isMetaConfigured()
  return NextResponse.json({ count, min: MIN_BUYERS, ready: metaConnected && count >= MIN_BUYERS, metaConnected })
}

// POST — build the lookalike. This uploads the buyers' HASHED contacts to Meta,
// so the UI must confirm first (body.confirm must be true).
export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body ok */ }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Confirmation required before uploading buyer data to Meta.' }, { status: 400 })
  }
  const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : 'AE'
  const ratio = typeof body.ratio === 'number' ? body.ratio : 0.03
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : 'Freehold'

  let contacts: BuyerContact[]
  try {
    contacts = await closedBuyerContacts()
  } catch {
    return NextResponse.json({ error: 'Could not read buyer records.' }, { status: 500 })
  }
  if (contacts.length < MIN_BUYERS) {
    return NextResponse.json(
      { error: 'not_enough', count: contacts.length, min: MIN_BUYERS },
      { status: 422 },
    )
  }

  try {
    const result = await buildLookalikeFromBuyers({ contacts, label, country, ratio })
    // Persist as a saved audience so the wizard can attach it in one click —
    // same pattern as /api/freehold/ads/audiences/seed.
    const audience = await createAudience({
      name: `${label} — Closed Buyers Lookalike ${Math.round(ratio * 100)}% ${country}`,
      description: `Lookalike of ${result.uploaded.toLocaleString()} closed-deal contacts (top ${Math.round(ratio * 100)}% most similar in ${country}).`,
      kind: 'lookalike',
      spec: { countries: [country], customAudienceIds: [result.lookalikeAudienceId] },
      metaSourceAudienceId: result.sourceAudienceId,
      metaLookalikeId: result.lookalikeAudienceId,
      uploadedCount: result.uploaded,
      createdBy: user.email,
    })
    return NextResponse.json({ ...result, source: contacts.length, audience }, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
