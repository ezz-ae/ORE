/**
 * SEED COHORT — who goes into a lookalike, and how much each one counts.
 *
 * A lookalike is only as good as its seed, and seed quality is dominated by
 * PURITY, not size. Past roughly a thousand rows the marginal value of another
 * row is small; what dominates is who is in the list. A seed of 5,000 "all
 * leads" and a seed of 400 "leads that actually closed" produce completely
 * different audiences, and the smaller one is usually better. That is the
 * whole thesis here: go deeper on the data, not wider.
 *
 * Three mechanisms, all of which work without a single extra lead:
 *
 *  1. REFINEMENT. Seed from the cohort the funnel proves converts, not from
 *     everyone who ever filled a form.
 *  2. WEIGHTING. Meta accepts a value column and weights similarity by it
 *     (value-based lookalikes). A closed AED 4m buyer should not count the
 *     same as a lead who merely answered the phone — and with a weight, it
 *     does not have to.
 *  3. EXCLUSION. The leads we know are bad are as informative as the good
 *     ones. Meta has no negative lookalike, but a custom audience of proven-bad
 *     people can be excluded from delivery, which sharpens the buy immediately.
 *
 * WHAT THIS CANNOT DO. It cannot conjure a seed out of a small funnel. Meta
 * needs about 100 matched people in one country to build a lookalike at all,
 * and wants far more before the result is worth trusting. An account with 26
 * leads has no lookalike available to it at any level of cleverness, and
 * `seedReadiness` says so rather than building something that will quietly
 * underperform.
 *
 * Pure — no I/O, no clock.
 */

/** A lead as this module needs to see it. */
export interface SeedLead {
  id: string
  email: string | null
  phone: string | null
  /** CRM status. */
  status: string | null
  blocked?: boolean | null
  /** Broker's 0–10 judgment, when someone made one. */
  valueRating?: number | null
  /** Landing-session behaviour score 0–100, when scored. */
  behaviourScore?: number | null
  /** Deal value in AED for a lead that closed. The strongest weight there is —
   *  a real number attached to a real outcome. */
  dealValueAed?: number | null
}

/** Meta's hard floor: fewer matched people than this and no lookalike is
 *  created at all. Matching loses rows, so the list has to be bigger. */
export const META_MIN_MATCHED = 100
/** Below this the lookalike exists but is built on so little that it is closer
 *  to broad targeting than to a similarity model. Meta's own guidance. */
export const SEED_QUALITY_FLOOR = 1000
/** Typical match rate for hashed email+phone lists in this market. Used only to
 *  turn a raw row count into an HONEST expectation, never to inflate one. */
export const ASSUMED_MATCH_RATE = 0.5

const WON = new Set(['converted', 'closed'])
const QUALIFIED = new Set(['qualified', 'viewing', 'negotiation'])
const LOST = new Set(['lost'])

/** An unusable phone — the same rule the CRM's duplicate view uses. */
const badPhone = (p: string | null | undefined) => !p || p.replace(/\D/g, '').length < 7

export interface ScoredLead extends SeedLead {
  /** 0–100. Not a probability — an ordering, used to pick the cohort and to
   *  weight it. Named `quality` rather than `score` so it is never confused
   *  with the campaign quality score, which measures something else. */
  quality: number
  /** The value handed to Meta for value-based lookalikes. Deal value when we
   *  have one, otherwise a scaled quality. Always ≥ 1: Meta drops rows with a
   *  zero or negative value, and dropping a row silently is worse than
   *  weighting it lightly. */
  weight: number
  /** Why this lead scored what it did, so a seed can be argued with. */
  reason: string
}

/**
 * Score a lead for seed membership.
 *
 * Outcome dominates, because outcome is the thing being predicted. The broker's
 * rating and the landing behaviour are supporting evidence — real signal, but
 * they are opinions and session traces, not deals, and a seed built mostly on
 * them would be a lookalike of people who browsed thoroughly.
 */
export function scoreLead(l: SeedLead): ScoredLead {
  const s = (l.status ?? '').toLowerCase()
  let quality = 0
  const why: string[] = []

  if (WON.has(s)) { quality += 70; why.push('closed') }
  else if (QUALIFIED.has(s)) { quality += 40; why.push('qualified') }
  else if (s && s !== 'new') { quality += 10; why.push('engaged') }

  if (typeof l.valueRating === 'number') {
    // −15 … +15, centred on 5.
    quality += ((l.valueRating - 5) / 5) * 15
    why.push(`rated ${l.valueRating}/10`)
  }
  if (typeof l.behaviourScore === 'number') {
    // −5 … +5. Deliberately small: how long someone read a page is the
    // weakest of the three signals and must never carry a seed.
    quality += ((l.behaviourScore - 50) / 50) * 5
  }

  // Disqualifiers. A blocked or unreachable person in a seed teaches Meta to
  // find more people like them, which is the opposite of the point.
  if (l.blocked) { quality = 0; why.length = 0; why.push('blocked') }
  else if (LOST.has(s) && badPhone(l.phone)) { quality = 0; why.length = 0; why.push('lost with an unusable phone') }

  quality = Math.max(0, Math.min(100, Math.round(quality)))

  // Weight: a real deal value when there is one, else quality scaled into a
  // comparable range so the two never sit on wildly different scales in the
  // same upload.
  const weight = l.dealValueAed && l.dealValueAed > 0
    ? Math.round(l.dealValueAed)
    : Math.max(1, Math.round(quality * 100))

  return { ...l, quality, weight, reason: why.join(', ') || 'no signal yet' }
}

