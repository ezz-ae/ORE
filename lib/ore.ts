import type { AreaProfile, DeveloperProfile, Project, Property } from "@/lib/types/project"
import { query } from "@/lib/db"
import { normalizeSlug } from "@/lib/utils/slug"

type ProjectRow = {
  id?: string
  slug?: string
  payload: Project
}

type ProjectListingRow = ProjectRow & {
  name?: string | null
  area?: string | null
  status?: string | null
  developer_name?: string | null
  hero_image?: string | null
  price_from_aed?: number | null
  price_to_aed?: number | null
  rental_yield?: number | null
  golden_visa_eligible?: boolean | null
}

type AreaRow = {
  slug: string
  name: string
  area_type: string | null
  avg_score: number | null
  median_price_aed: number | null
  project_count: number | null
  avg_yield: number | null
  image: string | null
  hero_video: string | null
  payload: {
    name?: string
    slug?: string
    image?: string
    areaType?: string
    avgScore?: number
    avgYield?: number
    heroVideo?: string
    whyInvest?: string[]
    description?: string
    projectCount?: number
    medianPriceAed?: number
    nearbyLandmarks?: Array<{ name: string; distance: string }>
  }
}

type DeveloperRow = {
  id: string
  slug: string
  name: string
  tier: string | null
  avg_score: number | null
  honesty_index: number | null
  risk_discount: boolean | null
  logo: string | null
  banner_image: string | null
  payload: {
    id?: string
    logo?: string
    name?: string
    slug?: string
    tier?: string
    awards?: string[]
    avgScore?: number
    bannerImage?: string
    description?: string
    trackRecord?: string
    honestyIndex?: number
    projectCount?: number
    riskDiscount?: boolean
    galleryImages?: string[]
    activeProjects?: number
    completedProjects?: number
    foundedYear?: number | string
    headquarters?: string
    website?: string
  }
}

const USD_RATE = 0.2723

const titleCase = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const slugToTitle = (value?: string) =>
  (value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue
    const cleaned = value.trim()
    if (cleaned) return cleaned
  }
  return ""
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const pickNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = toNumber(value)
    if (parsed != null) return parsed
  }
  return null
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const normalizeCategory = (value: unknown): Property["category"] => {
  const normalized = pickString(value).toLowerCase()
  if (!normalized) return "apartment"
  if (normalized.includes("villa")) return "villa"
  if (normalized.includes("townhouse")) return "townhouse"
  if (normalized.includes("penthouse")) return "penthouse"
  if (normalized.includes("office")) return "office"
  if (normalized.includes("retail")) return "retail"
  if (normalized.includes("warehouse")) return "warehouse"
  return "apartment"
}

const normalizeRiskClass = (value: unknown): Property["riskClass"] => {
  const normalized = pickString(value).toLowerCase()
  if (normalized === "low" || normalized === "moderate" || normalized === "high") return normalized
  return null
}

const normalizePropertyStatus = (value: unknown): Property["status"] => {
  const normalized = pickString(value).toLowerCase()
  if (
    normalized === "available" ||
    normalized === "reserved" ||
    normalized === "sold" ||
    normalized === "selling" ||
    normalized === "launching" ||
    normalized === "upcoming" ||
    normalized === "completed" ||
    normalized === "sold-out"
  ) {
    return normalized
  }
  return "selling"
}

const getTableColumns = async (tableName: string) => {
  const rows = await query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = $1`,
    [tableName],
  )
  return new Set(rows.map((row) => row.column_name))
}

const parseBedrooms = (unitType?: string) => {
  if (!unitType) return 1
  const normalized = unitType.toLowerCase()
  if (normalized.includes("studio")) return 0
  const match = normalized.match(/(\\d+)/)
  return match ? Number(match[1]) : 1
}

const SORT_SCORE_ORDER =
  "COALESCE(market_score, NULLIF(payload->>'sortScore', '')::numeric) DESC NULLS LAST"
const LISTING_AREA_SQL =
  "COALESCE(NULLIF(payload->'location'->>'area', ''), NULLIF(payload->>'area', ''), area, 'Dubai')"
const LISTING_DEVELOPER_SQL =
  "COALESCE(NULLIF(payload->'developer'->>'name', ''), NULLIF(payload->>'developer', ''), developer_name, '')"
const LISTING_PRICE_SQL =
  "COALESCE(price_from_aed, price_to_aed, NULLIF(payload->>'priceFrom', '')::numeric, NULLIF(payload->>'price_from_aed', '')::numeric, NULLIF(payload->'price'->>'fromAed', '')::numeric, NULLIF(payload->'units'->0->>'priceFrom', '')::numeric, 0)"
const LISTING_STATUS_SQL = "COALESCE(NULLIF(payload->>'status', ''), status, 'selling')"
const LISTING_PROPERTY_TYPE_SQL =
  "COALESCE(NULLIF(payload->>'propertyType', ''), NULLIF(payload->>'category', ''), NULLIF(payload->>'type', ''))"
const LISTING_ROI_SQL =
  "COALESCE(NULLIF(payload->>'roi', '')::numeric, NULLIF(payload->'investmentHighlights'->>'expectedROI', '')::numeric, rental_yield)"
const LISTING_UNITS_ARRAY_SQL =
  "CASE WHEN jsonb_typeof(payload->'units') = 'array' THEN payload->'units' ELSE '[]'::jsonb END"
const unitBedroomsExpression = (unitAlias = "unit") => `(
  CASE
    WHEN lower(COALESCE(${unitAlias}->>'bedrooms', '')) = 'studio' THEN 0
    WHEN COALESCE(${unitAlias}->>'bedrooms', '') ~ '^[0-9]+$' THEN (${unitAlias}->>'bedrooms')::int
    WHEN lower(COALESCE(${unitAlias}->>'type', '')) LIKE '%studio%' THEN 0
    WHEN COALESCE(${unitAlias}->>'type', '') ~ '[0-9]+' THEN substring(${unitAlias}->>'type' from '[0-9]+')::int
    ELSE NULL
  END
)`

export const projectToProperty = (project: Project): Property => {
  const projectRecord = project as unknown as Record<string, unknown>
  const projectLocationRecord = toRecord(projectRecord.location)
  const projectCoordinatesRecord = toRecord(projectLocationRecord?.coordinates)
  const payloadPaymentPlanRecord = toRecord(projectRecord.paymentPlan)
  const primaryUnit = project.units?.[0]
  const safeLocation = project.location || ({} as Project["location"])
  const safeDeveloper = project.developer || ({} as Project["developer"])
  const safeInvestment = project.investmentHighlights || ({} as Project["investmentHighlights"])
  const safeTimeline = project.timeline || ({} as Project["timeline"])
  const area = pickString(safeLocation.area, projectLocationRecord?.area, projectRecord.area, "Dubai")
  const district = pickString(safeLocation.district, projectLocationRecord?.district, area, "Dubai")
  const city = pickString(safeLocation.city, projectLocationRecord?.city, projectRecord.city, "Dubai")
  const coordinates = {
    lat: pickNumber(safeLocation.coordinates?.lat, projectCoordinatesRecord?.lat, projectRecord.lat) ?? 0,
    lng: pickNumber(safeLocation.coordinates?.lng, projectCoordinatesRecord?.lng, projectRecord.lng) ?? 0,
  }
  const freehold =
    typeof safeLocation.freehold === "boolean"
      ? safeLocation.freehold
      : typeof projectLocationRecord?.freehold === "boolean"
        ? (projectLocationRecord.freehold as boolean)
        : true
  const developerId = safeDeveloper.id || project.id || "developer"
  const developerName = pickString(
    safeDeveloper.name,
    toRecord(projectRecord.developer)?.name,
    projectRecord.developer_name,
    projectRecord.developer,
    "ORE",
  )
  const developerSlug = safeDeveloper.slug || normalizeSlug(developerName) || "ore"
  const developerLogo = safeDeveloper.pfLogo || safeDeveloper.logo || "/logo.png"
  const bedrooms =
    typeof primaryUnit?.bedrooms === "number"
      ? primaryUnit.bedrooms
      : parseBedrooms(primaryUnit?.type)
  const unitBaths =
    typeof primaryUnit?.baths === "number"
      ? primaryUnit.baths
      : typeof primaryUnit?.bathrooms === "number"
        ? primaryUnit.bathrooms
        : undefined
  const bathrooms = typeof unitBaths === "number" ? unitBaths : Math.max(1, bedrooms)
  const sizeSqft = primaryUnit?.sizeFrom ?? 900
  const sizeSqm = Math.round(sizeSqft * 0.0929)
  const projectName =
    pickString(
      project.name,
      projectRecord.projectName,
      projectRecord.title,
      projectRecord.pfName,
      projectRecord.pfTitle,
      slugToTitle(project.slug),
    ) || "Property"
  const fallbackPriceFromRecord = (() => {
    const priceNode = projectRecord.price as
      | { fromAed?: unknown; fromAED?: unknown; from?: unknown; min?: unknown }
      | undefined
    return pickNumber(
      projectRecord.price_from_aed,
      projectRecord.priceFromAed,
      projectRecord.priceFromAED,
      projectRecord.priceFrom,
      priceNode?.fromAed,
      priceNode?.fromAED,
      priceNode?.from,
      priceNode?.min,
    )
  })()
  const price = pickNumber(primaryUnit?.priceFrom, primaryUnit?.priceTo, fallbackPriceFromRecord) ?? 0
  const propertyType = pickString(projectRecord.propertyType, projectRecord.category, primaryUnit?.type) || null
  const category = normalizeCategory(propertyType)
  const roi = pickNumber(projectRecord.roi, safeInvestment.expectedROI)
  const rentalYield = pickNumber(projectRecord.rentalYield, safeInvestment.rentalYield)
  const constructionProgress = pickNumber(projectRecord.constructionProgress, safeTimeline.progressPercentage)
  const investorScore = pickNumber(projectRecord.investorScore)
  const riskClass = normalizeRiskClass(projectRecord.riskClass)
  const status = normalizePropertyStatus(projectRecord.status || project.status)
  const rawPaymentPlan = payloadPaymentPlanRecord || toRecord(project.paymentPlan)
  const paymentPlanDescription = pickString(rawPaymentPlan?.description)
  const paymentPlan = rawPaymentPlan
    ? {
        downPayment: pickNumber(rawPaymentPlan.downPayment) ?? 0,
        duringConstruction: pickNumber(rawPaymentPlan.duringConstruction) ?? 0,
        onHandover: pickNumber(rawPaymentPlan.onHandover) ?? 0,
        postHandover: pickNumber(rawPaymentPlan.postHandover) ?? 0,
        description:
          paymentPlanDescription ||
          `${pickNumber(rawPaymentPlan.downPayment) ?? 0}% down / ${pickNumber(rawPaymentPlan.duringConstruction) ?? 0}% during construction / ${pickNumber(rawPaymentPlan.onHandover) ?? 0}% on handover`,
      }
    : null
  const heroImage = project.mediaSource?.heroImage || project.heroImage
  const gallery =
    Array.isArray(project.mediaSource?.gallery) && project.mediaSource?.gallery?.length
      ? project.mediaSource?.gallery
      : project.gallery

  const projectUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://orerealestate.ae"}/projects/${project.slug || normalizeSlug(projectName)}`

  return {
    id: project.id || project.slug || normalizeSlug(projectName) || "property",
    title: projectName,
    slug: project.slug || normalizeSlug(projectName) || "property",
    type: "off-plan",
    category,
    price,
    currency: "AED",
    location: {
      area,
      district,
      city,
      coordinates,
      freehold,
    },
    specifications: {
      bedrooms,
      bathrooms,
      sizeSqft,
      sizeSqm,
      parkingSpaces: bedrooms > 2 ? 2 : 1,
      furnished: false,
      view: project.tagline || "City view",
    },
    images: gallery?.length ? gallery : heroImage ? [heroImage] : [],
    roi,
    rentalYield,
    paymentPlan,
    constructionProgress,
    investorScore,
    riskClass,
    propertyType,
    developerName: developerName || null,
    video: project.heroVideo,
    virtualTour: project.virtualTour,
    description: project.description || `${projectName} in ${area}, Dubai.`,
    highlights: project.highlights || [],
    amenities: project.amenities || [],
    developer: {
      ...safeDeveloper,
      id: safeDeveloper.id || developerId,
      name: safeDeveloper.name || developerName,
      slug: safeDeveloper.slug || developerSlug,
      logo: developerLogo,
    },
    project: {
      id: project.id || project.slug || normalizeSlug(projectName) || "property",
      name: projectName,
      slug: project.slug || normalizeSlug(projectName) || "property",
    },
    projectUrl,
    investmentMetrics: {
      roi: roi ?? 0,
      rentalYield: rentalYield ?? 0,
      appreciationRate: rentalYield ?? 0,
      goldenVisaEligible: safeInvestment.goldenVisaEligible ?? false,
    },
    completionDate: safeTimeline.expectedCompletion,
    handoverDate: safeTimeline.handoverDate,
    status,
    featured: project.featured,
    seoTitle: project.seoTitle || projectName,
    seoDescription: project.seoDescription || project.description || `${projectName} in Dubai.`,
    seoKeywords: project.seoKeywords || [],
    nearbyLandmarks: safeLocation.nearbyLandmarks?.map((landmark) => ({
      name: landmark.name,
      distance: landmark.distance,
    })),
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || new Date().toISOString(),
  }
}

