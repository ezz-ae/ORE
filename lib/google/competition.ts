/**
 * HOW MUCH OF THE AUCTION WE GOT, AND WHY WE LOST THE REST.
 *
 * The Google report shape carried an `auctionInsights: AuctionInsightRow[]`
 * field — competitor domains, overlap rate, position-above rate — that was
 * hardcoded to `[]` at every call site since it was written. Not an oversight
 * that could be finished: the Auction Insights report is not exposed by the
 * Google Ads API at all. It is a UI-only report, and a field in our own shape
 * that the API can never fill is a promise the product cannot keep.
 *
 * What IS available was never asked for, and it is the more useful half:
 *
 *   search_impression_share               of the auctions you were eligible
 *                                         for, the share you actually showed in
 *   search_rank_lost_impression_share     the share you lost because you were
 *                                         OUTRANKED — bid or quality
 *   search_budget_lost_impression_share   the share you lost because you RAN
 *                                         OUT OF MONEY
 *   search_top_impression_share           of your impressions, the share above
 *                                         the organic results
 *   search_absolute_top_impression_share  …and the share in position one
 *
 * THE TWO LOSSES HAVE OPPOSITE FIXES, and that is the whole reason this module
 * exists. Losing to rank means raise the bid or fix the ad and the landing
 * page; more budget buys nothing, because you were never going to win those
 * auctions at any spend rate. Losing to budget means the auctions were already
 * won and the money ran out; a bid rise makes it strictly worse by spending
 * the same budget faster. Google separates them and nobody looks — which is
 * most of why "people don't really understand Google Ads".
 *
 * TWO HONESTY RULES, both learned elsewhere in this product.
 *
 *  1. GOOGLE CLAMPS. Any impression share above 0.9 is reported AS 0.9, and
 *     any below 0.1 as 0.0999. Those are BOUNDS, not measurements. Printing
 *     "90%" as a point estimate is exactly the bare-point-estimate failure
 *     min-evidence.ts exists to prevent, so a clamped value is carried as a
 *     bound and the screen says "over 90%".
 *
 *  2. NO VERDICT ON A THIN AUCTION. Impression share over a few dozen
 *     impressions is noise, and "you are losing 70% to rank" said about
 *     eleven impressions sends somebody to raise a bid for no reason.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */

/**
 * Google's own clamps on every impression-share metric. Documented behaviour,
 * not our rounding: the API returns exactly these numbers rather than the true
 * value once it passes either edge.
 */
export const IS_CLAMP_HIGH = 0.9
export const IS_CLAMP_LOW = 0.0999

/**
 * Below this many impressions in the window, share percentages are noise and
 * no verdict is offered. A Search campaign that has been live a day is
 * routinely under it, and the honest answer then is "not enough yet".
 */
export const MIN_IMPRESSIONS_FOR_SHARE = 300

/**
 * The share of lost impressions that has to sit on ONE side before that side
 * is named as the reason. Below it the two losses are comparable and naming
 * either one sends somebody to make a change that fixes half the problem.
 */
export const DOMINANT_LOSS = 0.6

/** Walkable — each renders its own sentence. */
export const COMPETITION_VERDICTS = [
  'winning', 'losingToBudget', 'losingToRank', 'losingToBoth', 'thin', 'unknown',
] as const
export type CompetitionVerdict = (typeof COMPETITION_VERDICTS)[number]

/** A share, with whether Google clamped it. */
export interface Share {
  /** 0–1 as Google reported it. */
  value: number
  /** 'over' — the truth is above this. 'under' — below it. null — exact. */
  bound: 'over' | 'under' | null
}

export interface CompetitionInput {
  impressions: number
  /** metrics.search_impression_share, 0–1. Absent when Google has none. */
  impressionShare?: number | null
  /** metrics.search_rank_lost_impression_share, 0–1. */
  rankLost?: number | null
  /** metrics.search_budget_lost_impression_share, 0–1. */
  budgetLost?: number | null
  /** metrics.search_top_impression_share, 0–1. */
  topShare?: number | null
  /** metrics.search_absolute_top_impression_share, 0–1. */
  absoluteTopShare?: number | null
}

export interface Competition {
  verdict: CompetitionVerdict
  /** null when Google reported nothing — never defaulted to zero, because
   *  "you showed in 0% of auctions" and "we do not know" are different
   *  sentences and only one of them is true. */
  share: Share | null
  rankLost: Share | null
  budgetLost: Share | null
  topShare: Share | null
  absoluteTopShare: Share | null
  /**
   * The share of the MISSED impressions attributable to each cause, 0–1 and
   * summing to at most 1. This is the number the verdict is made on: losing
   * 20% to budget matters completely differently when you are showing 75% of
   * the time than when you are showing 5%.
   */
  ofLoss: { rank: number; budget: number } | null
  impressions: number
}

