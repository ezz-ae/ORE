/**
 * THE POINTS ECONOMY — what a point buys, what earns one back, and what does
 * not.
 *
 * The ledger underneath this (credits-db.ts) is sound: every movement is a
 * whole positive integer, every referenced movement is idempotent per
 * (broker, type, reference), and the balance is derived from the rows rather
 * than stored. Nothing here changes that. This module is the ECONOMY on top of
 * it — the rules that decide when a row is written at all.
 *
 * ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────
 *
 * rating-loop.ts states it: a rating that changes nothing is worse than no
 * rating, because it costs somebody ten seconds a lead and buys a number in a
 * column. Brokers stop rating within a week, and the rating is the single
 * strongest signal this product has — it is what builds the value-based
 * lookalike and the exclusion list.
 *
 * So rating pays. A broker gets points back for judging the leads their own
 * spend bought. That makes the loop self-funding, and it makes the most
 * valuable ten seconds in the product the ten seconds people are paid for.
 *
 * ── AND THE TRAP THAT DECIDES WHETHER IT WORKS ───────────────────────────
 *
 * Pay for RATINGS and you get ratings. Pay for ACCURATE ratings and you get a
 * broker who rates a lead 1, never calls it, and is proven right by their own
 * inaction. A self-fulfilling prophecy paid for in points, and the product
 * would be funding brokers to write off leads instead of working them — the
 * exact opposite of what it is for.
 *
 * Hence the first and most important rule: A RATING ON A LEAD NOBODY WORKED
 * EARNS NOTHING. You are not paid for judging something you never touched.
 * It is the same position design-race takes about a design that was never
 * funded — you cannot call a race that was not run.
 *
 * ── AND THREE MORE, EACH CLOSING A WAY TO PRINT POINTS ────────────────────
 *
 *   · A FORECAST MADE AFTER THE ANSWER IS NOT A FORECAST. Rating a lead 10
 *     after it has already closed is copying, not judging, and it earns
 *     nothing. `ratedBeforeOutcome` is what makes the whole scheme honest.
 *   · ONLY THE FIRST RATING EARNS. A broker who rates 5, watches for a month
 *     and edits to 9 has not made a better forecast; they have looked at the
 *     answer. Later edits still feed the audiences — they are just not paid.
 *   · A MIDDLING RATING EARNS NOTHING, because it forecast nothing. The house
 *     scale says 3–5 is "neither" (lead-stages.ts), and "I do not know" is a
 *     legitimate answer that this product will not pay for. Not punished:
 *     nothing is deducted. Just not paid.
 *
 * Pure — no I/O, no clock (now is passed in). Runs in `pnpm guards`.
 */
import { VALUABLE_RATING, AVOID_RATING, DEAL_RATING } from '@/lib/freehold/lead-stages'

/** Walkable — the forecast a rating actually makes. */
export const RATING_BANDS = ['avoid', 'unsure', 'good', 'deal'] as const
export type RatingBand = (typeof RATING_BANDS)[number]

/** Walkable — what became of the lead, as the CRM knows it. */
export const LEAD_OUTCOMES = ['won', 'qualified', 'stalled', 'junk'] as const
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number]

/** Walkable — why a claim did or did not pay. Each renders its own sentence. */
export const CLAIM_VERDICTS = [
  'paid', 'wrong', 'notWorked', 'noForecast', 'knewTheAnswer', 'notFirst', 'tooEarly',
] as const
export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number]

/**
 * Points returned for one accurate rating.
 *
 * One point. It is deliberately the smallest movement the ledger can make: the
 * scheme has to be worth a broker's ten seconds without ever becoming a better
 * business than selling property. A broker who rates fifty leads accurately in
 * a month earns back fifty points — about what one modest campaign costs — and
 * they had to be right about fifty leads to get it.
 *
 * Whole points only. The ledger column is INTEGER (credits-shared.ts) and a
 * fractional reward would be silently rounded by Postgres into either nothing
 * or double.
 */
export const POINTS_PER_ACCURATE_RATING = 1

/**
 * The most a broker may earn back, as a share of what they spent.
 *
 * Half. Rating is meant to offset the cost of buying leads, never to replace
 * it — past this the cheapest way to get points is to buy a few leads and rate
 * a great many, and an economy whose best strategy is not advertising is a
 * broken economy. Enforced on the ACCOUNT, not on a campaign, so it cannot be
 * walked around by spreading the same ratings over many small launches.
 */
export const MAX_REFUND_SHARE_OF_SPEND = 0.5

/**
 * How long a rating must season before it is judged, when the account has no
 * measured cycle of its own.
 *
 * Seven days — the same default money-truth uses for reaching "qualified",
 * and for the same reason: a forecast judged the next morning is not judged,
 * it is guessed at twice. Callers pass the account's own measured cycle when
 * there is one, and this is only the fallback.
 */
export const DEFAULT_SEASON_DAYS = 7

/** Which forecast a rating on the house scale is making. */
export function bandOf(rating: number): RatingBand {
  if (!Number.isFinite(rating)) return 'unsure'
  const r = Math.round(rating)
  if (r >= DEAL_RATING) return 'deal'
  if (r >= VALUABLE_RATING) return 'good'
  if (r <= AVOID_RATING) return 'avoid'
  return 'unsure'
}

