/**
 * WHAT YOU'D SAY ACROSS THE DESK — one line per campaign, and the button next
 * to it.
 *
 * The live screen this replaces printed four totals and a list of names with
 * spend beside them. Everything an operator actually needs to know was absent:
 * whether Meta is delivering it, whether it is out of learning, whether the
 * same people are seeing it for the fifth time, whether anyone has rated the
 * leads, which of two ad sets is buying at a multiple. And its "Live" badge
 * showed the BROWSER CLOCK, which says nothing about the data — a campaign
 * two days stale read as live to the second.
 *
 * A live screen is live when it COMMUNICATES. So this module turns a
 * campaign's facts into the sentence a colleague would say on a busy day, and
 * the fix rides on the same line:
 *
 *     Meta stopped it.              [See why]
 *     adset 2 — 6× the price, 0.    [Turn off]
 *     2 leads, none rated.          [Rate]
 *     Seen 4.2× each.               [Add designs]
 *     12 of 50 this week.           [Add designs]
 *
 * THREE RULES:
 *
 *  1. TWO LINES, NEVER MORE. A row with five findings is a row nobody reads,
 *     and the fifth is never the one that mattered. Ranked by money and cut.
 *
 *  2. NO LINE WITHOUT ITS DOOR. Every signal carries the action that addresses
 *     it, aimed where the fault is — the ad set's id, not "go look at the
 *     campaign". A screen that surfaces a fault and makes you find the fix
 *     elsewhere has moved the work, not done it.
 *
 *  3. SILENCE IS A RESULT. A campaign doing what it should produces one quiet
 *     line and no button. If everything shouts, nothing is heard.
 *
 * Pure — no I/O, no clock (today is passed in, so the staleness rule is
 * testable). Runs in `pnpm guards`.
 */

export type SignalTone = 'bad' | 'warn' | 'flat' | 'good'

/** Every line this module can say. Walkable — rendered through a computed key. */
export const SIGNAL_IDS = [
  'blocked', 'stale', 'dearAdSet', 'unrated', 'burning',
  'learning', 'oneDesign', 'noClicks', 'spendNoLeads', 'steady', 'paused',
] as const
export type SignalId = (typeof SIGNAL_IDS)[number]

/** What the button does. Mirrors the campaign page's own action vocabulary so
 *  one press means the same thing on both screens. */
export const SIGNAL_ACTIONS = ['open', 'addDesigns', 'rate', 'pauseAdSet', 'none'] as const
export type SignalAction = (typeof SIGNAL_ACTIONS)[number]

export interface LiveSignal {
  id: SignalId
  tone: SignalTone
  vars?: Record<string, string | number>
  action: SignalAction
  /** The Meta object the action acts on, when the fault is one of many. */
  targetId?: string
}

export interface LiveFacts {
  /** ACTIVE / PAUSED — what was asked for. */
  status: string
  /** Meta's own verdict, which is the one that matters. */
  deliveryBlocked?: boolean
  spendAed: number
  leads: number
  /**
   * Leads the CRM has rated. NULL means nobody has asked yet — which is not
   * the same as zero, and must not produce the "nobody rated these" line. The
   * cheap list read leaves it null and the deep read fills it in; a screen
   * that cannot tell "none" from "unknown" invents faults.
   */
  ratedLeads: number | null
  impressions: number
  clicks: number
  /** Average times the SAME person saw it. The fatigue number. */
  frequency: number | null
  /** Live ads across the campaign — how much there is to rotate. Null until
   *  the deep read counts them; same rule as ratedLeads. */
  liveAds: number | null
  /** Days the campaign has been able to spend. */
  days: number
  /**
   * The last day Meta has data for (`date_stop`), and the day being read on.
   * Both ISO yyyy-mm-dd. The pair is what makes "live" a claim about the DATA
   * rather than about the browser clock.
   */
  dataThrough?: string | null
  today: string
  /** Per ad set, so the comparison a campaign total cannot contain is possible
   *  here too — see the expensive-ad-set rule. */
  adSets?: Array<{ id: string; name: string; spendAed: number; impressions: number; leads: number }>
}

