/**
 * WHAT WOULD STOP THIS LAUNCH — asked before the work, not after it.
 *
 * The launcher is a sequence: pick a project, pick an audience, write the ad,
 * set a budget, press Run. Every check that can refuse the launch fires at the
 * END of that sequence, inside the launch route, when the person has already
 * done all of it. A missing Trakheesi permit, an unpublished landing page, no
 * connected Page — each is knowable the moment the project is chosen, and each
 * is currently discovered on the last click.
 *
 * That is the shape problem, and it is not cosmetic. A wizard that fails at
 * the end teaches people to fear the last button, and the way people avoid a
 * feared button is to stop using the tool that has it.
 *
 * SO THE SEQUENCE IS NOT THE POINT — the BLOCKERS are. This module answers one
 * question at any moment during the flow: given what has been chosen so far,
 * what would refuse this, what would merely go wrong, and what does the person
 * do about each. Anything not yet chosen is 'pending', never a failure: a
 * launcher that shows five red rows before you have typed anything is a
 * launcher nobody reads.
 *
 * EVERY CHECK NAMES ITS OWN FIX. A blocker with no route is a dead end
 * somebody has to leave the screen to solve, and they do not come back.
 *
 * Pure — no I/O, no clock (now is passed in). Runs in `pnpm guards`.
 */

/** Walkable — each renders its own line. */
export const READINESS_CHECKS = [
  'account', 'page', 'pageAds', 'project', 'permit', 'destination', 'creative', 'budget', 'audience',
] as const
export type ReadinessCheck = (typeof READINESS_CHECKS)[number]

/** Walkable — each renders its own tone and word. */
export const READINESS_STATES = ['ok', 'blocked', 'warn', 'pending'] as const
export type ReadinessState = (typeof READINESS_STATES)[number]

/**
 * Meta's own floor for a lead-optimised ad set to leave the learning phase in
 * a reasonable time — roughly fifty conversions in a week.
 *
 * Below the daily budget that can buy those, the ad set never stabilises and
 * every number it produces is learning-phase noise. Warned, never blocked: a
 * small test budget is a legitimate thing to want, and refusing it would be
 * this tool deciding how much of somebody's money is enough.
 */
export const LEARNING_DAILY_AED = 150

/** Meta's hard minimum for a daily budget, below which it refuses outright. */
export const META_MIN_DAILY_AED = 20

/**
 * The states each check can actually reach, EXCLUDING 'ok'.
 *
 * An 'ok' row needs no sentence — the label and a tick say everything, and
 * writing "your budget is fine" in three languages is copy nobody reads that
 * still has to be translated and maintained. So the screen renders a sentence
 * only when something is not yet done or not right, and the computed-key guard
 * walks exactly this map rather than the full 8x4 cross product, most of which
 * is unreachable.
 */
export const REACHABLE: Record<ReadinessCheck, readonly Exclude<ReadinessState, 'ok'>[]> = {
  account:     ['blocked'],
  page:        ['blocked', 'pending'],
  pageAds:     ['blocked', 'pending'],
  project:     ['pending'],
  permit:      ['blocked', 'warn', 'pending'],
  destination: ['blocked', 'warn', 'pending'],
  creative:    ['warn', 'pending'],
  budget:      ['blocked', 'warn', 'pending'],
  audience:    ['warn'],
}

