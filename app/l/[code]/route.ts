import { NextRequest, NextResponse } from 'next/server'
import { resolveShortLink } from '@/lib/freehold/short-links'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * fhp.ae/l/{code} → the real target, counting the click. An unknown code sends
 * the visitor to the site home rather than a dead 404 — a short link that was
 * printed on an ad should never strand someone.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const target = code ? await resolveShortLink(code) : null
  return NextResponse.redirect(target || getSiteUrl(), 307)
}
