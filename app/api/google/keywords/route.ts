import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listKeywords, listNegativeKeywords } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type GoogleKeyword, type GoogleKeywordMatchType } from '@/lib/google/types'
import { demoKeywords, demoNegativeKeywords } from '@/lib/google/demo-data'
import { listLocalEntities, createLocalEntity, removeLocalEntity, localId } from '@/lib/google/local-store'

const KIND = 'keyword'

export async function GET(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId') ?? undefined
    const includeNegatives = searchParams.get('negatives') === 'true'

    const [keywords, negatives] = await Promise.all([
      listKeywords(campaignId),
      includeNegatives ? listNegativeKeywords(campaignId) : Promise.resolve([]),
    ])

    return NextResponse.json({ keywords, negatives })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → merge locally-added keywords ahead of the demo set.
      const local = await listLocalEntities<GoogleKeyword>(KIND)
      return NextResponse.json({ keywords: [...local, ...demoKeywords], negatives: demoNegativeKeywords, demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// Add a keyword. (Local persistence — the Google Ads mutation client isn't wired
// yet; when it is, this branches on configuration like the campaign routes.)
export async function POST(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const body = await req.json().catch(() => null) as { text?: string; matchType?: GoogleKeywordMatchType; campaignId?: string } | null
  const text = body?.text?.trim()
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
  const matchType: GoogleKeywordMatchType = body?.matchType === 'EXACT' || body?.matchType === 'PHRASE' ? body.matchType : 'BROAD'
  const id = localId('kw')
  const keyword: GoogleKeyword = {
    id,
    resourceName: `customers/local/keywords/${id}`,
    adGroupId: 'local',
    campaignId: body?.campaignId || 'local',
    text,
    matchType,
    status: 'ENABLED',
    qualityScore: undefined,
    metrics: { impressions: 0, clicks: 0, costMicros: 0, ctr: 0, averageCpcMicros: 0, conversions: 0 },
  }
  await createLocalEntity(KIND, keyword)
  return NextResponse.json({ keyword, demo: true }, { status: 201 })
}

export async function DELETE(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  await removeLocalEntity(KIND, id)
  return NextResponse.json({ ok: true })
}
