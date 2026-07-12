import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import type { Role } from '@/lib/freehold/session-types'
import { getGlobalPixels, saveGlobalPixels } from '@/lib/freehold/tracking-pixels'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

// GET — the global tracking pixels applied to every landing page.
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  return NextResponse.json({ pixels: await getGlobalPixels() })
}

// PUT — set them once (management + marketing).
export async function PUT(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  await saveGlobalPixels(
    {
      metaPixelId: String(body.metaPixelId ?? ''),
      googleTagId: String(body.googleTagId ?? ''),
      googleConversionId: String(body.googleConversionId ?? ''),
      tiktokPixelId: String(body.tiktokPixelId ?? ''),
    },
    auth.user.email,
  )
  return NextResponse.json({ pixels: await getGlobalPixels() })
}
