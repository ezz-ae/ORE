import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { query } from '@/lib/db'
import { enrichLeadProfile, listProfileFacts } from '@/lib/freehold/lead-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// One grounded research call can take a while on a slow model fallback.
export const maxDuration = 120

/**
 * GET — the lead's smart-profile facts (dynamic cells: only what was found).
 * POST — run the research agent and complete the profile.
 * Same access rule as the lead itself: brokers only on their own leads.
 */
async function authorize(id: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role === 'broker') {
    const ownerKeys = brokerOwnerKeys(user)
    // A broker with no owner keys owns nothing — deny before touching the DB.
    if (!ownerKeys.length) return { res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    let rows: { assigned_broker_id: string | null }[]
    try {
      rows = await query<{ assigned_broker_id: string | null }>(
        `SELECT assigned_broker_id FROM freehold_site_leads WHERE id = $1`,
        [id],
      )
    } catch {
      // A DB outage is 503, not "not found" — don't turn infra failure into a
      // misleading 404 (the sibling lead routes return 503 too).
      return { res: NextResponse.json({ error: 'DB unavailable' }, { status: 503 }) }
    }
    // Uniform 404 whether the lead is absent OR simply not this broker's —
    // a 403-only-when-it-exists response is an existence oracle. Matches the
    // lead GET route, which filters ownership in SQL and 404s either way.
    if (!rows.length || !ownerKeys.includes(rows[0].assigned_broker_id ?? '')) {
      return { res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }
  }
  return { user }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if ('res' in auth) return auth.res
  try {
    return NextResponse.json({ facts: await listProfileFacts(id) })
  } catch {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorize(id)
  if ('res' in auth) return auth.res
  try {
    const result = await enrichLeadProfile(id, auth.user.email)
    return NextResponse.json(result, { status: result.ok ? 200 : 409 })
  } catch (e) {
    console.error('[enrich] failed', e)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
