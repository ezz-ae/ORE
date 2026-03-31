import { query } from "@/lib/db"

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null

type LandingPageRow = Record<string, unknown>
let ensureLandingSchemaPromise: Promise<void> | null = null

type ProjectRow = {
  id: string
  slug: string
  name: string | null
  area: string | null
  developer_name: string | null
  status: string | null
  hero_image: string | null
  price_from_aed: number | null
  price_to_aed: number | null
  rental_yield: number | null
  payload: Record<string, unknown> | null
}

export type LandingSectionType =
  | "hero"
  | "market-intelligence"
  | "key-facts"
  | "payment-plan"
  | "roi"
  | "why-dubai"
  | "amenities"
  | "location"
  | "ai-concierge"
  | "faq"
  | "download-brochure"
  | "lead-form"

export interface LandingSection {
  type: LandingSectionType
  data: Record<string, unknown>
}

export interface CampaignPixelIds {
  metaPixelId?: string
  googleTagId?: string
  googleConversionId?: string
  tiktokPixelId?: string
}

export interface LandingProjectSummary {
  slug: string
  name: string
  area: string
  developerName: string
  heroImage: string
  priceFromAed: number | null
  priceToAed: number | null
  rentalYield: number | null
  paymentPlan?: {
    downPayment?: number
    duringConstruction?: number
    onHandover?: number
    postHandover?: number
  }
  amenities: string[]
  faqs: Array<{ question: string; answer: string }>
}

export interface LandingPageData {
  slug: string
  projectSlug: string
  title: string
  subtitle: string
  heroImage: string
  ctaText: string
  seo: {
    title: string
    description: string
    ogImage: string
  }
  pixels: CampaignPixelIds
  sections: LandingSection[]
  project: LandingProjectSummary | null
}

export interface LandingPageDashboardRow {
  slug: string
  projectSlug: string
  headline: string
  status: string
  isLiveNow: boolean
  publishFrom: string | null
  publishTo: string | null
  updatedAt: string | null
  leadCount: number
  pageViews: number
  formSubmissions: number
}

export interface LandingPageEditorData {
  slug: string
  projectSlug: string
  headline: string
  subheadline: string
  heroImage: string
  ctaText: string
  status: "draft" | "published"
  publishFrom: string
  publishTo: string
  seoTitle: string
  seoDescription: string
  ogImage: string
  metaPixelId: string
  googleTagId: string
  googleConversionId: string
  tiktokPixelId: string
  updatedAt: string | null
}

const formatAed = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

const toObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const toArray = (value: unknown): Array<unknown> => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue
    const cleaned = value.trim()
    if (cleaned) return cleaned
  }
  return ""
}

const pickNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const normalized = value.replace(/,/g, "").trim()
      if (!normalized) continue
      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

const normalizeLandingStatus = (value: unknown): "draft" | "published" => {
  const normalized = pickString(value).toLowerCase()
  return ["published", "active", "live"].includes(normalized) ? "published" : "draft"
}

const normalizePaymentPlan = (plan?: {
  downPayment?: number
  duringConstruction?: number
  onHandover?: number
  postHandover?: number
}) => {
  const normalized = {
    downPayment: Math.max(0, plan?.downPayment ?? 20),
    duringConstruction: Math.max(0, plan?.duringConstruction ?? 50),
    onHandover: Math.max(0, plan?.onHandover ?? 30),
    postHandover: Math.max(0, plan?.postHandover ?? 0),
  }

  const total =
    normalized.downPayment +
    normalized.duringConstruction +
    normalized.onHandover +
    normalized.postHandover

  if (total > 0 && total < 100) {
    normalized.postHandover += 100 - total
  }

  return normalized
}

const toDate = (value: unknown) => {
  if (!value) return null
  const raw = typeof value === "string" ? value : String(value)
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const getTableColumns = async (tableName: string) => {
  const rows = await query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName],
  )
  return new Set(rows.map((row) => row.column_name))
}

const normalizeType = (value: string): LandingSectionType | null => {
  const normalized = value.toLowerCase().replace(/[_\s]+/g, "-")
  switch (normalized) {
    case "hero":
      return "hero"
    case "market-intelligence":
    case "market":
    case "intelligence":
      return "market-intelligence"
    case "key-facts":
    case "facts":
    case "keyfacts":
      return "key-facts"
    case "payment-plan":
    case "payment":
      return "payment-plan"
    case "roi":
    case "returns":
      return "roi"
    case "why-dubai":
    case "whydubai":
      return "why-dubai"
    case "amenities":
      return "amenities"
    case "location":
      return "location"
    case "ai-concierge":
    case "ai":
    case "assistant":
    case "concierge":
      return "ai-concierge"
    case "faq":
    case "faqs":
      return "faq"
    case "download-brochure":
    case "brochure":
      return "download-brochure"
    case "lead-form":
    case "lead":
    case "form":
      return "lead-form"
    default:
      return null
  }
}

