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
 * Ten levels, five that include and five that exclude, mirrored. Every layer
 * in a stack belongs to exactly one, and the level decides where it is applied
 * — which is what decides the cost.
 *
 *    +1  PERSONA        who this is: the shape of the person we sell to
 *    +2  MONEY          can they complete: income, assets, purchasing power
 *    +3  PRODUCT        what they want: apartment, villa, off-plan
 *    +4  DECISION       are they deciding now: in-market, actively looking
 *    +5  EXPERIMENTAL   the deliberate unknown — the slot that learns
 *
 *    -1  OUT OF TARGET  not the persona at all
 *    -2  POOR           cannot complete
 *    -3  NOT INTERESTED wrong product
 *    -4  NOT SERIOUS    browsing, scared, or never going to sign
 *    -5  EXPERIMENTAL   the deliberate negative test
 *
 * ORDER IS THE WHOLE COST ARGUMENT. Applied ascending, each level filters the
 * public before the next one has to pay to look at them. Applied inverted —
 * product interest at the base — you bid into twelve million people who want
 * an apartment and pay Meta to discover most of them cannot buy one. Same
 * segments, same account, a completely different bill. It is nothing like
 * running the whole track every time.
 *
 * THE MIRROR MATTERS TOO. -2 is the negative of +2. A stack that includes a
 * money level AND excludes a poor level is doing one job twice, and the second
 * copy only narrows delivery further for no additional filtering. Naming the
 * pairs is what lets that be seen.
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

/** The order inclusion levels must be applied in. */
export const INCLUSION_ORDER: readonly AudienceLevel[] = [1, 2, 3, 4, 5]
/** The exclusion levels, in the order they mirror the inclusions. */
export const EXCLUSION_ORDER: readonly AudienceLevel[] = [-1, -2, -3, -4, -5]

/** The exclusion that does the same job as a given inclusion, and vice versa. */
export const mirrorOf = (l: AudienceLevel): AudienceLevel => -l as AudienceLevel

export interface OrderedLevel {
  name: string
  level: AudienceLevel | null
  /** Position in the stack as written, 0 = applied first. */
  index: number
}

/** An OrderedLevel that has actually been placed on the schema. */
export type PlacedLevel = OrderedLevel & { level: AudienceLevel }

export interface OrderVerdict {
  correct: boolean
  /** Inclusion levels applied before a level that should precede them. */
  misplaced: Array<{ level: PlacedLevel; shouldFollow: PlacedLevel }>
  /** Inclusion levels with no layer at all — gaps in the filter. */
  missing: AudienceLevel[]
  /** Pairs where an inclusion and its mirror exclusion both appear, doing the
   *  same job twice. */
  redundantMirrors: Array<{ include: PlacedLevel; exclude: PlacedLevel; level: AudienceLevel }>
  /** True when an experimental level sits above a proven one — the explore
   *  slot must be the last thing applied, never a constraint on everything. */
  experimentalTooEarly: boolean
  headline: string
  recommendation: string
}

/**
 * Check a stack against the schema.
 *
 * Unclassified layers are skipped rather than assumed wrong. A layer we could
 * not place is not evidence of a bad stack, and guessing its level in order to
 * have an opinion would be exactly the imagining this file exists against.
 */
export function assessLevelOrder(levelsIn: OrderedLevel[]): OrderVerdict {
  const classified = levelsIn.filter((l): l is PlacedLevel => l.level !== null)
  const includes = classified.filter((l) => l.level > 0).sort((a, b) => a.index - b.index)
  const excludes = classified.filter((l) => l.level < 0)

  const misplaced: OrderVerdict['misplaced'] = []
  for (let i = 0; i < includes.length; i++) {
    for (let j = i + 1; j < includes.length; j++) {
      if (includes[i].level > includes[j].level) { misplaced.push({ level: includes[i], shouldFollow: includes[j] }); break }
    }
  }

  const present = new Set(includes.map((l) => l.level))
  // Level 5 is optional by design — an experiment you do not have is not a gap.
  const missing = ([1, 2, 3, 4] as AudienceLevel[]).filter((l) => !present.has(l))

  const redundantMirrors: OrderVerdict['redundantMirrors'] = []
  for (const inc of includes) {
    const mirror = excludes.find((e) => e.level === mirrorOf(inc.level))
    if (mirror) redundantMirrors.push({ include: inc, exclude: mirror, level: inc.level })
  }

  const experimental = includes.find((l) => l.level === 5)
  const experimentalTooEarly = !!experimental && includes.some((l) => l.level < 5 && l.index > experimental.index)

  const correct = misplaced.length === 0 && !experimentalTooEarly

  const headline = classified.length === 0
    ? 'No layer in this stack could be placed on the level schema — the order cannot be checked.'
    : correct
    ? `The ${includes.length} inclusion level${includes.length === 1 ? '' : 's'} are applied in order${missing.length ? `, with ${missing.map((l) => LEVEL_LABEL[l].toLowerCase()).join(' and ')} missing` : ''}.`
    : `${misplaced.length + (experimentalTooEarly ? 1 : 0)} level${misplaced.length === 1 && !experimentalTooEarly ? ' is' : 's are'} out of order — this stack pays to reach people it filters out later.`

  const parts: string[] = []
  for (const m of misplaced) {
    parts.push(`Apply "${m.shouldFollow.name}" (level ${m.shouldFollow.level}, ${LEVEL_LABEL[m.shouldFollow.level].toLowerCase()}) before "${m.level.name}" (level ${m.level.level}) — the earlier level removes people you would otherwise pay to reach.`)
  }
  if (experimentalTooEarly) {
    parts.push(`"${experimental!.name}" is experimental and is constraining levels that are not. An experiment belongs last, where it can be judged and dropped without taking the proven levels with it.`)
  }
  for (const r of redundantMirrors) {
    parts.push(`"${r.include.name}" (level ${r.level}) and "${r.exclude.name}" (level ${mirrorOf(r.level)}) do the same job. Keep the inclusion — the exclusion only narrows delivery further without filtering anything the inclusion has not.`)
  }
  if (missing.includes(2)) {
    parts.push('No money level anywhere in this stack. Every level here filters for what someone WANTS, none for whether they can complete — which is the difference between a lead and a buyer.')
  } else if (missing.length > 0) {
    parts.push(`No ${missing.map((l) => LEVEL_LABEL[l].toLowerCase()).join(' or ')} level — the filter has a gap the spend will fall through.`)
  }

  return {
    correct, misplaced, missing, redundantMirrors, experimentalTooEarly,
    headline,
    recommendation: parts.length > 0
      ? parts.join(' ')
      : 'The order is right and the levels are complete. The remaining question is whether each one bites, which is what the layer audit answers.',
  }
}
