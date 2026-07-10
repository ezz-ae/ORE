import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getAdPreviews, getAdEngagement, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Real rendered previews + live post engagement for a single ad. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ adId: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { adId } = await params
  try {
    const [previews, engagement] = await Promise.all([
      getAdPreviews(adId),
      getAdEngagement(adId).catch(() => null), // engagement is best-effort; a preview is still useful
    ])
    return NextResponse.json({ previews, engagement })
  } catch (err) {
    if (err instanceof MetaConfigError) return NextResponse.json({ previews: [], engagement: null, demo: true })
    if (err instanceof MetaApiError) return NextResponse.json({ error: err.message }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
