/**
 * LEVEL ARMS — how to weight when the platform only knows how to rule.
 *
 * Meta's narrowing is a MUST. `flexible_spec` says "match the base AND at
 * least one entry of every group", and there is no field anywhere that says
 * "prefer". So the doctrine — target the persona, expect money, appreciate
 * product interest, value a decision, try the experiment — cannot be expressed
 * inside one ad set. Stack it as AND and you have refused the person who
 * matches four levels out of five; leave it off and you have no weighting at
 * all.
 *
 * The way through is structural: MAKE EVERY LEVEL ITS OWN AD SET.
 *
 * One arm buys the persona alone. Another buys persona AND money. Another adds
 * the decision. Each is a legal Meta ad set using only MUST, and the weighting
 * lives where Meta cannot interfere with it — in the budget split across the
 * arms. Budget allocation IS weighting. A level you merely appreciate gets a
 * small arm; a level you value gets a large one; the persona keeps the floor
 * so the four-out-of-five person is still reachable somewhere.
 *
 * Two things fall out of this that are worth more than the weighting itself:
 *
 *  1. EVERY ARM IS A CLEAN EXPERIMENT. One ad set, one level combination, so a
 *     lead's registration snapshot attributes it to exactly one hypothesis.
 *     This is what produces the unconfounded read in `relevance.ts` — the
 *     "solo" cohort only exists because arms were built this way.
 *  2. THE ARMS ARE COMPARABLE. Same creative, same geo, same landing page,
 *     differing in one level. That is a controlled comparison, and
 *     `inventory-quality` can rank them on impressions within days.
 *
 * RETARGETING IS THE SAME IDEA ON THE OTHER AXIS. Cold levels describe who
 * someone IS; retargeting levels describe what they DID with us. Someone who
 * opened the form and stopped is a different, closer, cheaper person than
 * someone who saw the ad once — and they deserve their own arm and their own
 * message, not a share of the cold budget.
 *
 * Pure — no I/O. The launcher turns these into real ad sets.
 */
import { LEVEL_WEIGHT, LEVEL_LABEL, type AudienceLevel } from '@/lib/freehold/layer-audit'
import { chooseOptimisation, type EventCosts, type LearningVerdict } from '@/lib/freehold/learning-phase'

export type PositiveLevel = 1 | 2 | 3 | 4 | 5

/**
 * How warm someone already is. Ascending closeness — each rung is a smaller,
 * cheaper, more likely group than the one before it.
 */
export type RetargetRung =
  | 'saw_ad'        // impression or engagement on the ad
  | 'visited'       // reached the landing page
  | 'engaged'       // scrolled, opened a gallery, spent real time
  | 'started_form'  // began the form and stopped
  | 'lead_cold'     // became a lead, never progressed

export const RETARGET_LABEL: Record<RetargetRung, string> = {
  saw_ad: 'Saw the ad',
  visited: 'Visited the page',
  engaged: 'Engaged with the page',
  started_form: 'Started the form and stopped',
  lead_cold: 'Became a lead and went cold',
}

/**
 * Relative worth of each retargeting rung.
 *
 * Steeply ascending, and deliberately far above the cold weights: someone who
 * started your form and stopped is the most winnable person in the account,
 * and the usual mistake is spending nothing on them because the audience looks
 * too small to bother with. Small and winnable beats large and cold.
 */
export const RETARGET_WEIGHT: Record<RetargetRung, number> = {
  saw_ad: 1.5, visited: 3, engaged: 5, started_form: 9, lead_cold: 4,
}

export interface ColdArm {
  kind: 'cold'
  id: string
  label: string
  /** The levels this arm requires. Always includes 1 — the persona is the buy. */
  levels: PositiveLevel[]
  /** Raw weight before normalisation. */
  weight: number
  rationale: string
}

export interface WarmArm {
  kind: 'warm'
  id: string
  label: string
  rung: RetargetRung
  weight: number
  rationale: string
}

export type Arm = ColdArm | WarmArm

export interface PlannedArm {
  arm: Arm
  /** Share of the total budget, 0–1. */
  share: number
  dailyBudgetAed: number
}

