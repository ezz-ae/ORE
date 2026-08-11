import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getCampaign, getCampaignInsights, getCampaignLifetimeInsights, listAdSets, listAds, updateCampaignStatus, deleteCampaign } from '@/lib/meta/client'
import { metaLeadCount } from '@/lib/meta/lead-count'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { getLocalCampaign, updateLocalCampaignStatus } from '@/lib/meta/local-store'
import { authorizeDelete } from '@/lib/freehold/authority-db'
import { statusForDenial } from '@/lib/freehold/authority'
import type { MetaCampaignStatus } from '@/lib/meta/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const { id } = await params
    // TWO WINDOWS, ON PURPOSE.
    //
    // `insights` is a rolling 30 days — the right read for judging a LIVE
    // campaign, and what the frequency and placement panels compare against.
    //
    // `lifetime` is everything it ever did. A rolling window drains after a
    // campaign is switched off: thirty days past the last lead it reads zero,
    // as though the campaign never ran. "How many leads did this bring?" is a
    // question about the whole life of the campaign, and its answer must never
    // go down.
    const [campaign, insights, lifetime, adSets] = await Promise.all([
      getCampaign(id),
      getCampaignInsights(id),
      getCampaignLifetimeInsights(id),
      listAdSets(id),
    ])

    // Ads AND each ad set's OWN numbers.
    //
    // The per-ad-set insights are what make a comparison possible, and a
    // comparison is the only way the most expensive finding in this product
    // becomes visible: a campaign whose two ad sets buy impressions at AED 15
    // and AED 163 reads as one blended "AED 250 per lead" — a figure that
    // describes neither of them and sends the operator to fix the wrong
    // thing. Fetched here rather than derived, because a campaign total
    // cannot be un-averaged afterwards.
    const adSetsWithAds = await Promise.all(
      adSets.map(async (adSet) => {
        const [ads, ins] = await Promise.all([
          listAds(adSet.id),
          getCampaignInsights(adSet.id).catch(() => null),
        ])
        return {
          ...adSet,
          ads,
          spendAED: Number(ins?.spend) || 0,
          impressions: Number(ins?.impressions) || 0,
          clicks: Number(ins?.clicks) || 0,
          leads: metaLeadCount(ins?.actions),
        }
      }),
    )

    return NextResponse.json({ campaign, insights, lifetime, adSets: adSetsWithAds })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      // Not connected → read the local store so demo/in-app campaigns open.
      const { id } = await params
      const campaign = await getLocalCampaign(id)
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      const { insights = null, ...rest } = campaign
      return NextResponse.json({ campaign: rest, insights, adSets: [], demo: true })
    }
    if (err instanceof MetaApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, type: err.type },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { status?: MetaCampaignStatus }
  const status = body.status as MetaCampaignStatus

  if (!['ACTIVE', 'PAUSED', 'DELETED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    if (status === 'DELETED') {
      // Deleting a campaign is the owner's call alone. A team leader "can see
      // all the campaigns and work with them on it but doesnt own camapigns" —
      // pausing, editing and re-targeting stay open to them below; destroying
      // one does not. The attempt is logged either way.
      const decision = await authorizeDelete('campaign', id, {
        email: __auth.user.email, role: __auth.user.role,
      })
      if (!decision.allowed) {
        return NextResponse.json(
          { error: 'Only the account owner can delete a campaign. Pause it instead.', reason: decision.reason },
          { status: statusForDenial(decision) },
        )
      }
      const result = await deleteCampaign(id)
      return NextResponse.json(result)
    }

    const result = await updateCampaignStatus(id, status)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MetaConfigError) {
      // Not connected → toggle status in the local store.
      const ok = await updateLocalCampaignStatus(id, status)
      return NextResponse.json({ success: ok, id, status, demo: true })
    }
    if (err instanceof MetaApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, type: err.type },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