/** What a claim knows about one rated lead. */
export interface RatingClaim {
  leadId: string
  brokerId: string
  /** The rating as first given — see the header: only the first one earns. */
  rating: number
  /** When it was given. */
  ratedAt: string | number
  /** True when this broker is the FIRST person to have rated this lead. */
  isFirstRating: boolean
  /**
   * What the CRM already knew when the rating was given. A rating made after
   * the lead had already closed is not a forecast.
   */
  outcomeAtRating: LeadOutcome
  /** What became of it since. */
  outcomeNow: LeadOutcome
  /**
   * Did anybody actually work this lead — a call, a message, a note, a stage
   * move by a human? Rating is not work.
   */
  worked: boolean
}

export interface ClaimSettlement {
  verdict: ClaimVerdict
  points: number
  band: RatingBand
}

/**
 * Was the forecast right?
 *
 * `good` says the lead is worth calling, so qualified or won proves it.
 * `avoid` says stop buying this, so anything that never qualified proves it.
 * `deal` is the strongest claim on the scale and only a closed deal proves it.
 * `unsure` forecasts nothing and can be neither right nor wrong.
 */
export function forecastHeld(band: RatingBand, outcome: LeadOutcome): boolean {
  switch (band) {
    case 'good':   return outcome === 'qualified' || outcome === 'won'
    case 'avoid':  return outcome === 'stalled' || outcome === 'junk'
    case 'deal':   return outcome === 'won'
    case 'unsure': return false
  }
}

/**
 * Settle one claim.
 *
 * The order of the refusals is the order of the arguments in the header, and
 * it matters: a rating that was never worked is `notWorked` even if it also
 * happened to be right, because paying it would teach the wrong lesson
 * loudest.
 */
export function settleClaim(
  claim: RatingClaim,
  opts: { seasonDays?: number; now?: Date } = {},
): ClaimSettlement {
  const band = bandOf(claim.rating)
  const none = (verdict: ClaimVerdict): ClaimSettlement => ({ verdict, points: 0, band })

  // 1. NOT SEASONED. A forecast judged the next morning is not judged.
  const seasonDays = opts.seasonDays ?? DEFAULT_SEASON_DAYS
  const ratedMs = typeof claim.ratedAt === 'number' ? claim.ratedAt : Date.parse(String(claim.ratedAt))
  if (!Number.isFinite(ratedMs)) return none('tooEarly')
  const age = ((opts.now ?? new Date()).getTime() - ratedMs) / 86_400_000
  if (age < seasonDays) return none('tooEarly')

  // 2. NOT THE FIRST RATING. A later edit is welcome and is not a forecast.
  if (!claim.isFirstRating) return none('notFirst')

  // 3. THE ANSWER WAS ALREADY KNOWN. Rating a closed deal 10 is copying.
  //    Checked against what the CRM knew AT THE MOMENT of the rating.
  if (claim.outcomeAtRating === 'won' || claim.outcomeAtRating === 'qualified') {
    return none('knewTheAnswer')
  }

  // 4. NOBODY WORKED IT. The rule the whole scheme stands on: a broker who
  //    rates a lead 1 and never calls it must not be paid for being right.
  if (!claim.worked) return none('notWorked')

  // 5. NO FORECAST WAS MADE. "I do not know" is legitimate and unpaid.
  if (band === 'unsure') return none('noForecast')

  return forecastHeld(band, claim.outcomeNow)
    ? { verdict: 'paid', points: POINTS_PER_ACCURATE_RATING, band }
    : none('wrong')
}

/**
 * The ceiling on what an account may earn back this cycle.
 *
 * Read from what the broker actually SPENT, so a broker who has bought nothing
 * can earn nothing — there is no lead to rate that their points paid for, and
 * an account that can earn without spending is a faucet.
 */
export function refundCeiling(spentThisCycle: number): number {
  if (!Number.isFinite(spentThisCycle) || spentThisCycle <= 0) return 0
  return Math.floor(spentThisCycle * MAX_REFUND_SHARE_OF_SPEND)
}

/**
 * How many of these settlements may actually be paid, given the ceiling and
 * what has already been paid this cycle.
 *
 * Returns the settlements in order with the ones past the ceiling turned into
 * a plain zero rather than dropped — a broker who hit the cap should be able
 * to see that they hit it, not find rows silently missing.
 */
export function applyCeiling(
  settled: ClaimSettlement[],
  opts: { spentThisCycle: number; alreadyRefundedThisCycle: number },
): { settled: ClaimSettlement[]; paid: number; cappedOut: number } {
  const ceiling = refundCeiling(opts.spentThisCycle)
  let room = Math.max(0, ceiling - Math.max(0, opts.alreadyRefundedThisCycle))
  let paid = 0
  let cappedOut = 0
  const out = settled.map((s) => {
    if (s.points <= 0) return s
    if (room >= s.points) {
      room -= s.points
      paid += s.points
      return s
    }
    cappedOut += s.points
    return { ...s, points: 0, verdict: 'tooEarly' as ClaimVerdict }
  })
  return { settled: out, paid, cappedOut }
}

/** The ledger reference for a rating refund — one per lead, ever. */
export const ratingRefundReference = (leadId: string): string => `rating:${leadId}`

/**
 * Read a CRM status into the outcome vocabulary this module reasons in.
 *
 * `stalled` and `junk` are deliberately different: one is a lead that went
 * quiet, the other one somebody blocked or that never had a usable number.
 * Both prove an `avoid` forecast; keeping them apart lets a screen say which.
 */
export function outcomeOf(input: {
  status: string | null | undefined
  blocked?: boolean | null
  badPhone?: boolean | null
}): LeadOutcome {
  const s = String(input.status ?? '').toLowerCase()
  if (s === 'converted' || s === 'closed') return 'won'
  if (s === 'qualified' || s === 'viewing' || s === 'negotiation') return 'qualified'
  if (input.blocked || input.badPhone) return 'junk'
  return 'stalled'
}
