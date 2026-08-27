/**
 * WHERE THE NEXT DIRHAM GOES — the whole cap, split on purpose.
 *
 * The machine moves budget one decision at a time: ROTATE pauses a loser and
 * hands its budget to a survivor, GROW raises a proven winner into idle cap
 * headroom. Both are local. Neither ever asks the portfolio question — given
 * this cap and these campaigns, what should each one be running at tomorrow?
 *
 * Four things decide that, and every one of them is already computed somewhere
 * in this codebase and read by nothing that sets a budget.
 *
 * ── 1. FEWER ARMS FUNDED PROPERLY BEATS MANY ARMS STARVED ────────────────
 *
 * Meta needs about fifty optimisation events in a week for an ad set to leave
 * the learning phase (learning-phase.ts). Below the budget that buys those, an
 * ad set never stabilises and every number it produces is learning-phase noise.
 * Splitting a cap across five arms when it can fund two does not give you five
 * results — it gives you five campaigns that never tell you anything, and a
 * month later nobody can say which audience worked.
 *
 * `armsThatCanLearn` has computed this the whole time. Nothing consulted it
 * when allocating.
 *
 * ── 2. THE NEXT DIRHAM IS NOT WORTH WHAT THE LAST ONE WAS ────────────────
 *
 * The best average cost per lead is not where the next dirham should go. A
 * campaign whose audience is used up — frequency at the ceiling, reach flat
 * (lookalike-ladder.ts) — spends the next dirham showing the same ad to the
 * same person again. Its average still looks excellent, because the average is
 * dominated by the money that bought the first views.
 *
 * So a saturated arm is held at its current budget. It is not punished — it is
 * not given money that would buy re-views. That is the difference between
 * allocating on average return and allocating on MARGINAL return, and it is the
 * whole of what a good buyer does by hand.
 *
 * ── 3. MOVE ONLY ON EVIDENCE ─────────────────────────────────────────────
 *
 * Rank on money-truth's standing, which separates two campaigns only on a real
 * test. A tie moves nothing. An optimiser that re-ranks nightly on point
 * estimates spends its life chasing noise around the account.
 *
 * ── 4. AND MOVE SLOWLY ENOUGH THAT THE MOVE DOES NOT DESTROY THE ANSWER ──
 *
 * A budget change over LEARNING_RESET_BUDGET_CHANGE re-enters learning. A
 * machine that reallocates every night while resetting learning every night
 * holds the entire account in permanent learning and believes it is optimising.
 *
 * So the plan is a TARGET and a STEP, and they are different numbers. Cuts in
 * particular cannot land in one night: you cannot take an arm down by half
 * without a reset, so a large cut is a glide over several days and this module
 * says how many. A plan that claimed to land tomorrow would be lying about
 * what the platform does.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import {
  dailyBudgetToLearn, armsThatCanLearn, safeBudgetStep, LEARNING_RESET_BUDGET_CHANGE,
} from '@/lib/freehold/learning-phase'
import { MIN_ARM_DAILY_AED } from '@/lib/freehold/level-arms'
import type { MoneyVerdict } from '@/lib/freehold/money-truth'
import { NEUTRAL_WEIGHT } from '@/lib/freehold/audience-weight'

/** Walkable — each renders its own word and its own reason. */
export const SPLIT_ACTIONS = ['raise', 'lower', 'hold', 'starve'] as const
export type SplitAction = (typeof SPLIT_ACTIONS)[number]

/**
 * Most days a glide may take before the plan stops calling itself a plan.
 *
 * At LEARNING_RESET_BUDGET_CHANGE a day, a cut of 80% takes eight days. Past
 * about a fortnight the target is not a plan any more — the evidence behind it
 * will have changed before the budget arrives — so the caller is told the glide
 * is long rather than being handed a schedule nobody will follow.
 */
export const MAX_GLIDE_DAYS = 14

export interface SplitRow {
  campaignId: string
  /** What it runs at today. */
  dailyBudgetAed: number
  /** Where it stands against the others — see money-truth.ts. */
  standing: MoneyVerdict
  /**
   * Is its audience used up? From lookalike-ladder's `assessTier`: frequency
   * at the ceiling with reach flat. A saturated arm is never RAISED, whatever
   * its average cost says, because the next dirham buys a re-view.
   */
  saturated: boolean
  /** Human endorsement or a compliance reason to keep it running. A protected
   *  arm is funded before anything else and is never starved. */
  protected?: boolean
  /**
   * How this campaign's AUDIENCE converts against the rest of the field — see
   * `audience-weight.ts`. Absent, or on an account with no quality signal yet,
   * it is NEUTRAL_WEIGHT and this function splits exactly as it always did.
   *
   * It scales the SURPLUS only, never the learning base: the audience is
   * deprioritised, never switched off.
   */
  audienceWeight?: number
}

