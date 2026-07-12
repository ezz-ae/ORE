import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { isMetaConfigured, searchInterests, searchBehaviors, MetaApiError } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET ?q=expat&kind=behavior — Meta's LIVE targeting vocabulary with real
// audience-size bands. Never a hardcoded id, never an invented segment.
// kind: interest | behavior | demographic | life_event
export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const kind = (searchParams.get('kind') ?? 'interest').trim()

  if (!(await isMetaConfigured())) {
    return NextResponse.json({ connected: false, entries: [] })
  }
  if (kind === 'interest' && !q) {
    return NextResponse.json({ connected: true, entries: [] })
  }

  try {
    const entries =
      kind === 'behavior' ? await searchBehaviors(q, 'behaviors')
      : kind === 'demographic' ? await searchBehaviors(q, 'demographics')
      : kind === 'life_event' ? await searchBehaviors(q, 'life_events')
      : await searchInterests(q)
    return NextResponse.json({ connected: true, entries })
  } catch (error) {
    if (error instanceof MetaApiError) {
      return NextResponse.json({ connected: true, entries: [], error: error.message }, { status: 502 })
    }
    return NextResponse.json({ connected: true, entries: [], error: 'Vocabulary search failed' }, { status: 500 })
  }
}
