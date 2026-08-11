import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCampaigns, getAccountCampaignInsights } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { listLocalCampaigns } from '@/lib/meta/local-store'

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const campaigns = await listCampaigns()

    // EVERY CAMPAIGN'S NUMBERS, AT THE SAME WINDOW THE CAMPAIGN PAGE USES.
    //
    // This route used to fetch insights per campaign and ONLY when the status
    // was ACTIVE, over the rolling 30 days. Two faults, and together they
    // produced a home screen that read:
    //
    //   cash offer new audiences   AED 204 · 1 lead      ← rolling window
    //   every other campaign       AED 0   · 0 leads     ← never asked
    //
    // while the campaign page for the same account, same minute, showed
    // AED 501 and 2 leads. A paused campaign that spent real money and brought
    // real leads printed zero because nothing asked, and the one campaign that
    // was asked got a different question than the detail screen asks.
    //
    // The account-level insights edge answers for all of them in ONE call at
    // the lifetime window — see lib/meta/insights-window.ts for why a list is
    // a report rather than a judgement, and why a report must never go down.
    const byCampaign = await getAccountCampaignInsights()
    const withInsights = campaigns.map((c) => ({
      ...c,
      // Absent means never delivered — null, not a zeroed row. Zero spend is a
      // measurement; this is the absence of one, and the screens already know
      // how to print the difference.
      insights: byCampaign.get(c.id) ?? null,
    }))

    return NextResponse.json({ campaigns: withInsights })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      // Not connected → serve the local store (seeded from demo + any
      // campaigns launched in-app), so the list stays interactive.
      return NextResponse.json({ campaigns: await listLocalCampaigns(), demo: true })
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
