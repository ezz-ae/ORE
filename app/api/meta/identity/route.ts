import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getAdIdentity, listAccessiblePages, isMetaConfigured } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Whose profile the ad appears under — the Facebook Page and the Instagram
 * account it runs as. Optional ?pageId= to ask about a Page other than the
 * configured one, so a form's own Page can be identified.
 *
 * Not connected ⇒ honest nulls rather than an error: the launcher must still
 * open.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (!(await isMetaConfigured())) {
    return NextResponse.json({ connected: false, identity: null, pages: [] })
  }
  const pageId = req.nextUrl.searchParams.get('pageId') || undefined
  const [identity, pages] = await Promise.all([
    getAdIdentity(pageId),
    listAccessiblePages().catch(() => []),
  ])
  return NextResponse.json({
    connected: true,
    identity,
    // Names only — a Page access token must never leave the server.
    pages: pages.map((p) => ({ id: p.id, name: p.name })),
  })
}
