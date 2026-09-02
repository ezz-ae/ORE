/**
 * THE HALF OF THE LOOP THAT WAS NEVER BUILT.
 *
 * "no quality analysis for lead on arrival. a good system will analyse from
 *  which interest or behaviour we got this lead… and give an expected quality
 *  level, then compare the expectation with the team rate and feed the ads.
 *  this is the loop that makes this system smarter."
 *
 * Everything needed for that existed except the two ends of it.
 *
 * The CRM already collects the ground truth: a broker's 0–10 value rating,
 * one click, the strongest signal in the product. The ads side already writes
 * outcomes back to Meta (lead-stages.ts) and already rolls up outcomes by
 * audience and by form answer (audience-outcomes.ts, answer-outcomes.ts).
 *
 * What was missing:
 *
 *   1. NOTHING PREDICTED. `intentScore` was a four-way lookup off
 *      `temperature` — 90 / 75 / 55 / 30 — so it carried no information about
 *      the lead at all. Every screen showed it; nothing computed it. The
 *      operator's verdict: "the intent level is decoration and means nothing,
 *      now its 50 for everyone and never calculated."
 *   2. NOTHING COMPARED. With no forecast there was nothing to check the
 *      rating against, so a rating could only ever be a KPI — a number on a
 *      card. "the rate seems like kpi not effecting the spend or the target."
 *
 * A forecast that is never checked is astrology. A rating that is never
 * forecast against is bookkeeping. Together they are a feedback loop, and the
 * loop is the entire difference between a collection of apps and a machine:
 * if the next campaign has nothing to learn from this one, the system is a
 * very expensive spreadsheet.
 *
 * ── WHAT MAKES THIS A LOOP RATHER THAN A SCORE ───────────────────────────
 *
 * The dominant term in the forecast is `sourceHistory` — what leads from THIS
 * ad, form or audience have actually been rated before. That is the carry
 * from campaign N into campaign N+1, and it is empirical: nobody tunes it,
 * the brokers' own ratings move it.
 *
 * The other terms only adjust it, and each is a fact observed before anyone
 * picked up the phone: how thoroughly they read the page, whether the number
 * can be dialled, whether they answered the qualifying questions.
 *
 * Then `calibrate` closes it: per source, the mean forecast against the mean
 * rating. A source rated better than predicted is under-bought. Worse, and it
 * is over-bought. That difference is the instruction to the next campaign.
 *
 * ── AND IT SAYS "I DO NOT KNOW" ──────────────────────────────────────────
 *
 * Withheld, not 50. A lead with no history, no behaviour and no answers gets
 * `null` — the whole reason the old number was worthless is that it always
 * had a value. Every threshold here is stated with its reason, and every
 * comparison is gated on a sample big enough to mean something (min-evidence).
 *
 * NOTHING HERE READS NATIONALITY, ORIGIN, OR ANY PROXY FOR EITHER. The
 * signals are behaviour, contactability and this source's own measured
 * results. See lib/freehold/audience-pattern.ts for why that line exists.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import { countBounds } from '@/lib/freehold/min-evidence'
import { VALUABLE_RATING, AVOID_RATING } from '@/lib/freehold/lead-stages'

/** Walkable — every reason a forecast can cite. Each renders its own words. */
export const FORECAST_REASONS = [
  'sourceHistory', 'readDeeply', 'skimmed', 'answeredQuestions',
  'undialable', 'suspectEmail', 'declaredIntent',
] as const
export type ForecastReason = (typeof FORECAST_REASONS)[number]

/**
 * Ratings a source needs before its history may steer a forecast.
 *
 * Three is enough to stop one broker's Tuesday deciding what the machine
 * believes about an entire ad, and low enough that a new ad earns an opinion
 * within its first week rather than its second month.
 */
export const MIN_RATED_FOR_HISTORY = 3

/**
 * Ratings a source needs before its forecast error may move money.
 *
 * Higher than the above deliberately: believing a source is under-bought and
 * spending more on it is a decision with a cost, and five is where the
 * Poisson bound on a count stops being wider than the thing it measures. Same
 * floor as MIN_ATTRIBUTED_FOR_QUALITY, for the same reason.
 */
export const MIN_RATED_FOR_CALIBRATION = 5

/** The middle of the 0–10 scale — the value that asserts nothing. */
const NEUTRAL = 5

