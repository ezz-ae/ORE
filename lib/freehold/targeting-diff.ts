/**
 * WHAT THIS LIVE AD SET IS MISSING, AND WHETHER FIXING IT IS WORTH IT.
 *
 * "can you implement the better target if there's any to the current ads."
 *
 * The engine now builds a materially better audience than anything running in
 * this account: a property gate that narrows instead of admitting two in five
 * UAE adults, exclusions that are actually sent, and geography that can name a
 * city. Every live campaign was built by hand in Ads Manager and carries none
 * of it.
 *
 * So the obvious move is to push the new targeting onto the running ad sets.
 * The obvious move is usually wrong here, and this module exists to say why.
 *
 * ── A TARGETING EDIT RESETS LEARNING ─────────────────────────────────────
 *
 * Meta re-enters the learning phase on a significant edit, and targeting is
 * one. The ad set goes back to unstable delivery and a higher cost per result
 * until it re-accumulates conversions — and it does that on a NEW audience,
 * so none of what it learned carries over.
 *
 * That means "better targeting" is not free. It costs the delivery already
 * paid for. On an ad set that is producing, a better audience applied badly is
 * worse than a worse audience left alone.
 *
 * ── WHICH IS WHY A RESET IS WORTH IT EXACTLY WHEN THERE IS NOTHING TO LOSE ──
 *
 * Two cases where it plainly is:
 *
 *   1. THE AD SET IS NOT PRODUCING. There is no learning worth keeping.
 *   2. WHAT IT LEARNED IS WRONG. An ad set with Advantage on, or with no
 *      property gate, has spent its learning becoming efficient at finding
 *      the cheapest form-filler. That is not an asset. Resetting it is the
 *      point, not the cost.
 *
 * And one where it plainly is not: an ad set producing rated leads at a cost
 * the account is happy with. There the honest answer is to build the better
 * audience as a NEW ad set and let the two run, which costs a budget rather
 * than a week of delivery.
 *
 * Pure — the live spec and the performance are passed in. Nothing here edits
 * anything. Runs in `pnpm guards`.
 */
import { MIN_ATTRIBUTED_FOR_QUALITY } from '@/lib/freehold/min-evidence'

/** Walkable — every gap this can find, worst first. */
export const TARGETING_GAPS = [
  'advantageOn', 'noPropertyGate', 'wideGate', 'noExclusions', 'countryWide',
] as const
export type TargetingGap = (typeof TARGETING_GAPS)[number]

export interface LiveAdSet {
  id: string
  name: string
  /** Interest and behaviour NAMES anywhere in the spec. */
  signals: string[]
  /** Names in the exclusion block. */
  excluded: string[]
  /** Meta Advantage / audience expansion is on. */
  expanding: boolean
  /** The spec narrows below country level (cities or a radius). */
  subCountry: boolean
  /** Leads attributed to this ad set, and what they were rated. */
  leads: number
  rated: number
  meanRating: number
}

export interface GapFinding {
  gap: TargetingGap
  /** Fixing this requires a targeting edit, which re-enters learning. */
  resetsLearning: boolean
  /**
   * Whether the reset is worth it FOR THIS AD SET. Never a property of the
   * gap alone: the same missing gate is worth fixing on an ad set producing
   * nothing and worth leaving alone on one producing buyers.
   */
  worthApplying: boolean
  /** Why, as an id a screen turns into words. */
  because: 'nothingToLose' | 'learningIsWrong' | 'producing'
}

/** Names that read as being about property. Matched on wording rather than id,
 *  because ids are re-resolved at launch and an id proves nothing about what
 *  it means today — the same reason campaign-setup-check matches on words. */
const PROPERTY_WORDS = /real estate|property|residential|apartment|villa|mortgage/i

/**
 * Property-worded AND too wide to gate anything.
 *
 * `Real estate investing` is ~4M people in the UAE — two in five reachable
 * adults. It is not "no property signal"; it is a property signal that does
 * not narrow, and the distinction changes the instruction: one ad set needs a
 * gate added, the other needs its gate replaced.
 *
 * Reporting it as absent (the first version of this did) would have told an
 * operator their ad set had no property targeting at all, which is both wrong
 * and less useful than the truth.
 */
const WIDE_WORDS = /investing|investment|luxury|wealth/i

/**
 * Is this ad set worth disturbing?
 *
 * Producing means: enough rated leads to be a fact, and rated well enough to
 * be worth keeping. Both halves matter — an ad set with forty leads all rated
 * 2 is not producing, it is producing junk efficiently.
 */
function producing(a: LiveAdSet, valuableRating: number): boolean {
  return a.rated >= MIN_ATTRIBUTED_FOR_QUALITY && a.meanRating >= valuableRating
}

export function diffTargeting(
  a: LiveAdSet,
  opts: { valuableRating: number; standardExclusions: readonly string[] },
): GapFinding[] {
  const out: GapFinding[] = []
  const isProducing = producing(a, opts.valuableRating)

  const add = (gap: TargetingGap, learningIsWrong: boolean) => {
    // A reset is worth it when there is nothing to lose, or when what was
    // learned is itself the problem. Never merely because a rule is missing.
    const worth = learningIsWrong || !isProducing
    out.push({
      gap,
      resetsLearning: true,
      worthApplying: worth,
      because: learningIsWrong ? 'learningIsWrong' : worth ? 'nothingToLose' : 'producing',
    })
  }

  // Advantage overrides the chosen audience, so whatever this ad set learned,
  // it learned about an audience nobody picked. Always wrong learning.
  if (a.expanding) add('advantageOn', true)

  const property = a.signals.filter((n) => PROPERTY_WORDS.test(n))
  if (property.length === 0) {
    // No property signal at all: the ad set has spent its whole life becoming
    // efficient at finding the cheapest form-filler in the country.
    add('noPropertyGate', true)
  } else if (property.every((n) => WIDE_WORDS.test(n))) {
    // EVERY property signal is a wide one, so the gate is there and does not
    // narrow — the failure this codebase already carries three times. `every`,
    // not `some`: one narrow member is enough to gate, and an ad set carrying
    // both a portal interest and `Real estate investing` is gated by the
    // portal. Flagging that would send somebody to fix a working ad set.
    add('wideGate', true)
  }

  const missing = opts.standardExclusions.filter(
    (e) => !a.excluded.some((x) => x.toLowerCase() === e.toLowerCase()),
  )
  if (missing.length > 0) add('noExclusions', false)

  if (!a.subCountry) add('countryWide', false)

  return out
}

/**
 * The one instruction for this ad set.
 *
 * `edit` when a reset is worth it, `duplicate` when the ad set is producing
 * and the better audience should run alongside instead, `leave` when there is
 * nothing to fix. One instruction, not a list — an operator with four
 * findings and no verdict does nothing.
 */
export function instructionFor(findings: readonly GapFinding[]): 'edit' | 'duplicate' | 'leave' {
  if (findings.length === 0) return 'leave'
  if (findings.some((f) => f.worthApplying)) return 'edit'
  return 'duplicate'
}
