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
 *   2. TOLD       a lead rated >= VALUABLE_RATING sends Meta a QualifiedLead
 *                 event, once, deduplicated by a deterministic id
 *                 (lead-writeback). This half already worked.
 *   3. SEEDED     the rated-well leads become a custom audience, and that
 *                 audience becomes a value-based LOOKALIKE — which is the
 *                 only mechanism by which "find me more people like this"
 *                 actually reaches Meta's delivery.
 *   4. TARGETED   the lookalike is attached to a campaign, and the rated-badly
 *                 leads are attached as an EXCLUSION.
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
import { VALUABLE_RATING } from '@/lib/freehold/lead-stages'

/** A rating at or below this is "stop buying this" — the same band the CRM
 *  chip, the campaign-quality score and the row control already use. */
export const AVOID_RATING = 2

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
   * QualifiedLead events actually sent (meta_reported_stages), not events we
   * believe should have been sent. The difference between those two is the
   * whole reason this module exists.
   */
  sent: number
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
  // Sent events versus leads that earned one. A shortfall is real and worth
  // seeing: it means a write-back failed, or a lead has no email and no phone
  // for Meta to match on.
  steps.push({
    id: 'told',
    state: f.valuable === 0 ? 'idle' : f.sent >= f.valuable ? 'done' : 'waiting',
    vars: { sent: f.sent, valuable: f.valuable },
    action: 'none',   // automatic — it fires on the rating write itself
  })

  // ── 3. SEEDED ────────────────────────────────────────────────────────────
  // The step that was missing. MATCHED people, not uploaded ones, and against
  // Meta's real floor — a lookalike from a dozen people is a broad audience
  // wearing a precise name.
  const matched = f.seedMatched ?? 0
  steps.push({
    id: 'seeded',
    state: f.valuable === 0 ? 'idle'
      : f.lookalikeExists && matched >= LOOKALIKE_MIN_SEED ? 'done'
      : 'waiting',
    vars: { matched, need: LOOKALIKE_MIN_SEED, valuable: f.valuable, avoid: f.avoid,
            suppression: f.suppressionMatched ?? 0, suppressionNeed: SUPPRESSION_MIN_SEED },
    // Sync is worth pressing whenever there are ratings not yet in an
    // audience — including when only the avoid list can be built, because
    // exclusion pays off long before a lookalike does.
    action: (f.valuable > 0 || f.avoid >= SUPPRESSION_MIN_SEED) ? 'sync' : 'none',
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
