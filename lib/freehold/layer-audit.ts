/**
 * LAYER AUDIT — which of your targeting layers is actually doing anything.
 *
 * A stacked audience looks like work. Base interests, narrowed by a behaviour,
 * narrowed again by a second behaviour, minus two exclusions: five decisions,
 * five things to feel clever about. Very often three of them change nothing at
 * all, and nobody finds out, because the ad set delivers and the numbers look
 * like numbers. You end up understanding a dish you imagined rather than the
 * one you cooked.
 *
 * The measurement is simple and it costs nothing: ask Meta for the audience
 * size of the full stack, then again with each layer REMOVED. If taking a
 * layer out barely changes the reach, that layer was never narrowing anything —
 * it was decoration. Meta will happily accept it and never mention it.
 *
 * This runs BEFORE a dirham is spent, which is the whole value: a stack can be
 * argued with while it is still a draft.
 *
 * NOTHING TAKES THE SAME WEIGHT. Every layer gets its own measured share of the
 * narrowing, and every exclusion its own measured bite. There is deliberately
 * no "5 layers so 20% each" anywhere in this file: an equal split would be an
 * assumption wearing the costume of a measurement, and the entire point is to
 * stop assuming.
 *
 * WHAT IT CANNOT SEE. Reach is a size, not a quality. A layer that halves the
 * audience is doing real work, and it may still be halving it in the wrong
 * direction — cutting away exactly the people who would have bought. Size
 * answers "is this layer connected to anything"; only outcomes answer "is this
 * layer right", and that is `relevance.ts`. A layer with real narrowing power
 * and no proven relevance is a layer doing something confident and unverified.
 *
 * Pure — no I/O. The reach calls live in the route that feeds this.
 */

/** One thing a stack does, and the audience size when it is taken away. */
export interface LayerProbe {
  /** Stable id — an interest/behaviour id, or a group label. */
  id: string
  name: string
  kind: 'interest' | 'behavior' | 'narrowing_group' | 'exclusion' | 'age' | 'geo' | 'language'
  /** Audience size with the FULL stack minus this one layer. For an exclusion,
   *  this is the size when the exclusion is not applied — bigger, not smaller. */
  reachWithout: number
}

export interface StackProbe {
  /** Audience size of the complete stack, exactly as it would launch. */
  full: number
  /** Audience size with nothing but geo + age — the widest the account would
   *  ever run. The denominator for "what did all this layering buy me". */
  baseline: number
  layers: LayerProbe[]
}

export type LayerVerdict =
  /** Removing it materially changes the audience — it is doing real work. */
  | 'load_bearing'
  /** Removing it changes the audience a little. Real, minor. */
  | 'minor'
  /** Removing it changes almost nothing. Meta is effectively ignoring it. */
  | 'ignored'

export interface LayerReading extends LayerProbe {
  /**
   * How much of the audience this layer removes, relative to the stack without
   * it. 0 = removes nobody, 1 = removes everybody.
   *
   * Computed per layer against its OWN counterfactual, never as a share of a
   * total — layers overlap, so their individual powers do not and should not
   * sum to one. Presenting them as a pie would be a lie with a chart on it.
   */
  narrowingPower: number
  /** The complement: how much of this layer Meta is disregarding. The number
   *  the operator asked for. */
  ignoranceRate: number
  verdict: LayerVerdict
  sentence: string
}

/** Below this share of the audience moved, a layer is doing nothing an
 *  operator would notice or could measure. */
export const IGNORED_BELOW = 0.02
/** At or above this, the layer is genuinely shaping the buy. */
export const LOAD_BEARING_AT = 0.15

export interface StackAudit {
  readings: LayerReading[]
  full: number
  baseline: number
  /** How much of the baseline audience the whole stack removes. The honest
   *  answer to "did all this layering do anything". */
  stackNarrowing: number
  ignored: LayerReading[]
  loadBearing: LayerReading[]
  headline: string
  recommendation: string
}

