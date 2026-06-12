import { cache } from "react"
import { query } from "@/lib/db"

export interface MarketAreaStat {
  name: string
  pricePerSqft: number | null
  rentalYield: number | null
}

export interface MarketStats {
  /** Total projects in the public catalogue (same unfiltered count the /properties grid uses). */
  liveProjects: number | null
  /** Distinct areas with at least one mapped project. */
  areasCovered: number | null
  /** Average gross rental yield across publicly listed areas (null if unavailable or 0). */
  avgYield: number | null
  /** Developer profiles with at least one tracked project (same visibility filter as /developers). */
  developersTracked: number | null
  /** Top areas by project coverage, for the snapshot table. Empty if DB unavailable. */
  topAreas: MarketAreaStat[]
}

/**
 * Aggregate platform stats for marketing surfaces. Every query fails soft:
 * if the database is unreachable each stat resolves to null (or [] for areas)
 * so callers can render only the stats that exist — never a fake number.
 */
export const getMarketStats = cache(async (): Promise<MarketStats> => {
  const [liveProjects, areasCovered, avgYield, developersTracked, topAreas] = await Promise.all([
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM freehold_site_projects`,
    )
      .then((rows) => rows[0]?.total ?? null)
      .catch(() => null),
    query<{ total: number }>(
      `SELECT COUNT(DISTINCT area)::int AS total
       FROM freehold_site_projects
       WHERE area IS NOT NULL AND area <> ''`,
    )
      .then((rows) => rows[0]?.total ?? null)
      .catch(() => null),
    query<{ avg: number | null }>(
      `SELECT AVG(avg_yield)::float AS avg
       FROM freehold_site_area_profiles
       WHERE avg_yield > 0
         AND (NULLIF(payload->>'projectCount', '')::int > 0 OR project_count > 0)`,
    )
      .then((rows) => (rows[0]?.avg && rows[0].avg > 0 ? Number(rows[0].avg.toFixed(1)) : null))
      .catch(() => null),
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM freehold_site_developer_profiles
       WHERE NULLIF(payload->>'projectCount', '')::int > 0 OR NULLIF(payload->>'activeProjects', '')::int > 0`,
    )
      .then((rows) => rows[0]?.total ?? null)
      .catch(() => null),
    query<{ name: string; median_price_aed: number | null; avg_yield: number | null }>(
      `SELECT name, median_price_aed::float AS median_price_aed, avg_yield::float AS avg_yield
       FROM freehold_site_area_profiles
       WHERE avg_yield > 0
         AND (NULLIF(payload->>'projectCount', '')::int > 0 OR project_count > 0)
       ORDER BY NULLIF(payload->>'projectCount', '')::int DESC NULLS LAST, avg_yield DESC
       LIMIT 5`,
    )
      .then((rows) =>
        rows.map((row) => ({
          name: row.name,
          pricePerSqft: row.median_price_aed ? Number(row.median_price_aed) : null,
          rentalYield: row.avg_yield ? Number(Number(row.avg_yield).toFixed(1)) : null,
        })),
      )
      .catch(() => [] as MarketAreaStat[]),
  ])

  return {
    liveProjects: liveProjects || null,
    areasCovered: areasCovered || null,
    avgYield,
    developersTracked: developersTracked || null,
    topAreas,
  }
})

/** "3,512" -> "3,500+" (floor to the nearest 100). Counts under 100 render exactly. */
export function formatCompactCount(count: number): string {
  if (count < 100) return count.toLocaleString("en-US")
  const floored = Math.floor(count / 100) * 100
  return `${floored.toLocaleString("en-US")}+`
}
