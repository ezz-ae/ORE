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
 *   · the audience weight       audience-weight.ts, over what each audience's
 *                               leads BECAME — the fifth input, and the only
 *                               one about WHO was bought rather than what it
 *                               cost. Absent on an account with no quality
 *                               signal yet, where every weight is neutral and
 *                               this route plans exactly as it always did.
 *
 * BOTH CHANNELS, and this one is not a reporting nicety. The Ads Machine's cap
 * is ONE combined figure covering Meta and Google (ads-machine-engine states
 * it). Splitting that cap across the Meta campaigns alone would hand Google's
 * share to Meta — the plan would fit the cap on paper and the account would
 * spend over it in fact.
 *
 * A Google campaign carries no reach or frequency, so it is never marked
 * saturated on evidence this product does not have; its budget also lives on
 * the campaign rather than on ad sets, so the panel plans it and does not
 * apply it. Saying which is better than a button that silently does nothing.
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
import { weighAudiences, weightFor } from '@/lib/freehold/audience-weight'
import { audienceOutcomes, campaignAudienceKeys } from '@/lib/freehold/audience-outcomes'
import { listMachines } from '@/lib/freehold/ads-machine'
import { deliveryOf, isSpending } from '@/lib/meta/delivery-status'
import {
  listCampaigns as listGoogleCampaigns, googleConfiguredAsync,
} from '@/lib/google/client'
import { googleDeliveryOf, isServing as googleIsServing } from '@/lib/google/delivery'

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
    // NOT an early return on "no live Meta campaigns". An account running
    // Google only would have been told it has nothing running, which is a
    // different and much louder claim than "this only looked at Meta".

    const [basis, insightsById, capAed, audienceRows, audienceOfCampaign] = await Promise.all([
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
      // BOTH BEST-EFFORT. These two reads add a preference to an allocation
      // that is already correct without them, so a database that will not
      // answer must degrade to the neutral split rather than fail the panel.
      audienceOutcomes().catch(() => []),
      campaignAudienceKeys().catch(() => new Map<string, { key: string; name: string }>()),
    ])

    // One weight per AUDIENCE, computed over the whole field before any
    // campaign is looked at — an audience is ranked against the other
    // audiences, not against the campaigns that happened to run it.
    const audienceWeights = weighAudiences(audienceRows.map((a) => ({
      key: a.key, leads: a.leads, qualified: a.qualified, won: a.won,
      // The rota's alibi. Without it an audience nobody called reads as an
      // audience nobody wants, and the budget answers the wrong question.
      medianResponseMinutes: a.medianResponseMinutes,
    })))
    const audienceRung = audienceWeights[0]?.rung ?? 'none'

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

    // ── The Google half of the same cap ────────────────────────────────
    const googleDetail = (await googleConfiguredAsync().catch(() => false))
      ? await (async () => {
          const gs = await listGoogleCampaigns('LAST_30_DAYS').catch(() => [])
          const live = gs.filter((g) => googleIsServing(googleDeliveryOf({
            primaryStatus: g.primaryStatus ?? null, reasons: g.primaryStatusReasons ?? [],
          }).state))
          return Promise.all(live.slice(0, MAX_CAMPAIGNS).map(async (g) => {
            const quality = await getCampaignQuality(g.id, g.name).catch(() => null)
            const created = g.startDate ? Date.parse(g.startDate) : NaN
            return {
              campaign: { id: g.id, name: g.name },
              money: {
                campaignId: g.id,
                spendAed: (g.metrics?.costMicros ?? 0) / 1_000_000,
                leads: quality?.attributed ?? 0,
                qualified: quality?.qualified ?? 0,
                deals: quality?.won ?? 0,
                revenueAed: quality?.revenueAed ?? 0,
                ageDays: Number.isFinite(created)
                  ? Math.max(0, (Date.now() - created) / 86_400_000) : 0,
              } satisfies CampaignMoney,
              dailyBudgetAed: (g.dailyBudgetMicros ?? 0) / 1_000_000,
              // Google budgets live on the campaign, not on ad sets. Empty
              // means the panel plans this row and does not offer to apply it.
              adSetIds: [] as string[],
              frequency: 0,
              // A search auction has no reach or frequency, so there is no
              // saturation evidence. Never claimed on a number we do not have.
              saturated: false,
              channel: 'google' as const,
            }
          }))
        })()
      : []

    const detailAll = [
      ...detail.map((d) => ({ ...d, channel: 'meta' as const })),
      ...googleDetail,
    ]

    const standings = moneyStandings(detailAll.map((d) => d.money), basis.cycle, basis.medianDealAed)
    const standingById = new Map(standings.map((s) => [s.campaignId, s]))

    // The price of a lead, pooled across the account — what decides how many
    // arms this cap can carry. Pooled rather than per campaign, because the
    // question is "what does a lead cost HERE", and one campaign's sample is
    // thinner than the account's.
    const totalSpend = detailAll.reduce((n, d) => n + d.money.spendAed, 0)
    const totalLeads = detailAll.reduce((n, d) => n + d.money.leads, 0)
    const costPerLeadAed = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : null

    const rows: SplitRow[] = detailAll.map((d) => ({
      campaignId: d.money.campaignId,
      dailyBudgetAed: d.dailyBudgetAed,
      standing: standingById.get(d.money.campaignId)?.verdict ?? 'tooEarly',
      saturated: d.saturated,
      // A campaign whose audience was never recorded — every Google campaign,
      // and every Meta one launched before the bookkeeping existed — resolves
      // to NEUTRAL_WEIGHT. An unknown audience is not a bad audience.
      audienceWeight: weightFor(
        audienceWeights,
        audienceOfCampaign.get(d.money.campaignId)?.key ?? null,
      ),
    }))

    // No cap configured ⇒ plan against what is already committed. That is the
    // honest read: with no stated ceiling, the money in play is the money in
    // play, and the split is about how to arrange it rather than how much.
    const cap = capAed ?? rows.reduce((n, r) => n + r.dailyBudgetAed, 0)
    const split = splitBudget(rows, { capAed: cap, costPerLeadAed })
    const detailById = new Map(detailAll.map((d) => [d.money.campaignId, d]))

    return NextResponse.json({
      connected: true,
      // BOTH CHANNELS. `live.length` was the Meta count, and the panel prints
      // it beside "you are running N" — a number that omitted Google would
      // have contradicted the rows underneath it on the same card.
      live: detailAll.length,
      capAed: cap,
      capIsConfigured: capAed !== null,
      costPerLeadAed,
      perArmAed: split.perArmAed,
      // What the audience ranking stood on, so the panel can say 'deals',
      // 'qualified leads' or nothing at all rather than implying a precision
      // the account has not earned yet.
      audienceRung,
      supportedArms: split.supportedArms,
      tomorrowAed: split.tomorrowAed,
      overCapAed: split.overCapAed,
      plans: split.plans.map((p) => {
        const d = detailById.get(p.campaignId)
        return {
          ...p,
          name: d ? `${d.campaign.name}${d.channel === 'google' ? ' · Google' : ''}` : p.campaignId,
          channel: d?.channel ?? 'meta',
          currentAed: Math.round(d?.dailyBudgetAed ?? 0),
          saturated: d?.saturated ?? false,
          audienceName: audienceOfCampaign.get(p.campaignId)?.name ?? null,
          audienceWeight: weightFor(
            audienceWeights, audienceOfCampaign.get(p.campaignId)?.key ?? null,
          ),
          audienceVerdict: audienceWeights.find(
            (w) => w.key === audienceOfCampaign.get(p.campaignId)?.key,
          )?.verdict ?? null,
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
