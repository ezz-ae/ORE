/**
 * AUDIENCE WEIGHT — the reversible form of "stop showing it to those people".
 *
 * When leads get expensive the instinct is always the same: find the segment
 * that is not buying and cut it out. Two things in this product forbid that,
 * and one of them is not obvious.
 *
 * The obvious one: the axis people reach for is nationality or origin, and
 * audiences here narrow by language and behaviour only (`audience-pattern.ts`).
 * That rule already holds and this module does not touch it.
 *
 * THE ONE THAT COST SOMETHING. An exclusion is a permanent decision taken on a
 * temporary sample. An audience switched off stops producing leads, so it stops
 * producing the evidence that would overturn the verdict — and the first bad
 * fortnight becomes the last word on it forever. The account slowly narrows
 * onto whatever happened to work in its first month, and every later reading
 * confirms it, because nothing else was ever funded enough to disagree.
 *
 * A WEIGHT is the same judgement made reversible. An audience that provably
 * produces fewer buyers per lead gets less of the surplus, keeps running at the
 * floor that lets it learn, and climbs back out on its own evidence when it has
 * some. Nothing is ever removed, so nothing ever becomes unfalsifiable.
 *
 * WHAT IT MEASURES, AND WHY IT IS NOT COST. `budget-split.ts` already ranks on
 * cost per rung — what a lead cost. It has no idea which AUDIENCE a campaign
 * was launched from, and `audience-outcomes.ts` has known what each audience's
 * leads BECOME since the day it shipped, read by no decision that sets a
 * budget. This module is that seam: quality, per audience, in a number the
 * allocator can multiply by.
 *
 * Pure — no I/O, no clock, no platform call. Runs in `pnpm guards`.
 */
import { countBounds } from '@/lib/freehold/min-evidence'

/** One audience's record, as `audience-outcomes.ts` already rolls it up. */
export interface AudienceRecord {
  /** Saved-audience id or ready-buyer preset id. */
  key: string
  leads: number
  qualified: number
  won: number
}

/**
 * The deepest rung the FIELD can support a comparison on.
 *
 * Not the deepest rung an audience reached — one audience with a single deal
 * cannot be ranked against a field that has closed nothing, and pretending
 * otherwise hands the whole surplus to whoever got lucky first.
 *
 * `none` is a real answer and the common one on a young account: there is no
 * quality signal yet, so every weight is 1 and this module changes nothing.
 */
export const WEIGHT_RUNGS = ['none', 'qualified', 'deal'] as const
export type WeightRung = (typeof WEIGHT_RUNGS)[number]

/** Walkable — each renders its own sentence. */
export const WEIGHT_VERDICTS = ['better', 'worse', 'tied', 'unknown'] as const
export type WeightVerdict = (typeof WEIGHT_VERDICTS)[number]

/**
 * The floor. A weight is a DEPRIORITISATION, NOT AN EXCLUSION — this constant
 * is the whole difference between the two, so it is never 0 and never derived.
 *
 * A quarter share still buys enough leads for the audience to keep measuring
 * itself, which is the only way a wrong verdict ever gets corrected. Zero here
 * would rebuild the exclusion this module exists to replace, with extra steps.
 */
export const MIN_WEIGHT = 0.25

/**
 * The ceiling. A month is not a mandate: an audience that separated on eight
 * qualified leads is evidence, not proof, and letting one such reading take
 * four times the surplus would empty every other arm before the second
 * reading arrived to disagree with the first.
 */
export const MAX_WEIGHT = 2

/** Neutral. Returned for every audience the evidence cannot separate. */
export const NEUTRAL_WEIGHT = 1

/**
 * The field needs at least this many events at a rung before that rung may
 * rank anything. Below it the field rate is one or two people's behaviour and
 * every audience "separates" from it by accident.
 */
export const MIN_FIELD_EVENTS = 5

export interface AudienceWeight {
  key: string
  /** The multiplier. Always within [MIN_WEIGHT, MAX_WEIGHT]. */
  weight: number
  /** The rung the comparison was made on. 'none' ⇒ weight is NEUTRAL_WEIGHT. */
  rung: WeightRung
  verdict: WeightVerdict
  /** What the rest of the field converts at, on this rung. null when unranked. */
  fieldRate: number | null
  /**
   * The bound that FACED the field rate — never the point estimate.
   * `min-evidence.ts` states the rule; this is it applied to a proportion.
   */
  bound: number | null
}

const clamp = (w: number): number => Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w))

const eventsOn = (r: AudienceRecord, rung: Exclude<WeightRung, 'none'>): number =>
  rung === 'deal' ? r.won : r.qualified

/**
 * Which rung the field can carry.
 *
 * Deals first — they are what the business is paid on (`money-truth.ts` rule 1)
 * — and qualified leads only when deals are too thin to rank on. Both counted
 * across the whole field, because the question is whether a COMPARISON is
 * possible, not whether one audience did well.
 */