/** What is known about a lead the moment it arrives, before anybody calls. */
export interface ArrivalFacts {
  /** 0–100 landing-session score; null when they never saw a landing page. */
  behaviourScore?: number | null
  phone?: string | null
  email?: string | null
  /** Non-contact form answers, resolved to words at sync. */
  answers?: Array<{ key: string; question: string; answer: string }>
  /** Declared intent carried on the ad's link (?intent=). */
  clickIntent?: string | null
  /**
   * WHAT THIS SOURCE HAS ALREADY PRODUCED — the carry from the last campaign
   * into this one. Resolved by the caller from rated leads sharing this ad,
   * form or audience.
   */
  sourceHistory?: { rated: number; meanRating: number } | null
}

export interface Forecast {
  /** 0–10, on the same scale a broker rates. null = not enough to say. */
  expected: number | null
  /** How much of the forecast rests on measured history rather than proxies. */
  confidence: 'none' | 'low' | 'medium' | 'high'
  because: ForecastReason[]
}

const digits = (p?: string | null) => String(p ?? '').replace(/\D/g, '')
/** Same rule the quality read uses — a number too short to dial. */
export const undialable = (p?: string | null) => digits(p).length < 7

/** Obvious throwaways. Deliberately short: a wrong guess here costs a real lead. */
const DISPOSABLE = /@(mailinator|guerrillamail|10minutemail|tempmail|yopmail|trashmail|sharklasers)\./i
export const suspectEmail = (e?: string | null): boolean => {
  const v = String(e ?? '').trim()
  if (!v) return false
  if (DISPOSABLE.test(v)) return true
  // Not a plausible address at all.
  return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

const clamp = (n: number) => Math.max(0, Math.min(10, n))

/**
 * What this lead is likely to be worth, before anybody has spoken to them.
 *
 * Returns null rather than a number when nothing is known. That is the whole
 * correction: the value it replaces was always present and always meaningless.
 */
export function forecastLead(f: ArrivalFacts): Forecast {
  const because: ForecastReason[] = []
  let base: number | null = null
  let confidence: Forecast['confidence'] = 'none'

  // ── The learned term. This is the loop. ────────────────────────────────
  const h = f.sourceHistory
  if (h && h.rated >= MIN_RATED_FOR_HISTORY && Number.isFinite(h.meanRating)) {
    base = clamp(h.meanRating)
    because.push('sourceHistory')
    // Confidence follows the sample, not the strength of the opinion.
    confidence = h.rated >= MIN_RATED_FOR_CALIBRATION * 2 ? 'high'
      : h.rated >= MIN_RATED_FOR_CALIBRATION ? 'medium' : 'low'
  }

  // ── Observed behaviour. A leading signal: CRM outcomes take weeks, how
  //    thoroughly somebody read the page is known in minutes.
  const b = f.behaviourScore
  const hasBehaviour = typeof b === 'number' && Number.isFinite(b)
  if (hasBehaviour) {
    // Mapped onto the same 0–10 scale so the two terms are commensurable.
    const asRating = clamp((b as number) / 10)
    base = base === null ? asRating : (base * 2 + asRating) / 3
    if ((b as number) >= 70) because.push('readDeeply')
    else if ((b as number) <= 30) because.push('skimmed')
    if (confidence === 'none') confidence = 'low'
  }

  // ── Effort. Answering the qualifying questions is a small act of intent,
  //    so it nudges rather than decides.
  const answered = (f.answers ?? []).filter((a) => String(a.answer ?? '').trim()).length
  if (answered >= 2) {
    base = (base ?? NEUTRAL) + 0.5
    because.push('answeredQuestions')
    if (confidence === 'none') confidence = 'low'
  }
  if (String(f.clickIntent ?? '').trim()) {
    base = (base ?? NEUTRAL) + 0.5
    because.push('declaredIntent')
    if (confidence === 'none') confidence = 'low'
  }

  // ── Contactability. A lead nobody can reach is worth nothing whatever the
  //    ad said, so these are the only terms allowed to dominate.
  if (undialable(f.phone)) {
    base = Math.min(base ?? NEUTRAL, AVOID_RATING)
    because.push('undialable')
    confidence = confidence === 'none' ? 'medium' : confidence
  }
  if (suspectEmail(f.email)) {
    base = (base ?? NEUTRAL) - 1
    because.push('suspectEmail')
    if (confidence === 'none') confidence = 'low'
  }

  if (base === null) return { expected: null, confidence: 'none', because: [] }
  return { expected: Math.round(clamp(base) * 10) / 10, confidence, because }
}

// ── THE COMPARISON THAT CLOSES THE LOOP ──────────────────────────────────

/** Walkable — what a source's measured results say about what to do next. */
export const CALIBRATION_VERDICTS = ['underBought', 'overBought', 'onTarget', 'tooEarly'] as const
export type CalibrationVerdict = (typeof CALIBRATION_VERDICTS)[number]

/**
 * How far the actual rating may sit from the forecast before it means
 * something. A point and a half on a ten-point scale: smaller than that is
 * two brokers disagreeing about the same lead, which is not a fact about the
 * ad that produced it.
 */
export const CALIBRATION_TOLERANCE = 1.5

export interface RatedLead {
  /** The ad, form or audience this lead came from. */
  source: string
  /** What was forecast at arrival. Null-forecast leads are excluded. */
  forecast: number | null
  /** What a human actually said, 0–10. */
  actual: number
}

export interface Calibration {
  source: string
  rated: number
  meanForecast: number
  meanActual: number
  /** actual − forecast. Positive means better than predicted. */
  gap: number
  verdict: CalibrationVerdict
  /** True when the leads are genuinely good, not merely better than feared. */
  worthMore: boolean
}

/**
 * Compare what was predicted against what the team actually said, per source.
 *
 * This is the instruction the next campaign reads. A source whose leads are
 * rated consistently better than forecast is under-bought — the machine was
 * pessimistic about it and spend should follow the evidence. Worse than
 * forecast is over-bought.
 *
 * `worthMore` is the safeguard on that: a source can beat a dismal forecast
 * and still produce leads nobody wants, and "less bad than expected" must
 * never read as "buy more". It requires the ACTUAL mean to clear
 * VALUABLE_RATING as well.
 */
export function calibrate(leads: readonly RatedLead[]): Calibration[] {
  const bySource = new Map<string, RatedLead[]>()
  for (const l of leads) {
    const key = String(l.source ?? '').trim()
    if (!key || l.forecast === null || !Number.isFinite(l.actual)) continue
    bySource.set(key, [...(bySource.get(key) ?? []), l])
  }

  const out: Calibration[] = []
  for (const [source, rows] of bySource) {
    const rated = rows.length
    const meanForecast = rows.reduce((s, r) => s + (r.forecast as number), 0) / rated
    const meanActual = rows.reduce((s, r) => s + r.actual, 0) / rated
    const gap = meanActual - meanForecast
    const worthMore = meanActual >= VALUABLE_RATING

    // Under the floor nothing is claimed — see MIN_RATED_FOR_CALIBRATION.
    const verdict: CalibrationVerdict =
      rated < MIN_RATED_FOR_CALIBRATION ? 'tooEarly'
        : gap >= CALIBRATION_TOLERANCE && worthMore ? 'underBought'
          : gap <= -CALIBRATION_TOLERANCE ? 'overBought'
            : 'onTarget'

    out.push({
      source, rated,
      meanForecast: Math.round(meanForecast * 10) / 10,
      meanActual: Math.round(meanActual * 10) / 10,
      gap: Math.round(gap * 10) / 10,
      verdict, worthMore,
    })
  }
  // Loudest first: the biggest miss in either direction is the thing to act on.
  return out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
}

/**
 * IS THE FORECAST ITSELF ANY GOOD?
 *
 * The question that keeps this honest. If the mean absolute error across
 * everything rated is large, the forecast is not measuring the world and no
 * calibration built on it should move money — so the number is computed and
 * shown rather than assumed.
 *
 * Returned with the count, and the bound on that count, so a screen can say
 * how much to trust it instead of printing a bare average.
 */
export function forecastAccuracy(leads: readonly RatedLead[]): {
  rated: number
  meanAbsoluteError: number | null
  /** 95% bound on the sample size — wide sample, weak claim. */
  atLeast: number
} {
  const usable = leads.filter((l) => l.forecast !== null && Number.isFinite(l.actual))
  if (usable.length === 0) return { rated: 0, meanAbsoluteError: null, atLeast: 0 }
  const mae = usable.reduce((s, l) => s + Math.abs((l.forecast as number) - l.actual), 0) / usable.length
  return {
    rated: usable.length,
    meanAbsoluteError: Math.round(mae * 10) / 10,
    atLeast: Math.floor(countBounds(usable.length).lo),
  }
}
