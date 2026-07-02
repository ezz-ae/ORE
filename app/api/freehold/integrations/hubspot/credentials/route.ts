import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  getStoredCreds, setStoredCreds, clearStoredCreds,
} from '@/lib/freehold/integration-credentials'
import type { HubspotStoredCreds } from '@/lib/hubspot/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Connecting the company's HubSpot is a management+marketing capability.
const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const
const PROVIDER = 'hubspot'
const HS = 'https://api.hubapi.com'

/** Report connection state — never returns the token itself. */
export async function GET() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  if (process.env.HUBSPOT_TOKEN) {
    return NextResponse.json({ configured: true, source: 'env' })
  }
  const stored = await getStoredCreds<HubspotStoredCreds>(PROVIDER)
  if (stored?.token) {
    return NextResponse.json({ configured: true, source: 'db' })
  }
  return NextResponse.json({ configured: false, source: null })
}

/** Validate the private-app token against HubSpot, then store it. */
export async function POST(req: NextRequest) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as { token?: string }
  const token = String(body.token ?? '').trim()
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  // Validate against HubSpot before storing: the token must be able to read
  // contacts — otherwise a sync would fail later anyway. A cheap 1-row read.
  try {
    const res = await fetch(`${HS}/crm/v3/objects/contacts?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => null)
      const msg = detail?.message ?? `HTTP ${res.status}`
      return NextResponse.json(
        { error: `HubSpot rejected the token: ${msg}. Check the private-app scopes (crm.objects.contacts.read + write).` },
        { status: 400 },
      )
    }
    await setStoredCreds(PROVIDER, { token } satisfies HubspotStoredCreds, auth.user.email)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not reach the HubSpot API to validate the token' }, { status: 502 })
  }
}

export async function DELETE() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res
  await clearStoredCreds(PROVIDER)
  return NextResponse.json({ ok: true })
}