const isPublishedNow = (row: LandingPageRow) => {
  if (normalizeLandingStatus(pickString(row.status, row.publish_status)) !== "published") {
    return false
  }

  const now = new Date()
  const from = toDate(row.publish_from)
  const to = toDate(row.publish_to)

  if (from && now < from) return false
  if (to && now > to) return false
  return true
}

const readPixels = (row: LandingPageRow): CampaignPixelIds => ({
  metaPixelId: pickString(row.meta_pixel_id, row.metaPixelId, row.facebook_pixel_id),
  googleTagId: pickString(row.google_tag_id, row.googleTagId, row.gtag_id),
  googleConversionId: pickString(row.google_conversion_id, row.googleConversionId),
  tiktokPixelId: pickString(row.tiktok_pixel_id, row.tiktokPixelId),
})

const buildDefaultSections = (project: LandingProjectSummary | null, row: LandingPageRow): LandingSection[] => {
  const title = pickString(row.headline, row.title, project?.name) || "Dubai Project Campaign"
  const subtitle =
    pickString(row.subheadline, row.subtitle) ||
    (project
      ? `Discover ${project.name} in ${project.area} with curated investment insights and live availability.`
      : "Discover premium Dubai investment opportunities.")
  const startPrice =
    typeof project?.priceFromAed === "number" && project.priceFromAed > 0
      ? formatAed(project.priceFromAed)
      : "Price on request"
  const yieldText =
    typeof project?.rentalYield === "number" && project.rentalYield > 0
      ? `${project.rentalYield.toFixed(1)}% rental yield`
      : "Yield profile on request"
  const marketSummary = project
    ? `${project.name} in ${project.area} is positioned for buyers who want a branded Dubai asset with an entry point from ${startPrice} and a ${yieldText.toLowerCase()} profile.`
    : "This campaign page is designed to qualify buyers quickly with clearer pricing, positioning, and guided next actions."

  return [
    {
      type: "hero",
      data: {
        title,
        subtitle,
        eyebrow: project ? `${project.area} · ${project.developerName}` : "Dubai Investment Campaign",
        chips: [project?.area || "Dubai", startPrice, yieldText],
      },
    },
    {
      type: "market-intelligence",
      data: {
        title: "AI Market Read",
        subtitle: "A sharper investment frame generated from the listing itself.",
        summary: marketSummary,
        bullets: [
          `Area focus: ${project?.area || "Dubai"}`,
          `Developer: ${project?.developerName || "ORE"}`,
          `Entry point: ${startPrice}`,
          `Income lens: ${yieldText}`,
        ],
      },
    },
    {
      type: "key-facts",
      data: {
        items: [
          { label: "Project", value: project?.name || "On request" },
          { label: "Area", value: project?.area || "Dubai" },
          { label: "Developer", value: project?.developerName || "On request" },
          {
            label: "Starting Price",
            value: startPrice,
          },
        ],
      },
    },
    {
      type: "payment-plan",
      data: normalizePaymentPlan(project?.paymentPlan),
    },
    {
      type: "roi",
      data: {
        expectedRoi: project?.rentalYield ?? 0,
        rentalYield: project?.rentalYield ?? 0,
        startPriceAed: project?.priceFromAed ?? 0,
      },
    },
    {
      type: "why-dubai",
      data: {},
    },
    {
      type: "amenities",
      data: {
        items: project?.amenities || [],
      },
    },
    {
      type: "location",
      data: {
        area: project?.area || "Dubai",
        developer: project?.developerName || "ORE",
        title: "Location & Positioning",
        subtitle: "The commercial frame brokers can use immediately in a client conversation.",
        highlights: [
          `${project?.area || "Dubai"} demand corridor`,
          `Developer: ${project?.developerName || "ORE"}`,
          `Entry point: ${startPrice}`,
        ],
      },
    },
    {
      type: "ai-concierge",
      data: {
        title: "Ask ORE AI",
        subtitle: "Let the AI explain ROI, compare areas, and qualify the next step before a broker call.",
        prompts: [
          `Is ${project?.name || "this project"} better for rental yield or appreciation?`,
          `Compare ${project?.area || "this area"} with Dubai Marina`,
          `What kind of buyer is this project best for?`,
        ],
      },
    },
    {
      type: "faq",
      data: {
        items: project?.faqs || [],
      },
    },
    {
      type: "download-brochure",
      data: {},
    },
    {
      type: "lead-form",
      data: {
        title: "Get full brochure & availability",
        subtitle: "A senior investment consultant will contact you with curated options, live inventory, and AI-backed talking points.",
      },
    },
  ]
}

const ensureLandingPagesSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS gc_project_landing_pages (
      id text PRIMARY KEY,
      slug text UNIQUE,
      project_slug text,
      headline text,
      subheadline text,
      hero_image text,
      cta_text text,
      status text DEFAULT 'draft',
      publish_from timestamptz,
      publish_to timestamptz,
      sections_json jsonb,
      seo_title text,
      seo_description text,
      og_image text,
      meta_pixel_id text,
      google_tag_id text,
      google_conversion_id text,
      tiktok_pixel_id text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)

  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS id text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS slug text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS project_slug text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS headline text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS title text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS subheadline text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS subtitle text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS hero_image text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS cta_text text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS status text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS publish_status text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS publish_from timestamptz`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS publish_to timestamptz`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS sections_json jsonb`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS sections jsonb`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS content_json jsonb`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS seo_title text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS seo_description text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS og_image text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS meta_title text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS meta_description text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS meta_pixel_id text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS google_tag_id text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS google_conversion_id text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS tiktok_pixel_id text`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()`)
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`)
}

const ensureLandingPagesSchemaOnce = async () => {
  if (!ensureLandingSchemaPromise) {
    ensureLandingSchemaPromise = ensureLandingPagesSchema().catch((error) => {
      ensureLandingSchemaPromise = null
      throw error
    })
  }
  await ensureLandingSchemaPromise
}

const normalizeSections = (
  sectionsRaw: unknown,
  project: LandingProjectSummary | null,
  row: LandingPageRow,
): LandingSection[] => {
  const fromArray = toArray(sectionsRaw)
  let sections: LandingSection[] = []

  if (fromArray.length) {
    sections = fromArray
      .map((item) => toObject(item))
      .map((item) => {
        const type = normalizeType(pickString(item.type, item.section, item.id))
        if (!type) return null
        const itemData = toObject(item.data)
        const rootData = { ...item }
        delete rootData.type
        delete rootData.section
        delete rootData.id
        delete rootData.data
        return {
          type,
          data: Object.keys(itemData).length ? itemData : rootData,
        } satisfies LandingSection
      })
      .filter(Boolean) as LandingSection[]
  }

  if (!sections.length) {
    const fromObject = toObject(sectionsRaw)
    sections = Object.entries(fromObject)
      .map(([key, value]) => {
        const type = normalizeType(key)
        if (!type) return null
        return {
          type,
          data: toObject(value),
        } satisfies LandingSection
      })
      .filter(Boolean) as LandingSection[]
  }

  if (!sections.length) {
    sections = buildDefaultSections(project, row)
  }

  const fallbackOrder: LandingSectionType[] = [
    "hero",
    "market-intelligence",
    "key-facts",
    "payment-plan",
    "roi",
    "why-dubai",
    "amenities",
    "location",
    "ai-concierge",
    "faq",
    "download-brochure",
    "lead-form",
  ]

  const withFallbacks = [...sections]
  const existing = new Set(withFallbacks.map((section) => section.type))
  for (const fallback of buildDefaultSections(project, row)) {
    if (!existing.has(fallback.type)) {
      withFallbacks.push(fallback)
    }
  }

  withFallbacks.sort((a, b) => fallbackOrder.indexOf(a.type) - fallbackOrder.indexOf(b.type))
  return withFallbacks
}