const normalizeProjectPayload = (row: ProjectRow) => {
  const payload = row.payload || ({} as Project)
  const payloadRecord = payload as unknown as Record<string, unknown>
  const rowRecord = row as ProjectListingRow
  const mediaHero = payload.mediaSource?.heroImage
  const mediaGallery =
    Array.isArray(payload.mediaSource?.gallery) && payload.mediaSource?.gallery.length
      ? payload.mediaSource.gallery
      : undefined
  const primaryUnit = Array.isArray(payload.units) ? payload.units[0] : undefined
  const priceNode = payloadRecord.price as
    | { fromAed?: unknown; fromAED?: unknown; from?: unknown; min?: unknown; toAed?: unknown; max?: unknown }
    | undefined
  const priceFrom = pickNumber(
    primaryUnit?.priceFrom,
    primaryUnit?.priceTo,
    payloadRecord.price_from_aed,
    payloadRecord.priceFromAed,
    payloadRecord.priceFromAED,
    payloadRecord.priceFrom,
    priceNode?.fromAed,
    priceNode?.fromAED,
    priceNode?.from,
    priceNode?.min,
    rowRecord.price_from_aed,
  )
  const priceTo = pickNumber(
    primaryUnit?.priceTo,
    payloadRecord.price_to_aed,
    payloadRecord.priceToAed,
    payloadRecord.priceToAED,
    payloadRecord.priceTo,
    priceNode?.toAed,
    priceNode?.max,
    rowRecord.price_to_aed,
    priceFrom,
  )
  const canonicalSlug =
    pickString(payload.slug, payloadRecord.slugified, payloadRecord.pfSlug, row.slug) ||
    normalizeSlug(pickString(payload.name, rowRecord.name, payloadRecord.projectName, payloadRecord.title))
  const canonicalName =
    pickString(
      payload.name,
      rowRecord.name,
      payloadRecord.projectName,
      payloadRecord.title,
      payloadRecord.pfName,
      payloadRecord.pfTitle,
      slugToTitle(canonicalSlug),
    ) || "Property"
  const canonicalHero =
    pickString(payload.heroImage, mediaHero, rowRecord.hero_image, payloadRecord.ogImage, payloadRecord.og_image) ||
    "/logo.png"
  const fallbackUnits = Array.isArray(payload.units) && payload.units.length > 0
    ? payload.units
    : priceFrom != null
      ? [
          {
            type: "Residence",
            bedrooms: 1,
            baths: 1,
            bathrooms: 1,
            priceFrom,
            priceTo: priceTo ?? priceFrom,
            sizeFrom: 900,
            sizeTo: 900,
            available: 1,
            floorPlan: "",
          },
        ]
      : []
  return {
    ...payload,
    id: payload.id || row.id || canonicalSlug || "",
    name: canonicalName,
    slug: canonicalSlug,
    heroImage: canonicalHero,
    gallery: mediaGallery || payload.gallery || (canonicalHero ? [canonicalHero] : []),
    units: fallbackUnits,
  }
}

const normalizeListingProject = (row: ProjectListingRow) => {
  const payload = normalizeProjectPayload(row)
  const payloadRecord = payload as unknown as Record<string, unknown>
  const payloadLocationRecord = toRecord(payloadRecord.location)
  const payloadDeveloperRecord = toRecord(payloadRecord.developer)
  const primaryUnit = Array.isArray(payload.units) ? payload.units[0] : undefined
  const rowSlug = pickString(row.slug, payload.slug, payloadRecord.pfSlug)
  const resolvedName =
    pickString(
      row.name,
      payload.name,
      payloadRecord.projectName,
      payloadRecord.title,
      payloadRecord.pfName,
      payloadRecord.pfTitle,
      slugToTitle(rowSlug),
    ) || "Property"
  const from = pickNumber(
    row.price_from_aed,
    primaryUnit?.priceFrom,
    primaryUnit?.priceTo,
    payloadRecord.price_from_aed,
    payloadRecord.priceFromAed,
    payloadRecord.priceFromAED,
    payloadRecord.priceFrom,
  )
  const to = pickNumber(
    row.price_to_aed,
    primaryUnit?.priceTo,
    payloadRecord.price_to_aed,
    payloadRecord.priceToAed,
    payloadRecord.priceToAED,
    payloadRecord.priceTo,
    from,
  )
  const enriched = {
    ...payload,
    name: resolvedName,
    status:
      pickString(payload.status, payloadRecord.status, row.status, "selling") as Project["status"],
    tagline: payload.tagline || (row.area ? `${row.area} · Dubai` : "Dubai property"),
    heroImage: pickString(payload.heroImage, row.hero_image) || "/logo.png",
  } as Project

  const location = enriched.location || ({} as Project["location"])
  const resolvedArea = pickString(location.area, payloadLocationRecord?.area, payloadRecord.area, row.area, "Dubai")
  enriched.location = {
    ...location,
    area: resolvedArea,
    district: pickString(location.district, payloadLocationRecord?.district, resolvedArea, "Dubai"),
    city: pickString(location.city, payloadLocationRecord?.city, payloadRecord.city, "Dubai"),
    coordinates: location.coordinates || { lat: 0, lng: 0 },
    freehold: typeof location.freehold === "boolean" ? location.freehold : true,
    nearbyLandmarks: Array.isArray(location.nearbyLandmarks) ? location.nearbyLandmarks : [],
  }

  const developerName = pickString(
    enriched.developer?.name,
    payloadDeveloperRecord?.name,
    row.developer_name,
    payloadRecord.developerName,
    payloadRecord.developer,
    "ORE",
  )
  enriched.developer = {
    ...(enriched.developer || {}),
    id: pickString(enriched.developer?.id, payloadDeveloperRecord?.id, normalizeSlug(developerName), "developer"),
    name: developerName,
    slug: pickString(
      enriched.developer?.slug,
      payloadDeveloperRecord?.slug,
      normalizeSlug(developerName),
      "ore",
    ),
    logo: pickString(enriched.developer?.logo, payloadDeveloperRecord?.logo, "/logo.png"),
    description: pickString(enriched.developer?.description, "Developer profile"),
    trackRecord: pickString(enriched.developer?.trackRecord, "Strong delivery track record in Dubai."),
  }

  const hasUnits = Array.isArray(enriched.units) && enriched.units.length > 0
  if (!hasUnits && from != null) {
    enriched.units = [
      {
        type: "Residence",
        bedrooms: 1,
        baths: 1,
        bathrooms: 1,
        priceFrom: from,
        priceTo: to ?? from,
        sizeFrom: 900,
        sizeTo: 900,
        available: 1,
        floorPlan: "",
      },
    ]
  } else if (hasUnits && from != null && enriched.units?.[0]) {
    const nextUnits = [...enriched.units]
    const first = { ...nextUnits[0] }
    first.priceFrom = pickNumber(first.priceFrom, from) ?? 0
    first.priceTo = pickNumber(first.priceTo, to, first.priceFrom) ?? first.priceFrom
    first.type = pickString(first.type, first.bedrooms === 0 ? "Studio" : "Residence") || "Residence"
    nextUnits[0] = first
    enriched.units = nextUnits
  }

  const investment = enriched.investmentHighlights || ({} as Project["investmentHighlights"])
  const safeYield = pickNumber(row.rental_yield, payloadRecord.rentalYield) ?? 0
  const safeRoi = pickNumber(payloadRecord.roi, investment.expectedROI, safeYield) ?? safeYield
  enriched.investmentHighlights = {
    expectedROI: safeRoi,
    rentalYield: pickNumber(investment.rentalYield, safeYield) ?? safeYield,
    goldenVisaEligible:
      typeof investment.goldenVisaEligible === "boolean"
        ? investment.goldenVisaEligible
        : Boolean(row.golden_visa_eligible),
    paymentPlanAvailable: investment.paymentPlanAvailable ?? false,
  }

  return enriched
}