export interface Cohorts {
  /** The people to seed FROM, best first. */
  seed: ScoredLead[]
  /** The people to EXCLUDE from delivery — proven bad, not merely unproven. */
  exclude: ScoredLead[]
  /** Everyone else: not good enough to seed, not bad enough to exclude. */
  neutral: ScoredLead[]
}

/**
 * Split the funnel into seed, exclusion and neutral.
 *
 * `minQuality` is where the seed starts. The default admits closed buyers and
 * qualified leads, and keeps out anyone who only ever answered the phone —
 * because a seed that includes merely-engaged people is a lookalike of people
 * who engage, and engagement is not the thing being bought.
 *
 * Exclusion is deliberately narrow: PROVEN bad, never merely unproven. A new
 * lead that has not gone anywhere yet is not a bad lead, and excluding it
 * would teach the account to avoid its own future customers.
 */
export function splitCohorts(leads: SeedLead[], minQuality = 40): Cohorts {
  const scored = leads.map(scoreLead)
  const contactable = (l: ScoredLead) => !!(l.email || (l.phone && !badPhone(l.phone)))

  const seed: ScoredLead[] = []
  const exclude: ScoredLead[] = []
  const neutral: ScoredLead[] = []

  for (const l of scored) {
    const s = (l.status ?? '').toLowerCase()
    const provenBad = !!l.blocked || (LOST.has(s) && badPhone(l.phone)) || (typeof l.valueRating === 'number' && l.valueRating <= 2)
    if (provenBad) { exclude.push(l); continue }
    // A person with no email and no dialable phone cannot be matched by Meta;
    // including them would only dilute the seed's match rate.
    if (l.quality >= minQuality && contactable(l)) { seed.push(l); continue }
    neutral.push(l)
  }

  seed.sort((a, b) => b.quality - a.quality || b.weight - a.weight)
  return { seed, exclude, neutral }
}

export type ReadinessLevel = 'none' | 'below_meta_minimum' | 'thin' | 'ready'

export interface SeedReadiness {
  rows: number
  /** Rows × assumed match rate — what Meta is likely to actually find. */
  expectedMatched: number
  level: ReadinessLevel
  /** How many more seed-grade leads are needed to reach the next level. */
  moreNeeded: number
  message: string
}

/**
 * Is this seed worth uploading?
 *
 * Answered in matched people, not rows, because rows are the number that
 * flatters and matched people are the number Meta actually uses. Saying "you
 * have 180 leads" when 90 will match — below Meta's floor — would be the same
 * class of comfortable-but-wrong report this system exists to refuse.
 */
export function seedReadiness(seedRows: number, matchRate = ASSUMED_MATCH_RATE): SeedReadiness {
  const expectedMatched = Math.floor(seedRows * matchRate)
  const rowsFor = (matched: number) => Math.ceil(matched / matchRate)

  if (seedRows === 0) {
    return {
      rows: 0, expectedMatched: 0, level: 'none', moreNeeded: rowsFor(META_MIN_MATCHED),
      message: `No lead has reached seed quality yet. A lookalike needs about ${META_MIN_MATCHED} matched people, which is roughly ${rowsFor(META_MIN_MATCHED)} qualified or closed leads.`,
    }
  }
  if (expectedMatched < META_MIN_MATCHED) {
    const need = rowsFor(META_MIN_MATCHED) - seedRows
    return {
      rows: seedRows, expectedMatched, level: 'below_meta_minimum', moreNeeded: need,
      message: `${seedRows} seed-grade leads, about ${expectedMatched} of whom Meta will match. Meta will not build a lookalike below ${META_MIN_MATCHED} matched people — roughly ${need} more are needed. Weighting and exclusion still work today; the lookalike does not.`,
    }
  }
  if (expectedMatched < SEED_QUALITY_FLOOR) {
    const need = rowsFor(SEED_QUALITY_FLOOR) - seedRows
    return {
      rows: seedRows, expectedMatched, level: 'thin', moreNeeded: need,
      message: `${seedRows} seed-grade leads, about ${expectedMatched} matched. Meta will build the lookalike, but below ${SEED_QUALITY_FLOOR} matched people it behaves closer to broad targeting than to a similarity model. About ${need} more would make it a real one.`,
    }
  }
  return {
    rows: seedRows, expectedMatched, level: 'ready', moreNeeded: 0,
    message: `${seedRows} seed-grade leads, about ${expectedMatched} matched — enough for a similarity model that means something.`,
  }
}

/** Contacts + weights, in the shape the Meta upload wants. Only rows Meta can
 *  actually match are emitted. */
export function seedUpload(seed: ScoredLead[]): Array<{ email: string | null; phone: string | null; value: number }> {
  return seed
    .filter((l) => l.email || (l.phone && !badPhone(l.phone)))
    .map((l) => ({ email: l.email, phone: l.phone, value: l.weight }))
}
