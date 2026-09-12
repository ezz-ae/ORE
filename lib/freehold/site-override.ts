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

/**
 * ── DOMAINS THAT ARE DARK IN THE CODE, NOT IN AN ENV VAR ─────────────────
 *
 * The env switch is the right shape for a temporary outage: it flips without
 * a deploy and it applies to whatever the deployment serves. It is the wrong
 * shape for a deliberate, commercial shutdown, for two reasons.
 *
 * A shutdown that lives only in a dashboard setting is invisible in the
 * repository — the next person to read this code has no way to know the site
 * is down or why, and a redeploy from a clean environment silently brings it
 * back.
 *
 * And this deployment serves more than one brand. An env var darkens
 * everything the build answers for; naming the domains darkens exactly the
 * ones that are meant to be dark, so a trial or a demo on another host is
 * unaffected by a decision that has nothing to do with it.
 *
 * ── WHO IS DARK, AND SINCE WHEN ──────────────────────────────────────────
 *
 * freeholdproperty.ae and fhp.ae went on this list on 6 Sep 2026 over unpaid
 * invoices, came off it on 7 Sep when the decision was reversed, and went
 * back on on 12 Sep when it was reversed again. The history is in the log
 * because it is in the code: `git log -- lib/freehold/site-override.ts` is
 * the whole record of who was served when, which is the point of keeping it
 * here rather than in a dashboard nobody can diff.
 *
 * Empty would mean every host is served. Adding an entry darkens a domain,
 * removing it restores one, and both take one line and one review.
 */
export const DARK_DOMAINS: readonly string[] = [
  'freeholdproperty.ae',
  'fhp.ae',
]

/**
 * Does this host fall under one of the given domains?
 *
 * Separated from the list so the RULE can be tested independently of who is
 * currently dark. A guard pinned to the names would pass while a client is
 * suspended and fail the day they are restored, which makes it a record of a
 * commercial state rather than a test of behaviour.
 *
 * Matches the apex and any subdomain of it, because `www.` is the same site
 * and a shutdown that let `www` through would be no shutdown at all. The port
 * is stripped: a Host header carries one and a bare comparison would miss.
 */
export function hostMatches(
  host: string | null | undefined,
  domains: readonly string[],
): boolean {
  const h = String(host ?? '').trim().toLowerCase().split(':')[0]
  if (!h) return false
  return domains.some((d) => h === d || h.endsWith(`.${d}`))
}

/** Is this host one of the dark ones? Empty list, nobody is. */
export function isDarkHost(host: string | null | undefined): boolean {
  return hostMatches(host, DARK_DOMAINS)
}

/**
 * The mode for THIS request: the environment first, then the domain list.
 *
 * The env var wins so the switch can still be used for an ordinary outage on
 * any host, and so a dark domain can be brought back in an emergency without
 * waiting for a deploy — `SITE_OVERRIDE=off` beats the list.
 */
export function modeForRequest(
  env: Record<string, string | undefined>,
  host: string | null | undefined,
): OverrideMode {
  const raw = String(env.SITE_OVERRIDE ?? '').trim().toLowerCase()
  if ((OVERRIDE_MODES as readonly string[]).includes(raw)) return raw as OverrideMode
  return isDarkHost(host) ? 'all' : 'off'
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

/**
 * The holding page: black, one line, nothing else.
 *
 * No brand mark, no logo, no explanation, no contact. A styled apology reads
 * as a service having a bad day and invites waiting. A black screen with one
 * sentence reads as a decision, which is the entire point of showing it.
 *
 * One file, no assets, no fonts, no requests — it has to render when
 * everything behind it is switched off, on a phone, on a bad connection, in
 * an email preview.
 */
export function holdingPage(input: { title: string; message: string; brand: string }): string {
  const esc = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  // `message` is rendered only when somebody set one. The shipped default is
  // empty, so the page is the single line and nothing under it.
  const line = esc(input.message).trim()
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(input.title)}</title>
<style>
:root{color-scheme:dark}
html,body{margin:0;height:100%;background:#000}
body{display:grid;place-items:center;color:#8a8a8a;
font:13px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
p{margin:0;padding:0 1.25rem;text-align:center}
</style>
</head><body><p>${esc(input.title)}${line ? `<br>${line}` : ''}</p></body></html>`
}

/**
 * What ships when nobody sets anything.
 *
 * Says the site is not available and nothing about why. The reason for a
 * shutdown is between the parties to it — a public page on a company's own
 * domain stating it is a published statement about that company, readable by
 * their clients and their competitors, and not something to arrive as a
 * default. SITE_OVERRIDE_TITLE and SITE_OVERRIDE_MESSAGE take anything.
 */
export const DEFAULT_TITLE = 'This website is not available.'
export const DEFAULT_MESSAGE = ''


/**
 * IS THIS DEPLOYMENT SERVING A SUSPENDED ACCOUNT?
 *
 * The blackout answers "do we serve them". This answers the different and
 * more dangerous question: "may the machine still CHANGE their ad account".
 *
 * The morning guard reads live Meta and, since the auto-apply work, makes one
 * change on its own — it turns Meta Advantage off. That change is correct and
 * it helps whoever owns the account. It is also a WRITE INTO SOMEBODY ELSE'S
 * AD ACCOUNT MADE AFTER WE STOPPED SERVING THEM, and that is a different act
 * from monitoring, however good the edit is.
 *
 * "They were still editing our campaigns after they cut us off" is a sentence
 * that survives being technically wrong. So while a deployment's own site is
 * dark, the guard reads everything and changes nothing.
 *
 * Driven by the SAME list as the blackout — one record of suspension, so the
 * two can never disagree about whether an account is suspended.
 */
export function deploymentSuspended(
  env: Record<string, string | undefined>,
  brandDomain: string,
): boolean {
  // An explicit override still wins, in both directions: a deployment taken
  // down for an ordinary outage is not a suspended client, and one brought
  // back with SITE_OVERRIDE=off may act again immediately.
  const raw = String(env.SITE_OVERRIDE ?? '').trim().toLowerCase()
  if (raw === 'off') return false
  if (raw === 'public' || raw === 'all') return true

  const site = String(env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  let host = brandDomain
  if (site) {
    try { host = new URL(site.includes('://') ? site : `https://${site}`).host } catch { /* keep brandDomain */ }
  }
  return isDarkHost(host)
}