const mapAreaRow = (row: AreaRow): AreaProfile => {
  const payload = row.payload || {}
  const rawSlug = payload.slug || row.slug || payload.name || row.name || ""
  const slug = normalizeSlug(rawSlug)
  const areaType = payload.areaType || row.area_type || "urban"
  const lifestyleTags = [titleCase(areaType)]

  return {
    id: slug || payload.slug || row.slug,
    name: payload.name || row.name,
    slug: slug || payload.slug || row.slug,
    image: row.image || payload.image || "/logo.png",
    heroVideo: payload.heroVideo || row.hero_video || undefined,
    description: payload.description || "Dubai community overview.",
    avgPricePerSqft: Number(payload.medianPriceAed || row.median_price_aed || 0),
    rentalYield: Number(payload.avgYield || row.avg_yield || 0),
    investmentScore: Number(payload.avgScore || row.avg_score || 0),
    freehold: true,
    landmarks:
      payload.nearbyLandmarks?.map((landmark) => ({
        name: landmark.name,
        distance: landmark.distance,
        type: "mall",
      })) || [],
    investmentReasons: payload.whyInvest || [],
    lifestyleTags,
    propertyCount: Number(payload.projectCount || row.project_count || 0),
  }
}

const mapDeveloperRow = (row: DeveloperRow): DeveloperProfile => {
  const payload = row.payload || {}
  const rawDeveloperSlug = payload.slug || row.slug || payload.name || row.name || ""
  const normalizedDeveloperSlug = normalizeSlug(rawDeveloperSlug)
  const finalSlug = normalizedDeveloperSlug || (payload.slug || row.slug || rawDeveloperSlug)
  return {
    id: payload.id || row.id,
    name: payload.name || row.name,
    slug: finalSlug,
    tier: payload.tier || row.tier || undefined,
    logo: payload.logo || row.logo || "/logo.png",
    bannerImage: payload.bannerImage || row.banner_image || "/logo.png",
    galleryImages: payload.galleryImages || [payload.bannerImage || row.banner_image || "/logo.png"],
    description: payload.description || "Developer profile overview.",
    trackRecord: payload.trackRecord || "Strong delivery track record in Dubai.",
    awards: payload.awards || [],
    website: payload.website || undefined,
    foundedYear: payload.foundedYear ? Number(payload.foundedYear) : undefined,
    headquarters: payload.headquarters || undefined,
    activeProjects: payload.activeProjects ? Number(payload.activeProjects) : undefined,
    completedProjects: payload.completedProjects ? Number(payload.completedProjects) : undefined,
    projectCount: payload.projectCount ? Number(payload.projectCount) : undefined,
  }
}

export async function getProjectsForGrid(limit = 50) {
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload
     FROM gc_projects
     WHERE status = 'selling'
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $1`,
    [limit],
  )
  return rows.map((row) => normalizeProjectPayload(row))
}

export async function getAdjacentProjectSlugs(slug: string) {
  const rows = await query<{ prev_slug: string | null; next_slug: string | null }>(
    `
      WITH ordered AS (
        SELECT slug,
               payload->>'slug' AS payload_slug,
               lag(slug) OVER (ORDER BY ${SORT_SCORE_ORDER}) AS prev_slug,
               lead(slug) OVER (ORDER BY ${SORT_SCORE_ORDER}) AS next_slug,
               row_number() OVER (ORDER BY ${SORT_SCORE_ORDER}) AS idx
        FROM gc_projects
        WHERE status = 'selling'
      )
      SELECT prev_slug, next_slug
      FROM ordered
      WHERE slug = $1 OR payload_slug = $1
      LIMIT 1
    `,
    [slug],
  )
  return rows[0] || { prev_slug: null, next_slug: null }
}

export async function getProjectBySlug(slug: string) {
  const cleanSlug = slug.trim().toLowerCase()
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload
     FROM gc_projects
     WHERE lower(slug) = $1
        OR lower(payload->>'slug') = $1
        OR lower(payload->>'slugified') = $1
        OR lower(payload->>'pfSlug') = $1
     LIMIT 1`,
    [cleanSlug],
  )
  return rows[0] ? normalizeProjectPayload(rows[0]) : null
}

export async function getProperties(limit = 12) {
  const rows = await query<ProjectListingRow>(
    `SELECT id, slug, payload, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
     FROM gc_projects
     WHERE status = 'selling'
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $1`,
    [limit],
  )
  return rows.map((row) => projectToProperty(normalizeListingProject(row)))
}

export async function getFeaturedProperties(limit = 3) {
  const rows = await query<ProjectListingRow>(
    `SELECT id, slug, payload, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
     FROM gc_projects
     WHERE status = 'selling'
       AND featured = true
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $1`,
    [limit],
  )

  return rows.map((row) => projectToProperty(normalizeListingProject(row)))
}

export interface PropertyListingFilters {
  page?: number
  pageSize?: number
  sort?: "score" | "newest" | "price-low" | "price-high" | "roi" | "yield"
  areas?: string[]
  developer?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: string[]
  propertyType?: string
  status?: string
  freeholdOnly?: boolean
  goldenVisa?: boolean
}

const buildPropertyListingWhere = (filters: PropertyListingFilters, values: Array<string | number>) => {
  const where: string[] = []

  if (filters.areas?.length) {
    const areaClauses = filters.areas.map((area) => {
      values.push(`%${area}%`)
      return `${LISTING_AREA_SQL} ILIKE $${values.length}`
    })
    where.push(`(${areaClauses.join(" OR ")})`)
  }

  if (filters.developer && filters.developer !== "All Developers") {
    values.push(`%${filters.developer}%`)
    where.push(`${LISTING_DEVELOPER_SQL} ILIKE $${values.length}`)
  }

  if (typeof filters.minPrice === "number") {
    values.push(filters.minPrice)
    where.push(`${LISTING_PRICE_SQL} >= $${values.length}`)
  }

  if (typeof filters.maxPrice === "number") {
    values.push(filters.maxPrice)
    where.push(`${LISTING_PRICE_SQL} <= $${values.length}`)
  }

  if (filters.goldenVisa) {
    where.push(`golden_visa_eligible = true`)
  }

  if (filters.freeholdOnly) {
    where.push(`(payload->'location'->>'freehold')::boolean = true`)
  }

  if (filters.propertyType && filters.propertyType !== "All Types") {
    values.push(`%${filters.propertyType.toLowerCase()}%`)
    where.push(
      `(lower(${LISTING_PROPERTY_TYPE_SQL}) LIKE $${values.length}
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(${LISTING_UNITS_ARRAY_SQL}) AS unit WHERE lower(unit->>'type') LIKE $${values.length}))`,
    )
  }

  if (filters.bedrooms?.length) {
    const unitBedroomsSql = unitBedroomsExpression("unit")
    const bedClauses = filters.bedrooms.map((bed) => {
      if (bed.toLowerCase() === "studio") {
        return `${unitBedroomsSql} = 0`
      }
      if (bed === "5+") {
        return `${unitBedroomsSql} >= 5`
      }
      const bedNumber = Number(bed)
      if (Number.isFinite(bedNumber)) {
        values.push(bedNumber)
        return `${unitBedroomsSql} = $${values.length}`
      }
      return "false"
    })
    where.push(
      `EXISTS (SELECT 1 FROM jsonb_array_elements(${LISTING_UNITS_ARRAY_SQL}) AS unit WHERE ${bedClauses.join(" OR ")})`,
    )
  }

  if (filters.status && filters.status !== "All Statuses") {
    values.push(filters.status)
    where.push(`lower(${LISTING_STATUS_SQL}) = lower($${values.length})`)
  }

  return where
}

