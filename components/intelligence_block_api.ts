
// ─────────────────────────────────────────────────────────────────
// app/api/intelligence-block/route.ts
// Powers the homepage Intelligence Block
// Cache: 10 min (revalidate=600). No auth required.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server"
import postgres from "postgres"

export const revalidate = 600

const sql = postgres(process.env.NEON_DATABASE_URL!)

export async function GET() {
  const [trending, bestAreas, pulse, belowMarket] = await Promise.all([

    // 1. TRENDING — top sortScore, PF-verified images, off-plan
    sql`
      SELECT name, slug, area, developer_name,
             price_from_aed, rental_yield, market_score,
             golden_visa_eligible, hero_image,
             payload->>'pfUrl'       AS pf_url,
             payload->>'sortScore'   AS sort_score,
             payload->'investmentFlags'->>'safeYield'     AS safe_yield,
             payload->'investmentFlags'->>'flipOpportunity' AS flip,
             payload->>'hotness'     AS hotness
      FROM gc_projects
      WHERE hero_image IS NOT NULL
        AND price_from_aed > 0
      ORDER BY COALESCE(market_score, NULLIF(payload->>'sortScore', '')::float) DESC NULLS LAST
      LIMIT 6
    `,

    // 2. BEST YIELD AREAS — real area photos, min 5 projects
    sql`
      SELECT name, slug, area_type, avg_yield, avg_score,
             project_count, image, payload->>'heroVideo' AS video
      FROM gc_area_profiles
      WHERE avg_yield > 4 AND project_count >= 5 AND image IS NOT NULL
      ORDER BY avg_yield DESC
      LIMIT 4
    `,

    // 3. MARKET PULSE — single-row stats strip
    sql`
      SELECT
        COUNT(*)                                               AS total_projects,
        COUNT(DISTINCT area)                                   AS area_count,
        ROUND(AVG(price_from_aed) / 1000000, 2)              AS avg_price_m,
        ROUND(CAST(AVG(rental_yield) AS numeric), 1)          AS avg_yield,
        SUM(CASE WHEN golden_visa_eligible THEN 1 ELSE 0 END) AS gv_count,
        COUNT(CASE WHEN status = 'selling' THEN 1 END)        AS selling,
        COUNT(CASE WHEN
          payload->>'mediaSource' IN (
            'propertyfinder-cdn','offplan-dubai-cdn','developer-cdn'
          ) THEN 1 END)                                        AS verified_listings
      FROM gc_projects
    `,

    // 4. BELOW MARKET — priceIntelligence.vsCohortPct between -5% and -50%
    sql`
      SELECT name, slug, area, price_from_aed, rental_yield,
             hero_image,
             (payload->'priceIntelligence'->>'vsCohortPct')::float AS vs_cohort,
             (payload->'priceIntelligence'->>'pricePerSqft')::float AS psf
      FROM gc_projects
      WHERE (payload->'priceIntelligence'->>'vsCohortPct')::float BETWEEN -50 AND -5
        AND price_from_aed > 0
        AND hero_image IS NOT NULL
      ORDER BY (payload->'priceIntelligence'->>'vsCohortPct')::float ASC
      LIMIT 4
    `,
  ])

  return NextResponse.json({
    trending:     trending.map(r => ({ ...r, price_from_aed: Number(r.price_from_aed) })),
    best_areas:   bestAreas,
    pulse:        pulse[0],
    below_market: belowMarket,
    generated_at: new Date().toISOString(),
  })
}
