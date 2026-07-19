import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import {
  listKeywords,
  listNegativeKeywords,
  listAdGroups,
  addKeywords,
  removeKeyword,
  googleConfiguredAsync,
} from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type GoogleKeyword, type GoogleKeywordMatchType } from '@/lib/google/types'
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
      // Not connected → only the user's own locally-created keywords (no demo).
      const local = await listLocalEntities<GoogleKeyword>(KIND)
      return NextResponse.json({ keywords: local, negatives: [], demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// Add a keyword. When Google Ads is connected AND the target campaign is a
// real one, this is a LIVE mutation: the keyword is created in the campaign's
// first ad group. Local drafts (local-* campaigns) or a not-connected account
// keep the local persistence path, flagged demo:true.
export async function POST(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const body = await req.json().catch(() => null) as { text?: string; matchType?: GoogleKeywordMatchType; campaignId?: string } | null
  const text = body?.text?.trim()
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
  const matchType: GoogleKeywordMatchType = body?.matchType === 'EXACT' || body?.matchType === 'PHRASE' ? body.matchType : 'BROAD'
  const campaignId = body?.campaignId?.trim() || ''

  const liveTarget = campaignId && !campaignId.startsWith('local-') && await googleConfiguredAsync()
  if (liveTarget) {
    try {
      // Live mutation — keywords hang off ad groups, so attach to the
      // campaign's first ad group; honest error if the campaign has none.
      const adGroups = await listAdGroups(campaignId)
      const adGroup = adGroups[0]
      if (!adGroup) {
        return NextResponse.json(
          { error: 'This campaign has no ad groups yet — create one in Google Ads before adding keywords.' },
          { status: 409 },
        )
      }
      const [resourceName] = await addKeywords(adGroup.id, [{ text, matchType }])
      const keyword: GoogleKeyword = {
        id: resourceName?.split('~').pop() ?? '',
        resourceName: resourceName ?? '',
        adGroupId: adGroup.id,
        campaignId,
        text,
        matchType,
        status: 'ENABLED',
        metrics: { impressions: 0, clicks: 0, costMicros: 0, ctr: 0, averageCpcMicros: 0, conversions: 0 },
      }
      return NextResponse.json({ keyword }, { status: 201 })
    } catch (e) {
      if (e instanceof GoogleApiError) {
        return NextResponse.json({ error: e.message }, { status: e.status })
      }
      return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
    }
  }

  // Local path — not connected, or the keyword targets a local draft campaign.
  const id = localId('kw')
  const keyword: GoogleKeyword = {
    id,
    resourceName: `customers/local/keywords/${id}`,
    adGroupId: 'local',
    campaignId: campaignId || 'local',
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
  const resourceName = searchParams.get('resourceName')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Locally-created keywords are removed from the local store.
  if (id.startsWith('local-')) {
    await removeLocalEntity(KIND, id)
    return NextResponse.json({ ok: true })
  }

  // Real keywords require the criterion resource name and a live connection.
  if (!resourceName) {
    return NextResponse.json({ error: 'resourceName is required to remove a live keyword' }, { status: 400 })
  }
  try {
    await removeKeyword(resourceName)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ error: 'Google Ads is not connected' }, { status: 503 })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