export async function getPropertyListing(filters: PropertyListingFilters) {
  const pageSize = Math.max(1, filters.pageSize || 12)
  const page = Math.max(1, filters.page || 1)
  const offset = (page - 1) * pageSize
  const hasActiveFilters =
    Boolean(filters.areas?.length) ||
    Boolean(filters.developer && filters.developer !== "All Developers") ||
    Boolean(filters.bedrooms?.length) ||
    Boolean(filters.propertyType && filters.propertyType !== "All Types") ||
    Boolean(filters.status && filters.status !== "All Statuses") ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.freeholdOnly ||
    filters.goldenVisa

  const usesFeaturedFirstPage =
    page === 1 && !hasActiveFilters && (!filters.sort || filters.sort === "score")

  if (usesFeaturedFirstPage) {
    const featuredRows = await query<ProjectListingRow>(
      `SELECT id, slug, payload, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
       FROM gc_projects
       WHERE featured = true
       ORDER BY ${SORT_SCORE_ORDER}
       LIMIT $1`,
      [pageSize],
    )

    let rows = featuredRows
    const remaining = pageSize - featuredRows.length
    if (remaining > 0) {
      const fallbackRows = await query<ProjectListingRow>(
        `SELECT id, slug, payload, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
         FROM gc_projects
         WHERE (featured IS DISTINCT FROM true)
         ORDER BY ${SORT_SCORE_ORDER}
         LIMIT $1`,
        [remaining],
      )
      rows = [...featuredRows, ...fallbackRows]
    }

    const countRows = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM gc_projects`,
    )
    const total = countRows[0]?.total ?? rows.length
    return {
      total,
      properties: rows.map((row) => projectToProperty(normalizeListingProject(row))),
    }
  }

  const values: Array<string | number> = []
  const where = buildPropertyListingWhere(filters, values)
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : ""

  let orderBy = SORT_SCORE_ORDER
  switch (filters.sort) {
    case "score":
      orderBy = SORT_SCORE_ORDER
      break
    case "newest":
      orderBy = "created_at DESC NULLS LAST"
      break
    case "price-low":
      orderBy = `${LISTING_PRICE_SQL} ASC NULLS LAST`
      break
    case "price-high":
      orderBy = `${LISTING_PRICE_SQL} DESC NULLS LAST`
      break
    case "roi":
      orderBy = `${LISTING_ROI_SQL} DESC NULLS LAST`
      break
    case "yield":
      orderBy = "rental_yield DESC NULLS LAST"
      break
    default:
      break
  }

  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM gc_projects ${whereClause}`,
    values,
  )
  const total = countRows[0]?.total || 0

  values.push(pageSize, offset)
  const rows = await query<ProjectListingRow>(
    `SELECT id, slug, payload, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
     FROM gc_projects
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )

  return {
    total,
    properties: rows.map((row) => projectToProperty(normalizeListingProject(row))),
  }
}

export async function getPropertiesByArea(area: string, limit = 12) {
  const rows = await query<ProjectListingRow>(
    `SELECT id, slug, payload, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
     FROM gc_projects
     WHERE ${LISTING_AREA_SQL} ILIKE $1
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $2`,
    [`%${area}%`, limit],
  )
  return rows.map((row) => projectToProperty(normalizeListingProject(row)))
}

export async function getPropertyBySlug(slug: string) {
  const cleanSlug = slug.trim().toLowerCase()
  const rows = await query<ProjectListingRow>(
    `SELECT id, slug, payload, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
     FROM gc_projects
     WHERE lower(slug) = $1
        OR lower(payload->>'slug') = $1
        OR lower(payload->>'slugified') = $1
        OR lower(payload->>'pfSlug') = $1
     LIMIT 1`,
    [cleanSlug],
  )
  if (!rows[0]?.payload) return null
  return projectToProperty(normalizeListingProject(rows[0]))
}

export async function getAreas() {
  const rows = await query<AreaRow>(
    `SELECT slug, name, area_type, avg_score, median_price_aed, project_count, avg_yield, image, hero_video, payload 
     FROM gc_area_profiles 
     WHERE (payload->>'projectCount')::int > 0 OR project_count > 0
     ORDER BY (payload->>'projectCount')::int DESC NULLS LAST, avg_yield DESC`,
  )
  return rows.map(mapAreaRow)
}

export async function getAreaBySlug(slug: string) {
  const cleanSlug = normalizeSlug(slug)
  if (!cleanSlug) return null
  const rows = await query<AreaRow>(
    `SELECT slug, name, area_type, avg_score, median_price_aed, project_count, avg_yield, image, hero_video, payload
     FROM gc_area_profiles
     WHERE lower(slug) = $1
        OR lower(payload->>'slug') = $1
        OR lower(REGEXP_REPLACE(payload->>'slug', '[^a-z0-9]+', '-', 'g')) = $1
        OR lower(REGEXP_REPLACE(payload->>'name', '[^a-z0-9]+', '-', 'g')) = $1
        OR lower(REGEXP_REPLACE(name, '[^a-z0-9]+', '-', 'g')) = $1
     LIMIT 1`,
    [cleanSlug],
  )
  return rows[0] ? mapAreaRow(rows[0]) : null
}

export async function getDevelopers() {
  const rows = await query<DeveloperRow>(
    `SELECT id, slug, name, tier, avg_score, honesty_index, risk_discount, logo, banner_image, payload 
     FROM gc_developer_profiles 
     WHERE (payload->>'projectCount')::int > 0 OR (payload->>'activeProjects')::int > 0
     ORDER BY (payload->>'projectCount')::int DESC NULLS LAST, avg_score DESC`,
  )
  return rows.map(mapDeveloperRow)
}

export async function getDeveloperBySlug(slug: string) {
  const cleanSlug = normalizeSlug(slug)
  if (!cleanSlug) return null
  const rows = await query<DeveloperRow>(
    `SELECT id, slug, name, tier, avg_score, honesty_index, risk_discount, logo, banner_image, payload
     FROM gc_developer_profiles
     WHERE lower(slug) = $1
        OR lower(payload->>'slug') = $1
        OR lower(REGEXP_REPLACE(payload->>'slug', '[^a-z0-9]+', '-', 'g')) = $1
        OR lower(REGEXP_REPLACE(payload->>'name', '[^a-z0-9]+', '-', 'g')) = $1
        OR lower(REGEXP_REPLACE(name, '[^a-z0-9]+', '-', 'g')) = $1
     LIMIT 1`,
    [cleanSlug],
  )
  return rows[0] ? mapDeveloperRow(rows[0]) : null
}

export async function searchProjects(queryText: string, limit = 5) {
  const q = `%${queryText}%`
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload
     FROM gc_projects
     WHERE name ILIKE $1 OR area ILIKE $1 OR developer_name ILIKE $1 OR slug ILIKE $1 OR payload->>'slug' ILIKE $1
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $2`,
    [q, limit],
  )
  return rows.map((row) => normalizeProjectPayload(row))
}

export async function getTopROIProjects(limit = 5) {
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload FROM gc_projects ORDER BY rental_yield DESC LIMIT $1`,
    [limit],
  )
  return rows.map((row) => normalizeProjectPayload(row))
}

export async function getGoldenVisaProjects(limit = 5) {
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload
     FROM gc_projects
     WHERE golden_visa_eligible = true
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $1`,
    [limit],
  )
  return rows.map((row) => normalizeProjectPayload(row))
}

export async function getProjectsByArea(area: string, limit = 5) {
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload
     FROM gc_projects
     WHERE area ILIKE $1
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $2`,
    [`%${area}%`, limit],
  )
  return rows.map((row) => normalizeProjectPayload(row))
}

export async function getProjectsByDeveloper(developerName: string, limit = 6) {
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload
     FROM gc_projects
     WHERE developer_name ILIKE $1
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $2`,
    [`%${developerName}%`, limit],
  )
  return rows.map((row) => normalizeProjectPayload(row))
}

export async function getPropertiesByDeveloper(developerName: string, limit = 6) {
  const rows = await query<ProjectListingRow>(
    `SELECT id, slug, payload, name, area, status, hero_image, price_from_aed, price_to_aed, rental_yield, golden_visa_eligible
     FROM gc_projects
     WHERE developer_name ILIKE $1
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $2`,
    [`%${developerName}%`, limit],
  )
  return rows.map((row) => projectToProperty(normalizeListingProject(row)))
}

export async function getProjectsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return []
  const rows = await query<ProjectRow>(
    `SELECT id, slug, payload FROM gc_projects WHERE slug = ANY($1::text[]) OR payload->>'slug' = ANY($1::text[])`,
    [slugs],
  )
  return rows.map((row) => normalizeProjectPayload(row))
}

export async function getLlmContextByArea(area: string, limit = 8) {
  const rows = await query<{ llm_context: string }>(
    `SELECT llm_context
     FROM gc_projects
     WHERE area ILIKE $1
     ORDER BY ${SORT_SCORE_ORDER}
     LIMIT $2`,
    [`%${area}%`, limit],
  )
  return rows.map((row) => row.llm_context).filter(Boolean).join("\n\n")
}

export interface DeveloperStats {
  listings: number
  active: number
  completed: number
  avgYield: number
  avgScore: number
  goldenVisaCount: number
  minPrice: number
  maxPrice: number
  onTimeDeliveryRate: number | null
  firstProjectYear: number | null
  topAreas: Array<{ area: string; count: number }>
  flagshipProjects: Array<{ id: string; slug: string; name: string; marketScore: number | null }>
}

export async function getDeveloperStats(developerName: string): Promise<DeveloperStats> {
  const rows = await query<{
    listings: number
    active: number
    completed: number
    avg_yield: number | null
    avg_score: number | null
    golden_visa_count: number
    min_price: number | null
    max_price: number | null
    on_time_rate: number | null
    first_project_date: string | null
  }>(
    `SELECT
      COUNT(*)::int AS listings,
      COUNT(*) FILTER (WHERE status IN ('selling','launching'))::int AS active,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      AVG(rental_yield)::float AS avg_yield,
      AVG(market_score)::float AS avg_score,
      COUNT(*) FILTER (WHERE golden_visa_eligible = true)::int AS golden_visa_count,
      MIN(price_from_aed)::float AS min_price,
      MAX(price_to_aed)::float AS max_price,
      MIN(COALESCE(handover_date, created_at::timestamptz)) AS first_project_date,
      CASE
        WHEN COUNT(*) FILTER (WHERE status = 'completed') = 0 THEN NULL
        ELSE (
          COUNT(*) FILTER (
            WHERE status = 'completed' AND handover_date IS NOT NULL AND handover_date <= CURRENT_DATE
          )::float
          / COUNT(*) FILTER (WHERE status = 'completed')::float
        ) * 100
      END AS on_time_rate
     FROM gc_projects
     WHERE developer_name ILIKE $1`,
    [`%${developerName}%`],
  )

  const stats = rows[0] || {
    listings: 0,
    active: 0,
    completed: 0,
    avg_yield: 0,
    avg_score: 0,
    golden_visa_count: 0,
    min_price: 0,
    max_price: 0,
    on_time_rate: null,
    first_project_date: null,
  }

  const areaRows = await query<{ area: string; count: number }>(
    `SELECT area, COUNT(*)::int AS count
     FROM gc_projects
     WHERE developer_name ILIKE $1 AND area IS NOT NULL
     GROUP BY area
     ORDER BY count DESC
     LIMIT 5`,
    [`%${developerName}%`],
  )

  const flagshipRows = await query<{ id: string; slug: string; name: string; market_score: number | null }>(
    `SELECT id, slug, name, market_score
     FROM gc_projects
     WHERE developer_name ILIKE $1
     ORDER BY market_score DESC NULLS LAST
     LIMIT 3`,
    [`%${developerName}%`],
  )

  const firstProjectYear = stats.first_project_date
    ? new Date(stats.first_project_date).getFullYear()
    : null

  return {
    listings: stats.listings,
    active: stats.active,
    completed: stats.completed,
    avgYield: stats.avg_yield ? Number(stats.avg_yield.toFixed(2)) : 0,
    avgScore: stats.avg_score ? Number(stats.avg_score.toFixed(1)) : 0,
    goldenVisaCount: stats.golden_visa_count,
    minPrice: stats.min_price ? Number(stats.min_price) : 0,
    maxPrice: stats.max_price ? Number(stats.max_price) : 0,
    onTimeDeliveryRate: stats.on_time_rate ? Number(stats.on_time_rate.toFixed(1)) : null,
    firstProjectYear,
    topAreas: areaRows.map((row) => ({ area: row.area, count: row.count })),
    flagshipProjects: flagshipRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      marketScore: row.market_score,
    })),
  }
}

