/**
 * IS ANYTHING ACTUALLY THERE — checked before the money starts.
 *
 * The launch route validates that a landing URL is PRESENT. It has never
 * checked that the page at the other end exists, is published, or will still
 * be published tomorrow.
 *
 * WHAT THAT COSTS. app/lp/[slug] returns a 404 to anonymous visitors when the
 * page is outside its publish window — and every paid click is an anonymous
 * visitor. So a campaign can be launched, approved by Meta, and spend its full
 * daily budget delivering people to a 404. Nothing in Ads Manager reports it:
 * the impressions are real, the clicks are real, and the only symptom is that
 * no leads arrive, which reads exactly like a bad audience.
 *
 * THIS IS THE SAME SHAPE AS THE PERMIT RULE, and it is stated the same way.
 * trakheesi.ts says a permit NUMBER says nothing about today; a landing page's
 * status says nothing about tomorrow. `publish_to` is a real field with real
 * dates in it, so a page published until the 20th sends a campaign that starts
 * on the 18th into a 404 on the 21st — while the campaign, the budget and the
 * ad all stay perfectly healthy.
 *
 * WHAT THIS REFUSES AND WHAT IT ONLY WARNS ABOUT:
 *
 *   REFUSE   one of OUR pages that is missing or not published. There is no
 *            reading under which spending money on a guaranteed 404 is what
 *            somebody meant.
 *   WARN     a page whose publish window closes while the campaign would
 *            still be running, and any URL that is not ours. Both are real
 *            choices somebody may be making deliberately — an external
 *            developer microsite is a legitimate destination, it simply
 *            cannot be attributed.
 *
 * Pure — no I/O, no clock (now is passed in). Runs in `pnpm guards`.
 */

/** Walkable — each renders its own sentence. */
export const PREFLIGHT_VERDICTS = [
  'ok', 'noSuchPage', 'notPublished', 'windowClosed', 'closesSoon', 'notOurs', 'noUrl',
] as const
export type PreflightVerdict = (typeof PREFLIGHT_VERDICTS)[number]

/** Verdicts that must stop a launch rather than annotate it. */
const BLOCKING: ReadonlySet<PreflightVerdict> = new Set<PreflightVerdict>([
  'noSuchPage', 'notPublished', 'windowClosed', 'noUrl',
])
export const blocksLaunch = (v: PreflightVerdict): boolean => BLOCKING.has(v)

/**
 * How far ahead a closing publish window is worth warning about.
 *
 * Seven days rather than one: a campaign launched today is normally still
 * running next week, and a warning that arrives the day before the page goes
 * dark arrives after the budget for that week has already been committed.
 */
export const CLOSING_SOON_DAYS = 7

export interface LandingPageState {
  /** The page's own slug, as it appears in /lp/<slug>. */
  slug: string
  /** Normalised status — 'published' is the only one that serves. */
  status: string
  /** ISO dates, or null. The window app/lp/[slug] itself enforces. */
  publishFrom: string | null
  publishTo: string | null
}

export interface PreflightResult {
  verdict: PreflightVerdict
  /** The slug we recognised in the URL, when it is one of ours. */
  slug: string | null
  /** When the page stops serving, for the sentence on screen. */
  closesOn: string | null
}

/** The /lp/<slug> our landing pages live at. Returns null for anything else,
 *  including our own site's other pages — a project page is not a landing
 *  page and has no publish window to check. */
export function landingSlugOf(url: string, domain: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.toLowerCase()
  const d = domain.toLowerCase().replace(/^www\./, '')
  if (host !== d && !host.endsWith(`.${d}`)) return null
  const m = u.pathname.match(/^\/lp\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

const parse = (v: string | null): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

/**
 * Check one landing URL against the page it points at.
 *
 * `page` is null when nothing in the database matches the slug — which is a
 * REFUSAL, not an unknown. A /lp/ URL with no row behind it is a 404 with
 * certainty, and the one thing worse than blocking a launch is letting one
 * spend a week's budget on a page that was renamed.
 */
export function preflightLanding(
  url: string | null | undefined,
  page: LandingPageState | null,
  opts: { domain: string; now?: Date },
): PreflightResult {
  const now = opts.now ?? new Date()
  const raw = (url ?? '').trim()
  if (!raw) return { verdict: 'noUrl', slug: null, closesOn: null }

  const slug = landingSlugOf(raw, opts.domain)
  if (!slug) {
    // Not one of our landing pages. Could be our own site elsewhere, could be
    // a developer's microsite. Either way there is no publish window we can
    // check, and no CRM of ours on the other end — a warning, never a block,
    // because it is a choice somebody may be making on purpose.
    return { verdict: 'notOurs', slug: null, closesOn: null }
  }

  if (!page) return { verdict: 'noSuchPage', slug, closesOn: null }

  if (page.status.trim().toLowerCase() !== 'published') {
    return { verdict: 'notPublished', slug, closesOn: null }
  }

  const from = parse(page.publishFrom)
  const to = parse(page.publishTo)

  // Not yet open and already closed are the same outcome for a paid click —
  // a 404 — and both are refusals. They keep separate verdicts only because
  // "it starts on Monday" and "it ended in March" are answered differently.
  if (from && now < from) return { verdict: 'notPublished', slug, closesOn: null }
  if (to && now > to) return { verdict: 'windowClosed', slug, closesOn: page.publishTo }

  if (to) {
    const days = (to.getTime() - now.getTime()) / 86_400_000
    if (days <= CLOSING_SOON_DAYS) {
      return { verdict: 'closesSoon', slug, closesOn: page.publishTo }
    }
  }

  return { verdict: 'ok', slug, closesOn: page.publishTo }
}
