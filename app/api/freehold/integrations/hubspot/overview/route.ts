import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getStoredCreds } from '@/lib/freehold/integration-credentials'
import type { HubspotStoredCreds } from '@/lib/hubspot/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const
const BASE = 'https://api.hubapi.com'

// Server-side proxy for the HubSpot dashboard. The browser must NEVER call
// api.hubapi.com directly: HubSpot blocks CORS (by design — private-app tokens
// are server secrets), which surfaced in the UI as "Failed to fetch".
// Token resolution: request body (fresh connect) → env → stored connection.
export async function POST(req: NextRequest) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({}))
  let token: string | null = typeof body?.token === 'string' && body.token.trim() ? body.token.trim() : null
  if (!token) token = process.env.HUBSPOT_TOKEN || null
  if (!token) token = (await getStoredCreds<HubspotStoredCreds>('hubspot'))?.token ?? null
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 409 })

  const hs = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) throw Object.assign(new Error(`HubSpot ${res.status}`), { status: res.status })
    return res.json()
  }

  try {
    const [contacts, deals] = await Promise.all([
      hs('/crm/v3/objects/contacts?limit=10&properties=firstname,lastname,email,phone,lifecyclestage,hs_lead_status,createdate&sorts=-createdate'),
      hs('/crm/v3/objects/deals?limit=10&properties=dealname,amount,dealstage,closedate&sorts=-createdate'),
    ])
    return NextResponse.json({
      contacts: contacts.results ?? [],
      deals: deals.results ?? [],
      contactTotal: contacts.total ?? 0,
      dealTotal: deals.total ?? 0,
    })
  } catch (e) {
    const status = (e as { status?: number })?.status
    if (status === 401 || status === 403) return NextResponse.json({ error: 'hubspot_auth' }, { status })
    console.error('[hubspot/overview] failed:', e)
    return NextResponse.json({ error: 'hubspot_unreachable' }, { status: 502 })
  }
}