export interface LeadRecord {
  id: string
  name: string
  phone: string
  email?: string | null
  source?: string | null
  project_slug?: string | null
  assigned_broker_id?: string | null
  status?: string | null
  priority?: string | null
  last_contact_at?: string | null
  country?: string | null
  budget_aed?: number | null
  interest?: string | null
  created_at: string
}

export interface DashboardKpis {
  todaysLeads: number
  assignedThisWeek: number
  activeInquiries: number
  scheduledViewings: number
  pipelineValue: number
  unassignedLeads: number
}

export interface HotLead extends LeadRecord {
  score: number
}

export interface ProjectPerformance {
  id: string
  slug: string
  name: string
  area: string | null
  marketScore: number | null
  expectedRoi: number | null
  rentalYield: number | null
}

export interface DashboardOverviewData {
  kpis: DashboardKpis
  hotLeads: HotLead[]
  topProjects: ProjectPerformance[]
  recentLeads: LeadRecord[]
}

export interface LeadSourceSummary {
  source: string
  count: number
}

export interface AreaPerformanceSummary {
  area: string
  count: number
}

export interface BrokerPerformanceSummary {
  brokerId: string
  brokerName: string
  count: number
}

export interface AnalyticsOverview {
  leadSources: LeadSourceSummary[]
  areaPerformance: AreaPerformanceSummary[]
  brokerPerformance: BrokerPerformanceSummary[]
  topProjects: ProjectPerformance[]
  pipelineValue: number
  landingPageViews: number
  landingPageSubmissions: number
  landingPageCount: number
}

export interface DashboardProjectRow {
  id: string
  slug: string
  name: string
  area: string | null
  status: string | null
  developerName: string | null
  priceFrom: number | null
  priceTo: number | null
  marketScore: number | null
  expectedRoi: number | null
  rentalYield: number | null
  unitsAvailable: number
}

export interface DashboardProjectFilters {
  page?: number
  pageSize?: number
  search?: string
  area?: string
  developer?: string
  status?: string
  minPrice?: number
  maxPrice?: number
  minRoi?: number
  sort?: "market" | "price-low" | "price-high" | "roi"
}

export interface DashboardProjectInput {
  slug: string
  name: string
  area?: string | null
  developer?: string | null
  status?: string | null
  priceFrom?: number | null
  priceTo?: number | null
  roi?: number | null
  paymentPlan?: string | null
  handoverDate?: string | null
  description?: string | null
  highlights?: string[]
  amenities?: string[]
  heroImage?: string | null
  featured?: boolean
}

export interface DashboardProjectEditorRecord {
  id: string
  slug: string
  name: string
  area: string | null
  developer: string | null
  status: string | null
  priceFrom: number | null
  priceTo: number | null
  roi: number | null
  paymentPlan: string | null
  handoverDate: string | null
  description: string | null
  highlights: string[]
  amenities: string[]
  heroImage: string | null
  featured: boolean
}

export interface BlogPostSummary {
  id: string
  slug: string
  title: string
  excerpt: string | null
  hero_image: string | null
  category: string | null
  author: string | null
  published_at: string | null
  read_time: number | null
  featured: boolean | null
}

export interface BlogPost extends BlogPostSummary {
  body: string | null
  tags: unknown
  payload: unknown
}

export async function getBlogPosts(limit = 12, offset = 0) {
  const rows = await query<BlogPostSummary>(
    `SELECT id, slug, title, excerpt, hero_image, category, author, published_at, read_time, featured
     FROM gc_blog_posts
     ORDER BY featured DESC NULLS LAST, published_at DESC NULLS LAST, created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows
}

export async function getFeaturedBlogPosts(limit = 6) {
  const rows = await query<BlogPostSummary>(
    `SELECT id, slug, title, excerpt, hero_image, category, author, published_at, read_time, featured
     FROM gc_blog_posts
     WHERE featured = true
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [limit],
  )
  return rows
}

const HOMEPAGE_BLOG_KEYWORDS = [
  "%market%",
  "%investment%",
  "%investor%",
  "%roi%",
  "%yield%",
  "%rental%",
  "%dubai%",
  "%property%",
  "%real estate%",
  "%off-plan%",
  "%golden visa%",
  "%trend%",
  "%analysis%",
  "%guide%",
  "%finance%",
  "%regulation%",
]

const HOMEPAGE_BLOG_EXCLUDES = [
  "%thanksgiving%",
  "%christmas%",
  "%holiday%",
  "%eid%",
  "%ramadan%",
  "%new year%",
  "%valentine%",
  "%national day%",
]

export async function getHomepageBlogPosts(limit = 6) {
  const primaryRows = await query<BlogPostSummary>(
    `SELECT id, slug, title, excerpt, hero_image, category, author, published_at, read_time, featured
     FROM gc_blog_posts
     WHERE hero_image IS NOT NULL
       AND hero_image <> ''
       AND (
         title ILIKE ANY($1)
         OR excerpt ILIKE ANY($1)
         OR category ILIKE ANY($1)
       )
       AND NOT (
         title ILIKE ANY($2)
         OR excerpt ILIKE ANY($2)
       )
     ORDER BY featured DESC NULLS LAST, published_at DESC NULLS LAST, created_at DESC
     LIMIT $3`,
    [HOMEPAGE_BLOG_KEYWORDS, HOMEPAGE_BLOG_EXCLUDES, limit],
  )

  if (primaryRows.length >= limit) return primaryRows

  const excludeIds = primaryRows.map((row) => row.id)
  const remaining = limit - primaryRows.length
  const fallbackRows = await query<BlogPostSummary>(
    `SELECT id, slug, title, excerpt, hero_image, category, author, published_at, read_time, featured
     FROM gc_blog_posts
     WHERE hero_image IS NOT NULL
       AND hero_image <> ''
       AND NOT (
         title ILIKE ANY($1)
         OR excerpt ILIKE ANY($1)
       )
       AND id <> ALL($2::text[])
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $3`,
    [HOMEPAGE_BLOG_EXCLUDES, excludeIds, remaining],
  )

  return [...primaryRows, ...fallbackRows]
}

export async function getBlogPostBySlug(slug: string) {
  const rows = await query<BlogPost>(
    `SELECT id, slug, title, excerpt, body, hero_image, category, author, published_at, read_time, tags, payload
     FROM gc_blog_posts
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  )
  return rows[0] || null
}

export async function ensureLeadsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_leads (
      id text PRIMARY KEY,
      name text,
      phone text,
      email text,
      source text,
      project_slug text,
      assigned_broker_id text,
      created_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    ALTER TABLE gc_leads
      ADD COLUMN IF NOT EXISTS assigned_broker_id text,
      ADD COLUMN IF NOT EXISTS status text,
      ADD COLUMN IF NOT EXISTS priority text,
      ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
      ADD COLUMN IF NOT EXISTS country text,
      ADD COLUMN IF NOT EXISTS budget_aed numeric,
      ADD COLUMN IF NOT EXISTS interest text,
      ADD COLUMN IF NOT EXISTS message text,
      ADD COLUMN IF NOT EXISTS landing_slug text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS ai_ack_sent_at timestamptz,
      ADD COLUMN IF NOT EXISTS ai_ack_project_slug text,
      ADD COLUMN IF NOT EXISTS ai_broker_notified_at timestamptz
  `)
}

export interface LeadActivityRecord {
  id: string
  lead_id: string
  activity_type: string
  description: string | null
  created_by: string | null
  created_at: string
}