const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`

/**
 * Audit a stack from its probes.
 *
 * An exclusion is measured the same way but reads in the opposite direction:
 * `reachWithout` is LARGER than the full stack, and the bite is how much of
 * that larger audience the exclusion removes. The arithmetic is identical
 * precisely because the question is — "what changes when this is not there".
 */
export function auditStack(probe: StackProbe): StackAudit {
  const { full, baseline } = probe

  const readings: LayerReading[] = probe.layers.map((l) => {
    // Guard the degenerate cases explicitly rather than letting a divide by
    // zero become a confident 0% or NaN on a screen.
    const without = l.reachWithout
    const narrowingPower = without > 0 ? Math.max(0, Math.min(1, 1 - full / without)) : 0
    const ignoranceRate = 1 - narrowingPower
    const verdict: LayerVerdict =
      narrowingPower < IGNORED_BELOW ? 'ignored'
      : narrowingPower >= LOAD_BEARING_AT ? 'load_bearing'
      : 'minor'

    const isExclusion = l.kind === 'exclusion'
    const sentence =
      verdict === 'ignored'
        ? isExclusion
          ? `"${l.name}" excludes ${pct(narrowingPower)} of the audience — it is not removing anyone. Meta is effectively ignoring it.`
          : `"${l.name}" narrows the audience by ${pct(narrowingPower)}. Removing it would change nothing — this layer is decoration.`
        : verdict === 'load_bearing'
        ? isExclusion
          ? `"${l.name}" removes ${pct(narrowingPower)} of the audience. That is a real cut — worth knowing it is the right one.`
          : `"${l.name}" carries ${pct(narrowingPower)} of the narrowing. This layer is shaping the buy.`
        : `"${l.name}" moves ${pct(narrowingPower)} of the audience — real but minor.`

    return { ...l, narrowingPower, ignoranceRate, verdict, sentence }
  })

  // Sorted by what each layer actually does. Nothing takes the same weight, so
  // nothing is presented in the order it happened to be typed in.
  readings.sort((a, b) => b.narrowingPower - a.narrowingPower)

  const ignored = readings.filter((r) => r.verdict === 'ignored')
  const loadBearing = readings.filter((r) => r.verdict === 'load_bearing')
  const stackNarrowing = baseline > 0 ? Math.max(0, Math.min(1, 1 - full / baseline)) : 0

  const headline = baseline <= 0 || full <= 0
    ? 'Meta returned no audience size for this stack — nothing can be measured yet.'
    : `The full stack reaches ${full.toLocaleString()} people, ${pct(stackNarrowing)} narrower than geo and age alone (${baseline.toLocaleString()}).`

  const recommendation =
    baseline <= 0 || full <= 0
      ? 'Re-check once Meta returns an audience estimate.'
      : ignored.length === 0
      ? loadBearing.length > 0
        ? 'Every layer is doing something. Whether it is doing the RIGHT thing is a question for outcomes, not size.'
        : 'No layer is doing much individually, but none is dead either — this stack is loose rather than wrong.'
      : ignored.length === readings.length
      ? `None of these ${readings.length} layers changes the audience. This stack is geo and age wearing a costume — drop the layers or replace them with ones that bite.`
      : `Drop ${ignored.map((r) => `"${r.name}"`).join(', ')} — ${ignored.length === 1 ? 'it changes' : 'they change'} nothing, and ${ignored.length === 1 ? 'it makes' : 'they make'} the stack harder to reason about for no gain.`

  return { readings, full, baseline, stackNarrowing, ignored, loadBearing, headline, recommendation }
}

/**
 * The LEVELS view: what each successive layer bought, in the order it is
 * applied.
 *
 * The audit above answers "what does this layer do on its own". This answers
 * the operator's other question — "level after level, where did my audience
 * actually go" — and the two disagree whenever layers overlap, which is
 * exactly when a stack is worth arguing about. A layer can look load-bearing
 * alone and add nothing once the layer before it has already cut those people.
 *
 * `cumulative[i]` is the audience size after applying layers 0..i.
 */
export interface LevelStep {
  index: number
  name: string
  /** Audience size after this level is applied. */
  size: number
  /** People removed by THIS level, given everything before it. */
  removed: number
  /** That removal as a share of the audience entering the level. */
  share: number
  /** True when this level removed essentially nobody that earlier levels had
   *  not already removed — the redundancy an ordered read exists to expose. */
  redundant: boolean
}

export function levels(baseline: number, cumulative: Array<{ name: string; size: number }>): LevelStep[] {
  const out: LevelStep[] = []
  let previous = baseline
  cumulative.forEach((c, index) => {
    const removed = Math.max(0, previous - c.size)
    const share = previous > 0 ? removed / previous : 0
    out.push({ index, name: c.name, size: c.size, removed, share, redundant: share < IGNORED_BELOW })
    previous = c.size
  })
  return out
}

/**
 * SCALE MISMATCH inside an OR group.
 *
 * Meta's base group and every narrowing group are OR internally: a person
 * matches the group if they match ANY entry. So a mass behaviour placed beside
 * a narrow one does not COMBINE with it — it swallows it. Put "Engaged
 * Shoppers" (tens of millions) next to a high-net-worth investment behaviour
 * (a few hundred thousand) and the group is, to within a rounding error,
 * Engaged Shoppers. The investment behaviour is still listed, still visible in
 * Ads Manager, still discussed in the meeting, and contributing nothing.
 *
 * This is the most common way a stack lies to its author, and it needs no
 * spend to detect: Meta publishes an audience-size band for every entity in
 * its vocabulary, and the arithmetic of a union does the rest.
 *
 * The check is deliberately about ORDERS OF MAGNITUDE, not small differences.
 * Two behaviours within 2-3x of each other genuinely blend. One that is
 * twenty times larger than its neighbour is not a sibling, it is the group.
 *
 * THE FIX IS STRUCTURAL, NOT SUBTRACTIVE. The answer is rarely "delete the
 * mass segment" — it is usually the audience you actually want to fish in.
 * The answer is to move it DOWN a level:
 *
 *     wrong:  [ interested in apartments  OR  investor ]
 *             -> you bought "interested in apartments"
 *
 *     right:  base       [ interested in apartments ]
 *             narrowed by [ investor  OR  first-time buyer ]
 *             -> a person must match the base AND one of the intents
 *
 * Same three segments, completely different buy. The OR only belongs between
 * things of comparable scale — two intents, not an intent and a universe.
 */

/** How many times larger a sibling must be before it drowns the others. Ten is
 *  the point at which the smaller entity can contribute at most ~9% of the
 *  union even with zero overlap — and real overlap makes it less. */
export const DOMINANCE_RATIO = 10

export interface SizedEntity {
  id: string
  name: string
  /** Meta's own audience-size estimate for the entity. Use the midpoint of its
   *  published band; null when Meta gives no band. */
  size: number | null
}

export interface DominanceReading {
  /** The entity that dominates the group. */
  dominant: SizedEntity
  /** Entities it swallows — present in the group, contributing nothing. */
  drowned: Array<SizedEntity & {
    /** Largest share of the union this entity could contribute, assuming ZERO
     *  overlap with the dominant one. Real overlap only makes it smaller, so
     *  this is a ceiling, not an estimate. */
    maxShare: number
  }>
  sentence: string
}

/**
 * Find entities that cannot matter because a sibling is orders of magnitude
 * larger.
 *
 * Returns null when the group is balanced, when there are fewer than two
 * entities, or when Meta gave no sizes — an unmeasurable group is reported as
 * unmeasurable rather than as healthy.
 */
export function orDominance(entities: SizedEntity[], ratio = DOMINANCE_RATIO): DominanceReading | null {
  const sized = entities.filter((e) => typeof e.size === 'number' && (e.size as number) > 0)
  if (sized.length < 2) return null

  const dominant = sized.reduce((a, b) => ((b.size as number) > (a.size as number) ? b : a))
  const big = dominant.size as number
  const drowned = sized
    .filter((e) => e.id !== dominant.id && big / (e.size as number) >= ratio)
    .map((e) => ({ ...e, maxShare: (e.size as number) / (big + (e.size as number)) }))
    .sort((a, b) => a.maxShare - b.maxShare)

  if (drowned.length === 0) return null

  return {
    dominant,
    drowned,
    sentence:
      `"${dominant.name}" is ${Math.round(big / (drowned[drowned.length - 1].size as number))}x larger than ` +
      `${drowned.length === 1 ? 'its neighbour' : 'its neighbours'} in this group. ` +
      `Because a group is OR, ${drowned.map((d) => `"${d.name}"`).join(', ')} ` +
      `${drowned.length === 1 ? 'can contribute at most' : 'can each contribute at most'} ` +
      `${drowned.map((d) => pct(d.maxShare)).join(', ')} of it — and less once they overlap. ` +
      `Move "${dominant.name}" to the BASE and put ${drowned.map((d) => `"${d.name}"`).join(' / ')} in a narrowing layer, ` +
      `so ${drowned.length === 1 ? 'it ANDs' : 'they AND'} against the base instead of disappearing into it. ` +
      `As written, ${drowned.length === 1 ? 'it is' : 'they are'} being bought in name only.`,
  }
}

/**
 * Every group in a stack, checked for scale mismatch.
 *
 * Reported per group because that is the unit Meta ORs over — a mass behaviour
 * in the base group says nothing about a narrow one used as a NARROWING
 * constraint, since those AND together and the small one genuinely binds.
 */
export function auditGroupBalance(
  groups: Array<{ label: string; entities: SizedEntity[] }>,
  ratio = DOMINANCE_RATIO,
): Array<{ label: string; reading: DominanceReading }> {
  const out: Array<{ label: string; reading: DominanceReading }> = []
  for (const g of groups) {
    const reading = orDominance(g.entities, ratio)
    if (reading) out.push({ label: g.label, reading })
  }
  return out
}

/**
 * THE LEVEL SCHEMA.
 *
 * Ten levels, five including and five excluding, mirrored:
 *
 *    +1  PERSONA        who we sell to          — the TARGET. This is the buy.
 *    +2  MONEY          can they complete        — EXPECTED of them
 *    +3  PRODUCT        what they want           — APPRECIATED when present
 *    +4  DECISION       deciding now             — VALUED highly
 *    +5  EXPERIMENTAL   the deliberate unknown   — TRIED, never relied on
 *
 *    -1  OUT OF TARGET  not the persona at all
 *    -2  POOR           cannot complete
 *    -3  NOT INTERESTED wrong product
 *    -4  NOT SERIOUS    browsing, scared, never going to sign
 *    -5  EXPERIMENTAL   the deliberate negative test
 *
 * NARROWING IS NOT FEWER PEOPLE. IT IS A CLOSER TOUCH.
 *
 * This is the correction that makes the schema work, and getting it backwards
 * is the standard way a stack destroys itself. Stacking every level as a hard
 * AND does shrink the audience — and what it actually does is REFUSE the
 * person who matches four levels out of five. Someone who is the persona, has
 * the money, wants the product and is deciding now, but whom Meta never tagged
 * with one of those five labels, is thrown away by an AND. Meta's segments are
 * inferences with wide error bars; treating each one as a gate compounds five
 * uncertain guesses into one confident exclusion.
 *
 * So we do not RULE with the levels. We WEIGHT with them.
 *
 *    We target level 1.
 *    We expect level 2.
 *    We appreciate level 3.
 *    We value level 4.
 *    We try level 5.
 *
 * Level 1 is what you buy — the ad set runs on the persona. Levels 2 to 5 are
 * how closely each person matches, and a person carrying more of them is a
 * multi-touched person: the same audience, reached with a closer touch, worth
 * more per impression. That is a weight, a bid, a separate arm to measure —
 * never a gate that discards the four-out-of-five.
 *
 * The exclusions are different, and they are the one place hard rules belong.
 * -1 to -4 are things we have PROVEN bad, not things we merely hope for. A
 * negative fact earns a rule; a positive hope earns a weight.
 *
 * This is a DOCTRINE, written down so a stack can be checked against it and
 * argued with, rather than each operator holding a private version in their
 * head.
 */
export type AudienceLevel = 1 | 2 | 3 | 4 | 5 | -1 | -2 | -3 | -4 | -5

export const LEVEL_LABEL: Record<AudienceLevel, string> = {
  1: 'Targeted persona',
  2: 'Money',
  3: 'Product interest',
  4: 'Decision',
  5: 'Experimental',
  [-1]: 'Out of target',
  [-2]: 'Poor',
  [-3]: 'Not interested',
  [-4]: 'Not serious or scared',
  [-5]: 'Experimental (negative)',
}

/** What each level is FOR. The verb is the whole doctrine in one word. */
export type LevelRole = 'target' | 'expect' | 'appreciate' | 'value' | 'try'
export const LEVEL_ROLE: Record<1 | 2 | 3 | 4 | 5, LevelRole> = {
  1: 'target', 2: 'expect', 3: 'appreciate', 4: 'value', 5: 'try',
}

/**
 * How much a match at each level is worth, relative to the persona.
 *
 * Ascending, because a person who is deciding NOW is worth more than one who
 * merely has the money — but level 1 still anchors at 1.0 because it is the
 * thing being bought, not a bonus. Level 5 is worth the least: it is a guess
 * being tested, and paying a premium for an untested guess is how an
 * experiment stops being an experiment.
 */
export const LEVEL_WEIGHT: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1.0, 2: 1.5, 3: 1.8, 4: 2.5, 5: 1.1,
}

export const INCLUSION_ORDER: readonly AudienceLevel[] = [1, 2, 3, 4, 5]
export const EXCLUSION_ORDER: readonly AudienceLevel[] = [-1, -2, -3, -4, -5]

/** The exclusion that does the same job as a given inclusion, and vice versa. */
export const mirrorOf = (l: AudienceLevel): AudienceLevel => -l as AudienceLevel

/**
 * TOUCH DEPTH — how close a given person's match is.
 *
 * Not a filter and not a probability: an ordering, used to weight a bid, to
 * rank a seed, or to decide which arm deserves more budget. A person matching
 * only the persona still scores; they are simply touched less closely than one
 * who also has the money and is deciding now.
 *
 * Returns 0 when the persona is absent, because level 1 is the buy — someone
 * outside the persona who happens to have money is not a closer touch, they
 * are a different person.
 */
export function touchDepth(matched: Array<1 | 2 | 3 | 4 | 5>): {
  score: number
  levels: Array<1 | 2 | 3 | 4 | 5>
  /** Plain description, e.g. "persona + money + decision". */
  description: string
} {
  const uniq = Array.from(new Set(matched)).sort((a, b) => a - b) as Array<1 | 2 | 3 | 4 | 5>
  if (!uniq.includes(1)) {
    return { score: 0, levels: uniq, description: 'outside the persona — not a closer touch, a different person' }
  }
  const score = uniq.reduce((n, l) => n + LEVEL_WEIGHT[l], 0)
  return {
    score: Math.round(score * 100) / 100,
    levels: uniq,
    description: uniq.map((l) => LEVEL_LABEL[l].toLowerCase()).join(' + '),
  }
}

export interface OrderedLevel {
  name: string
  level: AudienceLevel | null
  /** True when this layer is applied as a hard AND / narrowing constraint
   *  rather than carried as a weight or run as its own arm. */
  hardRule?: boolean
  index: number
}

/** An OrderedLevel that has actually been placed on the schema. */
export type PlacedLevel = OrderedLevel & { level: AudienceLevel }

export interface OrderVerdict {
  correct: boolean
  /** Positive levels above 1 applied as hard rules — ruling where they should
   *  weight, which throws away the four-out-of-five match. */
  ruledNotWeighted: PlacedLevel[]
  /** True when nothing in the stack is the persona — there is no buy, only
   *  qualifiers on an audience nobody defined. */
  missingPersona: boolean
  /** Inclusion levels absent from the stack entirely. */
  missing: AudienceLevel[]
  /** An inclusion and its mirror exclusion both present: one job twice. */
  redundantMirrors: Array<{ include: PlacedLevel; exclude: PlacedLevel; level: AudienceLevel }>
  /** Level 5 applied as a hard rule — an untested guess gating a real buy. */
  experimentalAsRule: boolean
  headline: string
  recommendation: string
}

/**
 * Check a stack against the doctrine.
 *
 * Unplaced layers are skipped rather than assumed wrong: a layer we could not
 * classify is not evidence of a bad stack, and guessing its level in order to
 * have an opinion would be exactly the imagining this file exists against.
 */
export function assessLevelOrder(levelsIn: OrderedLevel[]): OrderVerdict {
  const classified = levelsIn.filter((l): l is PlacedLevel => l.level !== null)
  const includes = classified.filter((l) => l.level > 0)
  const excludes = classified.filter((l) => l.level < 0)

  const missingPersona = !includes.some((l) => l.level === 1)
  // The core violation: a positive level ABOVE the persona used as a gate.
  const ruledNotWeighted = includes.filter((l) => l.level > 1 && l.hardRule === true)
  const experimentalAsRule = includes.some((l) => l.level === 5 && l.hardRule === true)

  const present = new Set(includes.map((l) => l.level))
  // Level 5 is optional by design — an experiment you do not have is not a gap.
  const missing = ([1, 2, 3, 4] as AudienceLevel[]).filter((l) => !present.has(l))

  const redundantMirrors: OrderVerdict['redundantMirrors'] = []
  for (const inc of includes) {
    const mirror = excludes.find((e) => e.level === mirrorOf(inc.level))
    if (mirror) redundantMirrors.push({ include: inc, exclude: mirror, level: inc.level })
  }

  const correct = ruledNotWeighted.length === 0 && !missingPersona

  const headline = classified.length === 0
    ? 'No layer in this stack could be placed on the level schema — it cannot be checked.'
    : missingPersona
    ? 'No persona level in this stack. Every layer here qualifies an audience nobody has defined.'
    : ruledNotWeighted.length > 0
    ? `${ruledNotWeighted.length} level${ruledNotWeighted.length === 1 ? ' is' : 's are'} ruling where ${ruledNotWeighted.length === 1 ? 'it should' : 'they should'} weight — this stack discards people who match four levels out of five.`
    : `Level 1 is the buy; ${includes.length - 1} further level${includes.length === 2 ? '' : 's'} carried as weight${includes.length === 2 ? '' : 's'}.`

  const parts: string[] = []
  if (missingPersona) {
    parts.push('Add the persona as the base — level 1 is what you actually buy, and every other level only describes how closely a person matches it.')
  }
  for (const r of ruledNotWeighted) {
    const role = LEVEL_ROLE[r.level as 1 | 2 | 3 | 4 | 5]
    parts.push(`"${r.name}" is level ${r.level} (${LEVEL_LABEL[r.level].toLowerCase()}) and is applied as a hard constraint. We ${role} this level, we do not require it — Meta's segments are inferences, and gating on one throws away the person who has the money but was never labelled with it. Carry it as a weight, or run it as its own arm and measure the difference.`)
  }
  if (experimentalAsRule) {
    parts.push('An experimental level is gating the buy. An untested guess must never be a requirement — that is how an experiment quietly becomes an assumption.')
  }
  for (const r of redundantMirrors) {
    parts.push(`"${r.include.name}" (level ${r.level}) and "${r.exclude.name}" (level ${mirrorOf(r.level)}) do the same job. Keep the exclusion — a proven-bad fact earns a rule, where a hoped-for positive earns only a weight.`)
  }
  if (missing.includes(2) && !missingPersona) {
    parts.push('No money level anywhere in this stack — not even as a weight. Nothing here distinguishes someone who can complete from someone who cannot, which is the difference between a lead and a buyer.')
  }

  return {
    correct, ruledNotWeighted, missingPersona, missing, redundantMirrors, experimentalAsRule,
    headline,
    recommendation: parts.length > 0
      ? parts.join(' ')
      : 'The persona is the buy and the deeper levels are weights. The remaining question is whether each one bites, which is what the layer audit answers.',
  }
}
