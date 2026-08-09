/**
 * IS THIS AUDIENCE THE RIGHT SIZE FOR THIS MONEY?
 *
 * The question that decides whether the ads work, and the one nothing in the
 * product asked. Targeting is judged here on whether it can be BOUGHT, not on
 * whether it reads well:
 *
 *  1. LEARNING. Meta needs roughly 50 results per ad set per week before it
 *     stops guessing. Below that an ad set never leaves the learning phase —
 *     it keeps paying the beginner's price, and worse, its numbers are noise,
 *     so every verdict drawn from them is noise too. Four ad sets sharing one
 *     budget is the usual way this happens: the split that looks like control
 *     is four ad sets that each learn nothing.
 *
 *  2. BURN-OUT. Spend enough into a small audience and the same people see the
 *     ad again and again. Frequency climbs, results fall, and the cost per
 *     lead rises for a reason that has nothing to do with the ad. The answer
 *     is a wider audience, not a better picture — but only once the numbers
 *     say so, because widening early throws away the targeting that was
 *     working.
 *
 * EVERY NUMBER HERE COMES FROM REAL INPUTS. Nothing is modelled from an
 * assumed CPM or an invented audience size: budget, cost-per-lead cap and
 * ad-set count are the operator's own, and frequency, reach and results come
 * from Meta's own reporting. Where an input is missing, the finding that
 * needed it is not produced — it is never estimated into existence.
 *
 * Pure + client-safe. Runs in `pnpm guards`.
 */
import { LEARNING_EVENTS, LEARNING_WINDOW_DAYS, dailyBudgetToLearn } from '@/lib/freehold/learning-phase'


export type FitLevel = 'wrong' | 'watch' | 'ok'

export interface FitFinding {
  level: FitLevel
  /** i18n key suffix under `lm.fit.` */
  key: string
  vars?: Record<string, string | number>
}

export interface FitInput {
  /** Daily budget for the whole launch, in AED. */
  dailyBudgetAED: number
  /** How many ad sets this budget will be divided between. */
  adSets: number
  /** The operator's own cost-per-lead cap, in AED. */
  targetCplAED: number

  // ── Live campaign only. Absent before launch, and then the findings that
  //    depend on them simply are not made. ──
  /** Meta's own frequency: average times each person saw the ad. */
  frequency?: number | null
  /** Days the campaign has been delivering. */
  daysRunning?: number | null
  /** Results Meta has recorded so far. */
  results?: number | null
}

/**
 * Meta's own threshold: an ad set leaves the learning phase at ~50 results per
 * 7 days.
 *
 * THE SAME NUMBER learning-phase.ts already reasons with, imported rather than
 * retyped. A second copy of a constant is a copy that will disagree with the
 * first one the day somebody edits either — which is the failure this codebase
 * has now paid for three times (the interest catalog, the qualified-status
 * list, the form-page tag).
 */
export const LEARNING_RESULTS_PER_WEEK = LEARNING_EVENTS

/**
 * The frequency at which a Dubai property audience is being re-shown rather
 * than reached. Meta's own guidance and this account's history agree around
 * here; above it, cost per lead climbs for reasons the creative cannot fix.
 */
export const BURNOUT_FREQUENCY = 1.6

/** Nothing about a campaign's first days is stable. Judge nothing before this. */
export const MIN_DAYS_FOR_JUDGEMENT = 7

/** Results a single ad set can buy in a learning window at the operator's CPL cap. */
export function weeklyResultsPerAdSet(input: {
  dailyBudgetAED: number
  adSets: number
  targetCplAED: number
}): number | null {
  const { dailyBudgetAED, adSets, targetCplAED } = input
  if (!(dailyBudgetAED > 0) || !(targetCplAED > 0) || !(adSets > 0)) return null
  return ((dailyBudgetAED / adSets) * LEARNING_WINDOW_DAYS) / targetCplAED
}

/**
 * Daily budget that would let EVERY ad set learn.
 *
 * Rounded per ad set and then multiplied, so the number scales exactly with
 * the split — four ad sets cost four times one, with no rounding drift to
 * explain away.
 */
export function budgetToLearn(input: { adSets: number; targetCplAED: number }): number | null {
  const { adSets, targetCplAED } = input
  if (!(targetCplAED > 0) || !(adSets > 0)) return null
  return Math.ceil(dailyBudgetToLearn(targetCplAED)) * adSets
}

export function checkAudienceFit(input: FitInput): FitFinding[] {
  const out: FitFinding[] = []
  const perWeek = weeklyResultsPerAdSet(input)

  // ── Can this budget teach Meta anything? ────────────────────────────────
  if (perWeek !== null) {
    const n = Math.floor(perWeek)
    if (perWeek < LEARNING_RESULTS_PER_WEEK / 2) {
      // Two ways out, and the free one is named first. Splitting a budget
      // across four ad sets makes this exactly four times worse and costs
      // nothing to undo; more budget costs money. Where the split is in play
      // it is always named, even when undoing it is not enough on its own —
      // "it would still not be enough" is not a reason to hide that it is a
      // quarter of the problem.
      const oneAdSet = weeklyResultsPerAdSet({ ...input, adSets: 1 }) ?? 0
      out.push(input.adSets > 1
        ? {
            level: 'wrong',
            key: 'splitStarves',
            vars: {
              n, adSets: input.adSets,
              together: Math.floor(oneAdSet),
              need: budgetToLearn({ adSets: 1, targetCplAED: input.targetCplAED }) ?? 0,
            },
          }
        : {
            level: 'wrong',
            key: 'cannotLearn',
            vars: { n, need: budgetToLearn(input) ?? 0 },
          })
    } else if (perWeek < LEARNING_RESULTS_PER_WEEK) {
      out.push({ level: 'watch', key: 'slowLearn', vars: { n, need: budgetToLearn(input) ?? 0 } })
    } else {
      out.push({ level: 'ok', key: 'learns', vars: { n } })
    }
  }

  // ── Live: is the audience being reached, or re-shown? ───────────────────
  const days = input.daysRunning ?? null
  const freq = typeof input.frequency === 'number' ? input.frequency : null
  const oldEnough = days !== null && days >= MIN_DAYS_FOR_JUDGEMENT

  if (freq !== null && oldEnough) {
    const shown = Math.round(freq * 10) / 10
    if (freq >= BURNOUT_FREQUENCY * 1.5) {
      out.push({ level: 'wrong', key: 'burntOut', vars: { freq: shown, days: days as number } })
    } else if (freq >= BURNOUT_FREQUENCY) {
      out.push({ level: 'watch', key: 'wearing', vars: { freq: shown, days: days as number } })
    } else {
      out.push({ level: 'ok', key: 'freshAudience', vars: { freq: shown } })
    }
  }

  // ── Live: did it actually leave the learning phase? ─────────────────────
  if (oldEnough && typeof input.results === 'number') {
    const weeks = Math.max(1, (days as number) / 7)
    const perWeekReal = input.results / weeks
    if (perWeekReal < LEARNING_RESULTS_PER_WEEK) {
      out.push({
        level: perWeekReal < LEARNING_RESULTS_PER_WEEK / 2 ? 'wrong' : 'watch',
        key: 'stillLearning',
        vars: { n: Math.floor(perWeekReal), days: days as number },
      })
    }
  }

  const RANK: Record<FitLevel, number> = { wrong: 0, watch: 1, ok: 2 }
  return out.sort((a, b) => RANK[a.level] - RANK[b.level])
}