export async function ensureLeadActivityTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_lead_activity (
      id text PRIMARY KEY,
      lead_id text REFERENCES gc_leads(id) ON DELETE CASCADE,
      activity_type text,
      description text,
      created_by text,
      created_at timestamptz DEFAULT now()
    )
  `)
}

const scoreLead = (lead: LeadRecord) => {
  let score = 0
  if (lead.email) score += 2
  if (lead.phone) score += 2
  if (lead.project_slug) score += 3
  if (lead.source) score += 1
  if (lead.assigned_broker_id) score += 2
  if (lead.budget_aed && lead.budget_aed > 2000000) score += 2
  const createdAt = new Date(lead.created_at)
  if (Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000) score += 2
  return score
}

const priorityFromScore = (score: number) => {
  if (score >= 8) return "hot"
  if (score >= 5) return "warm"
  return "cold"
}

const applyLeadDefaults = (lead: LeadRecord): LeadRecord => {
  const status = lead.status || (lead.assigned_broker_id ? "contacted" : "new")
  const score = scoreLead({ ...lead, status })
  return {
    ...lead,
    status,
    priority: lead.priority || priorityFromScore(score),
  }
}

export async function getLeadById(id: string) {
  await ensureLeadsTable()
  const rows = await query<LeadRecord>(
    `SELECT id, name, phone, email, source, project_slug, assigned_broker_id, status, priority,
            last_contact_at, country, budget_aed, interest, created_at
     FROM gc_leads
     WHERE id = $1
     LIMIT 1`,
    [id],
  )
  return rows[0] ? applyLeadDefaults(rows[0]) : null
}

export async function getLeadActivity(leadId: string) {
  await ensureLeadActivityTable()
  return query<LeadActivityRecord>(
    `SELECT id, lead_id, activity_type, description, created_by, created_at
     FROM gc_lead_activity
     WHERE lead_id = $1
     ORDER BY created_at DESC`,
    [leadId],
  )
}

export async function getLeads(role: "admin" | "broker", brokerId?: string) {
  await ensureLeadsTable()
  if (role === "broker" && brokerId) {
    const rows = await query<LeadRecord>(
      `SELECT id, name, phone, email, source, project_slug, assigned_broker_id, status, priority,
              last_contact_at, country, budget_aed, interest, created_at
       FROM gc_leads
       WHERE assigned_broker_id = $1
       ORDER BY created_at DESC`,
      [brokerId],
    )
    return rows.map(applyLeadDefaults)
  }

  const rows = await query<LeadRecord>(
    `SELECT id, name, phone, email, source, project_slug, assigned_broker_id, status, priority,
            last_contact_at, country, budget_aed, interest, created_at
     FROM gc_leads
     ORDER BY created_at DESC`,
  )
  return rows.map(applyLeadDefaults)
}

export async function searchCrmLeads(
  term: string,
  role: "admin" | "broker",
  brokerId?: string,
  limit = 10,
) {
  await ensureLeadsTable()
  const filter = buildLeadFilter("l", role, brokerId)
  const values = [...filter.params]
  let whereClause = filter.clause

  const trimmed = term.trim()
  if (trimmed) {
    values.push(`%${trimmed}%`)
    whereClause += ` AND (
      l.name ILIKE $${values.length}
      OR COALESCE(l.email, '') ILIKE $${values.length}
      OR COALESCE(l.phone, '') ILIKE $${values.length}
      OR COALESCE(l.project_slug, '') ILIKE $${values.length}
      OR COALESCE(l.source, '') ILIKE $${values.length}
    )`
  }

  values.push(limit)
  const rows = await query<LeadRecord>(
    `SELECT l.id, l.name, l.phone, l.email, l.source, l.project_slug, l.assigned_broker_id, l.status, l.priority,
            l.last_contact_at, l.country, l.budget_aed, l.interest, l.created_at
     FROM gc_leads l
     WHERE ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${values.length}`,
    values,
  )
  return rows.map(applyLeadDefaults)
}

export function toUSD(aed: number) {
  return Math.round(aed * USD_RATE)
}

const buildLeadFilter = (alias: string, role: "admin" | "broker", brokerId?: string) => {
  if (role === "broker" && brokerId) {
    return { clause: `${alias}.assigned_broker_id = $1`, params: [brokerId] }
  }
  return { clause: "TRUE", params: [] as Array<string | number> }
}

export type AccessRole = "admin" | "broker"

export const resolveAccessRole = (role?: string | null): AccessRole => {
  const normalized = String(role || "").toLowerCase()
  return normalized === "broker" ? "broker" : "admin"
}

export async function getRecentLeads(limit = 5, role: "admin" | "broker" = "admin", brokerId?: string) {
  await ensureLeadsTable()
  const filter = buildLeadFilter("l", role, brokerId)
  const params = [...filter.params, limit]
  const rows = await query<LeadRecord>(
    `SELECT l.id, l.name, l.phone, l.email, l.source, l.project_slug, l.assigned_broker_id, l.status, l.priority,
            l.last_contact_at, l.country, l.budget_aed, l.interest, l.created_at
     FROM gc_leads l
     WHERE ${filter.clause}
     ORDER BY l.created_at DESC
     LIMIT $${params.length}`,
    params,
  )
  return rows.map(applyLeadDefaults)
}

export async function getDashboardOverviewData(
  role: "admin" | "broker" = "admin",
  brokerId?: string,
): Promise<DashboardOverviewData> {
  await ensureLeadsTable()
  const filter = buildLeadFilter("l", role, brokerId)
  const params = filter.params

  const [todays] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM gc_leads l
     WHERE ${filter.clause}
       AND l.created_at >= CURRENT_DATE`,
    params,
  )

  const [assignedThisWeek] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM gc_leads l
     WHERE ${filter.clause}
       AND l.assigned_broker_id IS NOT NULL
       AND l.created_at >= date_trunc('week', now())`,
    params,
  )

  const [activeInquiries] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM gc_leads l
     WHERE ${filter.clause}
       AND l.created_at >= now() - interval '30 days'`,
    params,
  )

  const [scheduledViewings] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM gc_leads l
     WHERE ${filter.clause}
       AND l.source ILIKE ANY(ARRAY['%view%', '%tour%', '%meeting%', '%showing%'])`,
    params,
  )

  const [pipeline] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(p.price_from_aed), 0)::bigint AS total
     FROM gc_leads l
     JOIN gc_projects p ON p.slug = l.project_slug
     WHERE ${filter.clause}
       AND l.created_at >= now() - interval '30 days'`,
    params,
  )

  const [unassigned] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM gc_leads l
     WHERE ${filter.clause}
       AND l.assigned_broker_id IS NULL`,
    params,
  )

  const recentLeads = await getRecentLeads(6, role, brokerId)

  const hotLeadRows = await query<LeadRecord>(
    `SELECT l.id, l.name, l.phone, l.email, l.source, l.project_slug, l.assigned_broker_id, l.status, l.priority,
            l.last_contact_at, l.country, l.budget_aed, l.interest, l.created_at
     FROM gc_leads l
     WHERE ${filter.clause}
     ORDER BY l.created_at DESC
     LIMIT 40`,
    params,
  )

  const hotLeads = hotLeadRows
    .map((lead) => {
      const normalized = applyLeadDefaults(lead)
      const score = scoreLead(normalized)
      return { ...normalized, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const projectRows = await query<{
    id: string
    slug: string
    name: string
    area: string | null
    market_score: number | null
    rental_yield: number | null
    payload: Project
  }>(
    `SELECT id, slug, name, area, market_score, rental_yield, payload
     FROM gc_projects
     ORDER BY market_score DESC NULLS LAST
     LIMIT 5`,
  )

  const topProjects = projectRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    area: row.area,
    marketScore: row.market_score,
    expectedRoi: row.payload?.investmentHighlights?.expectedROI ?? null,
    rentalYield: row.rental_yield ?? row.payload?.investmentHighlights?.rentalYield ?? null,
  }))

  return {
    kpis: {
      todaysLeads: todays?.count || 0,
      assignedThisWeek: assignedThisWeek?.count || 0,
      activeInquiries: activeInquiries?.count || 0,
      scheduledViewings: scheduledViewings?.count || 0,
      pipelineValue: pipeline?.total || 0,
      unassignedLeads: unassigned?.count || 0,
    },
    hotLeads,
    topProjects,
    recentLeads,
  }
}

export async function getDashboardAnalyticsData(
  role: "admin" | "broker" = "admin",
  brokerId?: string,
): Promise<AnalyticsOverview> {
  await ensureLeadsTable()
  await ensureProjectsTable()
  await ensureUsersTable()
  const filter = buildLeadFilter("l", role, brokerId)
  const params = filter.params

  const leadSources = await query<LeadSourceSummary>(
    `SELECT COALESCE(l.source, 'Unknown') AS source, COUNT(*)::int AS count
     FROM gc_leads l
     WHERE ${filter.clause}
     GROUP BY l.source
     ORDER BY count DESC`,
    params,
  )

  const areaPerformance = await query<AreaPerformanceSummary>(
    `SELECT COALESCE(p.area, 'General enquiry') AS area, COUNT(*)::int AS count
     FROM gc_leads l
     LEFT JOIN gc_projects p ON p.slug = l.project_slug
     WHERE ${filter.clause}
     GROUP BY p.area
     ORDER BY count DESC
     LIMIT 6`,
    params,
  )

  const brokerPerformance = await query<BrokerPerformanceSummary>(
    `SELECT
       COALESCE(l.assigned_broker_id, 'unassigned') AS "brokerId",
       COALESCE(u.name, u.email, l.assigned_broker_id, 'Unassigned') AS "brokerName",
       COUNT(*)::int AS count
     FROM gc_leads l
     LEFT JOIN gc_users u ON u.id = l.assigned_broker_id
     WHERE ${filter.clause}
     GROUP BY l.assigned_broker_id, u.name, u.email
     ORDER BY count DESC`,
    params,
  )

  const projectRows = await query<{
    id: string
    slug: string
    name: string
    area: string | null
    market_score: number | null
    rental_yield: number | null
    payload: Project
  }>(
    `SELECT id, slug, name, area, market_score, rental_yield, payload
     FROM gc_projects
     ORDER BY market_score DESC NULLS LAST
     LIMIT 6`,
  )

  const topProjects = projectRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    area: row.area,
    marketScore: row.market_score,
    expectedRoi: row.payload?.investmentHighlights?.expectedROI ?? null,
    rentalYield: row.rental_yield ?? row.payload?.investmentHighlights?.rentalYield ?? null,
  }))

  const [pipeline] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(p.price_from_aed), 0)::bigint AS total
     FROM gc_leads l
     LEFT JOIN gc_projects p ON p.slug = l.project_slug
     WHERE ${filter.clause}
       AND l.created_at >= now() - interval '30 days'`,
    params,
  )

  const analyticsColumns = await getTableColumns("gc_lp_analytics")
  const analyticsEventColumn = analyticsColumns.has("event_name")
    ? "event_name"
    : analyticsColumns.has("event")
      ? "event"
      : analyticsColumns.has("event_type")
        ? "event_type"
        : analyticsColumns.has("type")
          ? "type"
          : null

  const landingPageTableExists = await query<{ exists: number }>(
    `SELECT 1 AS exists
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'gc_project_landing_pages'
     LIMIT 1`,
  )

  const [landingTotals] =
    analyticsEventColumn
      ? await query<{ page_views: number; form_submissions: number }>(
          `SELECT
             COUNT(*) FILTER (WHERE ${analyticsEventColumn} IN ('page_view', 'pageview', 'view'))::int AS page_views,
             COUNT(*) FILTER (WHERE ${analyticsEventColumn} IN ('form_submit', 'lead_submit', 'submit'))::int AS form_submissions
           FROM gc_lp_analytics`,
        )
      : [{ page_views: 0, form_submissions: 0 }]

  const [landingCount] =
    landingPageTableExists.length > 0
      ? await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM gc_project_landing_pages`)
      : [{ count: 0 }]

  return {
    leadSources,
    areaPerformance,
    brokerPerformance,
    topProjects,
    pipelineValue: pipeline?.total || 0,
    landingPageViews: landingTotals?.page_views || 0,
    landingPageSubmissions: landingTotals?.form_submissions || 0,
    landingPageCount: landingCount?.count || 0,
  }
}

export async function ensureProjectsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_projects (
      id text PRIMARY KEY,
      slug text UNIQUE,
      name text,
      area text,
      status text,
      developer_name text,
      hero_image text,
      price_from_aed numeric,
      price_to_aed numeric,
      market_score numeric,
      rental_yield numeric,
      golden_visa_eligible boolean DEFAULT false,
      featured boolean DEFAULT false,
      payload jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    ALTER TABLE gc_projects
      ADD COLUMN IF NOT EXISTS developer_name text,
      ADD COLUMN IF NOT EXISTS hero_image text,
      ADD COLUMN IF NOT EXISTS price_from_aed numeric,
      ADD COLUMN IF NOT EXISTS price_to_aed numeric,
      ADD COLUMN IF NOT EXISTS market_score numeric,
      ADD COLUMN IF NOT EXISTS rental_yield numeric,
      ADD COLUMN IF NOT EXISTS golden_visa_eligible boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
  `)
}

