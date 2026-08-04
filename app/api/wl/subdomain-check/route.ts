/**
 * Live subdomain availability for the signup form. PUBLIC by prefix,
 * self-defending: alive only with tenancy enabled and rate-limited per IP
 * via checkRateLimit (it is a cheap indexed lookup, but no free enumeration
 * either). Availability is advisory — createTenant re-checks atomically.
 */
import { NextRequest, NextResponse } from 'next/server'
import { SAAS_TENANCY } from '@/lib/tenancy/config'
import { subdomainUnavailableReason } from '@/lib/tenancy/store'
import { checkRateLimit } from '@/lib/freehold/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!SAAS_TENANCY) return NextResponse.json({ error: 'not_available' }, { status: 404 })

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  const limit = await checkRateLimit(`wl-subcheck:${ip}`, { limit: 60, windowSec: 60 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  const sub = (req.nextUrl.searchParams.get('sub') || '').trim().toLowerCase()
  if (!sub) return NextResponse.json({ error: 'sub_required' }, { status: 400 })

  const reason = await subdomainUnavailableReason(sub).catch(() => null)
  return NextResponse.json({ sub, available: reason === null, reason })
}
