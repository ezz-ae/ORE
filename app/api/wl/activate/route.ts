/**
 * Redeem an access key into a branded workspace and enter the system.
 *
 * On success we set two cookies:
 *   • wl_workspace — the signed brand snapshot the BrandProvider paints from;
 *   • fh_session   — a demo platform session (CEO) so the prospect immediately
 *     sees the full system, populated with the shared demo dataset.
 *
 * The logo travels as a data: URL in the body; the client downscales it first,
 * and we hard-reject anything over the cap so the DB row stays small.
 */
import { NextRequest, NextResponse } from 'next/server'
import { WHITE_LABEL, WL_SESSION_COOKIE, WL_SESSION_TTL_MS, WL_LOGO_MAX_BYTES } from '@/lib/whitelabel/config'
import { redeemKey } from '@/lib/whitelabel/store'
import { signWorkspace } from '@/lib/whitelabel/session'
import { signSession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import type { SessionUser } from '@/lib/freehold/session-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REASON_MESSAGE: Record<string, string> = {
  not_found: 'That key was not recognised. Check it and try again.',
  revoked: 'That key has been revoked.',
  expired: 'That key has expired.',
  already_used: 'That key has already been used to create a workspace.',
}

/** Decoded byte length of a base64 data: URL payload. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return 0
  const b64 = dataUrl.slice(comma + 1)
  return Math.floor((b64.length * 3) / 4)
}

export async function POST(req: NextRequest) {
  if (!WHITE_LABEL) return NextResponse.json({ error: 'Not available.' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as {
    key?: string; company?: string; product?: string; accent?: string; logo?: string
  }
  const key = String(body.key ?? '').trim()
  const company = String(body.company ?? '').trim()
  const product = String(body.product ?? 'Intelligence').trim()
  const accent = String(body.accent ?? '').trim()
  const logo = String(body.logo ?? '')

  if (!key) return NextResponse.json({ error: 'Enter your access key.' }, { status: 400 })
  if (!company) return NextResponse.json({ error: 'Enter your brand name.' }, { status: 400 })
  if (logo && (!logo.startsWith('data:image/') || dataUrlBytes(logo) > WL_LOGO_MAX_BYTES)) {
    return NextResponse.json({ error: 'Logo is too large — use a smaller image.' }, { status: 400 })
  }

  const result = await redeemKey(key, { company, product, accent, logo }).catch(() => null)
  if (!result) return NextResponse.json({ error: 'Could not reach the workspace store. Try again.' }, { status: 502 })
  if (!result.ok) {
    return NextResponse.json({ error: REASON_MESSAGE[result.reason] ?? 'That key cannot be used.' }, { status: 400 })
  }

  const ws = result.workspace
  const home = '/freehold-intelligence'

  const res = NextResponse.json({ ok: true, home })

  // Brand snapshot (small — the logo is served separately from the DB row).
  const wlToken = signWorkspace({
    id: ws.id,
    company: ws.company,
    product: ws.product,
    accent: ws.accent,
    logo: ws.logo ? '/api/wl/logo' : '',
  })
  res.cookies.set(WL_SESSION_COOKIE, wlToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WL_SESSION_TTL_MS / 1000,
  })

  // Demo platform session so they land inside the full system as an owner.
  const initials = ws.company.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || 'WS'
  const demoUser: SessionUser = {
    email: `owner@${ws.id.slice(0, 8)}.demo`,
    name: `${ws.company} Owner`,
    initials,
    role: 'ceo',
    home,
  }
  try {
    const fhToken = await signSession(demoUser, WL_SESSION_TTL_MS)
    res.cookies.set(SESSION_COOKIE, fhToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: WL_SESSION_TTL_MS / 1000,
    })
  } catch {
    return NextResponse.json({ error: 'Could not start a session.' }, { status: 500 })
  }

  return res
}
