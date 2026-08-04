/**
 * Serve the current workspace's uploaded logo, so the brand mark never has to
 * travel inside a cookie or the layout HTML.
 *
 * Resolution order mirrors the BrandProvider: a SaaS tenant host serves that
 * tenant's stored logo (no cookie involved — the host IS the identity); the
 * WL demo serves the workspace row named by the signed wl_workspace cookie.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { WHITE_LABEL, WL_SESSION_COOKIE } from '@/lib/whitelabel/config'
import { verifyWorkspace } from '@/lib/whitelabel/session'
import { getWorkspace } from '@/lib/whitelabel/store'
import { getTenantForRequestHost } from '@/lib/tenancy/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function serveDataUrlImage(logo: string): NextResponse {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(logo)
  if (!match) return new NextResponse(null, { status: 404 })
  const [, mime, b64] = match
  const bytes = Buffer.from(b64, 'base64')

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

export async function GET() {
  // SaaS tenant host — the tenant row's logo.
  const tenant = await getTenantForRequestHost().catch(() => null)
  if (tenant?.logo?.startsWith('data:image/')) return serveDataUrlImage(tenant.logo)

  // WL demo — the workspace row named by the signed cookie.
  if (!WHITE_LABEL) return new NextResponse(null, { status: 404 })
  const brand = verifyWorkspace((await cookies()).get(WL_SESSION_COOKIE)?.value)
  if (!brand) return new NextResponse(null, { status: 404 })

  const ws = await getWorkspace(brand.id).catch(() => null)
  const logo = ws?.logo
  if (!logo || !logo.startsWith('data:image/')) return new NextResponse(null, { status: 404 })
  return serveDataUrlImage(logo)
}
