/**
 * THE LADDER FROM SPEND TO MONEY — and which rung a campaign may be judged on.
 *
 * Every decision this product makes about an advertising dirham is made on
 * LEADS. The rotate gate condemns on cost per lead. The grow gate scales on
 * cost per lead. The quality score counts a win as a RATE — one closed deal in
 * twenty-five leads scores identically whether the deal was AED 800,000 or
 * AED 12,000,000. `deal_value_aed` exists in the CRM, is written by
 * lead-writeback, is read by the seed builder, and reaches no advertising
 * decision anywhere.
 *
 * So the machine optimises for the cheapest lead while the business is paid on
 * deals, and those are not the same campaign. From this account:
 *
 *   cashoffer          25 leads   CPL AED 106   0 qualified   0 deals
 *   venice-investor     8 leads   CPL AED 331   5 qualified   2 deals
 *
 * On cost per lead the first wins by three times and the second gets condemned
 * as "> 2× the best sibling". On money it is not close.
 *
 * ── THE RUNG RULE, WHICH IS THE WHOLE MODULE ─────────────────────────────
 *
 * A campaign may only be judged on a rung it has had TIME to reach. Dubai
 * property does not close in a week; a campaign eleven days old with no deals
 * has not failed at deals, it has not got there. Judging it on the deal rung is
 * the same error as calling a design a loser on AED 26 of spend
 * (design-race.ts) — condemning something for an outcome it was never given the
 * chance to produce.
 *
 * So the judgement rung is the DEEPEST rung that is both mature and evidenced,
 * and the fallbacks are honest: deal → qualified → lead. A young campaign is
 * judged on leads because that is all it can have; a mature one is judged on
 * money because that is what was actually bought.
 *
 * ── WHY THE DECISION DOES NOT USE THE CAMPAIGN'S OWN REVENUE ─────────────
 *
 * Revenue per campaign is a FACT and it is shown as one. It is a bad basis for
 * a comparison, because the spread of Dubai inventory is enormous: one campaign
 * closing a single AED 12M villa is not proven fifteen times better than one
 * closing an AED 800k studio — that is the variance of the catalogue, not of the
 * campaign. Two deals cannot separate those.
 *
 * So the ranking counts DEALS, not dirhams: cost per deal, which asks how many
 * deals each dirham bought and is immune to the size of any one of them. The
 * account's median deal prices the separate question "was that worth it" —
 * return per dirham — and the campaign's own revenue stays on screen, where a
 * human can see the villa and draw their own conclusion.
 *
 * ── AND NOTHING FIRES ON A DIFFERENCE THAT MIGHT BE NOISE ────────────────
 *
 * Every rung is a count of events over spend, so two campaigns are separated by
 * a real test — `samePace`, the conditional-Poisson test the inventory ranking
 * already uses: how likely this split of events across this split of money is,
 * if both really convert at the same rate per dirham. Below p = 0.05 one is
 * ahead. Above it they are 'tied', and 'tied' is an answer, not a failure to
 * produce one. A machine that ranks on point estimates kills its own winners
 * the first week they run cold.
 *
 * Pure — no I/O, no clock (now is passed in). Runs in `pnpm guards`.
 */
import { countBounds, costRange } from '@/lib/freehold/min-evidence'
import { samePace, SIGNIFICANT_P } from '@/lib/freehold/inventory-quality'

export { costRange } from '@/lib/freehold/min-evidence'

/** Walkable — deepest last. Each renders its own word. */
export const MONEY_RUNGS = ['lead', 'qualified', 'deal'] as const
export type MoneyRung = (typeof MONEY_RUNGS)[number]

/** Walkable — the answer a comparison can give. */
export const MONEY_VERDICTS = ['ahead', 'behind', 'tied', 'tooEarly'] as const
export type MoneyVerdict = (typeof MONEY_VERDICTS)[number]

/**
 * How long this business takes to reach each rung, in days.
 *
 * Defaults, not truths — `cycleFromHistory` replaces them with the account's
 * OWN measured cycle as soon as it has closed enough leads to measure one.
 * Until then these are house judgement about Dubai off-plan:
 *
 *   · a lead that will qualify usually does so within the first week, because
 *     qualification is a phone call, not a decision;
 *   · a deal takes about six weeks — viewing, negotiation, paperwork.
 *
 * Wrong in the safe direction on purpose. Too LONG means a campaign is judged
 * on leads for a while longer than necessary, which costs some budget. Too
 * SHORT means a campaign is condemned for not having closed a deal it was
 * never given time to close, which kills the winner.
 */
