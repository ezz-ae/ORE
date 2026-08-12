/**
 * WHAT A RATING ACTUALLY DOES — the loop, stated so it can be checked.
 *
 * Brokers have started rating leads. A rating that changes nothing is worse
 * than no rating: it costs somebody ten seconds a lead and buys a number in a
 * column. So this module states the whole path from a broker's tap to Meta
 * finding a better person, and — the part that matters — states honestly at
 * which step it currently stops.
 *
 * THE FOUR STEPS.
 *
 *   1. RATED      a person judged this lead 0–10.
 *   2. TOLD       a lead that earned it — rated >= VALUABLE_RATING, or moved
 *                 to qualified or deeper, or closed — sends Meta an event,
 *                 once, deduplicated by a deterministic id (lead-writeback).
 *   3. SEEDED     the people the funnel PROVES were worth having become a
 *                 weighted custom audience, and that audience becomes a
 *                 value-based LOOKALIKE — the only mechanism by which "find
 *                 me more people like this" reaches Meta's delivery.
 *   4. TARGETED   the lookalike is attached to a campaign, and the proven-bad
 *                 leads are attached as an EXCLUSION.
 *
 * STEP 3 IS NOT THE RATING COLUMN. It is splitCohorts() in seed-cohort.ts,
 * over loadLeadEvidence() — status, deal value, blocked, phone, behaviour and
 * rating together. It shipped reading `value_rating` alone, which meant a lead
 * who BOUGHT and whom nobody rated was in no audience at all, and a lead rated
 * 9 who was later blocked stayed in the seed. Outcomes outrank opinions; the
 * weight says by how much.
 *
 * THE HALF THAT WAS MISSING, and why it is not symmetrical.
 *
 * A lead rated 0–2 sent NOTHING. Meta learned which leads were good and never
 * which were junk, so the optimiser kept its own opinion of who to find. There
 * is no "bad lead" event in the Conversions API — Meta has no negative signal
 * to receive, and inventing one by sending a Purchase with value 0 would teach
 * it that this person converted. THE ONLY HONEST NEGATIVE LEVER IS EXCLUSION:
 * put the junk in an audience and stop showing ads to it or anyone Meta thinks
 * resembles it. That is why step 3 has two outputs and step 2 has one.
 *
 * EVERY GATE IS AN EVIDENCE GATE. A lookalike built from eleven people is not
 * a lookalike; Meta needs a real seed and quietly produces a broad, useless
 * audience below it. So the loop reports "12 of 100" rather than "working",
 * and a step that cannot honestly be called done is called waiting.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import { VALUABLE_RATING, AVOID_RATING } from '@/lib/freehold/lead-stages'

/** A rating at or below this is "stop buying this" — the same band the CRM
 *  chip, the campaign-quality score and the row control already use. Defined
 *  next to VALUABLE_RATING in lead-stages; re-exported here because this is
 *  where callers reading about the loop expect to find it. */
export { AVOID_RATING }

/**
 * Meta's own working floor for a value-based lookalike source.
 *
 * Below roughly a hundred MATCHED people a lookalike is not a lookalike: Meta
 * accepts the audience and produces something so broad it is indistinguishable
 * from open targeting, which is the worst outcome — it looks like a precise
 * audience and behaves like none.
 */
export const LOOKALIKE_MIN_SEED = 100

/**
 * A suppression list is useful far earlier than a lookalike — excluding twenty
 * known-bad people is twenty people's worth of budget saved, and there is no
 * modelling involved to be degraded by a small sample.
 */
export const SUPPRESSION_MIN_SEED = 20

/** The steps, walkable — each renders its own sentence. */
export const LOOP_STEPS = ['rated', 'told', 'seeded', 'targeted'] as const
export type LoopStepId = (typeof LOOP_STEPS)[number]

/** Walkable — the state of one step. */
export const LOOP_STATES = ['done', 'waiting', 'blocked', 'idle'] as const
export type LoopState = (typeof LOOP_STATES)[number]

export interface LoopStep {
  id: LoopStepId
  state: LoopState
  /** The numbers the state stands on. Never a claim without them. */
  vars: Record<string, number>
  /** What the operator can press, when anything. */
  action: 'rate' | 'sync' | 'attach' | 'none'
}

export interface RatingLoopFacts {
  /** Leads that exist at all — the denominator. */
  total: number
  /** Leads a person has judged. */
  rated: number
  /** Of those, rated >= VALUABLE_RATING. */
  valuable: number
  /** Of those, rated <= AVOID_RATING. */
  avoid: number
  /**
   * Leads that EARNED an event by any route — rated well, or moved to
   * qualified or deeper in the CRM, or closed.
   *
   * This is the denominator, and it is not the rating count. A lead that
   * reached "negotiation" earned an event whether or not anybody got round to
   * rating it, and measuring the send against the rating column alone reported
   * "all sent" while closed buyers had never been mentioned to Meta.
   */
  earned: number
  /**
   * QualifiedLead / Purchase events actually sent (meta_reported_stages), not
   * events we believe should have been sent. The difference between those two
   * is the whole reason this module exists.
   */
  sent: number
  /**
   * People splitCohorts() puts in the seed — the funnel's judgment, not the
   * rating column's. Closed and qualified leads are in here whether or not
   * anyone rated them; a lead rated 9 who was later blocked is not.
   */
  seedRows: number
  /**
   * Of those, how many no rating found. The honest answer to "is this seed
   * just our ratings in a different shape" — and usually the larger half.
   */
  seedBeyondRatings: number
  /** People proven not worth buying: blocked, unreachable, or rated junk. */
  excludeRows: number
  /**
   * People MATCHED in the value seed audience, as Meta reported it — never the
   * number uploaded. Uploading a hundred contacts commonly matches sixty, and
   * a loop that reports the upload is reporting its own intention.
   */
  seedMatched: number | null
  /** True once a lookalike has actually been created from that seed. */
  lookalikeExists: boolean
  /** Matched people in the exclusion audience, as Meta reported it. */
  suppressionMatched: number | null
  /** The lookalike and/or exclusion are attached to at least one live campaign. */
  attached: boolean
  /** Meta is connected at all. Without it, nothing past step 1 can happen and
   *  the screen says that rather than showing three stalled steps. */
  metaConnected: boolean
}