/**
 * A row's weight, defended.
 *
 * Absent, zero, negative and NaN all mean the same thing here — nobody has
 * measured this audience — and all resolve to NEUTRAL_WEIGHT. A zero that fell
 * through would starve an arm silently, which is the exclusion `audience-weight`
 * exists to refuse.
 */
const audienceWeightOf = (r: SplitRow): number => {
  const w = r.audienceWeight
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : NEUTRAL_WEIGHT
}

export interface SplitPlan {
  campaignId: string
  action: SplitAction
  /** What it should run at, once the glide finishes. */
  targetAed: number
  /** What it should run at TOMORROW — the largest move that does not reset
   *  learning. Equal to the target when the target is already within reach. */
  stepAed: number
  /** Days of stepping before the step reaches the target. 0 when it lands
   *  tomorrow, MAX_GLIDE_DAYS when the glide is longer than a plan should be. */
  glideDays: number
  /** Why, in the caller's own vocabulary — the guard walks these. */
  reason: SplitReason
}

/** Walkable — each renders its own sentence. */
export const SPLIT_REASONS = [
  'funded', 'saturatedHold', 'behindOthers', 'capCannotCarry', 'protectedFloor', 'noChange',
] as const
export type SplitReason = (typeof SPLIT_REASONS)[number]

export interface SplitResult {
  plans: SplitPlan[]
  /** What one arm needs to leave learning at the observed cost per lead.
   *  null when no cost per lead is known — then nothing is starved, because
   *  "we do not know" is not grounds to switch a campaign off. */
  perArmAed: number | null
  /** How many arms this cap can fund properly. null with no cost per lead. */
  supportedArms: number | null
  /** Total of the STEPS — what actually runs tomorrow. May exceed the cap
   *  while cuts are gliding down, and the caller must show that rather than
   *  pretend the plan lands overnight. */
  tomorrowAed: number
  /** How far over the cap tomorrow is. 0 when the plan already fits. */
  overCapAed: number
}

/**
 * Split a daily cap across live campaigns.
 *
 * `costPerLeadAed` is the account's observed price of a lead — what decides how
 * many arms the cap can carry. Pass null when it is not known: the split still
 * ranks and still holds saturated arms, but NOTHING IS STARVED, because an
 * unknown cost is not evidence that a campaign should stop.
 */
