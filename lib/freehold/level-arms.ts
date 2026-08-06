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
}

/**
 * Meta will not deliver an ad set meaningfully below roughly this daily
 * budget — it cannot exit the learning phase and the delivery is erratic.
 * Splitting a small budget across many arms produces several ad sets that all
 * fail, which is worse than fewer arms that work.
 */
export const MIN_ARM_DAILY_AED = 50

/**
 * Build the cold arms from a level schema.
 *
 * The arms are CUMULATIVE, not every combination: persona; persona + money;
 * persona + money + product; and so on. Every-combination would produce
 * fifteen arms from four levels, none of which could clear the budget floor,
 * and most of which nobody would ever read. Cumulative arms answer the
 * question actually being asked — what does each additional level buy me.
 */
export function coldArms(levels: PositiveLevel[]): ColdArm[] {
  const ordered = Array.from(new Set(levels)).filter((l) => l !== 1).sort((a, b) => a - b)
  const arms: ColdArm[] = [{
    kind: 'cold', id: 'L1', label: LEVEL_LABEL[1], levels: [1],
    weight: LEVEL_WEIGHT[1],
    rationale: 'The persona alone — the buy, and the only arm that can reach someone Meta never labelled with the deeper levels.',
  }]

  const carried: PositiveLevel[] = [1]
  for (const l of ordered) {
    carried.push(l)
    arms.push({
      kind: 'cold',
      id: `L${carried.join('+')}`,
      label: carried.map((x) => LEVEL_LABEL[x]).join(' + '),
      levels: [...carried],
      // The arm's weight is the DEEPEST level it adds, not the sum: this arm
      // exists to test that level's contribution, and summing would make a
      // long arm look valuable purely for being long.
      weight: LEVEL_WEIGHT[l],
      rationale: `Adds ${LEVEL_LABEL[l].toLowerCase()} as a MUST. Compared against the arm above it, the difference is exactly what that level is worth.`,
    })
  }
  return arms
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
export function planArms(arms: Arm[], dailyBudgetAed: number, personaFloor = 0.25): ArmPlan {
  const notes: string[] = []
  if (arms.length === 0 || dailyBudgetAed <= 0) {
    return { arms: [], unallocatedAed: Math.max(0, dailyBudgetAed), headline: 'No arms to plan.', notes }
  }

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
      notes,
    }
  }

  const allocated = planned.reduce((n, p) => n + p.dailyBudgetAed, 0)
  const cold = planned.filter((p) => p.arm.kind === 'cold').length
  const warm = planned.length - cold

  return {
    arms: planned.sort((a, b) => b.dailyBudgetAed - a.dailyBudgetAed),
    unallocatedAed: Math.max(0, dailyBudgetAed - allocated),
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
