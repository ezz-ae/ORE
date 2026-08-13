/**
 * THE HANDLE THAT LETS THE CRM TALK BACK — and it is thrown away today.
 *
 * The CRM already talks back to Meta: lead-writeback sends a qualified lead and
 * a closed deal, seed-cohort builds the value-based lookalike, rating-audiences
 * builds the exclusion. That loop is the most valuable thing in the product.
 *
 * It has three breaks, and this module is about the one that cannot be fixed
 * later.
 *
 * ── 1. GOOGLE RECEIVES NOTHING ───────────────────────────────────────────
 *
 * Not one line in this repo sends an outcome to Google. Its bidding optimises
 * on form fills it cannot tell apart, while the CRM two tables away knows which
 * of them became a three-million-dirham deal. On an account where the operator
 * believes Google is the better channel, that is the whole advantage unused.
 *
 * ── 2. AND IT CANNOT BE FIXED BY ADDING AN UPLOAD ────────────────────────
 *
 * Google will only accept an offline conversion against a CLICK IDENTIFIER —
 * gclid, or gbraid/wbraid on app and iOS traffic — or against hashed contact
 * details through enhanced conversions. This product captures none of the
 * three. The Google tracking template writes utm_source, utm_campaign and
 * utm_id and no click id; the landing form reads six utm fields and no click
 * id; the leads table has no column for one.
 *
 * ── 3. AND META'S OUTCOME EVENTS GO OUT HALF-IDENTIFIED ──────────────────
 *
 * `_fbc` and `_fbp` are read from the cookie jar at the moment the lead is
 * submitted, passed to that one Lead event, and dropped. So the events that
 * actually matter — "this one qualified", "this one bought", fired weeks later
 * by lead-writeback — carry only a hashed email and phone. The strongest signal
 * this account can send is sent with the weakest identity it has.
 *
 * ── WHY THIS IS URGENT AND NOT MERELY IMPORTANT ──────────────────────────
 *
 * Everything else in the loop can be backfilled. A deal value typed in next
 * month still teaches Meta something. A click identifier cannot: it exists for
 * the length of one visit, and a visit that ended without it being written down
 * is gone. Every day this is not capturing is a day of outcomes that can never
 * be sent anywhere.
 *
 * Pure — no I/O, no clock (now is passed in). Runs in `pnpm guards`.
 */

/** Walkable — each is a real parameter one of the platforms appends. */
export const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid'] as const
export type ClickIdParam = (typeof CLICK_ID_PARAMS)[number]

/** Which platform will accept an outcome against each. */
export const CLICK_ID_CHANNEL: Record<ClickIdParam, 'google' | 'meta'> = {
  gclid: 'google', gbraid: 'google', wbraid: 'google', fbclid: 'meta',
}

/**
 * How long a click identifier is worth sending back.
 *
 * Ninety days is Google's own limit for an offline conversion upload, and Meta
 * treats a click attribution window of similar length. Past it the platform
 * rejects the event, so an outcome older than this is not a failure to report —
 * it is a fact about what the platform will accept, and the screen says so
 * rather than showing a silent error.
 */
export const CLICK_ID_VALID_DAYS = 90

/**
 * Meta's click cookie, rebuilt from a raw `fbclid`.
 *
 * `_fbc` is what the Conversions API wants, and the browser only has it when
 * the Meta pixel has run and written the cookie. When a visitor arrives with
 * `fbclid` in the URL and the pixel has not written the cookie yet — an ad
 * blocker, a slow script, a first paint — the cookie is missing and the raw
 * parameter is right there in the address bar.
 *
 * Meta documents the format: `fb.<subdomain-index>.<timestamp-ms>.<fbclid>`,
 * with 1 as the subdomain index for a domain-level cookie. Rebuilding it is
 * not a trick; it is what Meta's own pixel does.
 */
export function fbcFrom(fbclid: string, atMs: number): string | null {
  const id = fbclid.trim()
  if (!id) return null
  if (!Number.isFinite(atMs) || atMs <= 0) return null
  return `fb.1.${Math.floor(atMs)}.${id}`
}

/** One visit's identifiers, as they can be read off a URL and a cookie jar. */
export interface ClickIdentity {
  /** Google's click id — whichever of the three arrived. */
  googleClickId: string | null
  /** Which parameter carried it, so an upload can name the right field. */
  googleClickIdKind: 'gclid' | 'gbraid' | 'wbraid' | null
  /** Meta's click cookie, from the jar or rebuilt from fbclid. */
  fbc: string | null
  /** Meta's browser id cookie. */
  fbp: string | null
}

export const EMPTY_IDENTITY: ClickIdentity = {
  googleClickId: null, googleClickIdKind: null, fbc: null, fbp: null,
}

/**
 * Read what this visit can prove about where it came from.
 *
 * `params` is the query string, `cookies` the jar. A missing value is null, not
 * an empty string: an empty string in a database column reads as "we captured
 * nothing here", which is indistinguishable from "we never looked", and those
 * two are different failures with different fixes.
 *
 * gclid is preferred over gbraid/wbraid when both are present, because it is
 * the one Google's offline upload accepts in every case; the other two exist
 * for traffic where gclid cannot be set, and are never both present with it in
 * practice.
 */
export function readClickIdentity(
  params: Record<string, string | undefined | null>,
  cookies: Record<string, string | undefined | null>,
  nowMs: number,
): ClickIdentity {
  const at = (k: string): string | null => {
    const v = params[k]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const cookie = (k: string): string | null => {
    const v = cookies[k]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }

  const gclid = at('gclid')
  const gbraid = at('gbraid')
  const wbraid = at('wbraid')
  const googleClickId = gclid ?? gbraid ?? wbraid
  const googleClickIdKind = gclid ? 'gclid' : gbraid ? 'gbraid' : wbraid ? 'wbraid' : null

  // The cookie first — it is what the pixel wrote and what Meta matches best.
  // The raw parameter is the fallback for the visit where the pixel had not
  // run yet, which is exactly the visit an ad blocker produces.
  const fbclid = at('fbclid')
  const fbc = cookie('_fbc') ?? (fbclid ? fbcFrom(fbclid, nowMs) : null)

  return { googleClickId, googleClickIdKind, fbc, fbp: cookie('_fbp') }
}

/** Did this visit leave anything at all to send an outcome back with? */
export const canReportBack = (i: ClickIdentity): boolean =>
  !!(i.googleClickId || i.fbc)

/**
 * Is this outcome still inside the window the platform will accept?
 *
 * `clickedAt` is when the lead arrived, which is the closest thing to the click
 * this product stores. An outcome outside the window is REFUSED here rather
 * than sent and silently dropped — a queue full of events the platform threw
 * away looks exactly like a queue that is working.
 */
export function withinUploadWindow(
  clickedAt: string | number | null,
  now: Date = new Date(),
): boolean {
  if (clickedAt === null) return false
  const t = typeof clickedAt === 'number' ? clickedAt : Date.parse(clickedAt)
  if (!Number.isFinite(t)) return false
  const days = (now.getTime() - t) / 86_400_000
  return days >= 0 && days <= CLICK_ID_VALID_DAYS
}

/**
 * The ValueTrack parameters a Google ad's tracking template must carry.
 *
 * `{gclid}` is not automatic. Auto-tagging puts a gclid on the landing URL only
 * when it is switched on in the account, and it is a setting somebody can turn
 * off — so the template asks for it explicitly rather than relying on an
 * account preference nobody in this product can see.
 */
export const GOOGLE_CLICK_TRACKING = 'gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}'
