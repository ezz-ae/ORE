/**
 * A CREATIVE DIES SLOWLY AND EVERY NUMBER ON THE SCREEN IS AN AVERAGE.
 *
 * Cost per lead, click-through, cost per thousand — all of them are totals over
 * a window. A creative that worked brilliantly for two weeks and has produced
 * nothing since still reads as a good creative, because the fortnight that
 * worked is inside the same average as the fortnight that did not. By the time
 * the average moves enough to notice, the money is gone.
 *
 * The fix is not a lower threshold. It is measuring the SLOPE: what this
 * creative did early against what the same creative is doing now.
 *
 * ── AND THE PART EVERY DASHBOARD GETS WRONG ──────────────────────────────
 *
 * "Results fell, so the creative is tired" is the analysis everybody does, and
 * about half the time it is the wrong diagnosis with an expensive fix.
 *
 *   · Frequency ROSE and the lead rate FELL — the same people are seeing it
 *     more often and responding less. That is fatigue. The fix is a new
 *     picture.
 *   · Frequency FLAT and the lead rate FELL — new people are still arriving
 *     and they are converting worse. The creative is doing what it always did;
 *     the AUDIENCE changed, or the market did, or a competitor started bidding.
 *     A new picture fixes none of that, and making one costs a week.
 *
 * Two different problems that look identical in a cost-per-lead chart. Telling
 * them apart is the whole reason this module exists.
 *
 * ── HALVES BY EXPOSURE, NOT BY DAYS ──────────────────────────────────────
 *
 * Split fourteen days down the middle and a creative that got AED 50 in week
 * one and AED 5,000 in week two is compared against almost nothing. The halves
 * are cut where the IMPRESSIONS are, so both sides carry the same weight of
 * evidence and the test has something to work with.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import { samePace, SIGNIFICANT_P } from '@/lib/freehold/inventory-quality'

/** Walkable — each renders its own word and its own fix. */
export const DECAY_VERDICTS = ['fresh', 'fatigued', 'audienceMoved', 'tooEarly'] as const
export type DecayVerdict = (typeof DECAY_VERDICTS)[number]

/**
 * Impressions each half needs before a slope means anything.
 *
 * Ten thousand a side. A lead rate is a few results per ten thousand
 * impressions in this market, so below that a half carries one or two events
 * and the comparison is a coin flip wearing a chart. Deliberately lower than
 * the ladder's MIN_IMPRESSIONS_FOR_LADDER, which is answering a harder
 * question — whether a whole audience pool is exhausted — on one window rather
 * than comparing a creative against itself.
 */
export const MIN_IMPRESSIONS_PER_HALF = 10_000

/**
 * How much frequency must have RISEN for a decline to be called fatigue.
 *
 * A tenth of a view per person. Not zero: frequency drifts up slightly on any
 * ad set that keeps running, and a threshold of zero would call every decline
 * fatigue, which is exactly the failure this module is here to prevent. Not
 * higher either — by the time the same person has seen it half a time more,
 * the creative has already stopped earning.
 */
export const FATIGUE_FREQUENCY_RISE = 0.1

/** One day of one creative, as the platform reports it. */
export interface CreativeDay {
  /** ISO date. Only used to order the days. */
  day: string
  impressions: number
  leads: number
  spendAed: number
  /** Times each person reached saw it that day. 0 when not reported. */
  frequency: number
}

export interface DecayHalf {
  impressions: number
  leads: number
  spendAed: number
  /** Leads per million impressions — the rate that is actually being compared. */
  ratePerMillion: number
  /** Impression-weighted, so a quiet day cannot move it. */
  frequency: number
  /** Cost per lead in this half, or null with nothing to divide by. */
  cplAed: number | null
}

export interface DecayReading {
  verdict: DecayVerdict
  early: DecayHalf
  recent: DecayHalf
  /** How likely this drop is chance, if the creative really had not changed. */
  p: number
  /** How much of the early rate survives — 0.4 means it produces 40% of what
   *  it used to. null when the early half produced nothing to fall from. */
  survivingShare: number | null
  /** The change in times-each-person-saw-it, recent minus early. */
  frequencyRise: number
}

