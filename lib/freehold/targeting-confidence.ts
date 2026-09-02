/**
 * HOW SURE ARE WE THAT THIS TARGETING WORKS — one answer, honestly bounded.
 *
 * This product judges targeting in five places and each one is sound:
 *
 *   audience-fit       can this be bought at this budget?      wrong/watch/ok
 *   audience-weight    which audience produced buyers?         better/worse/…
 *   local-audiences    is the reach right for the money?       good/tooWide/…
 *   placement-audit    where did the money actually go?        drain/strong/…
 *   audience-outcomes  what each audience returned             raw counts
 *
 * Nothing composed them. No caller in the product used more than one, so an
 * operator got five verdicts on five screens and no answer to the only
 * question they were ever asking: should I run this, and how sure are we?
 *
 * ── THE FAILURE THAT MADE THIS NECESSARY ─────────────────────────────────
 *
 * A brand-new setup returns `unknown` from weight, `undecided` from placement,
 * `unknown` from reach, and `ok` from fit — because fit only speaks when it can
 * compute. Nothing is flagged anywhere.
 *
 * Which is indistinguishable, on screen, from a setup proven over months.
 * SILENCE AND PROOF LOOK THE SAME, and the silence is louder because it is
 * everywhere. Every "no issues found" this product has ever shown about a new
 * audience was that.
 *
 * So confidence is stated as its own value, and `none` is a real answer.
 *
 * ── A CHAIN IS ITS WEAKEST LINK, NEVER ITS AVERAGE ───────────────────────
 *
 * The tempting composition is a score: average the five, weight them, print a
 * number. It is wrong here, and expensively so. Four strong signals and one
 * unknown averages to "quite confident" — but the unknown is the one that
 * decides, and the average has buried it.
 *
 * So the composite takes the MINIMUM. Confidence is capped by the least
 * evidenced input that matters, and the module names that input rather than
 * hiding it inside a total.
 *
 * ── AND A BROKEN SETUP NEEDS NO EVIDENCE TO BE BROKEN ────────────────────
 *
 * Some faults are structural: an ad set that cannot reach Meta's learning
 * threshold at this budget will not work, and no amount of running it will
 * make that untrue. Those BLOCK regardless of confidence — you do not need a
 * sample to know a budget divided six ways cannot learn.
 *
 * The inverse is the rule this module exists to enforce: a setup with no
 * blocking fault is not therefore proven. It is unproven, which is a
 * different sentence and a different decision.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

/** Walkable — how much the composite is standing on. */
export const CONFIDENCE_LEVELS = ['none', 'low', 'medium', 'high'] as const
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

/** Walkable — what to actually do. */
export const TARGETING_VERDICTS = ['run', 'watch', 'fix', 'notYet'] as const
export type TargetingVerdict = (typeof TARGETING_VERDICTS)[number]

/** Walkable — the checks the composite reads. Each is an existing module. */
export const CONFIDENCE_SIGNALS = ['fit', 'reach', 'audience', 'placement', 'quality'] as const
export type ConfidenceSignalId = (typeof CONFIDENCE_SIGNALS)[number]

/**
 * One check's contribution.
 *
 * `events` is what the reading rests on — qualified leads, results, decided
 * placements. It is the only thing that can raise confidence, and a signal
 * that says `good` on two events is not evidence, it is a coincidence with an
 * opinion.
 */
export interface ConfidenceSignal {
  id: ConfidenceSignalId
  reading: 'good' | 'bad' | 'unknown'
  /** Observations behind the reading. Zero means it is guessing.  */
  events: number
  /**
   * A fault so structural that no sample could excuse it — a budget that
   * cannot reach the learning threshold, a reach of nobody. Blocks whatever
   * the confidence is.
   */
  blocking?: boolean
}

/**
 * Events a single signal needs before it may claim anything.
 *
 * Five, matching MIN_FIELD_EVENTS in audience-weight and
 * MIN_ATTRIBUTED_FOR_QUALITY in min-evidence. One threshold across the
 * product, so a signal is never "decided" on one screen and "too early" on
 * another.
 */
export const MIN_EVENTS_TO_SPEAK = 5

/** Events before a signal counts as well established rather than indicative. */
export const EVENTS_FOR_HIGH = 25

/** What one signal's evidence supports on its own. */
export function levelOf(events: number): ConfidenceLevel {
  if (!Number.isFinite(events) || events <= 0) return 'none'
  if (events < MIN_EVENTS_TO_SPEAK) return 'low'
  if (events < EVENTS_FOR_HIGH) return 'medium'
  return 'high'
}

const RANK: Record<ConfidenceLevel, number> = { none: 0, low: 1, medium: 2, high: 3 }