/** Meta's weekly floor for a stable ad set. */
const LEARNING_EVENTS_WEEKLY = 50
/** How long "is it out of learning yet" is still the live question. Two of
 *  Meta's own seven-day windows: past that it has exited, as SUCCESS or FAIL,
 *  and saying "12 of 50" forever is noise rather than news. */
export const LEARNING_QUESTION_DAYS = 14
/** Above this, the same people are being shown the same ad over and over. */
export const FATIGUE_FREQUENCY = 3
/** Below this there is not enough delivery to say anything about creative. */
export const MIN_IMPRESSIONS_TO_JUDGE = 2000
/**
 * Meta's reporting lags a few hours, never days. An ACTIVE campaign whose last
 * data is two days old is not a slow report — it stopped delivering, or the
 * read is broken. Either way the number on screen is not today's.
 */
export const STALE_AFTER_DAYS = 2

const DAY = 86_400_000
export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = Date.parse(`${String(fromIso ?? '').slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${String(toIso ?? '').slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / DAY)
}

export function signalsFor(f: LiveFacts): LiveSignal[] {
  const live = String(f.status ?? '').toUpperCase() === 'ACTIVE'
  const out: LiveSignal[] = []

  // A campaign nobody switched on is not a problem to solve. It gets one flat
  // line and no button — the operator paused it on purpose.
  if (!live && !f.deliveryBlocked) {
    return [{ id: 'paused', tone: 'flat', action: 'none' }]
  }

  // ── Meta will not deliver it ─────────────────────────────────────────────
  // Everything below assumes an ad that can be seen. Returns alone: advice
  // about spend on an ad nobody is shown is worse than silence.
  if (f.deliveryBlocked) {
    return [{ id: 'blocked', tone: 'bad', action: 'open' }]
  }

  // ── The number on screen is not today's ──────────────────────────────────
  // Ranked directly under a block because every line below it is a claim
  // about data this rule has just said is old.
  const behind = f.dataThrough ? daysBetween(f.dataThrough, f.today) : null
  if (behind !== null && behind >= STALE_AFTER_DAYS) {
    out.push({ id: 'stale', tone: 'bad', vars: { days: behind }, action: 'open' })
  }

  // ── One ad set buying at a multiple, for nothing ─────────────────────────
  // The finding a campaign total cannot contain: an average of two audiences
  // describes neither. Same floors as the campaign page — enough spend to be
  // more than noise, and ZERO leads, because an expensive ad set that still
  // converts is buying scarce people who are worth it.
  const withCpm = (f.adSets ?? [])
    .filter((a) => a.impressions >= 100 && a.spendAed > 0)
    .map((a) => ({ ...a, cpm: (a.spendAed / a.impressions) * 1000 }))
  if (withCpm.length >= 2) {
    const cheap = withCpm.reduce((a, b) => (a.cpm <= b.cpm ? a : b))
    const dear = withCpm.reduce((a, b) => (a.cpm >= b.cpm ? a : b))
    const ratio = cheap.cpm > 0 ? dear.cpm / cheap.cpm : 1
    if (dear.id !== cheap.id && ratio >= 3 && dear.leads === 0 && dear.spendAed >= 50) {
      out.push({
        id: 'dearAdSet', tone: 'bad',
        vars: { name: dear.name, times: Math.round(ratio) },
        action: 'pauseAdSet', targetId: dear.id,
      })
    }
  }

  // ── Leads nobody has rated ───────────────────────────────────────────────
  // The free lever: a rated lead teaches Meta who to find next. Unrated, the
  // optimiser keeps buying whoever it found first.
  if (f.leads > 0 && f.ratedLeads === 0) {   // a KNOWN zero, never an unknown
    out.push({ id: 'unrated', tone: 'warn', vars: { n: f.leads }, action: 'rate' })
  }

  // ── The same people, again ───────────────────────────────────────────────
  if (f.frequency !== null && f.frequency >= FATIGUE_FREQUENCY && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE) {
    out.push({
      id: 'burning', tone: 'warn',
      vars: { freq: f.frequency.toFixed(1) }, action: 'addDesigns',
    })
  }

  // ── Short of the weekly floor that ends learning ─────────────────────────
  // Stated as the count, because "still learning" is a state and "12 of 50" is
  // a distance.
  //
  // TWO GATES, and the second is the one that keeps this screen readable.
  // Delivery first: a campaign with no impressions is not learning slowly, it
  // is not running. Then AGE — because almost no Dubai property campaign ever
  // reaches fifty leads in a week, so without a window this line would appear
  // on every row forever and become the wallpaper the eye skips. Learning is a
  // question for the first fortnight; after that Meta has already left the
  // phase, one way or the other, and the honest lines are the ones below.
  const weekly = f.days > 0 ? (f.leads / f.days) * 7 : 0
  if (f.impressions >= MIN_IMPRESSIONS_TO_JUDGE
    && f.days <= LEARNING_QUESTION_DAYS
    && weekly < LEARNING_EVENTS_WEEKLY) {
    out.push({
      id: 'learning', tone: 'warn',
      vars: { have: Math.round(weekly), need: LEARNING_EVENTS_WEEKLY },
      action: 'addDesigns',
    })
  }

  // ── One design carrying it ───────────────────────────────────────────────
  if (f.liveAds !== null && f.liveAds <= 1 && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE) {
    out.push({ id: 'oneDesign', tone: 'warn', action: 'addDesigns' })
  }

  // ── Reached and ignored ──────────────────────────────────────────────────
  const ctr = f.impressions > 0 ? f.clicks / f.impressions : 0
  if (ctr > 0 && ctr < 0.005 && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE) {
    out.push({
      id: 'noClicks', tone: 'warn',
      vars: { ctr: (ctr * 100).toFixed(2) }, action: 'addDesigns',
    })
  }

  // ── Money out, nothing back ──────────────────────────────────────────────
  // Deliberately last of the faults and only with real delivery behind it: a
  // campaign that has spent AED 40 has not failed, it has barely started.
  if (f.leads === 0 && f.spendAed > 0 && f.impressions >= MIN_IMPRESSIONS_TO_JUDGE) {
    out.push({ id: 'spendNoLeads', tone: 'warn', vars: { spend: Math.round(f.spendAed) }, action: 'open' })
  }

  // Rule 3: a campaign doing what it should says so, quietly, with no button.
  if (out.length === 0) return [{ id: 'steady', tone: 'good', action: 'none' }]

  // Rule 1: two lines. Bad before warn, and the order above is the order of
  // money — so the cut takes the cheapest findings, never the dearest.
  return out
    .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1))
    .slice(0, 2)
}

/**
 * How old is what this screen is showing?
 *
 * The page's "Live" badge used to print the browser clock, which is true and
 * useless: it ticks every minute whether or not a single number behind it has
 * moved. This reports the freshest `date_stop` across the campaigns being
 * shown — the actual edge of the data — and null when nothing has any, which
 * the screen says rather than filling with a time.
 */
export function dataFreshness(
  rows: Array<{ dataThrough?: string | null }>,
  today: string,
): { through: string; daysBehind: number } | null {
  const days = rows
    .map((r) => (r.dataThrough ? { through: r.dataThrough.slice(0, 10), d: daysBetween(r.dataThrough, today) } : null))
    .filter((x): x is { through: string; d: number } => !!x && x.d !== null)
  if (days.length === 0) return null
  const freshest = days.reduce((a, b) => (a.d <= b.d ? a : b))
  return { through: freshest.through, daysBehind: Math.max(0, freshest.d) }
}
