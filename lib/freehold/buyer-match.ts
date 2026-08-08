/**
 * Buyer Match — the audience that actually buys THIS listing, built from the
 * company's OWN closed deals + leads (which Meta can't see), anchored to the
 * listing's price band, and finished with a LIVE Meta reach estimate.
 *
 * Extracted from app/api/freehold/ads/buyer-match/route.ts (which now calls
 * this) so server-side callers — the Ads Machine planner in particular — can
 * build a real, band-anchored targeting recommendation without an HTTP hop.
 *
 * Every number here is real or honestly absent: if there are no closed deals in
 * a band yet, we say so (hasData: false) — we never invent a buyer profile.
 */
import { query } from '@/lib/db'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { UAE_INTERESTS } from '@/lib/meta/targeting-catalog'
import { getReachEstimate, isMetaConfigured } from '@/lib/meta/client'

export type PriceBand = {
  key: string
  min: number
  max: number
  label: string
  ageMin: number
  ageMax: number
  /** Names into UAE_INTERESTS — NOT positions. A numeric index into a catalog
   *  that changes size (an id gets pulled the moment Meta rejects it — see
   *  targeting-catalog.ts) silently points at a different interest the next
   *  time an entry is added or removed. This is exactly what happened here
   *  once already: removing one dead id from the catalog shifted every band
   *  below it onto the wrong signal with no error anywhere. Names don't
   *  shift when the catalog does. */
  interestNames: string[]
}

// Price bands for Dubai freehold. interestNames name into the UAE_INTERESTS
// catalog (real Meta interest ids) — higher bands skew to investment/luxury.
export const PRICE_BANDS: PriceBand[] = [
  { key: 'entry',   min: 0,          max: 1_000_000,  label: 'Entry',       ageMin: 27, ageMax: 45, interestNames: ['Property'] },
  { key: 'mid',     min: 1_000_000,  max: 2_000_000,  label: 'Mid-market',  ageMin: 30, ageMax: 50, interestNames: ['Property', 'Investment'] },
  { key: 'premium', min: 2_000_000,  max: 5_000_000,  label: 'Premium',     ageMin: 33, ageMax: 55, interestNames: ['Investment'] },
  { key: 'luxury',  min: 5_000_000,  max: 15_000_000, label: 'Luxury',      ageMin: 35, ageMax: 60, interestNames: ['Luxury goods', 'Investment'] },
  { key: 'ultra',   min: 15_000_000, max: Infinity,   label: 'Ultra-prime', ageMin: 38, ageMax: 62, interestNames: ['Luxury goods', 'Investment'] },
]