export interface ArmPlan {
  arms: PlannedArm[]
  /** Budget that could not be allocated because arms fell under the floor. */
  unallocatedAed: number
  headline: string
  notes: string[]
  /** Whether these arms can actually exit Meta's learning phase, and on which
   *  optimisation event. Null when no cost data was supplied — in which case
   *  the plan is a budget split only and does NOT claim the arms will learn. */
  learning: LearningVerdict | null
}

/**
 * Meta will not deliver an ad set meaningfully below roughly this daily
 * budget — it cannot exit the learning phase and the delivery is erratic.
 * Splitting a small budget across many arms produces several ad sets that all
 * fail, which is worse than fewer arms that work.
 */
export const MIN_ARM_DAILY_AED = 50

/**
 * What is already known about a level, BEFORE any of this runs.
 *
 * Three sources, none of which costs a dirham of new spend: the relevance
 * engine reading past registration events, the layer audit probing Meta's
 * audience sizes, and the funnel's own profile facts. Together they answer
 * "is this level worth an ad set" before an ad set exists.
 */
export interface LevelEvidence {
  level: PositiveLevel
  /** From `relevance.ts`, over the levels that have run before. */
  verdict?: 'relevant' | 'counter' | 'undecided'
  /** How much better leads carrying this level convert. Used only to ORDER
   *  proven levels against each other, never to promote an unproven one. */
  lift?: number | null
  /** From `layer-audit.ts`: how much of the audience this level actually
   *  removes. A level near zero here cannot make an arm that differs from the
   *  arm above it. */
  narrowingPower?: number | null
}

/**
 * Below this narrowing power, an arm adding the level would be a near-copy of
 * the arm above it — two ad sets buying the same people, bidding against each
 * other in the same auction and splitting the learning between them. Meta
 * calls this audience overlap; the account feels it as both arms
 * underperforming for no visible reason.
 */
export const MIN_ARM_DISTINCTION = 0.05

export interface ArmSelection {
  arms: ColdArm[]
  /** Levels deliberately not given an arm, and why. */
  skipped: Array<{ level: PositiveLevel; reason: string }>
  /** Levels that predict a WORSE lead — exclusion candidates, never arms. */
  excludeCandidates: PositiveLevel[]
  headline: string
}

/**
 * Build the cold arms, ordered by what has been PROVEN rather than by level
 * number.
 *
 * The naive version is strictly cumulative — persona, +money, +product,
 * +decision — and it wastes the account's budget on whichever levels happen to
 * come first in the schema. If the decision level has proven relevant and the
 * money level has not, the right second arm is persona + DECISION. Skipping
 * level 2 is not a violation of the order; the order was about cost of
 * filtering, and evidence beats a default ordering every time it exists.
 *
 * The rules, in the order they apply:
 *
 *  · Level 1 is always the first arm. It is the buy.
 *  · PROVEN levels get arms next, strongest first, whatever their number.
 *  · UNDECIDED levels get arms after those, in schema order — they are the
 *    exploration, and they go last because they are guesses.
 *  · COUNTER levels get no arm at all. A level that predicts a worse lead is
 *    an exclusion candidate, and building an arm to buy more of it would be
 *    the most expensive possible way to confirm what we already know.
 *  · A level that narrows almost nothing gets no arm either — it would be a
 *    duplicate ad set competing with its own neighbour.
 *
 * Without evidence this degrades to the cumulative schema order, which is the
 * right default and is described as a default rather than as a finding.
 */
export function coldArms(levels: PositiveLevel[], evidence: LevelEvidence[] = []): ColdArm[] {
  return selectColdArms(levels, evidence).arms
}

