/**
 * THE LOOKALIKE LADDER — widen when the data says the tier is used up, not
 * when someone gets impatient.
 *
 * A lookalike tier is a fixed pool: the top 1% most-similar people in a
 * country is a finite set, and once you have shown your ad to all of them the
 * only thing more budget buys is showing it to the same people again. That is
 * what frequency measures, and it is the honest signal for "extend the
 * audience" — no new seed data required, which is the point.
 *
 * THE TRAP THIS AVOIDS. Rising frequency alone is not saturation. An ad set
 * with a tiny budget and a narrow geo will show frequency creep too, and
 * widening it would abandon a tier that was never actually exhausted.
 * Saturation is three things at once:
 *
 *   1. frequency at or above the ceiling — people are seeing it repeatedly,
 *   2. reach growth flattened — new people have stopped arriving,
 *   3. the tier is WORKING — it produced leads at a rate worth extending.
 *
 * The third is the one everybody forgets, and leaving it out inverts the whole
 * mechanism: an ad set that is failing also stops reaching new people, so
 * without a performance condition the ladder would climb fastest on exactly
 * the audiences that deserve to be switched off. A tier that saturates without
 * converting is not a tier to widen. It is a tier to stop.
 *
 * Pure — no I/O, no clock.
 */
import { samePace, SIGNIFICANT_P } from '@/lib/freehold/inventory-quality'
import { rateRange } from '@/lib/freehold/min-evidence'

/** The rungs, as Meta ratios. 1% is the tightest similarity Meta offers and
 *  10% is the widest worth calling a lookalike at all. */
export const LADDER: readonly number[] = [0.01, 0.02, 0.03, 0.05, 0.10]

/**
 * Frequency at which a tier is considered to be repeating itself.
 *
 * 1.6 is the operator's own working number and it is a defensible one: below
 * ~1.5 most impressions are still first views, and much above 2 the marginal
 * impression is mostly a re-view. It is a policy constant, not a discovered
 * one, and it is named here so a decision can cite it instead of hiding it.
 */
export const FREQUENCY_CEILING = 1.6

/** Reach growing slower than this across the observation window counts as
 *  flattened — the pool has stopped producing new people. */
export const REACH_GROWTH_FLOOR = 0.05

export interface TierState {
  /** Current ratio, e.g. 0.01. */
  ratio: number
  impressions: number
  reach: number
  leads: number
  spend: number
  /** Reach at the previous observation, for growth. Null on the first look. */
  previousReach: number | null
}

export type LadderAction =
  /** Saturated AND working — widen to the next rung. */
  | 'widen'
  /** Saturated and NOT working — widening would buy more of what is failing. */
  | 'stop'
  /** Still reaching new people. Leave it. */
  | 'hold'
  /** Not enough delivery to say anything yet. */
  | 'too_early'

export interface LadderVerdict {
  action: LadderAction
  /** The rung to move to, when widening. Null otherwise. */
  nextRatio: number | null
  frequency: number
  reachGrowth: number | null
  /** Leads per million impressions, and whether it beat the reference rate. */
  lpm: number | null
  reason: string
}

/**
 * Minimum impressions before the ladder will say anything at all.
 *
 * Frequency on a few thousand impressions is noise — a handful of heavy users
 * can carry it past the ceiling while the pool is barely touched.
 */
export const MIN_IMPRESSIONS_FOR_LADDER = 20_000

/**
 * Should this tier widen?
 *
 * `referenceLeads / referenceImpressions` is what the tier is judged against —
 * normally the account's own blended rate. Without one, "working" falls back
 * to "produced any leads at all", which is weaker and is described as such in
 * the reason so nobody mistakes it for a comparison.
 */