const empty = (): DecayHalf => ({
  impressions: 0, leads: 0, spendAed: 0, ratePerMillion: 0, frequency: 0, cplAed: null,
})

function summarise(days: CreativeDay[]): DecayHalf {
  const impressions = days.reduce((n, d) => n + d.impressions, 0)
  const leads = days.reduce((n, d) => n + d.leads, 0)
  const spendAed = days.reduce((n, d) => n + d.spendAed, 0)
  return {
    impressions, leads, spendAed,
    ratePerMillion: impressions > 0 ? (leads / impressions) * 1_000_000 : 0,
    // Impression-weighted. A day with two hundred impressions and a frequency
    // of 4 is not evidence that people are being hammered.
    frequency: impressions > 0
      ? days.reduce((n, d) => n + d.frequency * d.impressions, 0) / impressions
      : 0,
    cplAed: leads > 0 && spendAed > 0 ? spendAed / leads : null,
  }
}

/**
 * Cut the run in two where the impressions are.
 *
 * Not down the middle of the calendar: a creative that got AED 50 in week one
 * and AED 5,000 in week two would be compared against almost nothing, and the
 * test would report "no change" on every ramping ad in the account.
 */
export function splitByExposure(days: CreativeDay[]): { early: CreativeDay[]; recent: CreativeDay[] } {
  const ordered = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const total = ordered.reduce((n, d) => n + d.impressions, 0)
  if (total <= 0) return { early: [], recent: ordered }
  let seen = 0
  let cut = 0
  for (let i = 0; i < ordered.length; i++) {
    seen += ordered[i].impressions
    if (seen >= total / 2) { cut = i + 1; break }
  }
  // Never hand back an empty side when there are at least two days to split:
  // one day holding more than half the impressions would otherwise leave the
  // recent half empty and the reading would be about nothing.
  if (cut >= ordered.length && ordered.length > 1) cut = ordered.length - 1
  return { early: ordered.slice(0, cut), recent: ordered.slice(cut) }
}

/**
 * Is this creative dying, and if so of what?
 *
 * `tooEarly` whenever either half is too thin to carry the comparison — which
 * is most creatives, most of the time, and saying so is the point. A verdict on
 * eight hundred impressions would be the thing this module replaces.
 */
export function readDecay(days: CreativeDay[]): DecayReading {
  const { early: e, recent: r } = splitByExposure(days)
  const early = e.length ? summarise(e) : empty()
  const recent = r.length ? summarise(r) : empty()
  const frequencyRise = recent.frequency - early.frequency
  const survivingShare = early.ratePerMillion > 0
    ? recent.ratePerMillion / early.ratePerMillion
    : null

  const thin = early.impressions < MIN_IMPRESSIONS_PER_HALF
    || recent.impressions < MIN_IMPRESSIONS_PER_HALF
  if (thin) {
    return { verdict: 'tooEarly', early, recent, p: 1, survivingShare, frequencyRise }
  }

  // Leads over impressions, early against recent — the same conditional test
  // every other comparison in this product uses.
  const p = samePace(recent.leads, recent.impressions, early.leads, early.impressions)
  const fell = recent.ratePerMillion < early.ratePerMillion

  if (p >= SIGNIFICANT_P || !fell) {
    return { verdict: 'fresh', early, recent, p, survivingShare, frequencyRise }
  }

  // IT FELL, AND IT FELL FOR REAL. Which of the two problems is it?
  return {
    verdict: frequencyRise >= FATIGUE_FREQUENCY_RISE ? 'fatigued' : 'audienceMoved',
    early, recent, p, survivingShare, frequencyRise,
  }
}

/**
 * Should this creative be replaced?
 *
 * Only fatigue. `audienceMoved` is a real decline and a real problem, and a new
 * picture is the wrong answer to it — the audience is converting worse, not
 * bored. Saying "make a new creative" there costs a week and fixes nothing.
 */
export const needsNewCreative = (d: DecayReading): boolean => d.verdict === 'fatigued'

/** Should the audience be looked at instead? */
export const needsNewAudience = (d: DecayReading): boolean => d.verdict === 'audienceMoved'