export interface TargetingConfidence {
  level: ConfidenceLevel
  verdict: TargetingVerdict
  /**
   * The one signal holding the answer back — the least-evidenced one that
   * matters, or the blocking fault when there is one. Null only when every
   * signal is both good and well evidenced.
   */
  weakest: ConfidenceSignalId | null
  /**
   * How many more observations the weakest signal needs before the composite
   * could move up a level. Null when more evidence is not what is missing —
   * a blocking fault is fixed, not waited out.
   */
  needsMoreEvents: number | null
  /** Every signal, so a screen can show the working rather than a verdict. */
  signals: ConfidenceSignal[]
}

/**
 * Compose one answer from the checks.
 *
 * Order of decisions, and each one is deliberate:
 *
 *   1. A BLOCKING fault ⇒ `fix`, whatever the evidence says. A structural
 *      fault is not a probabilistic claim.
 *   2. NO SIGNAL WITH EVIDENCE ⇒ `notYet` at level `none`. This is the case
 *      the module exists for: nothing is wrong AND nothing is known, and the
 *      two must never render the same.
 *   3. Any signal reading `bad` on real evidence ⇒ `fix`.
 *   4. Otherwise the level is the MINIMUM across signals that matter, and the
 *      verdict follows it: `run` only at medium or better, `watch` below.
 */
export function targetingConfidence(
  signals: readonly ConfidenceSignal[],
): TargetingConfidence {
  const all = signals.filter((s) => (CONFIDENCE_SIGNALS as readonly string[]).includes(s.id))

  // 1 ── Structural faults first.
  const blocked = all.find((s) => s.blocking && s.reading === 'bad')
  if (blocked) {
    return {
      level: levelOf(blocked.events),
      verdict: 'fix',
      weakest: blocked.id,
      // Waiting does not fix a budget that cannot learn.
      needsMoreEvents: null,
      signals: all,
    }
  }

  // 2 ── Nothing known is not the same as nothing wrong.
  const withEvidence = all.filter((s) => s.events >= MIN_EVENTS_TO_SPEAK && s.reading !== 'unknown')
  if (withEvidence.length === 0) {
    // The signal closest to speaking is the one to chase.
    const closest = [...all].sort((a, b) => b.events - a.events)[0] ?? null
    return {
      level: 'none',
      verdict: 'notYet',
      weakest: closest?.id ?? null,
      needsMoreEvents: closest ? Math.max(1, MIN_EVENTS_TO_SPEAK - closest.events) : null,
      signals: all,
    }
  }

  // 3 ── A proven fault outranks the rest.
  const bad = withEvidence.find((s) => s.reading === 'bad')
  if (bad) {
    return { level: levelOf(bad.events), verdict: 'fix', weakest: bad.id, needsMoreEvents: null, signals: all }
  }

  // 4 ── The weakest link sets the level. An `unknown` signal counts at its own
  //      evidence, which is usually none — that is the point: it caps the
  //      composite instead of being averaged away.
  const weakest = [...all].sort((a, b) => {
    const d = RANK[levelOf(a.events)] - RANK[levelOf(b.events)]
    return d !== 0 ? d : a.events - b.events
  })[0]
  const level = weakest ? levelOf(weakest.events) : 'none'

  return {
    level,
    verdict: RANK[level] >= RANK.medium ? 'run' : 'watch',
    weakest: level === 'high' ? null : weakest?.id ?? null,
    needsMoreEvents: level === 'high' || !weakest
      ? null
      : Math.max(1, (RANK[level] < RANK.medium ? MIN_EVENTS_TO_SPEAK : EVENTS_FOR_HIGH) - weakest.events),
    signals: all,
  }
}

/**
 * Turn an audience-fit finding list into the fit signal.
 *
 * A `wrong` finding blocks: those are the structural ones — a budget that
 * cannot reach the learning threshold, an audience too small to spend against.
 * `watch` is a real reading but not a blocking one.
 *
 * Fit is judged from the SETUP rather than from results, so its evidence is
 * the days it has run: a fit verdict on day one is arithmetic about a budget,
 * which is worth stating and not worth being confident about.
 */
export function fitSignal(
  findings: ReadonlyArray<{ level: 'wrong' | 'watch' | 'ok' }>,
  daysLive: number,
): ConfidenceSignal {
  const wrong = findings.some((f) => f.level === 'wrong')
  const watch = findings.some((f) => f.level === 'watch')
  return {
    id: 'fit',
    reading: wrong || watch ? 'bad' : 'good',
    events: Math.max(0, Math.round(daysLive)),
    blocking: wrong,
  }
}
