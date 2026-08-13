/**
 * THE WHOLE CAP, SPLIT ON PURPOSE.
 *
 * The machine moves budget one decision at a time — pause a loser, raise a
 * winner into idle headroom. Nothing ever asked the portfolio question: given
 * this cap and these campaigns, what should each be running at tomorrow?
 *
 * The judgement is pure and lives in lib/freehold/budget-split.ts. This route
 * assembles its four inputs, every one of which was already being computed and
 * read by nothing that sets a budget:
 *
 *   · the money standing        money-truth.ts, over the CRM funnel
 *   · saturation                lookalike-ladder.ts, over Meta frequency/reach
 *   · the price of a lead       what decides how many arms the cap carries
 *   · the current budgets       from the ad sets that actually hold them
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import {
  listCampaigns, listAdSets, getAccountCampaignInsights, isMetaConfigured,
} from '@/lib/meta/client'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import { accountMoneyBasis } from '@/lib/freehold/money-truth-db'
import { moneyStandings, type CampaignMoney } from '@/lib/freehold/money-truth'
import { assessTier } from '@/lib/freehold/lookalike-ladder'
import { splitBudget, type SplitRow } from '@/lib/freehold/budget-split'
import { listMachines } from '@/lib/freehold/ads-machine'
import { deliveryOf, isSpending } from '@/lib/meta/delivery-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Most campaigns to plan for. One CRM read and one ad-set read each. */
const MAX_CAMPAIGNS = 12

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (!(await isMetaConfigured())) return NextResponse.json({ connected: false })

  try {
    const all = await listCampaigns()
    // ONLY WHAT IS ACTUALLY SERVING. A paused campaign is not competing for
    // the cap, and including it would shrink everybody else's share to fund
    // something nobody is running. The SWITCH is not the state — read the
    // delivery, as every other screen in this product does.
    const live = all
      .filter((c) => isSpending(deliveryOf({
        effectiveStatus: c.effective_status, status: c.status,
      }).state))
      .slice(0, MAX_CAMPAIGNS)
    if (live.length === 0) {
      return NextResponse.json({ connected: true, live: 0, plans: [] })
    }

    const [basis, insightsById, capAed] = await Promise.all([
      accountMoneyBasis(),
      getAccountCampaignInsights(),
      // THE STATED CEILING, from the machines that are actually running. A
      // stopped machine's cap is not money in play, and counting it would
      // hand out budget nothing is authorised to spend.
      listMachines()
        .then((ms) => {
          const running = ms.filter((m) => m.status === 'running')
          return running.length > 0 ? running.reduce((n, m) => n + m.dailyCapAed, 0) : null
        })
        .catch(() => null),
    ])

    const detail = await Promise.all(live.map(async (c) => {
      const [quality, adSets] = await Promise.all([
        getCampaignQuality(c.id, c.name ?? '').catch(() => null),
        listAdSets(c.id).catch(() => []),
      ])
      const ins = insightsById.get(c.id)
      const created = c.created_time ? Date.parse(c.created_time) : NaN
      // The budget lives on the ad sets, not on the campaign, so the campaign's
      // real daily spend cap is their sum.
      const dailyBudgetAed = adSets.reduce((n, s) => n + (Number(s.daily_budget) || 0) / 100, 0)

      // SATURATION — the marginal-return input. assessTier wants a reach at the
      // previous observation to measure growth; we do not store one, so growth
      // is unknown and the tier can only ever read 'hold' or 'too_early' on
      // that half. Frequency alone still carries the signal, and treating an
      // unknown as "not saturated" is the safe direction: it keeps an arm
      // eligible for money rather than quietly freezing it on a gap.
      const frequency = Number(ins?.frequency ?? 0) || 0
      const impressions = Number(ins?.impressions ?? 0) || 0
      const reach = Number(ins?.reach ?? 0) || 0
      const tier = assessTier({
        ratio: 0, impressions, reach, leads: quality?.attributed ?? 0,
        spend: Number(ins?.spend ?? 0) || 0, previousReach: null,
      })
      return {
        campaign: c,
        money: {
          campaignId: c.id,
          spendAed: Number(ins?.spend ?? 0) || 0,
          leads: quality?.attributed ?? 0,
          qualified: quality?.qualified ?? 0,
          deals: quality?.won ?? 0,
          revenueAed: quality?.revenueAed ?? 0,
          ageDays: Number.isFinite(created) ? Math.max(0, (Date.now() - created) / 86_400_000) : 0,
        } satisfies CampaignMoney,
        dailyBudgetAed,
        adSetIds: adSets.map((s) => s.id),
        frequency,
        saturated: tier.action === 'widen' || tier.action === 'stop',
      }
    }))

    const standings = moneyStandings(detail.map((d) => d.money), basis.cycle, basis.medianDealAed)
    const standingById = new Map(standings.map((s) => [s.campaignId, s]))

    // The price of a lead, pooled across the account — what decides how many
    // arms this cap can carry. Pooled rather than per campaign, because the
    // question is "what does a lead cost HERE", and one campaign's sample is
    // thinner than the account's.
    const totalSpend = detail.reduce((n, d) => n + d.money.spendAed, 0)
    const totalLeads = detail.reduce((n, d) => n + d.money.leads, 0)
    const costPerLeadAed = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : null

    const rows: SplitRow[] = detail.map((d) => ({
      campaignId: d.money.campaignId,
      dailyBudgetAed: d.dailyBudgetAed,
      standing: standingById.get(d.money.campaignId)?.verdict ?? 'tooEarly',
      saturated: d.saturated,
    }))

    // No cap configured ⇒ plan against what is already committed. That is the
    // honest read: with no stated ceiling, the money in play is the money in
    // play, and the split is about how to arrange it rather than how much.
    const cap = capAed ?? rows.reduce((n, r) => n + r.dailyBudgetAed, 0)
    const split = splitBudget(rows, { capAed: cap, costPerLeadAed })
    const detailById = new Map(detail.map((d) => [d.money.campaignId, d]))

    return NextResponse.json({
      connected: true,
      live: live.length,
      capAed: cap,
      capIsConfigured: capAed !== null,
      costPerLeadAed,
      perArmAed: split.perArmAed,
      supportedArms: split.supportedArms,
      tomorrowAed: split.tomorrowAed,
      overCapAed: split.overCapAed,
      plans: split.plans.map((p) => {
        const d = detailById.get(p.campaignId)
        return {
          ...p,
          name: d?.campaign.name ?? p.campaignId,
          currentAed: Math.round(d?.dailyBudgetAed ?? 0),
          saturated: d?.saturated ?? false,
          frequency: d?.frequency ?? 0,
          // The ad sets that actually hold the budget. One ⇒ the panel can
          // apply the change; several ⇒ it says so instead, because splitting
          // a campaign budget across ad sets is a different decision and not
          // one to make silently on somebody's behalf.
          adSetIds: d?.adSetIds ?? [],
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
