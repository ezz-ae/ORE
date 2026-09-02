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
import { VALUABLE_RATING, AVOID_RATING, PERFECT_RATING, DEAL_RATING } from '@/lib/freehold/lead-stages'
import { ratingExcludes, ratingSeeds, ratingWeight, ruleForRating } from '@/lib/freehold/rating-actions'

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

/**
 * WHAT PUT A PERSON IN A COHORT — named, walkable, countable.
 *
 * `reason` below is prose for a human reading one row. These are the same
 * facts as data, because the loop screen has to say "31 in the seed: 4 closed,
 * 15 qualified, 12 rated well" and a screen that reaches that by parsing an
 * English sentence breaks the first time the sentence is reworded — and breaks
 * silently, into plausible numbers.
 */
export const SEED_SIGNALS = ['closed', 'qualified', 'engaged', 'rated_perfect', 'rated_well', 'read_deeply'] as const
export type SeedSignal = (typeof SEED_SIGNALS)[number]

export const AVOID_SIGNALS = ['blocked', 'unreachable', 'rated_junk'] as const
export type AvoidSignal = (typeof AVOID_SIGNALS)[number]

export type LeadSignal = SeedSignal | AvoidSignal

/**
 * A landing session at or above this was a real read, not a bounce — scroll
 * plus dwell plus opening something, in behaviour-score.ts's fixed weights.
 *
 * It is a LABEL, never a qualification: behaviour contributes at most ±5 to
 * quality, so no amount of thorough reading can lift a lead over the seed
 * floor of 40 on its own. That is deliberate — a seed built on reading depth
 * is a lookalike of people who read, and reading is not what is being bought.
 */
export const DEEP_READ_SCORE = 60

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
  /** The same facts as data, for counting. A disqualified lead carries ONLY
   *  its avoid signals — a blocked person who once qualified is not "qualified
   *  and blocked", they are blocked, and counting them on both sides would
   *  make the seed look bigger than it is. */
  signals: LeadSignal[]
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
  const signals: LeadSignal[] = []

  // The strongest QUALIFICATION evidence sets the base. Everything else
  // adjusts around it, so the ordering closed > qualified > engaged survives
  // whatever the supporting signals say.
  //
  // A rating of VALUABLE_RATING or better sits on the qualified rung, not
  // below it. That is not generosity toward opinions — lead-stages.ts already
  // sends Meta a QualifiedLead event on such a rating, for the stated reason
  // that brokers rate long before they move a card. A seed that scored the
  // same lead below the qualified floor would have this system telling Meta
  // "qualified" and its own lookalike "not qualified enough to copy" about one
  // person on one day. It still loses to a bad outcome: a lead rated 9 who was
  // later blocked scores zero.
  //
  // A DEAL_RATING is different in kind from a high rating. On this team a ten
  // means "this one became a deal" — a claim about an outcome, not a stronger
  // opinion — so it sits on the closed rung. See the scale in lead-stages.ts,
  // including why the same tap does NOT send Meta a Purchase event.
  const rating = typeof l.valueRating === 'number' ? l.valueRating : null
  const calledADeal = rating !== null && rating >= DEAL_RATING
  const ratedWell = rating !== null && rating >= VALUABLE_RATING

  if (WON.has(s)) { quality += 70; why.push('closed'); signals.push('closed') }
  else if (calledADeal) { quality += 70; why.push('called a deal by the broker') }
  else if (QUALIFIED.has(s)) { quality += 40; why.push('qualified'); signals.push('qualified') }
  else if (ratedWell) { quality += 40; why.push('judged worth having') }
  else if (s && s !== 'new') { quality += 10; why.push('engaged'); signals.push('engaged') }

  if (rating !== null) {
    // −15 … +15, centred on 5.
    quality += ((rating - 5) / 5) * 15
    why.push(`rated ${rating}/10`)
    // The rating signals stay ratings on the makeup line even at ten. A tap is
    // never reported to anybody as a sale — 'closed' is what the deal record
    // says, and nothing else may print it.
    if (rating >= PERFECT_RATING) signals.push('rated_perfect')
    else if (rating >= VALUABLE_RATING) signals.push('rated_well')
    else if (rating <= AVOID_RATING) signals.push('rated_junk')
  }
  if (typeof l.behaviourScore === 'number') {
    // −5 … +5. Deliberately small: how long someone read a page is the
    // weakest of the three signals and must never carry a seed.
    quality += ((l.behaviourScore - 50) / 50) * 5
    if (l.behaviourScore >= DEEP_READ_SCORE) signals.push('read_deeply')
  }

  // Disqualifiers. A blocked or unreachable person in a seed teaches Meta to
  // find more people like them, which is the opposite of the point. The
  // signal list is CLEARED alongside the score: a blocked lead who once
  // qualified is blocked, and leaving 'qualified' on the row would let it be
  // counted into the seed's makeup while sitting in the exclusion.
  if (l.blocked) { quality = 0; why.length = 0; why.push('blocked'); signals.length = 0; signals.push('blocked') }
  else if (LOST.has(s) && badPhone(l.phone)) {
    quality = 0; why.length = 0; why.push('lost with an unusable phone')
    signals.length = 0; signals.push('unreachable')
  }

  quality = Math.max(0, Math.min(100, Math.round(quality)))

  // Weight: a real deal value when there is one, else quality scaled into a
  // comparable range so the two never sit on wildly different scales in the
  // same upload.
  // Weight: a real deal value when there is one — the only number honest
  // enough to rank buyers by dirhams closed.
  //
  // Otherwise the OPERATOR'S OWN TABLE, scaled: a 10 pulls the lookalike three
  // times as hard as a 6, which is what "+1 +2 +3" asks for. That beats
  // scaling by our computed quality, because the weight is the one place the
  // team's judgment should speak directly rather than through a formula.
  // Unrated leads fall back to quality so a seed built before anybody rated
  // anything still ranks sensibly.
  const tableWeight = ratingWeight(l.valueRating)
  const weight = l.dealValueAed && l.dealValueAed > 0
    ? Math.round(l.dealValueAed)
    : tableWeight > 0
      ? tableWeight * 1000
      : Math.max(1, Math.round(quality * 100))

  return { ...l, quality, weight, reason: why.join(', ') || 'no signal yet', signals }
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
    // ── THE RATING DECIDES, WITHOUT WAITING FOR ANYBODY ──────────────────
    //
    // "this is the rate every number and action — we need this to feed the
    //  audience not to wait for manual execution."
    //
    // The operator's table (rating-actions.ts) is the authority for a lead
    // that has been rated: 0–3 exclude, 4–5 are a job for the team and feed
    // NEITHER audience, 6+ seed with a weight. Everything below still applies
    // to leads nobody has judged, which is most of them.
    const provenBad = !!l.blocked || (LOST.has(s) && badPhone(l.phone)) || ratingExcludes(l.valueRating)
    if (provenBad) { exclude.push(l); continue }

    // 4 and 5 forecast nothing — points.ts pays nothing for a rating there for
    // the same reason. Seeding from them hands Meta a cohort defined by our
    // own uncertainty; excluding them throws away people who were simply never
    // worked. They are a phone call, not a targeting input.
    if (ruleForRating(l.valueRating)?.action === 'crmExecution') { neutral.push(l); continue }

    // A person with no email and no dialable phone cannot be matched by Meta;
    // including them would only dilute the seed's match rate.
    if (contactable(l) && (ratingSeeds(l.valueRating) || l.quality >= minQuality)) { seed.push(l); continue }
    neutral.push(l)
  }

  seed.sort((a, b) => b.quality - a.quality || b.weight - a.weight)
  return { seed, exclude, neutral }
}

