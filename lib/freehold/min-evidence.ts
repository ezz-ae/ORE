/**
 * MINIMUM EVIDENCE — the gate between a number and a conclusion.
 *
 * An ad platform will happily tell you "Cost per result: AED 0.00" for a
 * campaign that has produced no results, and "CTR 0%" after eighty
 * impressions. Both are arithmetic. Neither is information. Acting on them
 * pauses campaigns that were fine and raises budgets on campaigns that have
 * proven nothing.
 *
 * This module refuses to hand a rate to a decision until the sample can
 * support the specific comparison being asked. Two ideas do the work:
 *
 * 1. A RATE (cost per lead, click-through) is a count over an exposure, so it
 *    carries an exact confidence interval. We never compare the point
 *    estimate — we compare the BOUND that faces the threshold:
 *      · "cpl > 300" may fire only if the LOWER bound is still above 300
 *      · "ctr < 0.5" may fire only if the UPPER bound is still below 0.5
 *    Both are one-sided and provably right. As the sample grows the interval
 *    tightens and the gate stops binding on its own — there is no arbitrary
 *    minimum to argue about, and no threshold that is "too strict" at scale.
 *
 * 2. Zero is not a special case. Zero leads on AED 248 is not "CPL 0" and not
 *    "unknown" either: it is CPL ≥ 67, because a campaign that truly converted
 *    at AED 67 would almost certainly have shown a lead by now. The same
 *    formula produces that bound, so "no result yet" becomes real evidence
 *    once enough money has gone through it — which is exactly when a human
 *    would start to worry, and not one dirham before.
 *
 * QUALITY is different. It is a weighted composite of four proportions plus
 * two bounded adjustments, not a single count over an exposure, so there is no
 * honest closed-form interval for it. It gets a plain minimum instead, and the
 * constant is named so a log line can cite it.
 *
 * COUNTS (leads, spend) are exact. They are never gated: "spend > 5000" is a
 * fact about money already gone, not an estimate.
 *
 * Pure. No I/O, no clock, no platform calls — so the guard suite can prove the
 * behaviour rather than assert the shape.
 */

/** Two-sided 95% — so each one-sided bound below is a 97.5% claim. */
const Z = 1.959964

/**
 * Attributed CRM leads required before a 0–100 quality score may decide
 * anything. Below this a single lead that went cold reads as "score 0" and a
 * single lead that closed reads as "score 100".
 */
export const MIN_ATTRIBUTED_FOR_QUALITY = 5

/**
 * Exact-ish 95% confidence bounds on a Poisson count.
 *
 * Byar's approximation to the Garwood (exact) interval. Closed form, no
 * iteration, no factorials, and no `exp(-m)` to underflow when a campaign has
 * a hundred thousand clicks. Within ~0.3% of exact for k ≥ 1, which is far
 * inside the noise of the thing being measured. k = 0 is the exact value:
 * P(X = 0 | m) = e^-m = 0.025 → m = -ln(0.025).
 */
export function countBounds(k: number): { lo: number; hi: number } {
  if (!Number.isFinite(k) || k < 0) return { lo: 0, hi: Infinity }
  if (k === 0) return { lo: 0, hi: 3.688879 }
  const lo = k * Math.pow(1 - 1 / (9 * k) - Z / (3 * Math.sqrt(k)), 3)
  const n = k + 1
  const hi = n * Math.pow(1 - 1 / (9 * n) + Z / (3 * Math.sqrt(n)), 3)
  return { lo: Math.max(0, lo), hi }
}

/**
 * The credible range of a rate measured as `count` events over `exposure`
 * units, scaled by `per`.
 *
 * `ctrRange(clicks, impressions, 100)` → percent.
 * Exposure ≤ 0 means nothing was measured at all: the whole range is possible.
 */
export function rateRange(count: number, exposure: number, per = 1): { lo: number; hi: number } {
  if (!Number.isFinite(exposure) || exposure <= 0) return { lo: 0, hi: Infinity }
  const b = countBounds(count)
  return { lo: (b.lo / exposure) * per, hi: (b.hi / exposure) * per }
}

/**
 * The credible range of a COST per event — an inverted rate, so the bounds
 * swap: many events (high count bound) means cheap (low cost bound).
 *
 * Zero events yields `hi: Infinity` — the cost could be anything, it may just
 * be that the next dirham buys one — while `lo` stays a real, defensible
 * number. That asymmetry is the whole point: it lets "this is too expensive"
 * fire on a campaign with no results, and forbids "this is cheap" from ever
 * firing on one.
 */
export function costRange(spend: number, events: number): { lo: number; hi: number } {
  if (!Number.isFinite(spend) || spend <= 0) return { lo: 0, hi: Infinity }
  const b = countBounds(events)
  return { lo: spend / b.hi, hi: b.lo > 0 ? spend / b.lo : Infinity }
}

/** What a decision is allowed to know. Raw evidence only — no pre-computed
 *  rates, because a caller that can hand in `cpl: 0` is the bug this replaces. */