export interface LaunchDraft {
  /** Meta connected at all, with an ad account. */
  metaConnected: boolean
  /** A Facebook Page is selected — no Page, no ad, at any budget. */
  pageId: string | null
  /**
   * May this login run ads FROM that Page? See lib/meta/page-ads.ts.
   *
   * Seeing a Page and advertising with it are two permissions, and only the
   * second creates an ad. undefined = not looked up yet. 'unknown' is Meta
   * declining to say, which is not a refusal.
   */
  pageAds?: 'can' | 'cannot' | 'unknown' | null
  /** The chosen listing, when one is chosen. */
  projectSlug: string | null
  /** Its Trakheesi permit expiry, YYYY-MM-DD. undefined = not looked up yet. */
  permitExpiry?: string | null
  /** The landing pre-flight verdict, when the destination is known.
   *  See lib/freehold/landing-preflight.ts — this module does not repeat it. */
  landingVerdict?: string | null
  /** True when the ad uses a Meta instant form instead of a link. */
  usesInstantForm?: boolean
  /** Something to show: an image or a video. */
  hasCreative: boolean
  /** Words: at least a headline and a primary text. */
  hasCopy: boolean
  dailyBudgetAed: number | null
  /** At least one audience selected or a persona chosen. */
  hasAudience: boolean
}

export interface ReadinessRow {
  id: ReadinessCheck
  state: ReadinessState
  /** Numbers the row stands on, for its sentence. */
  vars: Record<string, string | number>
  /** Where the person goes to resolve it. null when there is nothing to do. */
  fix: string | null
}

const FIX: Record<ReadinessCheck, string | null> = {
  account:     '/freehold-intelligence/integrations',
  page:        '/freehold-intelligence/integrations',
  pageAds:     '/freehold-intelligence/integrations',
  project:     null,
  permit:      '/freehold-intelligence/inventory',
  destination: '/freehold-intelligence/landing-pages',
  creative:    null,
  budget:      null,
  audience:    null,
}

/** Landing verdicts that stop a launch — mirrored from landing-preflight so
 *  this module can be pure, and asserted equal by the guard so the two can
 *  never drift into disagreeing about what a refusal is. */
const LANDING_BLOCKS = new Set(['noSuchPage', 'notPublished', 'windowClosed', 'noUrl'])
const LANDING_WARNS = new Set(['closesSoon', 'notOurs'])

/**
 * Read a draft.
 *
 * PENDING IS NOT A FAILURE, and this is the whole difference between a
 * checklist that helps and one people close. A person who has opened the
 * launcher and chosen nothing has done nothing wrong; the rows fill in as they
 * go, and only a real conflict turns red.
 */
