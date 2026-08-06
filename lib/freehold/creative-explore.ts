/**
 * CREATIVE EXPLORATION — the lever the machine was watching and never pulling.
 *
 * The engine explored targeting: an Explore arm broadened a winner's audience
 * one age step. The ad itself never changed after launch. When frequency
 * climbed past 3 the machine raised a fatigue alarm and stopped there, on this
 * reasoning, which was correct as far as it went:
 *
 *     Swapping the creative on a working campaign resets Meta's learning phase
 *     and replaces a KNOWN performer with an unknown one — a decision that can
 *     wipe out the very winner it means to rescue.
 *
 * Every word of that is true about a SWAP. It is not true about an ADDITION.
 *
 * Mint a sibling instead: same targeting, same budget scale, a different
 * angle. The fatigued winner keeps running untouched — its learning intact,
 * its delivery undisturbed — while a fresh creative proves itself alongside.
 * Budget only moves once the sibling has earned it, through the same
 * comparison every other arm faces. Nothing known is risked to test something
 * unknown, which is the objection the original reasoning raised and the reason
 * it settled for an alarm.
 *
 * WHY FATIGUE IS THE RIGHT TRIGGER. Frequency is the one creative signal that
 * needs no new instrumentation and cannot be argued with: when the average
 * person has seen the ad three times, further spend is buying repeat
 * impressions from people who already scrolled past. That is the moment a
 * second creative is worth its budget, and it arrives on its own.
 *
 * WHY ONLY ONE VARIABLE MOVES. A creative arm keeps the winner's targeting
 * exactly. A targeting arm keeps the winner's creative exactly. An arm that
 * changed both would be a new campaign wearing an experiment's clothes — its
 * result attributable to nothing.
 *
 * Pure — no I/O, no clock.
 */
import type { CreativeAngle } from '@/lib/meta/types'

/**
 * Angles paired by opposition, so a second creative is genuinely a second
 * argument rather than a rephrasing.
 *
 * A fatigued audience has already rejected — or exhausted — one pitch. Showing
 * them a near-identical one tests the wording; showing them the opposite pitch
 * tests whether the argument was the problem. The second is worth more, and it
 * is the reason this is a table rather than "pick the next one in the list".
 */
const OPPOSITE: Record<CreativeAngle, CreativeAngle> = {
  investor: 'lifestyle',     // returns and yield ⟷ how it feels to live there
  lifestyle: 'investor',
  yield: 'end_user',         // the numbers ⟷ the home
  end_user: 'yield',
  urgency: 'golden_visa',    // act now ⟷ the long-term reason to act at all
  golden_visa: 'urgency',
}

/** Fallback order when the opposite has already been tried. Deliberately
 *  fixed, so the same history always produces the same next angle and two
 *  machines never disagree about what to test. */
const ORDER: CreativeAngle[] = ['investor', 'yield', 'end_user', 'lifestyle', 'urgency', 'golden_visa']

/**
 * The next angle worth testing against a winner.
 *
 * Returns null when every angle has been tried for this project — at which
 * point the answer is a new image or a new offer, not another rewrite, and
 * saying so beats cycling back to the beginning and calling it exploration.
 */
export function nextAngle(current: CreativeAngle, tried: CreativeAngle[]): CreativeAngle | null {
  const used = new Set<CreativeAngle>([current, ...tried])
  const opposite = OPPOSITE[current]
  if (opposite && !used.has(opposite)) return opposite
  return ORDER.find((a) => !used.has(a)) ?? null
}

export interface FatigueState {
  /** Meta's average impressions per person. */
  frequency: number | null
  /** Whether this trial has produced leads at all — a fatigued arm that never
   *  worked does not deserve a fresh creative, it deserves to stop. */
  leads: number
  /** Creative arms already minted for this project, against the lifetime cap. */
  creativeArmsMinted: number
}

/** Frequency at which a second creative earns its budget. Matches the engine's
 *  own fatigue alarm, deliberately — one threshold, one meaning. */
export const FATIGUE_FREQUENCY = 3.0
/** Lifetime cap per project. Creative arms are cheap to mint and expensive to
 *  leave running; two is enough to learn whether the argument or the audience
 *  was the problem. */
export const MAX_CREATIVE_ARMS_PER_PROJECT = 2

export type CreativeArmDecision =
  | { mint: true; reason: string }
  | { mint: false; reason: string }

/**
 * Should a creative sibling be minted for this trial?
 *
 * Four conditions, and the third is the one that keeps this honest: a
 * fatigued arm that has never produced a lead is not suffering from creative
 * fatigue. It is suffering from not working, and giving it a second creative
 * spends more money on the same wrong thing.
 */
export function shouldMintCreativeArm(s: FatigueState): CreativeArmDecision {
  if (s.frequency === null) {
    return { mint: false, reason: 'no frequency reading yet — nothing says this creative is worn out' }
  }
  if (s.frequency < FATIGUE_FREQUENCY) {
    return { mint: false, reason: `frequency ${s.frequency.toFixed(1)} is below ${FATIGUE_FREQUENCY} — this ad is still reaching new people` }
  }
  if (s.leads === 0) {
    return {
      mint: false,
      reason: `frequency ${s.frequency.toFixed(1)} with no leads at all — this is not a worn-out creative, it is one that never worked. A second angle would spend more on the same wrong thing.`,
    }
  }
  if (s.creativeArmsMinted >= MAX_CREATIVE_ARMS_PER_PROJECT) {
    return {
      mint: false,
      reason: `${s.creativeArmsMinted} creative arms already minted for this project — the cap. If two angles have not fixed it, the answer is a new image or a new offer, not another rewrite.`,
    }
  }
  return {
    mint: true,
    reason: `frequency ${s.frequency.toFixed(1)} on ${s.leads} lead${s.leads === 1 ? '' : 's'} — the audience works and the ad is worn out. A sibling with a different angle tests that without touching the winner, so nothing proven is risked.`,
  }
}

/** The angle assumed for a trial whose source does not map to one — the
 *  broadest of the six, so a fallback never accidentally narrows the test. */
export const CREATIVE_ANGLE_FALLBACK: CreativeAngle = 'investor'
