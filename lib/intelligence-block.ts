/**
 * THE PUBLIC MARKET WIDGET'S DATA — through lib/db, like everything else.
 *
 * This module opened its OWN porsager `postgres` client against
 * NEON_DATABASE_URL, bypassing the lib/db funnel that every other query in
 * this product goes through. The db-funnel guard carried it on an allowlist
 * rather than as a rule.
 *
 * That funnel is not bureaucracy: it is where pooling, the tenant schema and
 * error handling live. A second client is a second set of connections against
 * the same database and a second place any of those three can be got wrong.
 *
 * WRAPPED IN runWithDefaultSchema, deliberately. This widget is PUBLIC and
 * shows the shared catalogue — the same trending projects and area profiles
 * on every host. Without the wrapper a tenant host would read its own schema
 * and the public widget would quietly change per visitor. The old porsager
 * client had no schema notion at all, so this preserves its behaviour rather
 * than changing it, minus its blind spot for DB_SCHEMA.
 *
 * No request header is read here, so /api/intelligence-block keeps its static
 * ten-minute revalidate.
 */
import { query, runWithDefaultSchema } from '@/lib/db'

type TrendingRow = { name: string; slug: string; area: string; developer_name: string; price_from_aed: number; rental_yield: string | null; market_score: string | null; golden_visa_eligible: boolean; hero_image: string | null; pf_url: string | null; sort_score: string | null; safe_yield: string | null; flip: string | null; hotness: string | null }
type AreaRow = { name: string; slug: string; area_type: string | null; avg_yield: string | null; avg_score: string | null; project_count: number; image: string | null; video: string | null }
type PulseRow = { total_projects: string; area_count: string; avg_price_m: string | null; avg_yield: string | null; gv_count: string; selling: string; verified_listings: string }
type BelowMarketRow = { name: string; slug: string; area: string; price_from_aed: number; rental_yield: string | null; hero_image: string | null; vs_cohort: number | null; psf: number | null }

const EMPTY_RESULT = {
  trending: [] as TrendingRow[],
  best_areas: [] as AreaRow[],
  pulse: null,
  below_market: [] as BelowMarketRow[],
  generated_at: new Date().toISOString(),
}

export async function getIntelligenceBlockData() {
  try {
    return await runWithDefaultSchema(read)
  } catch {
    // A public widget must never take the homepage down. The old client
    // returned EMPTY_RESULT when no DB_URL was set; this covers that and an
    // unreachable database too.
    return EMPTY_RESULT
  }
}

async function read() {
  const [trending, bestAreas, pulse, belowMarket] = await Promise.all([
    query<TrendingRow>(`
      SELECT name, slug, area, developer_name,
             price_from_aed,
             COALESCE(
               rental_yield,
               NULLIF(payload->'investmentHighlights'->>'expectedROI', '')::float,
               NULLIF(payload->>'roi', '')::float
             ) AS rental_yield,
             market_score,
             golden_visa_eligible, hero_image,
             payload->>'pfUrl'       AS pf_url,
             payload->>'sortScore'   AS sort_score,
             payload->'investmentFlags'->>'safeYield'     AS safe_yield,
             payload->'investmentFlags'->>'flipOpportunity' AS flip,
             payload->>'hotness'     AS hotness
      FROM freehold_site_projects
      WHERE hero_image IS NOT NULL
        AND price_from_aed > 0
      ORDER BY COALESCE(market_score, NULLIF(payload->>'sortScore', '')::float) DESC NULLS LAST
      LIMIT 6
    `),
    query<AreaRow>(`
      SELECT name, slug, area_type, avg_yield, avg_score,
             project_count, image, payload->>'heroVideo' AS video
      FROM freehold_site_area_profiles
      WHERE avg_yield > 4 AND project_count >= 5
      ORDER BY avg_yield DESC
      LIMIT 4
    `),
    query<PulseRow>(`
      SELECT
        COUNT(*)                                               AS total_projects,
        COUNT(DISTINCT area)                                   AS area_count,
        ROUND(AVG(price_from_aed) / 1000000, 2)              AS avg_price_m,
        ROUND(CAST(AVG(COALESCE(
          rental_yield,
          NULLIF(payload->'investmentHighlights'->>'expectedROI', '')::float,
          NULLIF(payload->>'roi', '')::float
        )) AS numeric), 1)                                     AS avg_yield,
        SUM(CASE WHEN golden_visa_eligible THEN 1 ELSE 0 END) AS gv_count,
        COUNT(CASE WHEN status = 'selling' THEN 1 END)        AS selling,
        COUNT(CASE WHEN
          payload->>'mediaSource' IN (
            'propertyfinder-cdn','offplan-dubai-cdn','developer-cdn'
          ) THEN 1 END)                                        AS verified_listings
      FROM freehold_site_projects
    `),
    query<BelowMarketRow>(`
      SELECT name, slug, area, price_from_aed,
             COALESCE(
               rental_yield,
               NULLIF(payload->'investmentHighlights'->>'expectedROI', '')::float,
               NULLIF(payload->>'roi', '')::float
             ) AS rental_yield,
             hero_image,
             (payload->'priceIntelligence'->>'vsCohortPct')::float AS vs_cohort,
             (payload->'priceIntelligence'->>'pricePerSqft')::float AS psf
      FROM freehold_site_projects
      WHERE (payload->'priceIntelligence'->>'vsCohortPct')::float BETWEEN -50 AND -5
        AND price_from_aed > 0
        AND hero_image IS NOT NULL
      ORDER BY (payload->'priceIntelligence'->>'vsCohortPct')::float ASC
      LIMIT 4
    `),
  ])

  return {
    trending: trending.map((r) => ({ ...r, price_from_aed: Number(r.price_from_aed) })),
    best_areas: bestAreas,
    pulse: pulse[0],
    below_market: belowMarket.map((r) => ({ ...r, price_from_aed: Number(r.price_from_aed) })),
    generated_at: new Date().toISOString(),
  }
}