export function readinessOf(d: LaunchDraft, now: Date = new Date()): ReadinessRow[] {
  const row = (id: ReadinessCheck, state: ReadinessState, vars: ReadinessRow['vars'] = {}): ReadinessRow =>
    ({ id, state, vars, fix: state === 'ok' || state === 'pending' ? null : FIX[id] })

  const rows: ReadinessRow[] = []

  // ── The account, before anything else ──────────────────────────────────
  // Checked first because everything below is moot without it, and because
  // it is the one blocker the person cannot fix by choosing differently.
  rows.push(row('account', d.metaConnected ? 'ok' : 'blocked'))
  rows.push(row('page', !d.metaConnected ? 'pending' : d.pageId ? 'ok' : 'blocked'))

  // ── …and whether ads may run FROM it ───────────────────────────────────
  // The launch that kept failing. A login can see a Page, list its forms and
  // show its name in the picker, and still be refused the moment an ad is
  // created (subcode 1487202) — because seeing a Page and advertising with it
  // are two separate grants. It was only ever discovered on the last click.
  //
  // 'unknown' stays PENDING rather than becoming a tick. Meta omits the field
  // for some token scopes, and a green tick for "we could not check" is the
  // false reassurance that made this worth building.
  rows.push(row('pageAds',
    !d.metaConnected || !d.pageId ? 'pending'
      : d.pageAds === 'cannot' ? 'blocked'
      : d.pageAds === 'can' ? 'ok'
      : 'pending'))

  // ── The project ────────────────────────────────────────────────────────
  rows.push(row('project', d.projectSlug ? 'ok' : 'pending'))

  // ── The permit — a legal gate, not a preference ────────────────────────
  // MISSING AND EXPIRED ARE DIFFERENT. An absent expiry is the absence of
  // evidence and blocks nothing; the launch route takes the same position,
  // because refusing over a blank field would stop launches on a data gap.
  // A date that has actually passed is grounds to stop somebody.
  if (!d.projectSlug) {
    rows.push(row('permit', 'pending'))
  } else if (d.permitExpiry === undefined) {
    rows.push(row('permit', 'pending'))
  } else if (!d.permitExpiry) {
    rows.push(row('permit', 'warn', { reason: 'noExpiry' }))
  } else {
    // Valid THROUGH the expiry date in Dubai time — treating it as dead at
    // midnight UTC would stop a legal campaign four hours early.
    const end = new Date(`${d.permitExpiry}T23:59:59+04:00`)
    const expired = Number.isFinite(end.getTime()) && end.getTime() < now.getTime()
    rows.push(row('permit', expired ? 'blocked' : 'ok', { expiry: d.permitExpiry }))
  }

  // ── Where the click lands ──────────────────────────────────────────────
  // An instant form has no landing page to check and cannot 404 — it is the
  // safest destination there is, which is why the machine prefers it.
  if (d.usesInstantForm) {
    rows.push(row('destination', 'ok', { kind: 'form' }))
  } else if (!d.landingVerdict) {
    rows.push(row('destination', 'pending'))
  } else if (LANDING_BLOCKS.has(d.landingVerdict)) {
    rows.push(row('destination', 'blocked', { why: d.landingVerdict }))
  } else if (LANDING_WARNS.has(d.landingVerdict)) {
    rows.push(row('destination', 'warn', { why: d.landingVerdict }))
  } else {
    rows.push(row('destination', 'ok', { kind: 'landing' }))
  }

  // ── The ad itself ──────────────────────────────────────────────────────
  // Both halves or neither: a picture with no words and words with no picture
  // are both incomplete, and reporting them as one row keeps the list short
  // enough to read.
  rows.push(row('creative',
    d.hasCreative && d.hasCopy ? 'ok'
      : !d.hasCreative && !d.hasCopy ? 'pending'
      : 'warn',
    { hasCreative: d.hasCreative ? 1 : 0, hasCopy: d.hasCopy ? 1 : 0 }))

  // ── The budget ─────────────────────────────────────────────────────────
  const b = d.dailyBudgetAed
  rows.push(row('budget',
    b === null || b <= 0 ? 'pending'
      : b < META_MIN_DAILY_AED ? 'blocked'
      : b < LEARNING_DAILY_AED ? 'warn'
      : 'ok',
    { budget: b ?? 0, min: META_MIN_DAILY_AED, learning: LEARNING_DAILY_AED }))

  // ── The audience ───────────────────────────────────────────────────────
  // Never a blocker. Meta will deliver to a broad audience, and there are real
  // cases where that is the right buy — this tool does not get to refuse a
  // legitimate strategy, only to say it is happening.
  rows.push(row('audience', d.hasAudience ? 'ok' : 'warn'))

  return rows
}

/** Can this be launched at all? */
export const canLaunch = (rows: ReadinessRow[]): boolean =>
  !rows.some((r) => r.state === 'blocked')

/**
 * The one line the strip leads with.
 *
 * A BLOCKER OUTRANKS EVERYTHING, then anything still pending, then warnings.
 * Pending before warn on purpose: "you have not chosen a project yet" is more
 * useful than "your budget is small" to somebody who has not chosen a project.
 */
export function readinessHeadline(rows: ReadinessRow[]): ReadinessRow | null {
  return rows.find((r) => r.state === 'blocked')
    ?? rows.find((r) => r.state === 'pending')
    ?? rows.find((r) => r.state === 'warn')
    ?? null
}

/** Counts for the strip's summary, so it can be read without expanding. */
export function readinessCounts(rows: ReadinessRow[]): Record<ReadinessState, number> {
  const out: Record<ReadinessState, number> = { ok: 0, blocked: 0, warn: 0, pending: 0 }
  for (const r of rows) out[r.state]++
  return out
}
