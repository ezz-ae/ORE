import { query } from "@/lib/db"
import type {
  InventoryProperty,
  LandingStatus,
  PropertyStatus,
} from "@/src/features/freehold-intelligence/inventory"

// ── DB row shape ──────────────────────────────────────────────────────────────

type DBProjectRow = {
  id: string
  slug: string
  name: string
  area: string
  developer_name: string
  status: string | null
  price_from_aed: string | number | null
  price_to_aed: string | number | null
  rental_yield: string | null
  golden_visa_eligible: boolean
  market_score: string | null
  handover_date: string | null
  hero_image: string | null
  payload: Record<string, unknown> | null
  leads_30d: string | number
  has_landing: boolean
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapStatus(raw: string | null): PropertyStatus {
  if (!raw) return 'active'
  const s = raw.toLowerCase()
  if (s === 'selling' || s === 'ready') return 'ready'
  if (s === 'off-plan' || s === 'offplan') return 'off_plan'
  if (s === 'under-construction' || s === 'construction') return 'under_construction'
  if (s === 'coming-soon') return 'coming_soon'
  if (s === 'sold-out' || s === 'soldout') return 'sold_out'
  return 'active'
}

function mapLandingStatus(adReadiness: number, hasLanding: boolean): LandingStatus {
  if (!hasLanding) return 'missing'
  if (adReadiness >= 80) return 'live'
  if (adReadiness >= 55) return 'draft'
  return 'pending_review'
}

function extractPaymentPlan(payload: Record<string, unknown> | null): string | null {
  if (!payload?.paymentPlan) return null
  const pp = payload.paymentPlan
  if (typeof pp === 'string') return pp
  if (pp && typeof pp === 'object') {
    const r = pp as Record<string, unknown>
    return (r.description || r.summary || r.label) as string | null
  }
  return null
}

function extractUnitTypes(payload: Record<string, unknown> | null): string[] {
  if (!payload) return []
  if (Array.isArray(payload.unitTypes)) return payload.unitTypes as string[]
  if (Array.isArray(payload.units)) {
    return [
      ...new Set(
        (payload.units as Array<Record<string, unknown>>)
          .map((u) => u.type as string)
          .filter(Boolean),
      ),
    ]
  }
  return []
}

const UNIT_ORDER: Record<string, number> = {
  Studio: 0, '1BR': 1, '2BR': 2, '3BR': 3, '4BR': 4, '5BR': 5,
  Loft: 6, Townhouse: 7, Villa: 8, Penthouse: 9, Office: 10, Retail: 11,
}

function bedroomsLabel(unitTypes: string[]): string {
  const sorted = [...unitTypes].sort(
    (a, b) => (UNIT_ORDER[a] ?? 99) - (UNIT_ORDER[b] ?? 99),
  )
  if (sorted.length === 0) return '1BR–3BR'
  if (sorted.length === 1) return sorted[0]
  return `${sorted[0]}–${sorted[sorted.length - 1]}`
}

function mapRowToInventory(row: DBProjectRow): InventoryProperty {
  const score = Number(row.market_score) || 45
  const hasImages = !!row.hero_image
  const unitTypes = extractUnitTypes(row.payload)
  const paymentPlan = extractPaymentPlan(row.payload)
  const leads30d = Number(row.leads_30d) || 0

  // Composite scores
  const dataQuality = Math.min(
    100,
    Math.round(
      score * 0.5 +
        (hasImages ? 20 : 0) +
        (paymentPlan ? 10 : 0) +
        (row.price_from_aed ? 15 : 0) +
        (unitTypes.length > 0 ? 5 : 0),
    ),
  )
  const adReadiness = Math.min(
    100,
    Math.round(
      dataQuality * 0.7 + (row.has_landing ? 20 : 0) + (hasImages ? 10 : 0),
    ),
  )

  return {
    id: row.slug,
    slug: row.slug,
    name: row.name || 'Unnamed Property',
    area: row.area || 'Dubai',
    developer: row.developer_name || '',
    type: unitTypes.some((t) => /Villa/i.test(t))
      ? 'villa'
      : unitTypes.some((t) => /Townhouse/i.test(t))
        ? 'townhouse'
        : unitTypes.some((t) => /Penthouse/i.test(t))
          ? 'penthouse'
          : unitTypes.some((t) => /Office|Retail/i.test(t))
            ? 'commercial'
            : 'apartment',
    status: mapStatus(row.status),
    startingPriceAED: row.price_from_aed ? Number(row.price_from_aed) : null,
    maxPriceAED: row.price_to_aed ? Number(row.price_to_aed) : null,
    handoverYear: row.handover_date ? new Date(row.handover_date).getFullYear() : null,
    paymentPlan,
    bedrooms: bedroomsLabel(unitTypes),
    totalUnits: null,
    availableUnits: null,
    sizeRange: '550–1,800 sqft',
    roi: row.rental_yield ? Number(row.rental_yield) : null,
    landingStatus: mapLandingStatus(adReadiness, row.has_landing ?? false),
    landingUrl: row.has_landing ? `/lp/${row.slug}` : null,
    hasImages,
    imageCount: hasImages ? 1 : 0,
    dataQuality,
    adReadiness,
    linkedCampaigns: 0,
    leads30d,
    views30d: leads30d > 0 ? leads30d * 12 : 0,
    lastUpdated: new Date().toISOString().slice(0, 10),
    tags: row.golden_visa_eligible ? ['golden_visa'] : [],
  }
}

// ── Shared SQL fragments ──────────────────────────────────────────────────────

const SELECT_FIELDS = `
  p.id::text,
  p.slug,
  p.name,
  p.area,
  p.developer_name,
  p.status,
  p.price_from_aed,
  p.price_to_aed,
  p.rental_yield,
  p.golden_visa_eligible,
  p.market_score,
  p.handover_date,
  p.hero_image,
  p.payload,
  COALESCE(lc.leads_30d, 0) AS leads_30d,
  (lp.project_id IS NOT NULL) AS has_landing
`

const LEADS_JOIN = `
  LEFT JOIN (
    SELECT project_slug, COUNT(*)::int AS leads_30d
    FROM freehold_site_leads
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY project_slug
  ) lc ON lc.project_slug = p.slug
  LEFT JOIN freehold_site_project_landing_pages lp ON lp.project_id = p.id
`

// ── Public query functions ────────────────────────────────────────────────────

/**
 * Fetch all inventory properties from Neon, ordered by market score.
 * Returns an empty array on DB failure so callers can gracefully fall back.
 */
export async function getInventoryPropertiesFromDB(): Promise<InventoryProperty[]> {
  try {
    const rows = await query<DBProjectRow>(
      `SELECT ${SELECT_FIELDS}
       FROM freehold_site_projects p
       ${LEADS_JOIN}
       ORDER BY COALESCE(p.market_score, 0) DESC NULLS LAST
       LIMIT 500`,
    )
    return rows.map(mapRowToInventory)
  } catch (err) {
    console.error('[inventory-data] getInventoryPropertiesFromDB failed', err)
    return []
  }
}

/**
 * Fetch a single inventory property by slug.
 * Returns null if not found or on DB failure.
 */
export async function getInventoryPropertyBySlug(
  slug: string,
): Promise<InventoryProperty | null> {
  try {
    const rows = await query<DBProjectRow>(
      `SELECT ${SELECT_FIELDS}
       FROM freehold_site_projects p
       ${LEADS_JOIN}
       WHERE p.slug = $1
       LIMIT 1`,
      [slug],
    )
    return rows[0] ? mapRowToInventory(rows[0]) : null
  } catch (err) {
    console.error('[inventory-data] getInventoryPropertyBySlug failed', err)
    return null
  }
}