export function selectColdArms(levels: PositiveLevel[], evidence: LevelEvidence[] = []): ArmSelection {
  const byLevel = new Map(evidence.map((e) => [e.level, e]))
  const candidates = Array.from(new Set(levels)).filter((l) => l !== 1).sort((a, b) => a - b)

  const skipped: ArmSelection['skipped'] = []
  const excludeCandidates: PositiveLevel[] = []
  const proven: PositiveLevel[] = []
  const undecided: PositiveLevel[] = []

  for (const l of candidates) {
    const e = byLevel.get(l)
    if (e?.verdict === 'counter') {
      excludeCandidates.push(l)
      skipped.push({ level: l, reason: `${LEVEL_LABEL[l]} brings worse leads in your own history, so it is excluded instead of paid for.` })
      continue
    }
    if (typeof e?.narrowingPower === 'number' && e.narrowingPower < MIN_ARM_DISTINCTION) {
      skipped.push({ level: l, reason: `${LEVEL_LABEL[l]} barely changes who sees the ad, so a separate ad set for it would just buy the same people twice.` })
      continue
    }
    if (e?.verdict === 'relevant') proven.push(l)
    else undecided.push(l)
  }

  // Proven levels strongest-first; ties fall back to schema order so the
  // result is deterministic rather than dependent on input ordering.
  proven.sort((a, b) => (byLevel.get(b)?.lift ?? 0) - (byLevel.get(a)?.lift ?? 0) || a - b)

  const arms: ColdArm[] = [{
    kind: 'cold', id: 'L1', label: LEVEL_LABEL[1], levels: [1],
    weight: LEVEL_WEIGHT[1],
    rationale: 'Your main audience on its own — the widest net, and where most of the budget starts.',
  }]

  const carried: PositiveLevel[] = [1]
  for (const l of [...proven, ...undecided]) {
    carried.push(l)
    const e = byLevel.get(l)
    const isProven = e?.verdict === 'relevant'
    arms.push({
      kind: 'cold',
      id: `L${carried.join('+')}`,
      label: carried.map((x) => LEVEL_LABEL[x]).join(' + '),
      levels: [...carried],
      // Weighted by the level it ADDS, not by its length — otherwise a long
      // arm looks valuable purely for being long. A proven level earns more
      // budget than an unproven one of the same nominal weight.
      weight: LEVEL_WEIGHT[l] * (isProven ? 1.5 : 1),
      rationale: isProven
        ? `Adds ${LEVEL_LABEL[l].toLowerCase()} — your own leads already showed this brings better leads${typeof e?.lift === 'number' ? ` (${e.lift.toFixed(1)}x)` : ''}, so it earns its own ad set.`
        : `Adds ${LEVEL_LABEL[l].toLowerCase()}. Your leads have not shown yet whether this helps, so it gets a smaller test budget.`,
    })
  }

  const usedEvidence = evidence.length > 0
  const headline = !usedEvidence
    ? `The budget is split across ${arms.length} ad sets. There is no lead history yet, so it starts on the safe default split and sharpens as your leads come in.`
    : proven.length > 0
    ? `The budget is split across ${arms.length} ad sets, led by ${proven.map((l) => LEVEL_LABEL[l].toLowerCase()).join(' then ')} — the parts your own leads already proved come first.`
    : `The budget is split across ${arms.length} ad sets. Your leads have not picked a winner yet, so most of the money stays on the main audience and the rest runs small tests.`

  return { arms, skipped, excludeCandidates, headline }
}

/**
 * Below this many people, a retargeting audience cannot deliver: Meta throttles
 * it, frequency climbs immediately, and the arm burns its budget showing the
 * same forty people the same ad. The rung is real — it simply has not filled
 * yet, and launching it early is how retargeting gets a reputation for not
 * working.
 */
export const MIN_RETARGET_AUDIENCE = 300

export interface RungState {
  rung: RetargetRung
  /** How many people are currently in this audience. */
  size: number
}

export interface WarmSelection {
  arms: WarmArm[]
  /** Rungs that exist but are not yet big enough, and how many more are needed. */
  notReady: Array<{ rung: RetargetRung; size: number; needs: number }>
  headline: string
}

/**
 * Choose the retargeting arms that can actually run.
 *
 * The point of doing this BEFORE launching is that a rung's readiness is
 * knowable in advance — it is a count of people we already have. Launching a
 * 40-person arm and discovering it three weeks later is the expensive version
 * of the same information.
 */