const buildProjectPayload = (input: DashboardProjectInput, existing?: Project | null): Project => {
  const nowIso = new Date().toISOString()
  const base = existing || ({} as Project)
  const highlights = Array.isArray(input.highlights)
    ? input.highlights.map((item) => item.trim()).filter(Boolean)
    : []
  const amenities = Array.isArray(input.amenities)
    ? input.amenities.map((item) => item.trim()).filter(Boolean)
    : []
  const heroImage =
    pickString(input.heroImage, existing?.heroImage, existing?.mediaSource?.heroImage, "/logo.png") || "/logo.png"
  const priceFrom = input.priceFrom ?? existing?.units?.[0]?.priceFrom ?? 0
  const priceTo = input.priceTo ?? existing?.units?.[0]?.priceTo ?? priceFrom
  const roi = input.roi ?? existing?.investmentHighlights?.expectedROI ?? 0
  const developerName = pickString(input.developer, existing?.developer?.name, "ORE") || "ORE"
  const slug = normalizeSlug(input.slug)
  const name = pickString(input.name, existing?.name, slugToTitle(slug)) || "Untitled Project"
  const area = pickString(input.area, existing?.location?.area, "Dubai") || "Dubai"

  return {
    id: existing?.id || slug,
    name,
    slug,
    tagline: base.tagline || `${area} · Dubai`,
    description: pickString(input.description, base.description, `${name} in ${area}.`),
    longDescription: pickString(input.description, base.longDescription, base.description, `${name} in ${area}.`),
    heroImage,
    mediaSource: {
      heroImage,
      gallery:
        base.mediaSource?.gallery?.length
          ? base.mediaSource.gallery
          : base.gallery?.length
            ? base.gallery
            : [heroImage],
    },
    heroVideo: base.heroVideo,
    virtualTour: base.virtualTour,
    gallery: base.gallery?.length ? base.gallery : [heroImage],
    developer: {
      id: base.developer?.id || normalizeSlug(developerName) || "ore",
      name: developerName,
      slug: base.developer?.slug || normalizeSlug(developerName) || "ore",
      logo: base.developer?.logo || "/logo.png",
      pfLogo: base.developer?.pfLogo,
      description: base.developer?.description || `${developerName} development profile.`,
      trackRecord: base.developer?.trackRecord || "Active Dubai developer.",
    },
    location: {
      area,
      district: base.location?.district || area,
      city: base.location?.city || "Dubai",
      coordinates: base.location?.coordinates || { lat: 25.2048, lng: 55.2708 },
      freehold: typeof base.location?.freehold === "boolean" ? base.location.freehold : true,
      nearbyLandmarks: Array.isArray(base.location?.nearbyLandmarks) ? base.location.nearbyLandmarks : [],
    },
    units: base.units?.length
      ? base.units.map((unit, index) =>
          index === 0
            ? {
                ...unit,
                priceFrom,
                priceTo,
              }
            : unit,
        )
      : [
          {
            type: "Residence",
            bedrooms: 1,
            baths: 1,
            bathrooms: 1,
            priceFrom,
            priceTo,
            sizeFrom: 700,
            sizeTo: 900,
            available: 1,
            floorPlan: "",
          },
        ],
    amenities: amenities.length ? amenities : base.amenities || [],
    highlights: highlights.length ? highlights : base.highlights || [],
    investmentHighlights: {
      expectedROI: roi,
      rentalYield: base.investmentHighlights?.rentalYield ?? roi,
      goldenVisaEligible: base.investmentHighlights?.goldenVisaEligible ?? (priceFrom >= 2000000),
      paymentPlanAvailable:
        base.investmentHighlights?.paymentPlanAvailable ?? Boolean(pickString(input.paymentPlan, "")),
    },
    paymentPlan: base.paymentPlan || {
      downPayment: 20,
      duringConstruction: 40,
      onHandover: 40,
      postHandover: 0,
    },
    timeline: {
      launchDate: base.timeline?.launchDate || nowIso.slice(0, 10),
      constructionStart: base.timeline?.constructionStart || nowIso.slice(0, 10),
      expectedCompletion: pickString(input.handoverDate, base.timeline?.expectedCompletion, ""),
      handoverDate: pickString(input.handoverDate, base.timeline?.handoverDate, ""),
      progressPercentage: base.timeline?.progressPercentage ?? 0,
    },
    constructionUpdates: Array.isArray(base.constructionUpdates) ? base.constructionUpdates : [],
    masterplan: base.masterplan || "",
    specifications: base.specifications || "",
    brochure: base.brochure || "",
    testimonials: Array.isArray(base.testimonials) ? base.testimonials : [],
    faqs: Array.isArray(base.faqs) ? base.faqs : [],
    seoTitle: base.seoTitle || name,
    seoDescription: pickString(input.description, base.seoDescription, `${name} in ${area}.`),
    seoKeywords: base.seoKeywords || [area, developerName, "Dubai property"],
    ogImage: base.ogImage || heroImage,
    status: (input.status as Project["status"]) || base.status || "selling",
    featured: Boolean(input.featured ?? base.featured),
    sortScore: base.sortScore ?? roi,
    scarcityMessage: base.scarcityMessage,
    urgencyMessage: base.urgencyMessage,
    createdAt: base.createdAt || nowIso,
    updatedAt: nowIso,
  }
}

const buildProjectFilters = (filters: DashboardProjectFilters, values: Array<string | number>) => {
  const where: string[] = []

  if (filters.search) {
    values.push(`%${filters.search}%`)
    where.push(`(name ILIKE $${values.length} OR slug ILIKE $${values.length})`)
  }

  if (filters.area) {
    values.push(`%${filters.area}%`)
    where.push(`area ILIKE $${values.length}`)
  }

  if (filters.developer) {
    values.push(`%${filters.developer}%`)
    where.push(`developer_name ILIKE $${values.length}`)
  }

  if (filters.status) {
    values.push(filters.status)
    where.push(`status = $${values.length}`)
  }

  if (typeof filters.minPrice === "number") {
    values.push(filters.minPrice)
    where.push(`price_from_aed >= $${values.length}`)
  }

  if (typeof filters.maxPrice === "number") {
    values.push(filters.maxPrice)
    where.push(`price_from_aed <= $${values.length}`)
  }

  if (typeof filters.minRoi === "number") {
    values.push(filters.minRoi)
    where.push(`COALESCE((payload->'investmentHighlights'->>'expectedROI')::numeric, 0) >= $${values.length}`)
  }

  return where
}

export async function getDashboardProjects(filters: DashboardProjectFilters) {
  await ensureProjectsTable()
  const pageSize = Math.max(1, filters.pageSize || 20)
  const page = Math.max(1, filters.page || 1)
  const offset = (page - 1) * pageSize
  const values: Array<string | number> = []
  const where = buildProjectFilters(filters, values)
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : ""

  let orderBy = "market_score DESC NULLS LAST"
  switch (filters.sort) {
    case "price-low":
      orderBy = "price_from_aed ASC NULLS LAST"
      break
    case "price-high":
      orderBy = "price_from_aed DESC NULLS LAST"
      break
    case "roi":
      orderBy = "COALESCE((payload->'investmentHighlights'->>'expectedROI')::numeric, rental_yield) DESC NULLS LAST"
      break
    default:
      break
  }

  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM gc_projects ${whereClause}`,
    values,
  )
  const total = countRows[0]?.total || 0

  values.push(pageSize, offset)
  const rows = await query<{
    id: string
    slug: string
    name: string
    area: string | null
    status: string | null
    developer_name: string | null
    price_from_aed: number | null
    price_to_aed: number | null
    market_score: number | null
    rental_yield: number | null
    payload: Project
  }>(
    `SELECT id, slug, name, area, status, developer_name, price_from_aed, price_to_aed, market_score, rental_yield, payload
     FROM gc_projects ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )

  const projects = rows.map((row) => {
    const units = Array.isArray(row.payload?.units) ? row.payload.units : []
    const unitsAvailable = units.reduce((sum, unit) => sum + (Number.isFinite(unit.available) ? unit.available : 0), 0)
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      area: row.area,
      status: row.status,
      developerName: row.developer_name,
      priceFrom: row.price_from_aed ?? null,
      priceTo: row.price_to_aed ?? null,
      marketScore: row.market_score ?? null,
      expectedRoi: row.payload?.investmentHighlights?.expectedROI ?? null,
      rentalYield: row.rental_yield ?? row.payload?.investmentHighlights?.rentalYield ?? null,
      unitsAvailable,
    }
  })

  return { total, projects }
}

export async function getDashboardProjectBySlug(slug: string) {
  await ensureProjectsTable()
  const cleanSlug = normalizeSlug(slug)
  const rows = await query<{
    id: string
    slug: string
    name: string
    area: string | null
    status: string | null
    developer_name: string | null
    hero_image: string | null
    price_from_aed: number | null
    price_to_aed: number | null
    featured: boolean | null
    payload: Project
  }>(
    `SELECT id, slug, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, featured, payload
     FROM gc_projects
     WHERE lower(slug) = $1
        OR lower(payload->>'slug') = $1
     LIMIT 1`,
    [cleanSlug],
  )
  const row = rows[0]
  if (!row) return null
  const payload = normalizeProjectPayload({ id: row.id, slug: row.slug, payload: row.payload })
  return {
    id: row.id,
    slug: row.slug,
    name: row.name || payload.name,
    area: row.area || payload.location?.area || null,
    developer: row.developer_name || payload.developer?.name || null,
    status: row.status || payload.status || null,
    priceFrom: row.price_from_aed ?? payload.units?.[0]?.priceFrom ?? null,
    priceTo: row.price_to_aed ?? payload.units?.[0]?.priceTo ?? null,
    roi: payload.investmentHighlights?.expectedROI ?? null,
    paymentPlan:
      payload.paymentPlan
        ? `${payload.paymentPlan.downPayment}/${payload.paymentPlan.duringConstruction}/${payload.paymentPlan.onHandover}`
        : null,
    handoverDate: payload.timeline?.handoverDate || payload.timeline?.expectedCompletion || null,
    description: payload.description || null,
    highlights: payload.highlights || [],
    amenities: payload.amenities || [],
    heroImage: row.hero_image || payload.heroImage || null,
    featured: Boolean(row.featured ?? payload.featured),
  } satisfies DashboardProjectEditorRecord
}