export function loopStepsFor(f: RatingLoopFacts): LoopStep[] {
  const steps: LoopStep[] = []

  // ── 1. RATED ─────────────────────────────────────────────────────────────
  // The only step a person drives. Done once anybody has judged anything —
  // this is not a completeness target, because rating every one of 571 leads
  // is not the goal and demanding it would make the step permanently red.
  steps.push({
    id: 'rated',
    state: f.rated > 0 ? 'done' : 'idle',
    vars: { rated: f.rated, total: f.total, valuable: f.valuable, avoid: f.avoid },
    action: f.rated === 0 ? 'rate' : 'none',
  })

  // Nothing past here is possible without Meta, and three stalled steps with
  // no reason is a screen that looks broken rather than one that explains.
  if (!f.metaConnected) {
    for (const id of ['told', 'seeded', 'targeted'] as LoopStepId[]) {
      steps.push({ id, state: 'blocked', vars: {}, action: 'none' })
    }
    return steps
  }

  // ── 2. TOLD ──────────────────────────────────────────────────────────────
  // Sent events versus leads that EARNED one — by rating, by CRM stage, or by
  // closing. A shortfall is real and worth seeing: it means a write-back
  // failed, or a lead has no email and no phone for Meta to match on.
  steps.push({
    id: 'told',
    state: f.earned === 0 ? 'idle' : f.sent >= f.earned ? 'done' : 'waiting',
    vars: { sent: f.sent, earned: f.earned, valuable: f.valuable },
    action: 'none',   // automatic — it fires on the rating and status writes
  })

  // ── 3. SEEDED ────────────────────────────────────────────────────────────
  // The step that was missing. MATCHED people, not uploaded ones, and against
  // Meta's real floor — a lookalike from a dozen people is a broad audience
  // wearing a precise name.
  //
  // Note what gates this step now: the SEED, not the rating count. An account
  // whose brokers never rated anything but which closed forty deals has a real
  // seed, and gating on ratings told it to go and rate something first.
  const matched = f.seedMatched ?? 0
  const canBuild = f.seedRows > 0 || f.excludeRows >= SUPPRESSION_MIN_SEED
  steps.push({
    id: 'seeded',
    state: !canBuild ? 'idle'
      : f.lookalikeExists && matched >= LOOKALIKE_MIN_SEED ? 'done'
      : 'waiting',
    vars: { matched, need: LOOKALIKE_MIN_SEED, valuable: f.valuable, avoid: f.avoid,
            seedRows: f.seedRows, beyond: f.seedBeyondRatings, excludeRows: f.excludeRows,
            suppression: f.suppressionMatched ?? 0, suppressionNeed: SUPPRESSION_MIN_SEED },
    // Sync is worth pressing whenever there is evidence not yet in an
    // audience — including when only the avoid list can be built, because
    // exclusion pays off long before a lookalike does.
    action: canBuild ? 'sync' : 'none',
  })

  // ── 4. TARGETED ──────────────────────────────────────────────────────────
  // An audience nothing points at changes no delivery. This is the step where
  // a "working" loop is most often actually idle.
  const haveSomething = (f.lookalikeExists && matched >= LOOKALIKE_MIN_SEED)
    || (f.suppressionMatched ?? 0) >= SUPPRESSION_MIN_SEED
  steps.push({
    id: 'targeted',
    state: !haveSomething ? 'idle' : f.attached ? 'done' : 'waiting',
    vars: { matched, suppression: f.suppressionMatched ?? 0 },
    action: haveSomething && !f.attached ? 'attach' : 'none',
  })

  return steps
}

/**
 * The one sentence the whole loop reduces to — the honest answer to "is my
 * rating doing anything".
 *
 * Deliberately the FIRST step that is not done, rather than a percentage: a
 * loop is only as closed as its weakest link, and "60% complete" tells nobody
 * what to press.
 */
export function loopHeadline(steps: LoopStep[]): { id: LoopStepId; state: LoopState } {
  const stuck = steps.find((s) => s.state === 'blocked')
    ?? steps.find((s) => s.state === 'waiting')
    ?? steps.find((s) => s.state === 'idle')
  return stuck ? { id: stuck.id, state: stuck.state } : { id: 'targeted', state: 'done' }
}

/** Which leads belong in each audience. Stated here so the query and the
 *  screen cannot disagree about what "valuable" means. */
export const isValuableRating = (v: number | null | undefined): boolean =>
  typeof v === 'number' && v >= VALUABLE_RATING
export const isAvoidRating = (v: number | null | undefined): boolean =>
  typeof v === 'number' && v <= AVOID_RATING