const getProjectSummary = async (projectSlug: string): Promise<LandingProjectSummary | null> => {
  if (!projectSlug) return null

  const rows = await query<ProjectRow>(
    `SELECT id, slug, name, area, developer_name, status, hero_image, price_from_aed, price_to_aed, rental_yield, payload
     FROM gc_projects
     WHERE lower(slug) = $1
        OR lower(payload->>'slug') = $1
        OR lower(payload->>'pfSlug') = $1
     LIMIT 1`,
    [projectSlug.toLowerCase()],
  )

  const row = rows[0]
  if (!row) return null

  const payload = toObject(row.payload)
  const paymentPlan = toObject(payload.paymentPlan)
  const amenities = toArray(payload.amenities).map((item) => pickString(item)).filter(Boolean)
  const faqs = toArray(payload.faqs)
    .map((item) => toObject(item))
    .map((item) => ({
      question: pickString(item.question),
      answer: pickString(item.answer),
    }))
    .filter((item) => item.question && item.answer)

  return {
    slug: pickString(row.slug, payload.slug) || projectSlug,
    name: pickString(row.name, payload.name) || "Dubai Project",
    area: pickString(row.area, toObject(payload.location).area) || "Dubai",
    developerName: pickString(row.developer_name, toObject(payload.developer).name) || "ORE",
    heroImage: pickString(row.hero_image, payload.heroImage, toObject(payload.mediaSource).heroImage) || "/logo.png",
    priceFromAed: pickNumber(row.price_from_aed, toArray(payload.units)[0] ? toObject(toArray(payload.units)[0]).priceFrom : null),
    priceToAed: pickNumber(row.price_to_aed, toArray(payload.units)[0] ? toObject(toArray(payload.units)[0]).priceTo : null),
    rentalYield: pickNumber(row.rental_yield, toObject(payload.investmentHighlights).rentalYield),
    paymentPlan: normalizePaymentPlan({
      downPayment: pickNumber(paymentPlan.downPayment) ?? undefined,
      duringConstruction: pickNumber(paymentPlan.duringConstruction) ?? undefined,
      onHandover: pickNumber(paymentPlan.onHandover) ?? undefined,
      postHandover: pickNumber(paymentPlan.postHandover) ?? undefined,
    }),
    amenities,
    faqs,
  }
}

export async function getLandingPageBySlug(
  slug: string,
  options?: { includeDraft?: boolean },
): Promise<LandingPageData | null> {
  await ensureLandingPagesSchemaOnce()
  const normalizedSlug = slug.trim().toLowerCase()
  const rows = await query<LandingPageRow>(
    `SELECT *
     FROM gc_project_landing_pages
     WHERE lower(slug) = $1
     LIMIT 1`,
    [normalizedSlug],
  )

  const row = rows[0]
  if (!row) return null
  if (!options?.includeDraft && !isPublishedNow(row)) return null

  const projectSlug = pickString(row.project_slug, row.projectSlug)
  const project = await getProjectSummary(projectSlug)

  const title = pickString(row.headline, row.title, project?.name) || "ORE Real Estate"
  const subtitle =
    pickString(row.subheadline, row.subtitle) ||
    (project
      ? `${project.name} in ${project.area} crafted for investors seeking strong fundamentals.`
      : "Exclusive project campaign by ORE.")

  const heroImage = pickString(row.hero_image, row.heroImage, row.og_image, project?.heroImage) || "/logo.png"
  const ctaText = pickString(row.cta_text, row.ctaText, row.primary_cta) || "Request Availability"

  const seoTitle = pickString(row.seo_title, row.meta_title, title) || title
  const seoDescription =
    pickString(row.seo_description, row.meta_description, subtitle) || subtitle
  const seoOgImage = pickString(row.og_image, row.seo_og_image, heroImage) || heroImage

  const sectionsRaw: JsonValue =
    (row.sections_json as JsonValue) ??
    (row.sections as JsonValue) ??
    (row.content_json as JsonValue) ??
    {}

  return {
    slug: pickString(row.slug) || normalizedSlug,
    projectSlug,
    title,
    subtitle,
    heroImage,
    ctaText,
    seo: {
      title: seoTitle,
      description: seoDescription,
      ogImage: seoOgImage,
    },
    pixels: readPixels(row),
    sections: normalizeSections(sectionsRaw, project, row),
    project,
  }
}

