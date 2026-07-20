// Buyer-intent vocabulary — Layer 4 (intent-differentiated landing experiences).
//
// ONE list, imported everywhere an intent is produced or consumed:
//   · the campaign wizard's "Buyer intent" picker (appends ?intent= to the ad's
//     landing URL via withIntent),
//   · the public landing page (app/lp/[slug]) which reorders/emphasizes its
//     REAL sections per intent,
//   · the LP tracker + /api/leads, which capture the clicked intent first-touch
//     and store it as freehold_site_leads.click_intent (declared intent from
//     the ad — distinct from the behaviour-derived buyer_intent).
//
// Pure module — safe to import from client components and edge/server code.

export const BUYER_INTENTS = [
  'investor',
  'end_user',
  'family',
  'luxury',
  'holiday',
  'rental_income',
  'first_time',
  'international',
] as const

export type BuyerIntent = (typeof BUYER_INTENTS)[number]

/** Tolerant parser: trims, lowercases, accepts dashes for underscores
    ("rental-income" → "rental_income"); anything else → null. */
export function parseIntent(v: string | null | undefined): BuyerIntent | null {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase().replace(/-/g, '_')
  return (BUYER_INTENTS as readonly string[]).includes(s) ? (s as BuyerIntent) : null
}

/** Append ?intent= to a landing URL safely (preserves existing query/hash;
    replaces any prior intent). No intent → the URL untouched. */
export function withIntent(url: string, intent: BuyerIntent | null | undefined | ''): string {
  if (!url || !intent) return url
  try {
    const u = new URL(url)
    u.searchParams.set('intent', intent)
    return u.toString()
  } catch {
    // Relative or non-standard URL — append conservatively, never twice.
    if (/[?&]intent=/.test(url)) return url.replace(/([?&]intent=)[^&#]*/, `$1${intent}`)
    return `${url}${url.includes('?') ? '&' : '?'}intent=${intent}`
  }
}
