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
