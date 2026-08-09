/**
 * Did a campaign's money go where it was pointed?
 *
 * READ ONLY, and deliberately narrow. It reports WHERE impressions were served
 * and what they cost, against the countries the campaign targeted. That is a
 * delivery fact of the same kind as the placement audit.
 *
 * It is not a statement about who anyone is. Meta's `country` breakdown is the
 * location an ad was shown in — not a nationality — and nothing downstream may
 * read it as one.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getCampaignInsightsByCountry, listAdSets } from '@/lib/meta/client'
import { checkGeoDelivery } from '@/lib/freehold/geo-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const campaignId = req.nextUrl.searchParams.get('campaignId')?.trim()
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

  try {
    // What was ASKED FOR comes from the live ad sets, not from the browser: a
    // comparison is only worth anything if both halves are read from Meta.
    const [rows, adSets] = await Promise.all([
      getCampaignInsightsByCountry(campaignId),
      listAdSets(campaignId).catch(() => []),
    ])
    const targeted = [...new Set(adSets.flatMap((a) => {
      const geo = (a.targeting as { geo_locations?: { countries?: unknown } } | undefined)?.geo_locations
      return Array.isArray(geo?.countries) ? (geo!.countries as unknown[]).map(String) : []
    }))]

    return NextResponse.json({
      // An empty breakdown is not evidence that delivery was clean — say which
      // it is rather than letting a blank panel read as "all fine".
      available: rows.length > 0,
      targeted,
      rows,
      findings: checkGeoDelivery({ targeted, rows }),
    })
  } catch {
    return NextResponse.json({ available: false, targeted: [], rows: [], findings: [] })
  }
}