export function bandForPrice(price: number): PriceBand {
  return PRICE_BANDS.find((b) => price >= b.min && price < b.max) ?? PRICE_BANDS[2]
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

export interface BuyerMatchProfile {
  band: { key: string; label: string; min: number; max: number | null }
  listing: { price: number; area: string }
  buyers: {
    deals: number
    avgValue: number
    totalValue: number
    topDevelopers: { name: string; count: number }[]
    leads: number
    qualified: number
    closed: number
    closeRate: number | null
    topSources: { source: string; count: number }[]
    /** Honest flag — false means we have NO real deal/lead signal in this band. */
    hasData: boolean
  }
  recommendation: {
    ageMin: number
    ageMax: number
    interestIds: string[]
    interestNames: string[]
  }
  estimate: { lower: number; upper: number; ready: boolean } | null
  metaConnected: boolean
}

/**
 * Build the full buyer-match profile for a listing (by slug and/or price).
 * Fail-soft everywhere: an unreachable DB yields an honest empty profile
 * (hasData: false), never a fabricated one. The returned object is EXACTLY
 * the JSON shape the buyer-match route has always responded with.
 */
export async function getBuyerMatchProfile(input: {
  listingSlug?: string
  price?: number
  countries?: string[]
}): Promise<BuyerMatchProfile> {
  const slug = (input.listingSlug ?? '').trim()
  let price = typeof input.price === 'number' ? input.price : 0
  const countries = Array.isArray(input.countries) && input.countries.length ? input.countries : ['AE']

  // Resolve the listing's real price if only a slug was given.
  let area = ''
  if (slug) {
    try {
      const prop = await getInventoryPropertyBySlug(slug)
      if (prop) { price = price || num(prop.startingPriceAED); area = String(prop.area || '') }
    } catch { /* fall through — price may still be provided */ }
  }
  const band = bandForPrice(price || 0)

  // ── Real buyer profile from the company's OWN closed deals in this band ──
  let deals = { count: 0, avgValue: 0, totalValue: 0, topDevelopers: [] as { name: string; count: number }[] }
  try {
    const [agg] = await query<{ c: number; avg: number; sum: number }>(
      `SELECT COUNT(*)::int AS c, COALESCE(AVG(property_value_aed),0)::float AS avg, COALESCE(SUM(property_value_aed),0)::float AS sum
       FROM freehold_site_deals
       WHERE status IN ('approved','closed') AND property_value_aed >= $1 AND property_value_aed < $2`,
      [band.min, band.max === Infinity ? 1e12 : band.max],
    )
    const devs = await query<{ name: string; count: number }>(
      `SELECT COALESCE(NULLIF(developer_name,''),'—') AS name, COUNT(*)::int AS count
       FROM freehold_site_deals
       WHERE status IN ('approved','closed') AND property_value_aed >= $1 AND property_value_aed < $2
       GROUP BY 1 ORDER BY count DESC LIMIT 3`,
      [band.min, band.max === Infinity ? 1e12 : band.max],
    )
    deals = { count: num(agg?.c), avgValue: Math.round(num(agg?.avg)), totalValue: Math.round(num(agg?.sum)), topDevelopers: devs }
  } catch { /* DB unreachable → honest empty profile */ }

  // ── Real lead signal in this band: which sources convert ──
  let leads = { count: 0, qualified: 0, closed: 0, topSources: [] as { source: string; count: number }[] }
  try {
    const [agg] = await query<{ c: number; q: number; cl: number }>(
      `SELECT COUNT(*)::int AS c,
              COUNT(*) FILTER (WHERE status IN ('qualified','viewing','negotiation','closed'))::int AS q,
              COUNT(*) FILTER (WHERE status = 'closed')::int AS cl
       FROM freehold_site_leads
       WHERE budget_aed >= $1 AND budget_aed < $2`,
      [band.min, band.max === Infinity ? 1e12 : band.max],
    )
    const srcs = await query<{ source: string; count: number }>(
      `SELECT COALESCE(NULLIF(source,''),'Direct') AS source, COUNT(*)::int AS count
       FROM freehold_site_leads
       WHERE budget_aed >= $1 AND budget_aed < $2
       GROUP BY 1 ORDER BY count DESC LIMIT 3`,
      [band.min, band.max === Infinity ? 1e12 : band.max],
    )
    leads = { count: num(agg?.c), qualified: num(agg?.q), closed: num(agg?.cl), topSources: srcs }
  } catch { /* fail-soft */ }

  // ── Recommended Meta spec for this band (real catalog interest ids) ──
  const interests = band.interestNames
    .map((name) => UAE_INTERESTS.find((i) => i.name === name))
    .filter((i): i is (typeof UAE_INTERESTS)[number] => !!i)
  const recommendation = {
    ageMin: band.ageMin,
    ageMax: band.ageMax,
    interestIds: interests.map((i) => i.id),
    interestNames: interests.map((i) => i.name),
  }

  // ── Live Meta reach estimate for that spec ──
  // metaConnected is decided by real creds, NOT by whether the estimate call
  // returned data — so a connected account whose estimate is momentarily
  // unavailable never sees a misleading "connect Meta".
  const metaConnected = await isMetaConfigured()
  const estimate = metaConnected
    ? await getReachEstimate({
        countries,
        cityKeys: [],
        ageMin: band.ageMin,
        ageMax: band.ageMax,
        publisherPlatforms: ['facebook', 'instagram'],
        interests,
      })
    : null

  const closeRate = leads.qualified > 0 ? Math.round((leads.closed / leads.qualified) * 100) : null

  return {
    band: { key: band.key, label: band.label, min: band.min, max: band.max === Infinity ? null : band.max },
    listing: { price, area },
    buyers: {
      deals: deals.count,
      avgValue: deals.avgValue,
      totalValue: deals.totalValue,
      topDevelopers: deals.topDevelopers,
      leads: leads.count,
      qualified: leads.qualified,
      closed: leads.closed,
      closeRate,
      topSources: leads.topSources,
      hasData: deals.count > 0 || leads.count > 0,
    },
    recommendation,
    estimate: estimate ? { lower: estimate.lower, upper: estimate.upper, ready: estimate.ready } : null,
    metaConnected,
  }
}
