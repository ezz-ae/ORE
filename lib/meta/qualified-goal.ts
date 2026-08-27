/**
 * WHAT THE AD SET IS ACTUALLY TOLD TO BUY.
 *
 * `lib/meta/capi.ts` sends Meta a `QualifiedLead` event for every lead a
 * broker qualifies, and a `Purchase` with the real money for every deal. It is
 * carefully built: hashed email and phone, `fbc`/`fbp` unhashed because they
 * are Meta's own tokens, and a value only on the Purchase — its own comment
 * explains that a QualifiedLead carrying the deal value "would teach Meta that
 * qualification IS the money, and it would optimise for form answers instead
 * of closings."
 *
 * The ad set was optimising for form answers anyway. `createAdSet` wrote
 *
 *     promoted_object = { pixel_id, custom_event_type: 'LEAD' }
 *
 * so the strongest signal this account owns — the one Meta cannot observe for
 * itself, identified with a click id kept alive specifically to carry it —
 * arrived, was stored, and was bid on by nothing. Every gate, every report and
 * every weight downstream then argued about leads while the auction kept
 * buying whoever fills in forms.
 *
 * SWITCHING IT IS NOT FREE, AND THAT IS WHAT THIS MODULE IS FOR. Meta needs
 * about LEARNING_EVENTS of the optimisation event per ad set per
 * LEARNING_WINDOW_DAYS to leave the learning phase. Qualified leads are a
 * fraction of form fills, so an account that switches too early does not get a
 * sharper optimiser — it gets an ad set that never leaves learning, on every
 * arm at once. That is a worse outcome than the problem.
 *
 * So the switch is EVIDENCE-GATED, on the bound facing the threshold, the same
 * rule `min-evidence.ts` states: the account must be able to prove it produces
 * enough qualified leads per arm per week, not merely to have averaged it.
 *
 * Pure — no I/O, no clock, no credentials. Runs in `pnpm guards`.
 */
import { LEARNING_EVENTS, LEARNING_WINDOW_DAYS } from '@/lib/freehold/learning-phase'
import { countBounds } from '@/lib/freehold/min-evidence'
import type { MetaOptimizationGoal } from '@/lib/meta/types'

/** Walkable — the two things an ad set can be told to buy. */
export const QUALIFIED_GOALS = ['qualified', 'lead'] as const
export type QualifiedGoal = (typeof QUALIFIED_GOALS)[number]

/** Walkable — each renders its own sentence. */
export const QUALIFIED_GOAL_REASONS = [
  'learnable', 'notAPixelGoal', 'noConversion', 'noneReported', 'tooFewToLearn',
] as const
export type QualifiedGoalReason = (typeof QUALIFIED_GOAL_REASONS)[number]

export interface QualifiedGoalRead {
  goal: QualifiedGoal
  reason: QualifiedGoalReason
  /**
   * The provable floor on qualified leads per arm per week — the LOWER bound,
   * never the average. null when there is nothing to compute one from.
   */
  perArmPerWeek: number | null
  /** What one arm needs per week to leave learning. */
  neededPerWeek: number
}

/**
 * Only a goal that optimises against the PIXEL can be pointed at a custom
 * conversion. An instant form is promoted through the Page — `promoted_object`
 * carries a `page_id` and there is nowhere to put a conversion id — and a
 * click or view goal is not buying an outcome at all.
 *
 * Stated as a list rather than inferred so that a goal Meta adds later is
 * excluded until somebody looks at it, which is the safe direction: the cost
 * of missing a switch is some optimiser sharpness, the cost of writing a
 * conversion id into a body that cannot hold one is a refused launch.
 */
export const PIXEL_OPTIMISED_GOALS: readonly MetaOptimizationGoal[] = ['OFFSITE_CONVERSIONS']

export function isPixelOptimised(goal: MetaOptimizationGoal): boolean {
  return PIXEL_OPTIMISED_GOALS.includes(goal)
}

/** The event name capi.ts sends when a broker qualifies a lead. Stated here so
 *  the sender, the finder and the recommender share one spelling. */
export const QUALIFIED_EVENT_NAME = 'QualifiedLead'

/**
 * Is this custom conversion the one the CRM's QualifiedLead lands in?
 *
 * ONE matcher, used by the launch-time finder (qualified-goal-db) and by the
 * Pixel tab's recommender. Two copies would let the recommender build a
 * conversion the finder then fails to recognise — a button that "worked" and
 * changed nothing.
 */
export function isQualifiedConversion(c: { rule?: string | null; name?: string | null }): boolean {
  // Tolerant of the separator: the RULE carries the event name verbatim
  // ('QualifiedLead'), but a conversion built by hand in Ads Manager is named
  // by a person — 'Qualified Lead (CRM)', 'qualified_lead' — and refusing
  // those would offer to create a duplicate beside the one that already works.
  return /qualified[\s_-]*lead/i.test(`${c.rule ?? ''} ${c.name ?? ''}`)
}

/**
 * Should this ad set be told to buy qualified leads?
 *
 * `qualifiedInWindow` is how many QualifiedLead events the account actually
 * reported over `windowDays`; `arms` is how many ad sets will share them,
 * because the learning floor is per ad set and an account that clears it in
 * total while running eight arms clears it on none of them.
 */
export function chooseQualifiedGoal(input: {
  /** The custom conversion built on QualifiedLead, or null if none exists. */
  conversionId: string | null
  optimizationGoal: MetaOptimizationGoal
  qualifiedInWindow: number
  windowDays: number
  arms: number
}): QualifiedGoalRead {
  const neededPerWeek = LEARNING_EVENTS
  const no = (reason: QualifiedGoalReason, perArmPerWeek: number | null = null): QualifiedGoalRead =>
    ({ goal: 'lead', reason, perArmPerWeek, neededPerWeek })

  if (!isPixelOptimised(input.optimizationGoal)) return no('notAPixelGoal')
  // Nothing to point at. Refused rather than invented: a conversion id this
  // module made up would be a launch Meta rejects after the campaign exists.
  if (!input.conversionId) return no('noConversion')

  const days = Number.isFinite(input.windowDays) && input.windowDays > 0 ? input.windowDays : 0
  const arms = Number.isFinite(input.arms) && input.arms > 0 ? Math.floor(input.arms) : 1
  const reported = Number.isFinite(input.qualifiedInWindow) ? Math.max(0, input.qualifiedInWindow) : 0
  if (days <= 0) return no('noneReported')
  // NONE REPORTED IS ITS OWN ANSWER. An account that has never sent one is not
  // "a bit short" — it has no signal at all, and the sentence a screen shows
  // for it names a different fix.
  if (reported === 0) return no('noneReported', 0)

  // THE BOUND, NOT THE AVERAGE. Eleven qualified leads in a fortnight averages
  // 5.5 a week; the number a decision may rely on is the low end of what
  // eleven observations support, so a lucky fortnight cannot move every ad set
  // in the account onto an event it cannot sustain.
  const perArmPerWeek = (countBounds(reported).lo / days) * LEARNING_WINDOW_DAYS / arms

  return perArmPerWeek >= neededPerWeek
    ? { goal: 'qualified', reason: 'learnable', perArmPerWeek, neededPerWeek }
    : no('tooFewToLearn', perArmPerWeek)
}
