/**
 * Trakheesi — Dubai's DET/RERA real-estate advertising permit.
 *
 * Every property advertisement published in Dubai (Meta, Google, portals, print)
 * must legally carry a valid Trakheesi advertising-permit number and a QR code
 * that resolves to the official DLD verification page for that permit. This
 * module is the single source of truth for how a permit is validated, how its
 * verification URL is formed, and how it is surfaced in ad copy — so the Ads
 * Machine never launches an ad that a regulator could pull.
 *
 * Pure + client-safe: no `qrcode` import here (that runs server-side in the QR
 * route). The value itself is real operator-entered data — never invented.
 */

/**
 * Accept a permit only if it looks like a real Trakheesi/DLD reference:
 * alphanumeric with dashes/slashes, 4–40 chars. Returns the trimmed value or
 * null — an empty or junk value is honestly "no permit", never a fake one.
 */
export function normalizePermit(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (s.length < 4 || s.length > 40) return null
  if (!/^[A-Za-z0-9][A-Za-z0-9\-/ ]*[A-Za-z0-9]$/.test(s)) return null
  return s
}

export function hasPermit(raw: unknown): boolean {
  return normalizePermit(raw) !== null
}

/* ── Permit VALIDITY ────────────────────────────────────────────────────────
 *
 * A Trakheesi permit is not permanent — DET issues it for a fixed window, and
 * an ad that keeps running past that window is as non-compliant as one that
 * never had a permit. The number alone therefore proves nothing about *today*;
 * the machine needs the expiry date to keep a launched campaign legal.
 *
 * Dates are compared on Dubai's calendar day, not the server's. Vercel crons
 * run in UTC, which is 4 hours behind Asia/Dubai — comparing UTC days would
 * treat a permit as still valid through the last four hours of the Dubai day
 * after it lapsed. On a compliance gate, that error must not exist.
 */

/** Warn this many days ahead of expiry, so a permit can be renewed before the
 *  machine has to stop the ads. */
export const PERMIT_EXPIRY_WARN_DAYS = 5

/** Today's date in Dubai as `YYYY-MM-DD`. `en-CA` formats exactly that way. */
export function dubaiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/**
 * Accept an expiry only as a real `YYYY-MM-DD` calendar date. Anything else —
 * blank, prose, an impossible date like 2026-02-31 — is null, i.e. honestly
 * "no expiry on file", never a guessed one.
 */
export function normalizePermitExpiry(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  // Round-trip through UTC to reject dates that don't exist on the calendar.
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10) === s ? s : null
}

/**
 * Whole days from today (Dubai) until the permit lapses. 0 = lapses today and
 * is still valid today; negative = already lapsed. null when no expiry is on
 * file — the caller must treat that as "unknown", never as "fine".
 */
export function permitDaysLeft(expiry: unknown, now: Date = new Date()): number | null {
  const e = normalizePermitExpiry(expiry)
  if (!e) return null
  const end = Date.parse(`${e}T00:00:00Z`)
  const today = Date.parse(`${dubaiToday(now)}T00:00:00Z`)
  return Math.round((end - today) / 86_400_000)
}

/**
 * True only when we KNOW the permit has lapsed. A permit is valid *through*
 * its expiry date, so it expires the day after. No expiry on file → false:
 * we cannot assert a lapse we have no evidence for (that case is surfaced as
 * a "no expiry on file" warning instead, so it is never silently ignored).
 */
export function isPermitExpired(expiry: unknown, now: Date = new Date()): boolean {
  const left = permitDaysLeft(expiry, now)
  return left !== null && left < 0
}

/** The permit string only when it is usable for advertising RIGHT NOW — a real
 *  permit number that is not known to have lapsed. The single check the Ads
 *  Machine uses before launching, reallocating into, or continuing a trial. */
export function usablePermit(permitRaw: unknown, expiryRaw: unknown, now: Date = new Date()): string | null {
  const permit = normalizePermit(permitRaw)
  if (!permit) return null
  return isPermitExpired(expiryRaw, now) ? null : permit
}

export type PermitState = 'ok' | 'expiring' | 'expired' | 'no_expiry' | 'missing'

/** How a project's permit stands today — one classification shared by the
 *  engine's gate and the operator-facing alert strip, so the dashboard can
 *  never disagree with what the machine actually did. */
export function permitState(permitRaw: unknown, expiryRaw: unknown, now: Date = new Date()): PermitState {
  if (!normalizePermit(permitRaw)) return 'missing'
  const left = permitDaysLeft(expiryRaw, now)
  if (left === null) return 'no_expiry'
  if (left < 0) return 'expired'
  return left <= PERMIT_EXPIRY_WARN_DAYS ? 'expiring' : 'ok'
}

/**
 * The public DLD "validate advertising permit" page, deep-linked to this
 * permit. The QR encodes this URL so a scan lands on the official verification
 * page. Centralised here so the exact validator URL is corrected in ONE place
 * if DLD changes it.
 */
export function permitVerificationUrl(permit: string): string {
  return `https://dubailand.gov.ae/en/eservices/validate-advertising-license/?permit=${encodeURIComponent(permit)}`
}

/** Server-rendered QR endpoint for this permit (used by <img src>). */
export function qrApiPath(permit: string): string {
  return `/api/freehold/trakheesi/qr?permit=${encodeURIComponent(permit)}`
}

/**
 * Append the legally-required permit reference to ad body copy, once. Used at
 * launch time so the permit number is visible in the ad's own text (the QR
 * lives on the creative / landing page).
 */
export function appendPermitToText(text: string, permit: string): string {
  const suffix = `Permit ${permit}`
  if (text.includes(permit)) return text
  return `${text.trim()} · ${suffix}`.trim()
}
