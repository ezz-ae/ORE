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
    const rows = await query<{ assigned_broker_id: string | null }>(
      `SELECT assigned_broker_id FROM freehold_site_leads WHERE id = $1`,
      [id],
    ).catch(() => [])
    if (!rows.length) return { res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    if (!ownerKeys.includes(rows[0].assigned_broker_id ?? '')) {
      return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
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
