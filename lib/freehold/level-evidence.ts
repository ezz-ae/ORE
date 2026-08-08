/**
 * THE MISSING WIRE.
 *
 * `level-arms.ts` decides which levels deserve an ad set, and it asks for
 * `LevelEvidence` — a verdict, a lift and a narrowing power per level. Nothing
 * ever built that. The relevance engine reports per ENTITY ("Frequent
 * Travellers converts 2.4x, p=0.003"), the layer audit reports per LAYER, and
 * the arm planner speaks in LEVELS. Three modules, all correct, none able to
 * talk to the next — which is why the planner has never run on real evidence
 * and has no production caller at all.
 *
 * This is that translation, and it is deliberately conservative, because the
 * output decides where money goes:
 *
 *  · AN ENTITY NOBODY HAS ENOUGH LEADS FOR DOES NOT VOTE. The relevance
 *    report already drops those as `tooRare`. Counting silence as agreement
 *    is how a level gets promoted on no data at all.
 *  · A LEVEL IS ONLY PROVEN IF ITS ENTITIES AGREE. Mixed evidence inside one
 *    level means the level is not what is driving the result — one segment
 *    inside it is. Reporting that as "level 3 works" would fund three
 *    segments to buy the behaviour of one.
 *  · LIFT IS AVERAGED, NEVER MAXED. The planner orders proven levels by lift,
 *    so taking the best entity in a level would let a single outlier decide
 *    the budget order of the whole account.
 *
 * Pure — takes reports and an assignment, returns evidence. The reading of
 * Meta and the database happens in the route. Runs in `pnpm guards`.
 */
import type { RelevanceReport, RelevanceSignal } from '@/lib/freehold/relevance'
import type { LevelEvidence, PositiveLevel } from '@/lib/freehold/level-arms'

/** Which level an interest or behaviour was placed at when the audience was
 *  built. The operator's own schema assignment — never inferred. */
export interface EntityLevel {
  /** Raw Meta id, without the `interest:` / `behavior:` prefix. */
  id: string
  kind: 'interest' | 'behavior'
  level: PositiveLevel
}

/**
 * How lopsided the entities inside a level must be before the level itself
 * counts as proven or counter.
 *
 * A strict majority is not enough. Two relevant against one counter is a level
 * with an argument going on inside it, and the honest answer there is
 * "undecided" — which the planner funds as exploration rather than as a
 * finding. Two thirds is the point at which the level, and not one segment in
 * it, is the better explanation.
 */
export const LEVEL_AGREEMENT = 2 / 3

/** The report ids carry their dimension: `behavior:6002...`. */
const entityId = (e: EntityLevel) => `${e.kind}:${e.id}`

/**
 * Average lift across the entities that agreed.
 *
 * Infinite lift is real and common — it means no lead WITHOUT the attribute
 * converted — but it is a statement about the denominator, not a magnitude,
 * and averaging it produces Infinity for the whole level. A level whose only
 * signal is infinite gets `null`: proven, with no honest number to order it
 * by, which the planner already handles.
 */
function meanLift(signals: RelevanceSignal[]): number | null {
  const finite = signals.map((s) => s.lift).filter((l) => Number.isFinite(l) && l > 0)
  if (finite.length === 0) return null
  return finite.reduce((a, b) => a + b, 0) / finite.length
}

export interface LevelReading extends LevelEvidence {
  /** How many entities at this level the relevance engine could actually
   *  judge. Zero means the level has no verdict — not that it failed. */
  judged: number
  /** How many were dropped for being too rare to say anything about. */
  tooRare: number
  /** Plain sentence for the operator. Says "not yet" out loud when that is
   *  the truth, rather than leaving a level looking silently unproven. */
  sentence: string
}

/**
 * Turn per-entity relevance and per-level narrowing into what the arm planner
 * asks for.
 *
 * `narrowingByLevel` comes from the layer audit — the share of the audience a
 * level actually removes, measured against Meta's own size estimates. It is
 * carried through untouched: the planner uses it to refuse an arm that would
 * buy the same people as the arm above it, and inventing a value here would
 * defeat exactly that check. A level with no measurement passes none.
 */