export function fieldRung(rows: AudienceRecord[]): WeightRung {
  const deals = rows.reduce((n, r) => n + Math.max(0, r.won), 0)
  if (deals >= MIN_FIELD_EVENTS) return 'deal'
  const qualified = rows.reduce((n, r) => n + Math.max(0, r.qualified), 0)
  if (qualified >= MIN_FIELD_EVENTS) return 'qualified'
  return 'none'
}

/**
 * Weigh every audience against the rest of the field.
 *
 * AGAINST THE REST, NOT AGAINST THE WHOLE. An audience that is most of the
 * account's volume is most of the field average too, so comparing it to a
 * total that includes itself compares it to itself and it can never separate —
 * which is exactly backwards, since the biggest arm is the one whose weight
 * moves the most money.
 *
 * The comparison is one-sided and uses the bound facing the field rate, so a
 * verdict fires only when the audience's whole credible interval is on one
 * side of it. As the sample grows the interval tightens and the gate stops
 * binding on its own — there is no minimum lead count to argue about here.
 */
export function weighAudiences(rows: AudienceRecord[]): AudienceWeight[] {
  const rung = fieldRung(rows)
  const unranked = (r: AudienceRecord): AudienceWeight => ({
    key: r.key, weight: NEUTRAL_WEIGHT, rung, verdict: 'unknown', fieldRate: null, bound: null,
  })
  if (rung === 'none') return rows.map(unranked)

  const totalLeads = rows.reduce((n, r) => n + Math.max(0, r.leads), 0)
  const totalEvents = rows.reduce((n, r) => n + Math.max(0, eventsOn(r, rung)), 0)

  return rows.map((r): AudienceWeight => {
    const leads = Math.max(0, r.leads)
    // No leads is not a bad audience. It is an audience nobody has run, and
    // starving it would guarantee it stays that way.
    if (leads <= 0) return unranked(r)

    const events = Math.max(0, eventsOn(r, rung))
    const restLeads = totalLeads - leads
    const restEvents = totalEvents - events
    // Nothing to compare against: one audience carrying the entire account, or
    // a field that converted nobody. Neither is grounds to move money.
    if (restLeads <= 0 || restEvents <= 0) return unranked(r)

    const fieldRate = restEvents / restLeads
    const b = countBounds(events)
    const lo = b.lo / leads
    const hi = b.hi / leads

    // The bound that faces the threshold, both directions — the same one-sided
    // claim `min-evidence.ts` makes, so a weight and a verdict elsewhere in the
    // product can never disagree about what the sample supports.
    if (lo > fieldRate) {
      return { key: r.key, weight: clamp(lo / fieldRate), rung, verdict: 'better', fieldRate, bound: lo }
    }
    if (hi < fieldRate) {
      return { key: r.key, weight: clamp(hi / fieldRate), rung, verdict: 'worse', fieldRate, bound: hi }
    }
    return { key: r.key, weight: NEUTRAL_WEIGHT, rung, verdict: 'tied', fieldRate, bound: null }
  })
}

/**
 * How far from neutral a weight has to be before it is worth a SENTENCE.
 *
 * A panel must never print "1.07". A broker cannot price a multiplier, and a
 * gap that small is inside the noise of the sample it came from — putting it
 * on screen would dress a coin-flip as a finding. Below this band the row says
 * nothing about its audience, which is the honest reading.
 *
 * This lives here rather than in the component so the rule is one definition
 * and a guard can prove it, the way `aedOf` owns the ledger's one conversion.
 */
export const WEIGHT_SAY_BAND = 0.1

/**
 * The word for a weight, or nothing.
 *
 * Three answers, and the third is the common one. 'less' is deliberately not
 * 'excluded' anywhere it is rendered: the floor is MIN_WEIGHT and the screen
 * has to keep saying so, because "we spend less here" and "we stopped" are
 * different promises and only one of them is true.
 */
export function weightReads(weight: number): 'more' | 'less' | null {
  if (!Number.isFinite(weight)) return null
  if (weight >= NEUTRAL_WEIGHT + WEIGHT_SAY_BAND) return 'more'
  if (weight <= NEUTRAL_WEIGHT - WEIGHT_SAY_BAND) return 'less'
  return null
}

/**
 * The weight for one audience, for a caller holding a campaign rather than a
 * table. An audience nobody weighed is NEUTRAL_WEIGHT — an unknown is never a
 * penalty, which is the same rule `budget-split.ts` applies to an unknown cost.
 */
export function weightFor(weights: AudienceWeight[], key: string | null | undefined): number {
  if (!key) return NEUTRAL_WEIGHT
  return weights.find((w) => w.key === key)?.weight ?? NEUTRAL_WEIGHT
}