export const DEFAULT_DAYS_TO_QUALIFY = 7
export const DEFAULT_DAYS_TO_CLOSE = 42

export interface SalesCycle {
  daysToQualify: number
  daysToClose: number
  /** How many closed leads the measurement stands on. 0 ⇒ the defaults. */
  measuredOn: number
}

export const DEFAULT_CYCLE: SalesCycle = {
  daysToQualify: DEFAULT_DAYS_TO_QUALIFY,
  daysToClose: DEFAULT_DAYS_TO_CLOSE,
  measuredOn: 0,
}

/**
 * Closed leads required before the account's own cycle replaces the defaults.
 *
 * Five, because the statistic used is a MEDIAN and a median of two is one of
 * the two numbers. Below this the defaults stand — an account that has closed
 * one fast deal must not conclude its sales cycle is three days and start
 * condemning every campaign older than that.
 */
export const MIN_CLOSED_FOR_CYCLE = 5

/**
 * Closed deals required before the account has a median deal value.
 *
 * Same reasoning. The median prices return-per-dirham — "AED 3.40 back per
 * dirham" — and a median of two is one of the two numbers. Below this there is
 * no median worth the name, so return is withheld. It does NOT withhold the
 * deal rung itself: cost per deal counts deals and needs no price.
 */
export const MIN_DEALS_FOR_MEDIAN = 3

/** One row of the ladder, as the CRM and the platform report it. */
export interface CampaignMoney {
  campaignId: string
  /** Real spend, from the platform. A fact. */
  spendAed: number
  /** Attributed leads. */
  leads: number
  /** Attributed leads at qualified or deeper. */
  qualified: number
  /** Attributed leads at converted or closed. */
  deals: number
  /** Money recorded against those deals. Shown, never used to rank — see the
   *  module header. */
  revenueAed: number
  /** Days since this campaign first spent. Decides which rungs are in play. */
  ageDays: number
}

/**
 * A cost, as the range the evidence supports.
 *
 * Spend is exact and the count is the estimate, so the interval comes from the
 * count: many events ⇒ a tight range, one event ⇒ a wide one, zero events ⇒ a
 * floor and no ceiling. `costRange` is min-evidence's, not a second copy —
 * cost per lead, cost per qualified lead and cost per deal are the same
 * arithmetic over different counts and must never drift apart.
 */
export interface CostRange {
  /** Best case for this campaign. */
  lo: number
  /** Worst case. Infinity when nothing has converted yet — which is honest:
   *  zero results on any spend supports no upper bound at all. */
  hi: number
}

/** The count on a rung. */
export function countOn(m: CampaignMoney, rung: MoneyRung): number {
  return rung === 'deal' ? m.deals : rung === 'qualified' ? m.qualified : m.leads
}

/** How old a campaign must be before a rung means anything. */
export function maturedFor(rung: MoneyRung, cycle: SalesCycle): number {
  return rung === 'deal' ? cycle.daysToClose : rung === 'qualified' ? cycle.daysToQualify : 0
}

/**
 * The deepest rung this campaign may be judged on.
 *
 * Two conditions, and both are refusals to over-claim:
 *
 *   · TIME — a campaign younger than the cycle has not failed at that rung, it
 *     has not arrived at it;
 *   · A DENOMINATOR — the rung above must have produced something, or the rung
 *     below is measuring a funnel that does not exist yet.
 *
 * The deal rung needs no price to be usable: cost per deal counts deals.
 */
export function judgementRung(m: CampaignMoney, cycle: SalesCycle = DEFAULT_CYCLE): MoneyRung {
  if (m.ageDays >= maturedFor('deal', cycle) && m.qualified > 0) return 'deal'
  if (m.ageDays >= maturedFor('qualified', cycle) && m.leads > 0) return 'qualified'
  return 'lead'
}

/**
 * What one event on this rung cost this campaign.
 *
 * Every rung is a count over the same spend, so all three are the same
 * arithmetic and none of them touches revenue. That is deliberate: it is what
 * makes a campaign that closed a studio comparable with one that closed a
 * villa.
 */
export function costOn(m: CampaignMoney, rung: MoneyRung): CostRange {
  return costRange(m.spendAed, countOn(m, rung))
}