export async function getLandingPageForEditor(slug: string): Promise<LandingPageEditorData | null> {
  await ensureLandingPagesSchemaOnce()
  const normalizedSlug = slug.trim().toLowerCase()
  const rows = await query<LandingPageRow>(
    `SELECT *
     FROM gc_project_landing_pages
     WHERE lower(slug) = $1
     LIMIT 1`,
    [normalizedSlug],
  )

  const row = rows[0]
  if (!row) return null

  const headline = pickString(row.headline, row.title, row.slug) || normalizedSlug
  const subheadline = pickString(row.subheadline, row.subtitle)
  const heroImage = pickString(row.hero_image, row.og_image) || "/logo.png"
  const ctaText = pickString(row.cta_text, row.primary_cta) || "Request Availability"
  const publishFrom = row.publish_from ? new Date(String(row.publish_from)).toISOString().slice(0, 16) : ""
  const publishTo = row.publish_to ? new Date(String(row.publish_to)).toISOString().slice(0, 16) : ""

  return {
    slug: pickString(row.slug) || normalizedSlug,
    projectSlug: pickString(row.project_slug, row.projectSlug),
    headline,
    subheadline,
    heroImage,
    ctaText,
    status: normalizeLandingStatus(pickString(row.status, row.publish_status)),
    publishFrom,
    publishTo,
    seoTitle: pickString(row.seo_title, row.meta_title, headline) || headline,
    seoDescription: pickString(row.seo_description, row.meta_description, subheadline) || subheadline,
    ogImage: pickString(row.og_image, row.hero_image, heroImage) || heroImage,
    metaPixelId: pickString(row.meta_pixel_id, row.metaPixelId),
    googleTagId: pickString(row.google_tag_id, row.googleTagId),
    googleConversionId: pickString(row.google_conversion_id, row.googleConversionId),
    tiktokPixelId: pickString(row.tiktok_pixel_id, row.tiktokPixelId),
    updatedAt: pickString(row.updated_at, row.created_at) || null,
  }
}

export async function getLandingPagesForDashboard(limit = 100): Promise<LandingPageDashboardRow[]> {
  await ensureLandingPagesSchemaOnce()
  const safeLimit = Math.max(1, Math.min(limit, 500))

  const pages = await query<
    {
      slug: string | null
      project_slug: string | null
      headline: string | null
      status: string | null
      publish_status: string | null
      publish_from: string | null
      publish_to: string | null
      updated_at: string | null
      created_at: string | null
    }
  >(
    `SELECT slug, project_slug, headline, status, publish_status, publish_from, publish_to, updated_at, created_at
     FROM gc_project_landing_pages
     ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
     LIMIT $1`,
    [safeLimit],
  )

  const leadColumns = await getTableColumns("gc_leads")
  const leadSlugExpression = leadColumns.has("landing_slug")
    ? leadColumns.has("source")
      ? "COALESCE(NULLIF(landing_slug, ''), NULLIF(REGEXP_REPLACE(source, '^lp:', '', 'g'), ''))"
      : "NULLIF(landing_slug, '')"
    : leadColumns.has("source")
      ? "NULLIF(REGEXP_REPLACE(source, '^lp:', '', 'g'), '')"
      : null

  const leads = leadSlugExpression
    ? await query<{ slug: string; total: number }>(
        `SELECT
           ${leadSlugExpression} AS slug,
           COUNT(*)::int AS total
         FROM gc_leads
         WHERE ${leadSlugExpression} IS NOT NULL
         GROUP BY 1`,
      )
    : []

  const analyticsColumns = await getTableColumns("gc_lp_analytics")
  const analytics =
    analyticsColumns.has("landing_slug") && analyticsColumns.has("event_name")
      ? await query<{ slug: string; page_views: number; form_submissions: number }>(
          `SELECT
             landing_slug AS slug,
             COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
             COUNT(*) FILTER (WHERE event_name = 'form_submit')::int AS form_submissions
           FROM gc_lp_analytics
           WHERE landing_slug IS NOT NULL
             AND landing_slug <> ''
           GROUP BY landing_slug`,
        )
      : []

  const leadMap = new Map(leads.map((row) => [row.slug, Number(row.total) || 0]))
  const analyticsMap = new Map(
    analytics.map((row) => [
      row.slug,
      {
        pageViews: Number(row.page_views) || 0,
        formSubmissions: Number(row.form_submissions) || 0,
      },
    ]),
  )

  return pages
    .map((row) => {
      const slug = pickString(row.slug).toLowerCase()
      if (!slug) return null
      const metric = analyticsMap.get(slug)
      const status = normalizeLandingStatus(pickString(row.status, row.publish_status))
      return {
        slug,
        projectSlug: pickString(row.project_slug),
        headline: pickString(row.headline) || slug,
        status,
        isLiveNow: isPublishedNow(row),
        publishFrom: row.publish_from || null,
        publishTo: row.publish_to || null,
        updatedAt: row.updated_at || row.created_at || null,
        leadCount: leadMap.get(slug) || 0,
        pageViews: metric?.pageViews || 0,
        formSubmissions: metric?.formSubmissions || 0,
      } satisfies LandingPageDashboardRow
    })
    .filter(Boolean) as LandingPageDashboardRow[]
}