export function assessTier(
  t: TierState,
  reference?: { leads: number; impressions: number },
): LadderVerdict {
  const frequency = t.reach > 0 ? t.impressions / t.reach : 0
  const reachGrowth = t.previousReach !== null && t.previousReach > 0
    ? (t.reach - t.previousReach) / t.previousReach
    : null
  const lpm = t.impressions > 0 ? (t.leads / t.impressions) * 1_000_000 : null

  if (t.impressions < MIN_IMPRESSIONS_FOR_LADDER) {
    return {
      action: 'too_early', nextRatio: null, frequency, reachGrowth, lpm,
      reason: `${t.impressions.toLocaleString()} impressions — frequency is not meaningful below ${MIN_IMPRESSIONS_FOR_LADDER.toLocaleString()}, and widening on it would be guesswork.`,
    }
  }

  const repeating = frequency >= FREQUENCY_CEILING
  // A null growth reading (first observation) is NOT flattening. Treating
  // "we have not measured twice yet" as "it stopped growing" would widen every
  // tier on its first look.
  const flattened = reachGrowth !== null && reachGrowth < REACH_GROWTH_FLOOR

  if (!repeating || !flattened) {
    return {
      action: 'hold', nextRatio: null, frequency, reachGrowth, lpm,
      reason: !repeating
        ? `Frequency ${frequency.toFixed(2)} is below ${FREQUENCY_CEILING} — this tier is still finding new people.`
        : reachGrowth === null
        ? `Frequency ${frequency.toFixed(2)} is at the ceiling, but reach has only been measured once. One more reading will show whether the pool is actually used up.`
        : `Frequency ${frequency.toFixed(2)} is at the ceiling but reach still grew ${(reachGrowth * 100).toFixed(0)}% — there are new people left.`,
    }
  }

  // Saturated. The only remaining question is whether it earned an extension.
  let working: boolean
  let performanceNote: string
  if (reference && reference.impressions > 0) {
    const p = samePace(t.leads, t.impressions, reference.leads, reference.impressions)
    const refRate = reference.leads / reference.impressions
    const tierRate = t.leads / t.impressions
    // Worse than the reference AND provably so → do not extend it.
    const provablyWorse = p < SIGNIFICANT_P && tierRate < refRate
    working = !provablyWorse && t.leads > 0
    performanceNote = provablyWorse
      ? `it converts worse than the rest of the account (p=${p.toFixed(3)})`
      : t.leads === 0
      ? 'it has produced no leads at all'
      : `it converts at ${Math.round(lpm ?? 0)} per million, in line with or better than the account`
  } else {
    working = t.leads > 0
    performanceNote = t.leads > 0
      ? `it produced ${t.leads} lead${t.leads === 1 ? '' : 's'} (no account reference to compare against, so this is a weak test)`
      : 'it produced no leads'
  }

  if (!working) {
    return {
      action: 'stop', nextRatio: null, frequency, reachGrowth, lpm,
      reason: `Saturated at frequency ${frequency.toFixed(2)} with reach flat, and ${performanceNote}. Widening would buy more of something that is not working — stop this tier instead.`,
    }
  }

  const i = LADDER.indexOf(t.ratio)
  const next = i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1] : null
  if (next === null) {
    return {
      action: 'hold', nextRatio: null, frequency, reachGrowth, lpm,
      reason: `Saturated and performing, but ${Math.round(t.ratio * 100)}% is the widest rung — beyond this a lookalike stops being a similarity model. Change the seed rather than the ratio.`,
    }
  }

  return {
    action: 'widen', nextRatio: next, frequency, reachGrowth, lpm,
    reason: `Frequency ${frequency.toFixed(2)} with reach flat at ${(reachGrowth * 100).toFixed(0)}% growth — the ${Math.round(t.ratio * 100)}% pool is used up, and ${performanceNote}. Widen to ${Math.round(next * 100)}%.`,
  }
}

/**
 * The honest range on a tier's conversion rate, for showing beside the verdict.
 * A widen decision made on 3 leads should be visibly made on 3 leads.
 */
export const tierRateRange = (t: TierState) => rateRange(t.leads, t.impressions, 1_000_000)