export async function upsertDashboardProject(input: DashboardProjectInput) {
  await ensureProjectsTable()
  const existing = await getProjectBySlug(input.slug)
  const payload = buildProjectPayload(input, existing)
  const id = existing?.id || payload.id || normalizeSlug(input.slug)
  const nowIso = new Date().toISOString()
  const rows = await query<{
    id: string
    slug: string
    name: string
    area: string | null
    status: string | null
    developer_name: string | null
    hero_image: string | null
    price_from_aed: number | null
    price_to_aed: number | null
    featured: boolean | null
    payload: Project
  }>(
    `INSERT INTO gc_projects (
        id, slug, name, area, status, developer_name, hero_image,
        price_from_aed, price_to_aed, market_score, rental_yield,
        golden_visa_eligible, featured, payload, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14::jsonb, $15
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        area = EXCLUDED.area,
        status = EXCLUDED.status,
        developer_name = EXCLUDED.developer_name,
        hero_image = EXCLUDED.hero_image,
        price_from_aed = EXCLUDED.price_from_aed,
        price_to_aed = EXCLUDED.price_to_aed,
        market_score = EXCLUDED.market_score,
        rental_yield = EXCLUDED.rental_yield,
        golden_visa_eligible = EXCLUDED.golden_visa_eligible,
        featured = EXCLUDED.featured,
        payload = EXCLUDED.payload,
        updated_at = EXCLUDED.updated_at
      RETURNING id, slug, name, area, status, developer_name, hero_image, price_from_aed, price_to_aed, featured, payload`,
    [
      id,
      payload.slug,
      payload.name,
      payload.location.area,
      payload.status,
      payload.developer.name,
      payload.heroImage,
      payload.units?.[0]?.priceFrom ?? null,
      payload.units?.[0]?.priceTo ?? null,
      payload.sortScore ?? payload.investmentHighlights.expectedROI ?? 0,
      payload.investmentHighlights.rentalYield ?? payload.investmentHighlights.expectedROI ?? 0,
      payload.investmentHighlights.goldenVisaEligible,
      payload.featured,
      JSON.stringify(payload),
      nowIso,
    ],
  )

  return rows[0]
}

export async function getDashboardProjectFilters() {
  await ensureProjectsTable()
  const areas = await query<{ area: string | null }>(
    `SELECT DISTINCT COALESCE(NULLIF(payload->'location'->>'area', ''), NULLIF(payload->>'area', ''), area) AS area
     FROM gc_projects
     WHERE COALESCE(NULLIF(payload->'location'->>'area', ''), NULLIF(payload->>'area', ''), area) IS NOT NULL
     ORDER BY area ASC
     LIMIT 120`,
  )
  const developers = await query<{ developer_name: string | null }>(
    `SELECT DISTINCT COALESCE(NULLIF(payload->'developer'->>'name', ''), NULLIF(payload->>'developer', ''), developer_name) AS developer_name
     FROM gc_projects
     WHERE COALESCE(NULLIF(payload->'developer'->>'name', ''), NULLIF(payload->>'developer', ''), developer_name) IS NOT NULL
     ORDER BY developer_name ASC
     LIMIT 120`,
  )
  return {
    areas: areas.map((row) => row.area).filter(Boolean) as string[],
    developers: developers.map((row) => row.developer_name).filter(Boolean) as string[],
  }
}

export interface UserProfileRecord {
  id: string
  name: string
  email: string
  role: string
  org_title?: string | null
  phone?: string | null
  commission_rate?: number | null
  language?: string | null
  ai_tone?: string | null
  ai_verbosity?: string | null
  notifications?: Record<string, boolean> | null
  last_login_at?: string | null
  created_at: string
}

export async function ensureUsersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_users (
      id text PRIMARY KEY,
      name text,
      email text UNIQUE,
      role text,
      created_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    ALTER TABLE gc_users
      ADD COLUMN IF NOT EXISTS phone text,
      ADD COLUMN IF NOT EXISTS org_title text,
      ADD COLUMN IF NOT EXISTS commission_rate numeric,
      ADD COLUMN IF NOT EXISTS language text,
      ADD COLUMN IF NOT EXISTS ai_tone text,
      ADD COLUMN IF NOT EXISTS ai_verbosity text,
      ADD COLUMN IF NOT EXISTS notifications jsonb,
      ADD COLUMN IF NOT EXISTS password_hash text,
      ADD COLUMN IF NOT EXISTS password_reset_token_hash text,
      ADD COLUMN IF NOT EXISTS password_reset_expires timestamptz,
      ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
      ADD COLUMN IF NOT EXISTS ai_access boolean DEFAULT false
  `)
}

export async function getUserProfileByEmail(email: string) {
  await ensureUsersTable()
  const rows = await query<UserProfileRecord>(
    `SELECT id, name, email, role, org_title, phone, commission_rate, language, ai_tone, ai_verbosity,
            notifications, last_login_at, created_at
     FROM gc_users
     WHERE email = $1
     LIMIT 1`,
    [email],
  )
  return rows[0] || null
}

export async function getUserProfileById(id: string) {
  await ensureUsersTable()
  const rows = await query<UserProfileRecord>(
    `SELECT id, name, email, role, org_title, phone, commission_rate, language, ai_tone, ai_verbosity,
            notifications, last_login_at, created_at
     FROM gc_users
     WHERE id = $1
     LIMIT 1`,
    [id],
  )
  return rows[0] || null
}

export interface UserAccessRecord {
  id: string
  name: string | null
  email: string
  role: string
  org_title?: string | null
  ai_access: boolean
  last_login_at?: string | null
  created_at?: string
}

export async function getUserAccessList() {
  await ensureUsersTable()
  return query<UserAccessRecord>(
    `SELECT id, name, email, role, org_title, ai_access, last_login_at, created_at
     FROM gc_users
     ORDER BY created_at DESC`,
  )
}

export async function setUserAiAccess(id: string, aiAccess: boolean) {
  await ensureUsersTable()
  const rows = await query<UserAccessRecord>(
    `UPDATE gc_users
     SET ai_access = $2
     WHERE id = $1
     RETURNING id, name, email, role, org_title, ai_access`,
    [id, aiAccess],
  )
  return rows[0] || null
}

export async function deleteUserAccess(id: string) {
  await ensureUsersTable()
  const rows = await query<UserAccessRecord>(
    `DELETE FROM gc_users
     WHERE id = $1
     RETURNING id, name, email, role, ai_access`,
    [id],
  )
  return rows[0] || null
}

export interface BrokerPerformanceSnapshot {
  totalLeads: number
  hotLeads: number
  pipelineValue: number
  lastLeadAt: string | null
  lastContactAt: string | null
}

export async function getBrokerPerformanceSummary(brokerId: string): Promise<BrokerPerformanceSnapshot> {
  await ensureLeadsTable()
  const [total] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM gc_leads
     WHERE assigned_broker_id = $1`,
    [brokerId],
  )

  const [pipeline] = await query<{ total: number }>(
    `SELECT COALESCE(SUM(p.price_from_aed), 0)::bigint AS total
     FROM gc_leads l
     JOIN gc_projects p ON p.slug = l.project_slug
     WHERE l.assigned_broker_id = $1`,
    [brokerId],
  )

  const [lastLead] = await query<{ last: string | null }>(
    `SELECT MAX(created_at) AS last
     FROM gc_leads
     WHERE assigned_broker_id = $1`,
    [brokerId],
  )

  const [lastContact] = await query<{ last: string | null }>(
    `SELECT MAX(last_contact_at) AS last
     FROM gc_leads
     WHERE assigned_broker_id = $1`,
    [brokerId],
  )

  const recentLeads = await query<LeadRecord>(
    `SELECT id, name, phone, email, source, project_slug, assigned_broker_id, status, priority,
            last_contact_at, country, budget_aed, interest, created_at
     FROM gc_leads
     WHERE assigned_broker_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [brokerId],
  )

  const hotLeads = recentLeads
    .map(applyLeadDefaults)
    .filter((lead) => lead.priority === "hot").length

  return {
    totalLeads: total?.count || 0,
    hotLeads,
    pipelineValue: pipeline?.total || 0,
    lastLeadAt: lastLead?.last || null,
    lastContactAt: lastContact?.last || null,
  }
}

export async function upsertUserProfile(profile: {
  id: string
  name: string
  email: string
  role: string
  org_title?: string | null
  phone?: string | null
  commission_rate?: number | null
  language?: string | null
  ai_tone?: string | null
  ai_verbosity?: string | null
  notifications?: Record<string, boolean> | null
  password_hash?: string | null
}) {
  await ensureUsersTable()
  const rows = await query<UserProfileRecord>(
    `INSERT INTO gc_users (id, name, email, role, org_title, phone, commission_rate, language, ai_tone, ai_verbosity, notifications, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (email)
     DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       org_title = EXCLUDED.org_title,
       phone = EXCLUDED.phone,
       commission_rate = EXCLUDED.commission_rate,
       language = EXCLUDED.language,
       ai_tone = EXCLUDED.ai_tone,
       ai_verbosity = EXCLUDED.ai_verbosity,
       notifications = EXCLUDED.notifications,
       password_hash = COALESCE(EXCLUDED.password_hash, gc_users.password_hash)
     RETURNING id, name, email, role, org_title, phone, commission_rate, language, ai_tone, ai_verbosity,
               notifications, last_login_at, created_at`,
    [
      profile.id,
      profile.name,
      profile.email,
      profile.role,
      profile.org_title || null,
      profile.phone || null,
      typeof profile.commission_rate === "number" ? profile.commission_rate : null,
      profile.language || null,
      profile.ai_tone || null,
      profile.ai_verbosity || null,
      profile.notifications || null,
      profile.password_hash || null,
    ].map(p => (typeof p === 'object' && p !== null) ? JSON.stringify(p) : p),
  )
  return rows[0]
}
