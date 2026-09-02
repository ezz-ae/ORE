/**
 * THE FORECAST HAS TO BE REMEMBERED, OR THE LOOP CANNOT GRADE ITSELF.
 *
 * `forecastLead` predicted what a lead would be worth. `calibrate` compared
 * predictions against what brokers actually said. Between them the loop was
 * complete — except that nothing ever wrote a forecast down. It was computed
 * when a screen asked for it and discarded when the response was sent, so no
 * (predicted, actual) pair has ever existed and `calibrate` was called by
 * nothing but its own test.
 *
 * A prediction nobody kept is not a prediction. This is the row that turns
 * two pure functions into a feedback loop.
 *
 * ── IT IS FROZEN AT ARRIVAL, AND THAT IS THE WHOLE INTEGRITY OF IT ───────
 *
 * The forecast is written ONCE, when the lead lands, and never recomputed.
 *
 * Recomputing later would read the ad's history AS IT IS NOW — which by then
 * contains the rating of this very lead. The forecast would move toward the
 * answer it is supposed to be judged against, the measured error would shrink
 * on its own, and the system would report itself getting cleverer while
 * learning nothing. A loop that grades its own homework is worse than no
 * measurement, because it produces a number that only ever improves.
 *
 * The same rule, for the same reason, as `openRatingClaim` in points.ts: the
 * snapshot is taken before the outcome could be known, or it is not evidence.
 * ON CONFLICT DO NOTHING enforces it — a second write for the same lead is
 * silently ignored rather than allowed to overwrite the original call.
 *
 * Every write here is best-effort. A lead must never fail to arrive because
 * its forecast could not be stored: a missing forecast costs one row of
 * calibration, a lost lead costs a customer.
 */
import { query, ensureOnce } from '@/lib/db'
import { forecastLead, calibrate, forecastAccuracy, type ArrivalFacts, type RatedLead } from '@/lib/freehold/lead-forecast'

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_lead_forecasts (
      lead_id      text PRIMARY KEY,
      expected     numeric NOT NULL,
      confidence   text NOT NULL DEFAULT '',
      because      text NOT NULL DEFAULT '',
      /* The ad it was forecast FROM, so calibration can group by source
         without re-reading the lead and getting a value edited since. */
      source       text NOT NULL DEFAULT '',
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_lead_forecasts_source_idx
               ON freehold_lead_forecasts (source)`)
}

export const ensureForecastSchema = () => ensureOnce('freehold_lead_forecasts', ensure)

/**
 * Record what we expected of a lead, at the moment it arrived.
 *
 * A withheld forecast (null) is NOT stored. "We could not say" is honest and
 * it is also not a prediction, and counting it as one would let a system that
 * knows nothing about most of its leads report a flattering accuracy on the
 * few it does.
 */
export async function rememberForecast(
  leadId: string,
  source: string,
  facts: ArrivalFacts,
): Promise<void> {
  if (!leadId) return
  try {
    const f = forecastLead(facts)
    if (f.expected === null) return
    await ensureForecastSchema()
    await query(
      `INSERT INTO freehold_lead_forecasts (lead_id, expected, confidence, because, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lead_id) DO NOTHING`,
      [leadId, f.expected, f.confidence, f.because.join(','), String(source ?? '')],
    )
  } catch {
    // A missing forecast costs one row of calibration; a failed insert here
    // must never cost the lead.
  }
}

/** The (predicted, actual) pairs — every forecast whose lead has been rated. */
export async function ratedForecasts(): Promise<RatedLead[]> {
  try {
    await ensureForecastSchema()
    const rows = await query<{ source: string; expected: string; actual: string }>(
      `SELECT f.source, f.expected::text, l.value_rating::text AS actual
         FROM freehold_lead_forecasts f
         JOIN freehold_site_leads l ON l.id = f.lead_id
        WHERE l.archived IS NOT TRUE
          AND l.value_rating IS NOT NULL`,
    )
    return rows.map((r) => ({
      source: r.source,
      forecast: Number(r.expected),
      actual: Number(r.actual),
    })).filter((r) => Number.isFinite(r.forecast) && Number.isFinite(r.actual))
  } catch {
    return []
  }
}

/**
 * The loop's own report card.
 *
 * `accuracy` is the honesty check on everything else here: if the forecast is
 * not measuring the world, no calibration built on it should be allowed to
 * move money, and the only way to know that is to compute the error and show
 * it rather than assume it.
 */
export async function loopStatus(): Promise<{
  calibration: ReturnType<typeof calibrate>
  accuracy: ReturnType<typeof forecastAccuracy>
  latency: RatingLatency
}> {
  const [pairs, latency] = await Promise.all([ratedForecasts(), ratingLatency()])
  return { calibration: calibrate(pairs), accuracy: forecastAccuracy(pairs), latency }
}


/**
 * HOW LONG THE LOOP TAKES TO CLOSE — the constraint everything else now sits
 * behind.
 *
 * "if the rate goes on time to meta and feed the same ad on time this is the
 *  ultimate loop we want and its super higher than the lookalike."
 *
 * That is right, and it changes which number matters. A value-based lookalike
 * is a slow, indirect signal: build an audience, hand it over, hope the
 * similarity model finds more. Sending the outcome back to the ad that
 * produced it teaches Meta's optimiser INSIDE the campaign that is running —
 * direct, and while the money is still moving.
 *
 * Which means the binding constraint is no longer whether the signal is sent.
 * It is HOW LATE. A lead rated the same afternoon reaches the optimiser while
 * the ad set is still learning; the same rating six days later arrives after
 * the budget has already been spent on whatever Meta guessed in the meantime.
 * The rating is identical. The value to the machine is not.
 *
 * So it is measured, per ad, and reported in hours — because "our team rates
 * leads eventually" is not a fact anybody can act on, and "this ad's outcomes
 * reach Meta four days late" is.
 */
export interface RatingLatency {
  /** Rated leads with both timestamps — the sample the rest rests on. */
  rated: number
  /** Median hours from a lead arriving to somebody rating it. */
  medianHours: number | null
  /** The slowest quarter, which is where the loop actually leaks. */
  p75Hours: number | null
  /** Rated inside a day — the share that reaches Meta while it still matters. */
  sameDayShare: number | null
}

const quantile = (sorted: readonly number[], q: number): number | null => {
  if (sorted.length === 0) return null
  const i = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))
  return Math.round(sorted[i] * 10) / 10
}

export async function ratingLatency(): Promise<RatingLatency> {
  const empty: RatingLatency = { rated: 0, medianHours: null, p75Hours: null, sameDayShare: null }
  try {
    const rows = await query<{ hours: string }>(
      `SELECT EXTRACT(EPOCH FROM (value_rated_at - created_at)) / 3600 AS hours
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND value_rating IS NOT NULL
          AND value_rated_at IS NOT NULL
          AND created_at IS NOT NULL
          -- A rating stamped before the lead arrived is a clock problem, not a
          -- fast team. Dropped rather than counted as zero, which would make
          -- the median flatter the slower the account got.
          AND value_rated_at >= created_at`,
    )
    const hours = rows
      .map((r) => Number(r.hours))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b)
    if (hours.length === 0) return empty
    return {
      rated: hours.length,
      medianHours: quantile(hours, 0.5),
      p75Hours: quantile(hours, 0.75),
      sameDayShare: Math.round((hours.filter((h) => h <= 24).length / hours.length) * 100),
    }
  } catch {
    return empty
  }
}