/**
 * Dirhams back per dirham spent, as a range, priced at the account median.
 *
 * null when the account has not closed enough to have a median. This is the
 * number a person actually wants and the one no ad platform can produce,
 * because the platform never learns which lead became money.
 */
export function returnPerDirham(m: CampaignMoney, medianDealAed: number | null): CostRange | null {
  if (medianDealAed === null || !Number.isFinite(m.spendAed) || m.spendAed <= 0) return null
  const b = countBounds(m.deals)
  return { lo: (b.lo * medianDealAed) / m.spendAed, hi: (b.hi * medianDealAed) / m.spendAed }
}

/**
 * Is A genuinely better than B — or is the difference inside the noise?
 *
 * Compared on the SHALLOWER of the two judgement rungs, because a rung one of
 * them has not reached is not a rung they can be compared on.
 *
 * THE TEST IS `samePace`, the same conditional-Poisson test the inventory
 * ranking already uses — the probability of seeing this split of events across
 * this split of spend if both campaigns really convert at the same rate per
 * dirham. Not overlapping confidence intervals: two non-overlapping 95%
 * intervals are roughly a 99.7% joint claim, which almost never fires on real
 * campaign counts, and a test that never fires is a test nobody keeps.
 *
 * 'tied' is a real answer and the machine acts on it by doing nothing. Ranking
 * on point estimates is how an optimiser kills the campaign that was working,
 * the first week it runs cold.
 */
export function compareMoney(
  a: CampaignMoney,
  b: CampaignMoney,
  cycle: SalesCycle = DEFAULT_CYCLE,
): { verdict: MoneyVerdict; rung: MoneyRung; p: number } {
  const ra = judgementRung(a, cycle)
  const rb = judgementRung(b, cycle)
  // The shallower rung — the deepest ground they actually share.
  const rung = MONEY_RUNGS[Math.min(MONEY_RUNGS.indexOf(ra), MONEY_RUNGS.indexOf(rb))]

  // Nothing has been spent on one of them: there is no cost to compare.
  if (a.spendAed <= 0 || b.spendAed <= 0) return { verdict: 'tooEarly', rung, p: 1 }

  const ka = countOn(a, rung)
  const kb = countOn(b, rung)
  // Neither has produced anything on this rung. There is no split to test, and
  // more spending is the only thing that can separate them.
  if (ka + kb === 0) return { verdict: 'tooEarly', rung, p: 1 }

  const p = samePace(ka, a.spendAed, kb, b.spendAed)
  if (p >= SIGNIFICANT_P) return { verdict: 'tied', rung, p }

  // Separated. Whoever bought more events per dirham is ahead.
  return { verdict: ka / a.spendAed > kb / b.spendAed ? 'ahead' : 'behind', rung, p }
}

/**
 * The account's own sales cycle, measured from closed leads.
 *
 * `daysToQualify` and `daysToClose` are MEDIANS — one deal that took nine
 * months must not push the whole account's patience to nine months, and one
 * that closed in a day must not shorten it to a day. Below MIN_CLOSED_FOR_CYCLE
 * the defaults stand and `measuredOn` says so, so a screen can state whose
 * number it is showing.
 */
export function cycleFromHistory(samples: Array<{
  daysToQualify: number | null
  daysToClose: number | null
}>): SalesCycle {
  const med = (xs: number[]): number | null => {
    const s = xs.filter((n) => Number.isFinite(n) && n >= 0).sort((x, y) => x - y)
    if (s.length === 0) return null
    const mid = Math.floor(s.length / 2)
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  }
  const closed = samples.filter((s) => s.daysToClose !== null)
  if (closed.length < MIN_CLOSED_FOR_CYCLE) return DEFAULT_CYCLE
  const q = med(samples.map((s) => s.daysToQualify).filter((n): n is number => n !== null))
  const c = med(closed.map((s) => s.daysToClose as number))
  return {
    daysToQualify: Math.max(1, Math.round(q ?? DEFAULT_DAYS_TO_QUALIFY)),
    daysToClose: Math.max(1, Math.round(c ?? DEFAULT_DAYS_TO_CLOSE)),
    measuredOn: closed.length,
  }
}

/**
 * The account's median deal, which is what prices every deal-rung comparison.
 *
 * null below MIN_DEALS_FOR_MEDIAN — and null means the deal rung is simply not
 * available, not that deals are worth nothing.
 */
