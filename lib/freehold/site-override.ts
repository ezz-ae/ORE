/**
 * TAKE THE SITE DOWN, DELIBERATELY, WITHOUT BREAKING WHAT MUST NOT BREAK.
 *
 * A holding page served for every route on every domain, switched by an
 * environment variable so it flips without a code change.
 *
 * ── WHY THIS IS NOT JUST `return new Response(503)` ──────────────────────
 *
 * Three things have to survive being switched off, and each one costs real
 * money or real trust if it does not.
 *
 * LEADS ARRIVING RIGHT NOW. Meta pushes a leadgen webhook, retries for a
 * while, and then GIVES UP — a lead dropped there is gone, not delayed. The
 * same is true of the landing-page capture endpoint. Taking a site down is a
 * commercial act; losing somebody's customers while doing it is a different
 * kind of act, and one that is very hard to undo or explain afterwards.
 *
 * SEARCH RANKING. A maintenance page returning 200 tells Google this is now
 * the content of every URL on the site, and it will index it. Days of that
 * costs rankings that take months to rebuild — a self-inflicted loss that
 * outlives whatever the shutdown was meant to achieve. So: 503 with
 * Retry-After, which Google treats as temporary and holds the index for.
 *
 * And deliberately NO `noindex`: on a 503 it is unnecessary, and if it were
 * ever served on a 200 by mistake it would actively deindex the site.
 *
 * THE WAY BACK IN. An override that also locks out the people who need to
 * turn it off is an outage, not a lever. The bypass key opens a normal
 * session for whoever holds it.
 *
 * ── THE DEFAULT MESSAGE SAYS NOTHING ABOUT WHY ───────────────────────────
 *
 * The reason for a shutdown is between the parties to it. A public page on a
 * company's own domain stating why is a published statement about that
 * company, readable by their clients and competitors, and it is not the kind
 * of thing to arrive as a default. The operator can set any message they
 * want; what ships is neutral.
 *
 * Pure — the environment is passed in. Runs in `pnpm guards`.
 */

/** Walkable. `public` covers the marketing site and landing pages; `all`
 *  additionally covers the internal command surfaces, which is the difference
 *  between "the site is down" and "nobody can work". */
export const OVERRIDE_MODES = ['off', 'public', 'all'] as const
export type OverrideMode = (typeof OVERRIDE_MODES)[number]

/**
 * Paths that keep working in EVERY mode, each for a reason that outlives the
 * shutdown.
 *
 * All of these authenticate themselves — Meta's HMAC signature, CRON_SECRET,
 * or nothing sensitive at all — so leaving them open costs no access.
 */
export const ALWAYS_LIVE: readonly string[] = [
  // Meta retries a leadgen push and then stops. A lead lost here is lost.
  '/api/meta/webhook',
  '/api/whatsapp/webhook',
  // Landing-page capture, for the same reason.
  '/api/leads',
  // The loops that keep the account's own bookkeeping continuous. A gap in
  // these is not recoverable by turning the site back on.
  '/api/cron/',
  '/api/health',
]

/** Read the mode off the environment. Anything unrecognised is OFF: a typo in
 *  an env var must never take a site down, and it must never quietly leave one
 *  down either. */
export function overrideMode(env: Record<string, string | undefined>): OverrideMode {
  const raw = String(env.SITE_OVERRIDE ?? '').trim().toLowerCase()
  return (OVERRIDE_MODES as readonly string[]).includes(raw) && raw !== 'off'
    ? (raw as OverrideMode)
    : 'off'
}

/** Internal command surfaces. Mirrors proxy.ts's own list — imported there
 *  rather than duplicated, so the two cannot drift. */
export const INTERNAL_PREFIXES: readonly string[] = [
  '/freehold-intelligence', '/ads-studio', '/notebook', '/cloud',
  '/agent-network', '/reports', '/settings',
]

/**
 * Should this request be answered with the holding page?
 *
 * Order matters: ALWAYS_LIVE wins over everything, then the bypass, then the
 * mode. A request that is both exempt and bypassed is still exempt — the
 * cheapest check first, and no path where a missing bypass could drop a lead.
 */
export function isHeldBack(
  pathname: string,
  mode: OverrideMode,
  opts: { bypassed?: boolean } = {},
): boolean {
  if (mode === 'off') return false
  if (ALWAYS_LIVE.some((p) => pathname === p || pathname.startsWith(p))) return false
  if (opts.bypassed) return false
  if (mode === 'all') return true
  // 'public': the internal surfaces keep working, so the team can still rate
  // leads and the machine keeps learning while the public site is dark.
  return !INTERNAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Does this request carry the bypass?
 *
 * Compared against a key that must be set — an empty key matches nothing
 * rather than everything, which is the failure mode that would leave the
 * override on and open at the same time.
 */
export function hasBypass(
  presented: string | null | undefined,
  key: string | undefined,
): boolean {
  const k = String(key ?? '').trim()
  if (k.length === 0) return false
  return String(presented ?? '') === k
}

/** The seconds a client should wait before retrying. Twelve hours: long
 *  enough that crawlers and monitors back off, short enough that it reads as
 *  temporary rather than gone. */
export const RETRY_AFTER_SECONDS = 43_200

/** The holding page. Deliberately one file with no assets: it has to render
 *  when everything behind it is switched off. */
export function holdingPage(input: { title: string; message: string; brand: string }): string {
  const esc = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(input.title)}</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#181613; color:#e8e4dd;
         font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif }
  main { max-width:34rem; padding:2.5rem 1.5rem; text-align:center }
  h1 { font-size:1.25rem; font-weight:600; margin:0 0 .75rem; letter-spacing:-.01em }
  p { margin:0; color:#a8a29a }
  .b { font-size:.75rem; letter-spacing:.14em; text-transform:uppercase;
       color:#7c766c; margin-bottom:1.75rem }
</style>
</head><body><main>
<div class="b">${esc(input.brand)}</div>
<h1>${esc(input.title)}</h1>
<p>${esc(input.message)}</p>
</main></body></html>`
}

/** What ships when nobody has set a message. Says that the site is
 *  unavailable and nothing about why — see the module header. */
export const DEFAULT_TITLE = 'This site is temporarily unavailable'
export const DEFAULT_MESSAGE = 'Please check back shortly.'