export function levelEvidenceFrom(
  reports: { behavior: RelevanceReport; interest: RelevanceReport },
  assignment: EntityLevel[],
  narrowingByLevel: Partial<Record<PositiveLevel, number>> = {},
): LevelReading[] {
  // One lookup across both dimensions. An entity's id already namespaces it,
  // so a behaviour and an interest sharing a numeric id cannot collide.
  const byId = new Map<string, { signal: RelevanceSignal; verdict: 'relevant' | 'counter' | 'undecided' }>()
  for (const report of [reports.behavior, reports.interest]) {
    for (const s of report.relevant) byId.set(s.id, { signal: s, verdict: 'relevant' })
    for (const s of report.counter) byId.set(s.id, { signal: s, verdict: 'counter' })
    for (const s of report.undecided) byId.set(s.id, { signal: s, verdict: 'undecided' })
  }

  const levels = Array.from(new Set(assignment.map((a) => a.level))).sort((a, b) => a - b)
  const out: LevelReading[] = []

  for (const level of levels) {
    const members = assignment.filter((a) => a.level === level)
    const seen = members.map((m) => byId.get(entityId(m))).filter((x): x is NonNullable<typeof x> => !!x)
    const tooRare = members.length - seen.length

    const relevant = seen.filter((s) => s.verdict === 'relevant').map((s) => s.signal)
    const counter = seen.filter((s) => s.verdict === 'counter').map((s) => s.signal)
    const decided = relevant.length + counter.length

    let verdict: LevelEvidence['verdict']
    let sentence: string

    if (seen.length === 0) {
      // NOT "undecided" — undecided means we looked and could not tell. Here
      // nothing at this level has carried enough leads to look at, and the
      // planner should fall back to schema order rather than treat the level
      // as explored and inconclusive.
      verdict = undefined
      sentence = `Not enough leads yet to learn from here — this fills in by itself as leads come in.`
    } else if (decided === 0) {
      verdict = 'undecided'
      sentence = `Some leads came in, but not enough to call it either way yet. Keep running.`
    } else if (relevant.length / decided >= LEVEL_AGREEMENT) {
      verdict = 'relevant'
      sentence = `${relevant.length} of ${decided} signals here bring better leads. This part works.`
    } else if (counter.length / decided >= LEVEL_AGREEMENT) {
      verdict = 'counter'
      sentence = `${counter.length} of ${decided} signals here bring worse leads. Better excluded than paid for.`
    } else {
      // The case worth naming: the level is not the explanation, a segment is.
      verdict = 'undecided'
      sentence = `Mixed results here — part works, part does not — so it gets a small test budget until it is clear.`
    }

    const narrowing = narrowingByLevel[level]
    out.push({
      level,
      verdict,
      lift: verdict === 'relevant' ? meanLift(relevant) : null,
      narrowingPower: typeof narrowing === 'number' ? narrowing : null,
      judged: seen.length,
      tooRare,
      sentence,
    })
  }

  return out
}

/**
 * Narrowing power per level, from the layer audit's per-layer readings.
 *
 * A level can hold several layers. Its power is the share of the audience the
 * level removes AS A WHOLE, and because the layers inside one level sit in the
 * same OR group, that is NOT the sum of theirs — a person removed by two of
 * them is one person. Taking the largest single layer is the safe read: it
 * cannot overstate what the level removes, and overstating is the direction
 * that matters, since an overstated level earns an ad set that then buys the
 * same people as the arm above it.
 */
export function narrowingByLevel(
  readings: Array<{ id: string; share: number }>,
  levelOf: (layerId: string) => PositiveLevel | null,
): Partial<Record<PositiveLevel, number>> {
  const out: Partial<Record<PositiveLevel, number>> = {}
  for (const r of readings) {
    const l = levelOf(r.id)
    if (l === null || !Number.isFinite(r.share)) continue
    out[l] = Math.max(out[l] ?? 0, Math.max(0, r.share))
  }
  return out
}
