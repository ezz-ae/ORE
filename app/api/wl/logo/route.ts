/**
 * Serve the current workspace's uploaded logo (from the DB row), so the brand
 * mark never has to travel inside the cookie. Reads the signed wl_workspace
 * cookie for the workspace id.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { WHITE_LABEL, WL_SESSION_COOKIE } from '@/lib/whitelabel/config'
import { verifyWorkspace } from '@/lib/whitelabel/session'
import { getWorkspace } from '@/lib/whitelabel/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!WHITE_LABEL) return new NextResponse(null, { status: 404 })
  const brand = verifyWorkspace((await cookies()).get(WL_SESSION_COOKIE)?.value)
  if (!brand) return new NextResponse(null, { status: 404 })

  const ws = await getWorkspace(brand.id).catch(() => null)
  const logo = ws?.logo
  if (!logo || !logo.startsWith('data:image/')) return new NextResponse(null, { status: 404 })

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
