/**
 * Claim endpoint — the tenant-host half of self-serve signup. PUBLIC by
 * prefix, self-defending: it only accepts a short-lived HMAC session token
 * (verifySession — same key and expiry rules as every platform session) and
 * only when the token's tenant claim matches THIS host's subdomain. It then
 * mints the real host-only session cookie and lands the owner on their home.
 *
 * Replay window equals the token TTL (2 minutes) on the one host it names —
 * the cookie it mints is no more powerful than the token itself.
 */
import { NextRequest, NextResponse } from 'next/server'
import { SAAS_TENANCY, tenantSubdomainFromHost } from '@/lib/tenancy/config'
import { signSession, verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  if (!SAAS_TENANCY) return new NextResponse(null, { status: 404 })

  const fallback = req.nextUrl.clone()
  fallback.pathname = '/server'
  fallback.search = ''

  const user = await verifySession(req.nextUrl.searchParams.get('token'))
  const hostTenant = tenantSubdomainFromHost(req.headers.get('host'))
  if (!user || !user.tenant || !hostTenant || user.tenant !== hostTenant) {
    // Invalid, expired, or aimed at another tenant — fall back to the
    // (tenant-branded) sign-in screen rather than erroring.
    return NextResponse.redirect(fallback)
  }

  const home = req.nextUrl.clone()
  home.pathname = user.home || '/freehold-intelligence'
  home.search = ''

  const res = NextResponse.redirect(home)
  res.cookies.set(SESSION_COOKIE, await signSession(user, SESSION_TTL_MS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  return res
}