export function splitBudget(
  rows: SplitRow[],
  opts: { capAed: number; costPerLeadAed: number | null },
): SplitResult {
  const { capAed, costPerLeadAed } = opts
  const empty: SplitResult = {
    plans: [], perArmAed: null, supportedArms: null, tomorrowAed: 0, overCapAed: 0,
  }
  if (rows.length === 0 || !Number.isFinite(capAed) || capAed <= 0) return empty

  const perArmAed = costPerLeadAed !== null && costPerLeadAed > 0
    ? Math.max(MIN_ARM_DAILY_AED, dailyBudgetToLearn(costPerLeadAed))
    : null
  const supportedArms = costPerLeadAed !== null && costPerLeadAed > 0
    ? Math.max(1, armsThatCanLearn(capAed, costPerLeadAed))
    : null

  // ── The order money should reach them in ────────────────────────────────
  // Protected first — a human endorsement or a compliance reason outranks
  // arithmetic, the same position ROTATE takes. Then the standings, which
  // separate only on a real test, so this ordering never churns on noise.
  const RANK: Record<MoneyVerdict, number> = { ahead: 0, tied: 1, tooEarly: 2, behind: 3 }
  const ranked = [...rows].sort((a, b) => {
    const p = (a.protected ? 0 : 1) - (b.protected ? 0 : 1)
    if (p !== 0) return p
    const s = RANK[a.standing] - RANK[b.standing]
    if (s !== 0) return s
    // Stable and explainable: the bigger arm first, so a tie does not shuffle
    // the account every night for no reason.
    return b.dailyBudgetAed - a.dailyBudgetAed
  })

  // ── Who the cap can actually carry ──────────────────────────────────────
  const fundable = supportedArms === null ? ranked : ranked.slice(0, supportedArms)
  const starved = supportedArms === null ? [] : ranked.slice(supportedArms)
  const fundableIds = new Set(fundable.map((r) => r.campaignId))

  // ── The targets ─────────────────────────────────────────────────────────
  // Everything fundable gets at least what one arm needs to learn, then the
  // surplus goes to the arms whose next dirham still buys a new person.
  const base = perArmAed ?? Math.max(MIN_ARM_DAILY_AED, capAed / Math.max(1, fundable.length))
  const targets = new Map<string, number>()
  for (const r of fundable) targets.set(r.campaignId, Math.min(base, capAed))
  // A protected arm is never taken below the platform floor, even when the
  // cap cannot really carry it — switching off a campaign somebody vouched for
  // is a decision for them, not for this function.
  for (const r of starved) targets.set(r.campaignId, r.protected ? MIN_ARM_DAILY_AED : 0)

  let spare = capAed - [...targets.values()].reduce((n, v) => n + v, 0)
  if (spare > 0) {
    // THE MARGINAL RULE. Only arms that are still reaching new people may take
    // the surplus. A saturated arm keeps its base and no more: its average may
    // be the best in the account and the next dirham still buys a re-view.
    const growable = fundable.filter((r) => !r.saturated && r.standing !== 'behind')
    const takers = growable.length > 0 ? growable : fundable.filter((r) => !r.saturated)
    if (takers.length > 0) {
      // THE SURPLUS IS THE ONLY PLACE AUDIENCE QUALITY MAY SPEAK. The base
      // above is what an arm needs to leave learning; scaling THAT by a weight
      // would starve the audience whose evidence is thinnest, which is the
      // audience most in need of more of it. So a weight moves the money that
      // is left over and never the money that buys the measurement.
      const totalWeight = takers.reduce((n, r) => n + audienceWeightOf(r), 0)
      for (const r of takers) {
        const share = totalWeight > 0 ? audienceWeightOf(r) / totalWeight : 1 / takers.length
        targets.set(r.campaignId, (targets.get(r.campaignId) ?? 0) + spare * share)
      }
      spare = 0
    }
  }

  // ── The move, and how long it takes ─────────────────────────────────────
  const plans = rows.map((r): SplitPlan => {
    const target = Math.round(targets.get(r.campaignId) ?? 0)
    const step = target <= 0 ? 0 : safeBudgetStep(r.dailyBudgetAed, target)

    const action: SplitAction =
      target <= 0 ? 'starve'
        : step > r.dailyBudgetAed ? 'raise'
        : step < r.dailyBudgetAed ? 'lower'
        : 'hold'

    const reason: SplitReason =
      target <= 0 ? 'capCannotCarry'
        : !fundableIds.has(r.campaignId) ? 'protectedFloor'
        : action === 'hold' ? 'noChange'
        : r.saturated && action === 'raise' ? 'saturatedHold'
        : r.standing === 'behind' && action === 'lower' ? 'behindOthers'
        : 'funded'

    return {
      campaignId: r.campaignId,
      action, targetAed: target, stepAed: Math.round(step),
      glideDays: glideDaysFor(r.dailyBudgetAed, target),
      reason,
    }
  })

  const tomorrowAed = plans.reduce((n, p) => n + p.stepAed, 0)
  return {
    plans,
    perArmAed: perArmAed === null ? null : Math.round(perArmAed),
    supportedArms,
    tomorrowAed: Math.round(tomorrowAed),
    // A CUT CANNOT LAND OVERNIGHT. You cannot take an arm down by half without
    // a learning reset, so a plan with big cuts in it is over the cap tomorrow
    // and converges over the glide. Reported, never hidden — a plan that
    // claimed to fit tomorrow would be lying about what the platform does.
    overCapAed: Math.max(0, Math.round(tomorrowAed - capAed)),
  }
}

/**
 * How many days of safe steps it takes to get from here to there.
 *
 * Counted rather than derived from a logarithm so it matches exactly what
 * `safeBudgetStep` will actually do, rounding included. Capped at
 * MAX_GLIDE_DAYS: past a fortnight the target is not a plan any more.
 */
export function glideDaysFor(fromAed: number, targetAed: number): number {
  if (targetAed <= 0 || fromAed <= 0) return 0
  let at = fromAed
  for (let day = 0; day < MAX_GLIDE_DAYS; day++) {
    const next = safeBudgetStep(at, targetAed)
    if (Math.round(next) === Math.round(targetAed)) return day
    // No progress means the step cannot move — treat it as the full glide
    // rather than looping on a number that will never arrive.
    if (Math.round(next) === Math.round(at)) return MAX_GLIDE_DAYS
    at = next
  }
  return MAX_GLIDE_DAYS
}

/** The share of a budget one safe step may move, for the sentence that
 *  explains why tomorrow is not the target. */
export const STEP_SHARE = LEARNING_RESET_BUDGET_CHANGE
