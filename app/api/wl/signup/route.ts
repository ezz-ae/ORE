/**
 * Self-serve trial signup — PUBLIC on purpose (the /api/wl/ prefix is
 * allowlisted), so it must defend itself: alive only when tenancy is enabled,
 * strict input validation, and DB-backed rate limits (per-IP and global) via
 * checkRateLimit so a scripted loop cannot mass-provision schemas.
 *
 * On success the browser is redirected to /api/wl/claim ON THE NEW TENANT
 * HOST with a short-lived HMAC token — that is where the real session cookie
 * is set (cookies are host-only; one minted here would never reach the
 * subdomain).
 */
import { NextRequest, NextResponse } from 'next/server'
import { SAAS_TENANCY, TENANT_BASE_DOMAIN } from '@/lib/tenancy/config'
import { TENANT_LOGO_MAX_BYTES } from '@/lib/tenancy/store'
import { signupTenant } from '@/lib/tenancy/onboard'
import { checkRateLimit } from '@/lib/freehold/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REASON_KEY: Record<string, string> = {
  invalid_subdomain: 'invalid_subdomain',
  reserved: 'reserved',
  taken: 'taken',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Decoded byte length of a base64 data: URL payload. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  return Math.floor(((dataUrl.length - comma - 1) * 3) / 4)
}

export async function POST(req: NextRequest) {
  if (!SAAS_TENANCY) return NextResponse.json({ error: 'not_available' }, { status: 404 })

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  const [perIp, global] = await Promise.all([
    checkRateLimit(`wl-signup:${ip}`, { limit: 5, windowSec: 3600 }),
    checkRateLimit('wl-signup:global', { limit: 50, windowSec: 3600 }),
  ])
  if (!perIp.ok || !global.ok) {
    const retry = Math.max(perIp.retryAfterSec, global.retryAfterSec)
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    )
  }

  const body = (await req.json().catch(() => ({}))) as {
    subdomain?: string; company?: string; product?: string; accent?: string; logo?: string
    adminName?: string; adminEmail?: string; password?: string
  }
  const subdomain = String(body.subdomain ?? '').trim().toLowerCase()
  const company = String(body.company ?? '').trim()
  const adminName = String(body.adminName ?? '').trim()
  const adminEmail = String(body.adminEmail ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const logo = String(body.logo ?? '')

  if (!subdomain) return NextResponse.json({ error: 'subdomain_required' }, { status: 400 })
  if (!company) return NextResponse.json({ error: 'company_required' }, { status: 400 })
  if (!EMAIL_RE.test(adminEmail)) return NextResponse.json({ error: 'email_invalid' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'password_short' }, { status: 400 })
  if (logo && (!logo.startsWith('data:image/') || dataUrlBytes(logo) > TENANT_LOGO_MAX_BYTES)) {
    return NextResponse.json({ error: 'logo_too_large' }, { status: 400 })
  }

  const result = await signupTenant({
    subdomain,
    company,
    product: body.product ? String(body.product) : undefined,
    accent: body.accent ? String(body.accent) : undefined,
    logo,
    adminName,
    adminEmail,
    password,
  }).catch(() => null)

  if (!result) return NextResponse.json({ error: 'store_unreachable' }, { status: 502 })
  if (!result.ok) return NextResponse.json({ error: REASON_KEY[result.reason] ?? 'failed' }, { status: 400 })

  // Land them on THEIR host. Preserve the request's port for local dev
  // ({sub}.localhost:3000); TENANT_BASE_DOMAIN itself never carries a port.
  const reqHost = req.headers.get('host') || ''
  const port = reqHost.includes(':') ? `:${reqHost.split(':')[1]}` : ''
  const proto = req.nextUrl.protocol // "https:" in production
  const redirect = `${proto}//${result.tenant.subdomain}.${TENANT_BASE_DOMAIN}${port}/api/wl/claim?token=${encodeURIComponent(result.claimToken)}`

  return NextResponse.json({ ok: true, redirect })
}
