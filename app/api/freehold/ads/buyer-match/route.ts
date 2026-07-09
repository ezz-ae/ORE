import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"
import { getInventoryPropertyBySlug } from "@/lib/inventory-data"
import { UAE_INTERESTS } from "@/lib/meta/targeting-catalog"
import { getReachEstimate, isMetaConfigured } from "@/lib/meta/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Buyer Match — the audience that actually buys THIS listing, built from the
// company's OWN closed deals + leads (which Meta can't see), anchored to the
// listing's price band, and finished with a LIVE Meta reach estimate.
//
// Every number here is real or honestly absent: if there are no closed deals in
// a band yet, we say so — we never invent a buyer profile.

type Band = { key: string; min: number; max: number; label: string; ageMin: number; ageMax: number; interestKeys: number[] }

// Price bands for Dubai freehold. interestKeys index into the proven UAE_INTERESTS
// catalog (real Meta interest ids) — higher bands skew to investment/luxury.
const BANDS: Band[] = [
  { key: "entry",   min: 0,        max: 1_000_000,  label: "Entry",         ageMin: 27, ageMax: 45, interestKeys: [1] },
  { key: "mid",     min: 1_000_000, max: 2_000_000, label: "Mid-market",    ageMin: 30, ageMax: 50, interestKeys: [0, 1] },
  { key: "premium", min: 2_000_000, max: 5_000_000, label: "Premium",       ageMin: 33, ageMax: 55, interestKeys: [0, 3] },
  { key: "luxury",  min: 5_000_000, max: 15_000_000, label: "Luxury",       ageMin: 35, ageMax: 60, interestKeys: [0, 2, 3] },
  { key: "ultra",   min: 15_000_000, max: Infinity, label: "Ultra-prime",   ageMin: 38, ageMax: 62, interestKeys: [2, 3] },
]

function bandForPrice(price: number): Band {
  return BANDS.find((b) => price >= b.min && price < b.max) ?? BANDS[2]
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0)

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const slug = typeof body.listingSlug === "string" ? body.listingSlug.trim() : ""
  let price = typeof body.price === "number" ? body.price : 0
  const countries = Array.isArray(body.countries) && body.countries.length ? (body.countries as string[]) : ["AE"]

  // Resolve the listing's real price if only a slug was given.
  let area = ""
  if (slug) {
    try {
      const prop = await getInventoryPropertyBySlug(slug)
      if (prop) { price = price || num(prop.startingPriceAED); area = String(prop.area || "") }
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
  const interests = band.interestKeys.map((i) => UAE_INTERESTS[i]).filter(Boolean)
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
        publisherPlatforms: ["facebook", "instagram"],
        interests,
      })
    : null

  const closeRate = leads.qualified > 0 ? Math.round((leads.closed / leads.qualified) * 100) : null

  return NextResponse.json({
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
  })
}
