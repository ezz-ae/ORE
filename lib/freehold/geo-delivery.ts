/**
 * DID THE MONEY GO WHERE IT WAS POINTED?
 *
 * A campaign targets the UAE. That is an instruction, not a receipt. Meta
 * delivers to people it believes are in the targeted locations, and the only
 * way to know whether that held is to read the country breakdown back and
 * compare it to what was asked for.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT.
 *
 * It is a delivery fact: where an impression was served, and what it cost.
 * The same kind of fact as the placement audit — is the money buying the
 * inventory it was meant to buy.
 *
 * It is NOT a statement about who anyone is. Meta's `country` breakdown is the
 * location an ad was shown in. It is not a nationality, it does not become one
 * by being counted, and nothing here or downstream may treat it as one. A
 * resident, a visitor and a citizen are the same row.
 *
 * The one question it answers: spend that landed outside the countries the
 * campaign was pointed at is money bought by mistake, and nothing in this
 * product could see it before.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

export interface CountryDelivery {
  country: string
  impressions: number
  spend: number
  leads: number
}

export interface GeoFinding {
  level: 'wrong' | 'watch' | 'ok'
  /** i18n key suffix under `lm.geo.` */
  key: string
  vars?: Record<string, string | number>
}

/**
 * Spend outside the targeted countries, above which it is worth saying.
 *
 * Not zero, deliberately. Meta's location inference is imperfect at the edges
 * — a traveller, a VPN, a phone on a foreign SIM — and a campaign that spent
 * one dirham of a thousand somewhere unexpected has not gone wrong. Below this
 * the honest report is silence, not a red row about noise.
 */
export const STRAY_SPEND_SHARE = 0.05

/** Nothing is judged on a handful of impressions. */
export const MIN_IMPRESSIONS_TO_JUDGE = 1000

export function checkGeoDelivery(input: {
  /** ISO country codes the campaign was pointed at. */
  targeted: string[]
  rows: CountryDelivery[]
}): GeoFinding[] {
  const targeted = new Set(input.targeted.map((c) => c.toUpperCase()).filter(Boolean))
  const rows = input.rows.filter((r) => r.country && r.country !== 'unknown')
  const totalImpressions = rows.reduce((n, r) => n + r.impressions, 0)
  const totalSpend = rows.reduce((n, r) => n + r.spend, 0)

  // No breakdown, or too little of it to mean anything. Meta not returning a
  // country breakdown is not evidence that delivery was clean.
  if (rows.length === 0 || totalImpressions < MIN_IMPRESSIONS_TO_JUDGE || totalSpend <= 0) return []

  // A campaign with no recorded targeting cannot have strayed from it. Saying
  // nothing is the honest answer; inventing an intended country is not.
  if (targeted.size === 0) return []

  const stray = rows.filter((r) => !targeted.has(r.country.toUpperCase()))
  const straySpend = stray.reduce((n, r) => n + r.spend, 0)
  const share = straySpend / totalSpend

  if (share < STRAY_SPEND_SHARE) {
    return [{ level: 'ok', key: 'onTarget', vars: { places: [...targeted].join(', ') } }]
  }

  // Name the biggest offender rather than a list — one place and one number is
  // something an operator can act on.
  const worst = [...stray].sort((a, b) => b.spend - a.spend)[0]
  return [{
    level: share >= STRAY_SPEND_SHARE * 3 ? 'wrong' : 'watch',
    key: 'strayed',
    vars: {
      pct: Math.round(share * 100),
      spend: Math.round(straySpend),
      where: worst?.country ?? '',
      places: [...targeted].join(', '),
    },
  }]
}
