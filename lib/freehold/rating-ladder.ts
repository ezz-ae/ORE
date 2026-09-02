/**
 * EVERY RATING, AS A ROW — and what each row is worth doing something about.
 *
 * "above the form create lead rate table… 1 2 3 4 5 6 7 8 9 10 this is your
 *  rows and you tell in every rate how many — and connect them in audiences
 *  building, match audiences from the crm who seem to have same behaviour."
 *
 * The forms page reported one number for the whole account: an average. An
 * average of ratings is close to meaningless here, because the distribution is
 * the finding. Two accounts both averaging 5 — one where every lead is a 5,
 * one that is half 10s and half 0s — are opposite businesses, and only the
 * second has anything worth buying more of.
 *
 * So the ladder is eleven rows, 0 to 10, each with its count and its share.
 * Zero is a row, not an omission: the bottom of the scale is what teaches the
 * machine what to stop buying, and this product's own comment calls that
 * "exactly as valuable as knowing what to buy more of".
 *
 * ── AND EACH BAND KNOWS WHICH AUDIENCE IT FEEDS ──────────────────────────
 *
 * A table nobody can act on is a report. Each band maps to a seed-cohort
 * signal (seed-cohort.ts) — the rows at the top are the people to build a
 * lookalike FROM, the rows at the bottom are the people to exclude. That
 * mapping is what turns "how many 9s do we have" into "here is the audience",
 * and it is the reason the counts are grouped by band as well as listed by
 * rating.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import { VALUABLE_RATING, AVOID_RATING, PERFECT_RATING, DEAL_RATING } from '@/lib/freehold/lead-stages'
import type { SeedSignal, AvoidSignal } from '@/lib/freehold/seed-cohort'

/** Every rating a broker can give. Walkable — the table's rows. */
export const RATING_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export type RatingStep = (typeof RATING_STEPS)[number]

/** Walkable — the four bands the ladder groups into. */
export const RATING_BAND_IDS = ['avoid', 'unsure', 'good', 'deal'] as const
export type RatingBandId = (typeof RATING_BAND_IDS)[number]

/**
 * Which band a rating falls in, using the thresholds the rest of the product
 * already decides by rather than a second set invented here.
 *
 *   0–2   avoid   the exclusion list
 *   3–5   unsure  forecasts nothing, earns nothing (points.ts)
 *   6–7   good    worth pursuing (VALUABLE_RATING)
 *   8–10  deal    the seed a lookalike is built from (PERFECT_RATING)
 */
export function bandOfRating(rating: number): RatingBandId {
  if (!Number.isFinite(rating)) return 'unsure'
  if (rating <= AVOID_RATING) return 'avoid'
  if (rating < VALUABLE_RATING) return 'unsure'
  if (rating < PERFECT_RATING) return 'good'
  return 'deal'
}

/**
 * The audience each band feeds, or null when it feeds none.
 *
 * `unsure` deliberately maps to nothing. A lead nobody could call is not
 * evidence in either direction, and seeding an audience from "we could not
 * tell" would hand Meta a cohort defined by our own uncertainty.
 */
export const BAND_AUDIENCE: Record<RatingBandId, SeedSignal | AvoidSignal | null> = {
  deal: 'rated_perfect',
  good: 'rated_well',
  unsure: null,
  avoid: 'rated_junk',
}

/** True for the bands a lookalike is built FROM rather than excluded by. */
export const isSeedBand = (b: RatingBandId): boolean => b === 'deal' || b === 'good'

export interface LadderRow {
  rating: RatingStep
  band: RatingBandId
  leads: number
  /** Share of all RATED leads, 0–100, rounded. */
  share: number
}

export interface RatingLadder {
  rows: LadderRow[]
  rated: number
  /** Counts per band, for the audience actions. */
  byBand: Record<RatingBandId, number>
  /** Mean across rated leads, or null when nothing is rated. */
  mean: number | null
  /**
   * THE FINDING THE AVERAGE HIDES. Share of ratings sitting at the two ends
   * rather than the middle — a high number means the account is producing two
   * different kinds of lead and the average describes neither.
   */
  polarised: number
}

/**
 * Build the ladder from raw counts.
 *
 * `counts` is rating → number of leads. Missing ratings are zero rows, not
 * absent ones: a gap in the table is a fact about the business and dropping
 * the row would hide it.
 */
export function buildLadder(counts: Readonly<Record<number, number>>): RatingLadder {
  const rows: LadderRow[] = RATING_STEPS.map((rating) => ({
    rating,
    band: bandOfRating(rating),
    leads: Math.max(0, Math.round(Number(counts[rating] ?? 0)) || 0),
    share: 0,
  }))
  const rated = rows.reduce((n, r) => n + r.leads, 0)
  for (const r of rows) r.share = rated > 0 ? Math.round((r.leads / rated) * 100) : 0

  const byBand = RATING_BAND_IDS.reduce((acc, b) => {
    acc[b] = rows.filter((r) => r.band === b).reduce((n, r) => n + r.leads, 0)
    return acc
  }, {} as Record<RatingBandId, number>)

  const mean = rated > 0
    ? Math.round((rows.reduce((n, r) => n + r.rating * r.leads, 0) / rated) * 10) / 10
    : null

  // The ends against the middle. Deliberately counts the AVOID and DEAL bands
  // only — "good" and "unsure" are the ordinary middle of any account.
  const polarised = rated > 0
    ? Math.round(((byBand.avoid + byBand.deal) / rated) * 100)
    : 0

  return { rows, rated, byBand, mean, polarised }
}

/** The rating that would be a perfect score, named rather than typed as 10. */
export const TOP_RATING = DEAL_RATING
