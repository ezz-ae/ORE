/**
 * WHAT THIS CAMPAIGN ACTUALLY BOUGHT — and how it stands against the others.
 *
 * The campaign page shows spend, delivery, placements, leads and a quality
 * score. All of it stops at the lead. `deal_value_aed` has been in the CRM the
 * whole time, read by the seed builder and by nothing that decides where an
 * advertising dirham goes.
 *
 * So this route assembles the ladder — spend → leads → qualified → deals →
 * money — for this campaign AND its siblings, because a cost per deal with
 * nothing to compare it against is a number, not an answer.
 *
 * The judgement is pure and lives in lib/freehold/money-truth.ts: which rung
 * this campaign has had TIME to be judged on, and whether the gap to its
 * siblings is real or noise. This route only fetches.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCampaigns, getAccountCampaignInsights, isMetaConfigured } from '@/lib/meta/client'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import { accountMoneyBasis } from '@/lib/freehold/money-truth-db'
import { moneyStandings, countOn, type CampaignMoney } from '@/lib/freehold/money-truth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Most sibling campaigns to read.
 *
 * One insights call and one CRM read each, so this is a real cost. Twelve is
 * more than this account runs at once; past that the panel reports the cap
 * rather than describing a subset as though it were the whole field.
 */
const MAX_SIBLINGS = 12

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  if (!(await isMetaConfigured())) return NextResponse.json({ connected: false })

  try {
    const all = await listCampaigns()
    // This campaign first, so it is never the one dropped by the cap.
    const ordered = [
      ...all.filter((c) => c.id === id),
      ...all.filter((c) => c.id !== id),
    ]
    const capped = Math.max(0, ordered.length - MAX_SIBLINGS)
    const chosen = ordered.slice(0, MAX_SIBLINGS)

    // THE LIFETIME WINDOW, not the rolling one. Cost per deal is a REPORT —
    // "what did this campaign cost per deal" is a question about its whole
    // life, and the CRM side of the ladder has no 30-day filter either.
    // Dividing rolling spend into lifetime leads would understate every cost
    // on this panel. See lib/meta/insights-window.ts.
    const [basis, insightsById] = await Promise.all([
      accountMoneyBasis(),
      getAccountCampaignInsights(),
    ])

    const rows = await Promise.all(chosen.map(async (c): Promise<CampaignMoney & { name: string }> => {
      const quality = await getCampaignQuality(c.id, c.name ?? '').catch(() => null)
      const created = c.created_time ? Date.parse(c.created_time) : NaN
      return {
        campaignId: c.id,
        name: c.name ?? c.id,
        spendAed: Number(insightsById.get(c.id)?.spend ?? 0) || 0,
        // The CRM-attributed count, always. The rungs below a lead are CRM
        // facts, and dividing Meta-reported leads into CRM-qualified ones
        // would be counting two different populations.
        leads: quality?.attributed ?? 0,
        qualified: quality?.qualified ?? 0,
        deals: quality?.won ?? 0,
        revenueAed: quality?.revenueAed ?? 0,
        ageDays: Number.isFinite(created) ? Math.max(0, (Date.now() - created) / 86_400_000) : 0,
      }
    }))

    const standings = moneyStandings(rows, basis.cycle, basis.medianDealAed)
    const byId = new Map(rows.map((r) => [r.campaignId, r]))
    const nameOf = (cid: string) => byId.get(cid)?.name ?? cid

    return NextResponse.json({
      connected: true,
      capped,
      cycle: basis.cycle,
      medianDealAed: basis.medianDealAed,
      closedDeals: basis.closedDeals,
      rows: standings.map((s) => {
        const m = byId.get(s.campaignId) as CampaignMoney & { name: string }
        return {
          campaignId: s.campaignId,
          name: m.name,
          isThis: s.campaignId === id,
          spendAed: m.spendAed,
          leads: m.leads,
          qualified: m.qualified,
          deals: m.deals,
          revenueAed: m.revenueAed,
          ageDays: Math.round(m.ageDays),
          rung: s.rung,
          // The count on the rung it is being judged on — the number the
          // sentence is actually about.
          count: countOn(m, s.rung),
          cost: { lo: s.cost.lo, hi: Number.isFinite(s.cost.hi) ? s.cost.hi : null },
          returnPerDirham: s.returnPerDirham
            ? { lo: s.returnPerDirham.lo, hi: Number.isFinite(s.returnPerDirham.hi) ? s.returnPerDirham.hi : null }
            : null,
          verdict: s.verdict,
          p: s.p,
          // Names, not ids: a badge that says "beats 2" is a badge nobody can
          // check.
          beats: s.beats.map(nameOf),
          beatenBy: s.beatenBy.map(nameOf),
        }
      }),
    })
  } catch (e) {
    return NextResponse.json(
      { connected: true, error: e instanceof Error ? e.message : 'Meta would not return the campaigns' },
      { status: 502 },
    )
  }
}
