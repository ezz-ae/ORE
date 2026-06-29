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
  hero_image: string | null
  payload: Record<string, unknown> | null
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

// A landing page's real, resolvable identity: its own slug (what /lp/[slug]
// looks up) plus whether it is published right now. The project slug a page is
// attached to is NOT what the public route resolves by, so we must carry the
// page's own slug to build a link that won't 404.
type LandingInfo = { slug: string; published: boolean }

function mapLandingStatus(landing: LandingInfo | undefined): LandingStatus {
  if (!landing) return 'missing'
  // Reflect the real publish state — never infer "live" from a heuristic score.
  return landing.published ? 'live' : 'pending_review'
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

function extractHandoverYear(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null
  const candidates = [
    payload.handoverDate,
    payload.handover,
    payload.completionDate,
    payload.completion,
    (payload.investmentHighlights as Record<string, unknown> | undefined)?.handover,
  ]
  for (const c of candidates) {
    if (!c) continue
    const str = String(c)
    // Match a 4-digit year (2024–2099)
    const yearMatch = str.match(/20[2-9]\d/)
    if (yearMatch) return Number(yearMatch[0])
    const parsed = new Date(str)
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear()
  }
  return null
}

function bedroomsLabel(unitTypes: string[]): string {
  const sorted = [...unitTypes].sort(
    (a, b) => (UNIT_ORDER[a] ?? 99) - (UNIT_ORDER[b] ?? 99),
  )
  if (sorted.length === 0) return '1BR–3BR'
  if (sorted.length === 1) return sorted[0]
  return `${sorted[0]}–${sorted[sorted.length - 1]}`
}

function mapRowToInventory(row: DBProjectRow, landingMap: Map<string, LandingInfo>, leadCounts: Map<string, number>): InventoryProperty {
  const score = Number(row.market_score) || 45
  const hasImages = !!row.hero_image
  const unitTypes = extractUnitTypes(row.payload)
  const paymentPlan = extractPaymentPlan(row.payload)
  const leads30d = leadCounts.get(row.slug) || 0
  const landing = landingMap.get(row.slug)
  const hasLanding = !!landing
  const handoverYear = extractHandoverYear(row.payload)

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
      dataQuality * 0.7 + (hasLanding ? 20 : 0) + (hasImages ? 10 : 0),
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
    handoverYear,
    paymentPlan,
    bedrooms: bedroomsLabel(unitTypes),
    totalUnits: null,
    availableUnits: null,
    sizeRange: '550–1,800 sqft',
    roi: row.rental_yield ? Number(row.rental_yield) : null,
    landingStatus: mapLandingStatus(landing),
    // Only link out when the page is actually published — the public /lp route
    // resolves by the page's own slug and 404s on drafts. Drafts render as a
    // non-clickable badge instead of a dead "Live ↗" link.
    landingUrl: landing?.published ? `/lp/${landing.slug}` : null,
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

// Only columns proven to exist on freehold_site_projects (mirrors lib/ore.ts).
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
  p.hero_image,
  p.payload
`

/**
 * Returns lead counts per project slug, guarded against missing table.
 */
async function getLeadCounts(): Promise<Map<string, number>> {
  try {
    const rows = await query<{ project_slug: string; leads_30d: number }>(
      `SELECT project_slug, COUNT(*)::int AS leads_30d
       FROM freehold_site_leads
       WHERE created_at > NOW() - INTERVAL '30 days'
         AND project_slug IS NOT NULL
       GROUP BY project_slug`,
    )
    return new Map(rows.map((r) => [r.project_slug, Number(r.leads_30d) || 0]))
  } catch {
    return new Map()
  }
}

/**
 * Maps each project slug to its landing page's own slug + live publish state.
 *
 * The public /lp/[slug] route resolves by the landing page's OWN slug (not the
 * project slug it is attached to) and serves only currently-published pages, so
 * we carry both pieces of truth here. A published page wins over a draft for the
 * same project. Isolated and guarded: the landing-pages table is created lazily
 * and may not exist on every database, so any failure yields an empty map
 * rather than breaking the inventory query.
 */
async function getLandingMap(): Promise<Map<string, LandingInfo>> {
  try {
    const rows = await query<{
      project_slug: string | null
      slug: string | null
      status: string | null
      publish_status: string | null
      publish_from: string | null
      publish_to: string | null
    }>(
      `SELECT project_slug, slug, status, publish_status, publish_from, publish_to
       FROM freehold_site_project_landing_pages
       WHERE project_slug IS NOT NULL AND slug IS NOT NULL`,
    )
    const now = Date.now()
    const map = new Map<string, LandingInfo>()
    for (const r of rows) {
      const projectSlug = r.project_slug
      const slug = r.slug
      if (!projectSlug || !slug) continue
      // Mirror lib/landing-pages.ts isPublishedNow: take the first NON-EMPTY of
      // status / publish_status (an empty-string status must fall through, not
      // count as present), so inventory's "live" matches what /lp actually serves.
      const rawStatus =
        [r.status, r.publish_status]
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .find((s) => s.length > 0) ?? ''
      const statusOk = ['published', 'active', 'live'].includes(rawStatus.toLowerCase())
      // Guard malformed dates: an unparseable bound is treated as "no bound"
      // (NaN), never as "window closed", matching toDate()'s null behaviour.
      const fromMs = r.publish_from ? new Date(r.publish_from).getTime() : NaN
      const toMs = r.publish_to ? new Date(r.publish_to).getTime() : NaN
      const from = Number.isNaN(fromMs) ? null : fromMs
      const to = Number.isNaN(toMs) ? null : toMs
      const published =
        statusOk &&
        (from === null || now >= from) &&
        (to === null || now <= to)
      const existing = map.get(projectSlug)
      // Prefer a published page over a draft for the same project.
      if (!existing || (published && !existing.published)) {
        map.set(projectSlug, { slug, published })
      }
    }
    return map
  } catch {
    return new Map()
  }
}

// ── Public query functions ────────────────────────────────────────────────────

/**
 * Fetch all inventory properties from Neon, ordered by market score.
 * Returns an empty array on DB failure so callers can gracefully fall back.
 */
export async function getInventoryPropertiesFromDB(): Promise<InventoryProperty[]> {
  try {
    const [rows, landingMap, leadCounts] = await Promise.all([
      query<DBProjectRow>(
        `SELECT ${SELECT_FIELDS}
         FROM freehold_site_projects p
         ORDER BY COALESCE(p.market_score, 0) DESC NULLS LAST
         LIMIT 500`,
      ),
      getLandingMap(),
      getLeadCounts(),
    ])
    return rows.map((row) => mapRowToInventory(row, landingMap, leadCounts))
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
    const [rows, landingMap, leadCounts] = await Promise.all([
      query<DBProjectRow>(
        `SELECT ${SELECT_FIELDS}
         FROM freehold_site_projects p
         WHERE lower(p.slug) = lower($1)
         LIMIT 1`,
        [slug],
      ),
      getLandingMap(),
      getLeadCounts(),
    ])
    return rows[0] ? mapRowToInventory(rows[0], landingMap, leadCounts) : null
  } catch (err) {
    console.error('[inventory-data] getInventoryPropertyBySlug failed', err)
    return null
  }
}
