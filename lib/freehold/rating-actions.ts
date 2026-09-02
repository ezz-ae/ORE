/**
 * WHAT EACH RATING DOES, WITHOUT WAITING FOR ANYBODY.
 *
 * "this is the rate every number and action — we need this to feed the
 *  audience not to wait for manual execution."
 *
 * The operator dictated the table. It is reproduced here exactly, because it
 * is a business decision rather than an inference, and the one thing this file
 * must not do is quietly improve on it:
 *
 *     1  Junk           exclude
 *     2  Avoid          exclude
 *     3  Unqualified    exclude
 *     4  Not interested CRM execution
 *     5  Unsure         CRM execution
 *     6  (see below)    include, weight 1
 *     7  Good           include, weight 2
 *     8  Perfect        include, weight 3
 *     9  Master         include, weight 3
 *    10  Buyer          include, weight 3
 *
 * ── THE THREE ACTIONS ────────────────────────────────────────────────────
 *
 * EXCLUDE feeds the do-not-target list. These people cost money to reach and
 * were judged not worth reaching.
 *
 * CRM EXECUTION feeds neither audience. 4 and 5 are the band that forecasts
 * nothing — points.ts pays nothing for a rating there for exactly this reason
 * — and a person nobody could read is not evidence in either direction.
 * Seeding from them hands Meta a cohort defined by our own uncertainty, and
 * excluding them throws away people who were simply never worked. They are a
 * job for the team, not an input to the buying.
 *
 * INCLUDE feeds the seed, with a WEIGHT. Meta accepts a value column on a
 * custom audience and weights similarity by it, which seed-cohort.ts already
 * uploads through `seedUpload`. So "+1 +2 +3" is expressed as a weight of 1,
 * 2 or 3: a 10 pulls the lookalike three times as hard as a 6.
 *
 * ── TWO THINGS I READ RATHER THAN KNEW, STATED SO THEY CAN BE CORRECTED ──
 *
 * 1. The written table labels BOTH 4 and 6 "not interested", while giving
 *    them opposite actions — 4 is CRM execution, 6 is include. Two different
 *    actions cannot share one meaning, so 6's ACTION is implemented as
 *    written and its LABEL is left as `rate6`, deliberately unnamed, rather
 *    than a word invented here. Name it and it renders.
 * 2. "+1 +2 +3" is read as cumulative weight (1, 2, 3), not as three separate
 *    lookalike percentages. That is the reading the existing upload path
 *    supports; if it meant 1%/2%/3% audience sizes, that is a different change
 *    and this table is wrong.
 *
 * Rating 0 is absent from the written table. It sits below Junk, so it
 * excludes — the alternative is a rating that does nothing, which is the
 * failure this whole file removes.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

/** Walkable — what a rating does to the audiences. */
export const RATING_ACTIONS = ['exclude', 'crmExecution', 'include'] as const
export type RatingAction = (typeof RATING_ACTIONS)[number]

export interface RatingRule {
  rating: number
  /** i18n key suffix — the operator's own word for this number. */
  label: string
  action: RatingAction
  /** Meta value-column weight. 0 for anything that is not included. */
  weight: 0 | 1 | 2 | 3
}

/**
 * THE TABLE, as dictated. Index is the rating.
 *
 * A const array so it can be walked: every screen, every guard and the i18n
 * audit read the same eleven rows, and a twelfth cannot appear without
 * appearing here.
 */
export const RATING_RULES: readonly RatingRule[] = [
  { rating: 0,  label: 'junk',          action: 'exclude',      weight: 0 },
  { rating: 1,  label: 'junk',          action: 'exclude',      weight: 0 },
  { rating: 2,  label: 'avoid',         action: 'exclude',      weight: 0 },
  { rating: 3,  label: 'unqualified',   action: 'exclude',      weight: 0 },
  { rating: 4,  label: 'notInterested', action: 'crmExecution', weight: 0 },
  { rating: 5,  label: 'unsure',        action: 'crmExecution', weight: 0 },
  { rating: 6,  label: 'rate6',         action: 'include',      weight: 1 },
  { rating: 7,  label: 'good',          action: 'include',      weight: 2 },
  { rating: 8,  label: 'perfect',       action: 'include',      weight: 3 },
  { rating: 9,  label: 'master',        action: 'include',      weight: 3 },
  { rating: 10, label: 'buyer',         action: 'include',      weight: 3 },
]

/** Walkable — every label the table uses, for the i18n audit. */
export const RATING_LABELS = [...new Set(RATING_RULES.map((r) => r.label))] as const

/**
 * The rule for a rating, or null when there is no rating.
 *
 * Null for unrated is the point: an unrated lead must not fall into any
 * audience by default. Nobody has judged it, so nothing is claimed.
 */
export function ruleForRating(rating: number | null | undefined): RatingRule | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null
  const r = Math.round(rating)
  return RATING_RULES.find((x) => x.rating === r) ?? null
}

export const ratingAction = (rating: number | null | undefined): RatingAction | null =>
  ruleForRating(rating)?.action ?? null

/** The Meta value-column weight for a lead, or 0 when it seeds nothing. */
export const ratingWeight = (rating: number | null | undefined): number =>
  ruleForRating(rating)?.weight ?? 0

export const ratingExcludes = (rating: number | null | undefined): boolean =>
  ratingAction(rating) === 'exclude'

export const ratingSeeds = (rating: number | null | undefined): boolean =>
  ratingAction(rating) === 'include'

/**
 * Ratings that are a job for the team rather than an input to the buying.
 *
 * Surfaced as its own question because "who has been rated 4 or 5" is a call
 * list — these are people somebody looked at and could not place, and the next
 * step is a phone call, not a budget change.
 */
export const ratingNeedsCrmWork = (rating: number | null | undefined): boolean =>
  ratingAction(rating) === 'crmExecution'