export function medianDeal(valuesAed: number[]): number | null {
  const s = valuesAed.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (s.length < MIN_DEALS_FOR_MEDIAN) return null
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface MoneyStanding {
  campaignId: string
  rung: MoneyRung
  cost: CostRange
  returnPerDirham: CostRange | null
  /** How this campaign sits against the FIELD, not against one rival. */
  verdict: MoneyVerdict
  /** Campaigns this one provably beats — the evidence behind 'ahead'. */
  beats: string[]
  /** Campaigns that provably beat it. */
  beatenBy: string[]
  /** The strongest separation behind the verdict, for the sentence that has to
   *  justify pausing somebody's campaign. 1 when nothing separated. */
  p: number
}

/**
 * Where every campaign stands against every other, on the deepest ground they
 * share.
 *
 * A campaign is 'ahead' when it beats at least one other and is beaten by
 * none; 'behind' when something beats it. Everything else is 'tied' — which is
 * the common and correct answer for an account with three campaigns and a
 * fortnight of data, and saying so is the point.
 */
export function moneyStandings(
  rows: CampaignMoney[],
  cycle: SalesCycle = DEFAULT_CYCLE,
  medianDealAed: number | null = null,
): MoneyStanding[] {
  return rows.map((m): MoneyStanding => {
    const rung = judgementRung(m, cycle)
    const beats: string[] = []
    const beatenBy: string[] = []
    let best = 1
    for (const other of rows) {
      if (other.campaignId === m.campaignId) continue
      const { verdict, p } = compareMoney(m, other, cycle)
      if (verdict === 'ahead') beats.push(other.campaignId)
      if (verdict === 'behind') beatenBy.push(other.campaignId)
      if (verdict !== 'tied' && verdict !== 'tooEarly') best = Math.min(best, p)
    }
    return {
      campaignId: m.campaignId,
      rung,
      cost: costOn(m, rung),
      returnPerDirham: returnPerDirham(m, medianDealAed),
      verdict: beatenBy.length > 0 ? 'behind'
        : beats.length > 0 ? 'ahead'
        : rows.length < 2 || m.spendAed <= 0 ? 'tooEarly'
        : 'tied',
      beats,
      beatenBy,
      p: best,
    }
  })
}

/**
 * Where ONE campaign stands against a named set of rivals.
 *
 * The same computation as moneyStandings, for the caller that has a subject and
 * its siblings rather than a whole account — the Ads Machine's rotate gate,
 * which is deciding about one trial at a time.
 */
export function standingOf(
  target: CampaignMoney,
  siblings: CampaignMoney[],
  cycle: SalesCycle = DEFAULT_CYCLE,
  medianDealAed: number | null = null,
): MoneyStanding {
  const all = [target, ...siblings.filter((s) => s.campaignId !== target.campaignId)]
  return moneyStandings(all, cycle, medianDealAed)
    .find((s) => s.campaignId === target.campaignId) as MoneyStanding
}

/**
 * THE VETO. This trial is about to be paused for a bad cost per lead — should
 * it be?
 *
 * The rotate gate condemns on leads, and this is the case where leads are the
 * wrong question: the trial buys expensive leads and they are the ones that
 * qualify and close. Pausing it moves the budget to the campaign that buys
 * cheap leads nobody can sell, which is exactly the trade this whole module
 * exists to stop.
 *
 * TWO CONDITIONS, AND THE SECOND IS THE ONE THAT MATTERS.
 *
 *   · Ahead — provably beats a sibling and is provably beaten by none. Not
 *     "tied": a tie is not evidence, and vetoing every pause on a tie would
 *     switch the rotate gate off entirely.
 *   · On a rung DEEPER than leads. On the lead rung this module is computing
 *     cost per lead from the same numbers the CPL gate used, so a veto there
 *     would be the gate overruling itself with its own data. The veto is only
 *     legitimate when it carries information the gate does not have — which is
 *     what "qualified" and "deal" are.
 */
export function moneyProtects(st: MoneyStanding): boolean {
  return st.verdict === 'ahead' && st.rung !== 'lead'
}

/**
 * The other direction: this trial produces leads at a fine price and none of
 * them ever become anything, while a sibling's do.
 *
 * Same two conditions mirrored, and same reason for the rung test — a
 * condemnation on the lead rung would just be the CPL gate again, fired twice.
 */
export function moneyCondemns(st: MoneyStanding): boolean {
  return st.verdict === 'behind' && st.rung !== 'lead'
}