/**
 * Read one of Google's share fields, carrying its clamp as a bound.
 *
 * THE VALUE IS KEPT AS REPORTED. An earlier draft replaced it with the clamp
 * constant, which quietly INFLATED every small loss in the arithmetic — a
 * rank loss of 0.05 became 0.0999, nearly doubling its weight in the split
 * that decides whether somebody is told to raise a bid or a budget. The bound
 * is a fact about what the number MEANS on screen; it is not a substitute for
 * the number itself.
 */
export function shareOf(v: number | null | undefined): Share | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
  if (v >= IS_CLAMP_HIGH) return { value: v, bound: 'over' }
  if (v > 0 && v <= IS_CLAMP_LOW) return { value: v, bound: 'under' }
  return { value: v, bound: null }
}

/**
 * The competition read for one campaign, ad group or keyword.
 *
 * `losingToBoth` is a real answer and not a cop-out: when the two losses are
 * comparable, raising the bid and raising the budget are both required and
 * doing either alone changes very little. Saying "rank" because it edged ahead
 * by four points would send somebody to do half a job and conclude the tool
 * was wrong.
 */
export function competitionOf(input: CompetitionInput): Competition {
  const share = shareOf(input.impressionShare)
  const rankLost = shareOf(input.rankLost)
  const budgetLost = shareOf(input.budgetLost)
  const topShare = shareOf(input.topShare)
  const absoluteTopShare = shareOf(input.absoluteTopShare)

  const base = {
    share, rankLost, budgetLost, topShare, absoluteTopShare,
    impressions: input.impressions,
  }

  // Nothing to read. Distinguished from a thin read: one has too little
  // evidence, the other has none at all, and "connect conversion tracking" is
  // the answer to one of them and not the other.
  if (!share && !rankLost && !budgetLost) {
    return { ...base, verdict: 'unknown', ofLoss: null }
  }
  if (input.impressions < MIN_IMPRESSIONS_FOR_SHARE) {
    return { ...base, verdict: 'thin', ofLoss: null }
  }

  const rank = rankLost?.value ?? 0
  const budget = budgetLost?.value ?? 0
  const lost = rank + budget

  // Showing nearly everywhere. Google's clamp means we cannot say more than
  // "over 90%", and over 90% there is no meaningful auction left to win.
  if (share && share.bound === 'over') {
    return { ...base, verdict: 'winning', ofLoss: lost > 0 ? { rank: rank / lost, budget: budget / lost } : null }
  }
  if (lost <= 0) {
    // Share is known and not clamped, but neither loss was reported. Nothing
    // honest to attribute; the share still stands on its own.
    return { ...base, verdict: 'unknown', ofLoss: null }
  }

  const ofLoss = { rank: rank / lost, budget: budget / lost }
  const verdict: CompetitionVerdict =
    ofLoss.budget >= DOMINANT_LOSS ? 'losingToBudget'
    : ofLoss.rank >= DOMINANT_LOSS ? 'losingToRank'
    : 'losingToBoth'

  return { ...base, verdict, ofLoss }
}

/** Percent for a screen, with the bound preserved. Never a bare number when
 *  Google clamped it — that is the point of carrying the bound this far. */
export function sharePct(s: Share | null): { pct: number; bound: 'over' | 'under' | null } | null {
  return s ? { pct: Math.round(s.value * 100), bound: s.bound } : null
}

/**
 * Roll several campaigns into one account-level read.
 *
 * Weighted by IMPRESSIONS, not averaged across campaigns: a campaign with
 * forty impressions and one with forty thousand are not two equal opinions
 * about the account's competitive position, and a plain mean would let the
 * smallest campaign in the account set the headline.
 */
export function rollUpCompetition(rows: CompetitionInput[]): CompetitionInput {
  const usable = rows.filter((r) => r.impressions > 0)
  const total = usable.reduce((n, r) => n + r.impressions, 0)
  if (total === 0) {
    return { impressions: 0, impressionShare: null, rankLost: null, budgetLost: null, topShare: null, absoluteTopShare: null }
  }
  const wavg = (pick: (r: CompetitionInput) => number | null | undefined): number | null => {
    let num = 0, den = 0
    for (const r of usable) {
      const v = pick(r)
      if (typeof v === 'number' && Number.isFinite(v)) { num += v * r.impressions; den += r.impressions }
    }
    return den > 0 ? num / den : null
  }
  // Returns the weighted INPUT, not a verdict: competitionOf stays the single
  // place a verdict is reached, so an account-level read and a campaign-level
  // read cannot drift into two different rules.
  return {
    impressions: total,
    impressionShare: wavg((r) => r.impressionShare),
    rankLost: wavg((r) => r.rankLost),
    budgetLost: wavg((r) => r.budgetLost),
    topShare: wavg((r) => r.topShare),
    absoluteTopShare: wavg((r) => r.absoluteTopShare),
  }
}
