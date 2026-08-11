/**
 * HOW MANY LEADS, AND HOW MANY RATED — for every campaign, in one call.
 *
 * The live screen needs this to say the cheapest true thing in the product:
 * "2 leads, none rated". Rating a lead is what teaches Meta who to find next;
 * unrated, the optimiser keeps buying whoever it found first. That line could
 * not be said on the list screen because the quality read was per campaign.
 *
 * THE CAMPAIGN LIST IS READ SERVER-SIDE, deliberately. The browser never sends
 * ids: it would then be able to ask about any campaign string it liked, and
 * this endpoint reads a lead table. What it can ask for is "the campaigns this
 * account has", which is what listCampaigns already answers.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCampaigns, isMetaConfigured } from '@/lib/meta/client'
import { getLeadCountsForCampaigns } from '@/lib/freehold/campaign-quality'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (!(await isMetaConfigured())) return NextResponse.json({ counts: {} })

  const campaigns = await listCampaigns().catch(() => [])
  const map = await getLeadCountsForCampaigns(
    campaigns.map((c) => ({ id: String(c.id), name: String(c.name ?? '') })),
  )
  // A campaign present with zeros is a MEASUREMENT of zero; a campaign absent
  // from this object has not been counted. The live screen renders those
  // differently on purpose — see live-signals' ratedLeads: number | null.
  return NextResponse.json({ counts: Object.fromEntries(map) })
}