export function selectWarmArms(rungs: RungState[]): WarmSelection {
  const ready = rungs.filter((r) => r.size >= MIN_RETARGET_AUDIENCE)
  const notReady = rungs
    .filter((r) => r.size < MIN_RETARGET_AUDIENCE)
    .map((r) => ({ rung: r.rung, size: r.size, needs: MIN_RETARGET_AUDIENCE - r.size }))
    .sort((a, b) => a.needs - b.needs)

  const headline = ready.length === 0
    ? rungs.length === 0
      ? 'No retargeting audience exists yet — nothing has been touched to retarget.'
      : `No retargeting rung has reached ${MIN_RETARGET_AUDIENCE} people. ${notReady[0] ? `"${RETARGET_LABEL[notReady[0].rung]}" is closest, ${notReady[0].needs} short.` : ''}`
    : `${ready.length} retargeting arm${ready.length === 1 ? '' : 's'} ready${notReady.length ? `, ${notReady.length} still filling` : ''}.`

  return { arms: warmArms(ready.map((r) => r.rung)), notReady, headline }
}

/** Build the warm arms from whichever rungs actually have an audience. */
export function warmArms(available: RetargetRung[]): WarmArm[] {
  return available.map((rung) => ({
    kind: 'warm' as const,
    id: `R:${rung}`,
    label: RETARGET_LABEL[rung],
    rung,
    weight: RETARGET_WEIGHT[rung],
    rationale: rung === 'started_form'
      ? 'The most winnable people in the account: they wanted it enough to begin. This arm is usually starved because the audience looks too small to bother with.'
      : 'Already touched us — a closer, cheaper conversation than a cold impression, and it deserves its own message rather than the cold creative.',
  }))
}

/**
 * Split a daily budget across arms in proportion to weight.
 *
 * Arms that fall below the delivery floor are DROPPED and their budget
 * redistributed, rather than launched at a level Meta cannot deliver. Reporting
 * eight arms when three of them will never leave the learning phase is the
 * flattering version of this function, and it is the wrong one.
 *
 * `personaFloor` guarantees the persona arm a minimum share whatever the
 * weights say — it is the only arm that can reach the four-out-of-five person,
 * so starving it defeats the entire structure.
 */