export interface Evidence {
  spend: number
  leads: number
  clicks: number
  impressions: number
  /**
   * Meta's own frequency — average times each person saw the ad. Null when
   * Meta has not reported one, which is not the same as zero and must never
   * be read as "nobody has seen it twice".
   */
  frequency?: number | null
  /** CRM-attributed leads behind `qualityScore` (its sample size). */
  attributed: number
  qualityScore: number | null
}

export type Direction = 'lt' | 'gt'

/** A comparison the evidence could not support, phrased for a human. */
export interface Withheld {
  metric: string
  /** Plain-language reason, e.g. "0 leads on AED 82 — CPL could be anything above 22". */
  reason: string
}

export interface Supported {
  /** The value to report and compare — the bound facing the threshold. */
  value: number
  /** The unguarded point estimate, for display beside it. Null when undefined. */
  point: number | null
}

/**
 * Can `metric <op> threshold` be decided on this evidence?
 *
 * Returns the bound to compare (never the point estimate), or the reason it
 * cannot be decided. The caller compares `value` to the threshold exactly as
 * it would have compared the raw metric — the gate is in which number it gets,
 * not in a second branch the caller has to remember to write.
 */
/**
 * Impressions below which a frequency figure is arithmetic rather than
 * information. Frequency is a reported ratio, not an estimate — but on a
 * few hundred impressions it swings on single deliveries, and a rule that
 * widens an audience on that noise throws away targeting that was working.
 */
export const MIN_IMPRESSIONS_FOR_FREQUENCY = 1000

export function support(
  metric: 'quality' | 'cpl' | 'leads' | 'spend' | 'ctr' | 'frequency',
  op: Direction,
  ev: Evidence,
): Supported | Withheld {
  const aed = (n: number) => `AED ${n.toFixed(0)}`

  // Exact counts. Money spent and leads received are not estimates.
  if (metric === 'spend') return { value: ev.spend, point: ev.spend }
  if (metric === 'leads') return { value: ev.leads, point: ev.leads }

  if (metric === 'cpl') {
    const point = ev.leads > 0 ? ev.spend / ev.leads : null
    if (ev.spend <= 0) {
      return { metric, reason: 'nothing spent yet — there is no cost to measure' }
    }
    const r = costRange(ev.spend, ev.leads)
    // "Too expensive" is decidable with zero leads; "cheap enough" never is.
    if (op === 'gt') return { value: r.lo, point }
    if (!Number.isFinite(r.hi)) {
      return {
        metric,
        reason: `${ev.leads} leads on ${aed(ev.spend)} — cost per lead could be anything above ${aed(r.lo)}, so it cannot be called cheap yet`,
      }
    }
    return { value: r.hi, point }
  }

  if (metric === 'frequency') {
    // Meta's own number. Nothing to bound — but plenty to withhold on.
    if (ev.frequency === null || ev.frequency === undefined) {
      return { metric, reason: 'Meta has not reported a frequency for this yet' }
    }
    if (ev.impressions < MIN_IMPRESSIONS_FOR_FREQUENCY) {
      return {
        metric,
        reason: `${ev.impressions} impressions — frequency swings on single deliveries below ${MIN_IMPRESSIONS_FOR_FREQUENCY}, and widening an audience on that noise throws away targeting that was working`,
      }
    }
    return { value: ev.frequency, point: ev.frequency }
  }

  if (metric === 'ctr') {
    const point = ev.impressions > 0 ? (ev.clicks / ev.impressions) * 100 : null
    if (ev.impressions <= 0) {
      return { metric, reason: 'no impressions yet — nobody has had the chance to click' }
    }
    const r = rateRange(ev.clicks, ev.impressions, 100)
    const bound = op === 'gt' ? r.lo : r.hi
    if (!Number.isFinite(bound)) {
      return { metric, reason: 'not enough impressions to bound the click-through rate' }
    }
    // Both directions are decidable here; the bound simply has to clear the
    // threshold. Small samples produce a wide bound and quietly fail to fire.
    return { value: bound, point }
  }

  // quality
  if (ev.qualityScore === null) {
    return { metric, reason: 'no attributed leads yet — there is no funnel outcome to score' }
  }
  if (ev.attributed < MIN_ATTRIBUTED_FOR_QUALITY) {
    return {
      metric,
      reason: `${ev.attributed} attributed lead${ev.attributed === 1 ? '' : 's'} — a quality score needs ${MIN_ATTRIBUTED_FOR_QUALITY} before one cold call can read as ${ev.qualityScore}/100`,
    }
  }
  return { value: ev.qualityScore, point: ev.qualityScore }
}

export const isWithheld = (s: Supported | Withheld): s is Withheld =>
  (s as Withheld).reason !== undefined

/** The point estimates, for DISPLAY only. Never pass these to a decision. */
export function displayMetrics(ev: Evidence): {
  quality: number | null; cpl: number | null; leads: number; spend: number; ctr: number | null
  frequency: number | null
} {
  return {
    frequency: ev.frequency ?? null,
    quality: ev.qualityScore,
    cpl: ev.leads > 0 ? ev.spend / ev.leads : null,
    leads: ev.leads,
    spend: ev.spend,
    ctr: ev.impressions > 0 ? (ev.clicks / ev.impressions) * 100 : null,
  }
}
