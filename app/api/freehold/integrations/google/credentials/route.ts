import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  getStoredCreds, setStoredCreds, clearStoredCreds,
} from '@/lib/freehold/integration-credentials'
import type { GoogleStoredCreds } from '@/lib/google/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Connecting the company's Google Ads account is a management+marketing capability.
const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const
const PROVIDER = 'google'

const ENV_KEYS = [
  'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID',
] as const
const envConfigured = () => ENV_KEYS.every((k) => (process.env[k] ?? '').trim().length > 0)

/** Report connection state — never returns any secret. */
export async function GET() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  if (envConfigured()) {
    return NextResponse.json({ configured: true, source: 'env' })
  }
  const stored = await getStoredCreds<GoogleStoredCreds>(PROVIDER)
  if (stored?.developerToken && stored.clientId && stored.clientSecret && stored.refreshToken && stored.customerId) {
    return NextResponse.json({ configured: true, source: 'db', customerId: stored.customerId })
  }
  return NextResponse.json({ configured: false, source: null })
}

/** Validate the credentials against Google, then store them. */
export async function POST(req: NextRequest) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => ({})) as Partial<GoogleStoredCreds>
  const developerToken = String(body.developerToken ?? '').trim()
  const clientId       = String(body.clientId ?? '').trim()
  const clientSecret   = String(body.clientSecret ?? '').trim()
  const refreshToken   = String(body.refreshToken ?? '').trim()
  const customerId     = String(body.customerId ?? '').replace(/-/g, '').trim()
  const loginCustomerId = String(body.loginCustomerId ?? '').replace(/-/g, '').trim() || customerId

  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    return NextResponse.json(
      { error: 'developerToken, clientId, clientSecret, refreshToken and customerId are all required' },
      { status: 400 },
    )
  }

  try {
    // 1) Refresh the OAuth token — validates clientId/clientSecret/refreshToken.
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => null)
      return NextResponse.json(
        { error: `Google rejected the OAuth credentials: ${err?.error_description ?? err?.error ?? tokenRes.status}` },
        { status: 400 },
      )
    }
    const accessToken = (await tokenRes.json()).access_token as string

    // 2) Trivial GAQL query — validates the developer token + customer id + MCC.
    const q = await fetch(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'login-customer-id': loginCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'SELECT customer.id FROM customer LIMIT 1' }),
      },
    )
    if (!q.ok) {
      const err = await q.json().catch(() => null)
      const msg = err?.error?.message ?? `HTTP ${q.status}`
      return NextResponse.json(
        { error: `Google Ads rejected the request: ${msg}. Check the developer token, customer ID and manager (login) ID.` },
        { status: 400 },
      )
    }

    const creds: GoogleStoredCreds = {
      developerToken, clientId, clientSecret, refreshToken, customerId,
      loginCustomerId: loginCustomerId || null,
    }
    await setStoredCreds(PROVIDER, creds as unknown as Record<string, unknown>, auth.user.email)
    return NextResponse.json({ ok: true, customerId })
  } catch {
    return NextResponse.json({ error: 'Could not reach Google to validate the credentials' }, { status: 502 })
  }
}

export async function DELETE() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res
  await clearStoredCreds(PROVIDER)
  return NextResponse.json({ ok: true })
}