export interface CohortEvidence {
  /** How many people in the seed carry each signal. Sums exceed the cohort
   *  size on purpose — one person is commonly closed AND rated well, and
   *  hiding that would be hiding agreement between two independent signals. */
  seed: Record<SeedSignal, number>
  avoid: Record<AvoidSignal, number>
  /** People in the seed that NO rating found — closed and qualified leads
   *  nobody got round to judging. The number that answers "is the seed just
   *  our ratings in a different shape", and the reason this loop reads the
   *  funnel rather than the rating column alone. */
  seedBeyondRatings: number
}

/**
 * WHAT ACTUALLY FED THESE COHORTS.
 *
 * The loop screen's job is to prove a rating did something. It cannot do that
 * with a cohort size alone — "31 people" is compatible with the seed being
 * built from nothing but a stale query. The makeup is the proof, and it is
 * also the honest correction when the ratings turn out to be the smaller half
 * of the evidence.
 */
export function cohortEvidence(c: Cohorts): CohortEvidence {
  const seed = Object.fromEntries(SEED_SIGNALS.map((k) => [k, 0])) as Record<SeedSignal, number>
  const avoid = Object.fromEntries(AVOID_SIGNALS.map((k) => [k, 0])) as Record<AvoidSignal, number>

  let seedBeyondRatings = 0
  for (const l of c.seed) {
    for (const sig of l.signals) if (sig in seed) seed[sig as SeedSignal]++
    if (!l.signals.includes('rated_well') && !l.signals.includes('rated_perfect')) seedBeyondRatings++
  }
  for (const l of c.exclude) {
    for (const sig of l.signals) if (sig in avoid) avoid[sig as AvoidSignal]++
  }
  return { seed, avoid, seedBeyondRatings }
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