export function planArms(
  arms: Arm[],
  dailyBudgetAed: number,
  personaFloor = 0.25,
  costs?: EventCosts,
): ArmPlan {
  const notes: string[] = []
  if (arms.length === 0 || dailyBudgetAed <= 0) {
    return { arms: [], unallocatedAed: Math.max(0, dailyBudgetAed), headline: 'No arms to plan.', notes, learning: null }
  }

  // THE LEARNING-PHASE CEILING, applied before the budget split.
  //
  // The delivery floor below (AED 50/day) only asks whether Meta will serve an
  // ad set at all. It says nothing about whether the ad set can EXIT LEARNING,
  // which needs ~50 optimisation events a week — a completely different and
  // much higher bar. Planning four arms that each deliver but none of which
  // ever stabilises produces four broken instruments that still print results,
  // and that is worse than one arm that works.
  let planning = [...arms]
  let learning: LearningVerdict | null = null
  if (costs) {
    learning = chooseOptimisation(planning.length, dailyBudgetAed, costs)
    if (!learning.fits) {
      const keep = Math.max(1, learning.supportedArms)
      if (keep < planning.length) {
        // Keep the heaviest arms — the persona arm is never among those cut,
        // because it is the structure rather than a test within it.
        const persona = planning.find((a) => a.kind === 'cold' && a.levels.length === 1)
        const rest = planning.filter((a) => a !== persona).sort((x, y) => y.weight - x.weight)
        const kept = persona ? [persona, ...rest.slice(0, keep - 1)] : rest.slice(0, keep)
        notes.push(`Cut from ${planning.length} arms to ${kept.length}: at AED ${Math.round(dailyBudgetAed)}/day only ${learning.supportedArms} can clear Meta's learning phase, and an arm stuck in Learning Limited reports numbers that are not a fair read of its audience.`)
        planning = kept
        learning = chooseOptimisation(planning.length, dailyBudgetAed, costs)
      }
    }
    if (learning.event && learning.event !== 'lead') {
      notes.push(learning.recommendation)
    }
  }
  arms = planning

  // Iteratively drop arms that cannot clear the floor, re-splitting each time.
  let live = [...arms]
  let planned: PlannedArm[] = []
  for (let guard = 0; guard < arms.length + 1; guard++) {
    const personaArm = live.find((a) => a.kind === 'cold' && a.levels.length === 1)
    const total = live.reduce((n, a) => n + a.weight, 0)
    if (total <= 0) { live = []; break }

    // Persona floor first, the rest proportional to weight over what remains.
    const rest = personaArm ? 1 - personaFloor : 1
    const restTotal = live.filter((a) => a !== personaArm).reduce((n, a) => n + a.weight, 0)
    planned = live.map((a) => {
      const share = a === personaArm
        ? personaFloor
        : restTotal > 0 ? (a.weight / restTotal) * rest : rest / Math.max(1, live.length)
      return { arm: a, share, dailyBudgetAed: Math.round(dailyBudgetAed * share) }
    })

    const starved = planned.filter((p) => p.dailyBudgetAed < MIN_ARM_DAILY_AED && p.arm !== personaArm)
    if (starved.length === 0) break
    // Drop the weakest starved arm and try again — one at a time, so a single
    // drop can rescue the others rather than collapsing the whole plan.
    const weakest = starved.reduce((a, b) => (a.arm.weight <= b.arm.weight ? a : b))
    notes.push(`Dropped "${weakest.arm.label}" — its share came to AED ${weakest.dailyBudgetAed}/day, below the AED ${MIN_ARM_DAILY_AED} Meta needs to deliver an ad set properly.`)
    live = live.filter((a) => a !== weakest.arm)
  }

  // The persona arm is exempt from being dropped — it is the structure. But
  // exempt from DROPPING is not exempt from the floor: if even it comes out
  // under the delivery minimum there is no plan here, only an ad set that
  // would never leave the learning phase. Returning it anyway would be the
  // flattering answer.
  const starvedRemaining = planned.filter((p) => p.dailyBudgetAed < MIN_ARM_DAILY_AED)
  if (planned.length === 0 || starvedRemaining.length > 0) {
    return {
      arms: [], unallocatedAed: dailyBudgetAed,
      headline: `AED ${dailyBudgetAed}/day cannot support even one arm at the AED ${MIN_ARM_DAILY_AED} floor.`,
      notes, learning,
    }
  }

  const allocated = planned.reduce((n, p) => n + p.dailyBudgetAed, 0)
  const cold = planned.filter((p) => p.arm.kind === 'cold').length
  const warm = planned.length - cold

  return {
    arms: planned.sort((a, b) => b.dailyBudgetAed - a.dailyBudgetAed),
    unallocatedAed: Math.max(0, dailyBudgetAed - allocated),
    learning,
    headline: `${planned.length} arms — ${cold} cold${warm ? `, ${warm} retargeting` : ''} — splitting AED ${dailyBudgetAed}/day. Each arm is one level combination, so each one is also a clean experiment.`,
    notes,
  }
}

/**
 * What this structure is for, stated where a plan can carry it.
 *
 * Returned rather than hardcoded into a screen because the reason a plan looks
 * like this is part of the plan — an operator who does not know why the
 * persona arm exists will be the one who switches it off for underperforming.
 */
export const ARM_DOCTRINE = [
  'Meta only offers MUST, so weighting happens in the budget split rather than inside one ad set.',
  'The persona arm keeps a floor whatever the weights say — it is the only arm that can reach someone who matches four levels out of five but was never labelled with the fifth.',
  'Each arm differs from its neighbour by exactly one level, so the difference between them is what that level is worth.',
  'Every arm is one hypothesis, which is what makes the leads it produces readable rather than confounded.',
] as const

/** The levels an arm requires, as the AND-narrowing groups Meta expects. */
export const armLevels = (a: Arm): AudienceLevel[] =>
  a.kind === 'cold' ? (a.levels as AudienceLevel[]) : []
