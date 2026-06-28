import { query } from "@/lib/db"

// ─── Types ──────────────────────────────────────────────────────────────────

export type MicrositeStatus = "draft" | "published"

export interface MicrositeRecord {
  projectSlug: string
  slug: string
  status: MicrositeStatus
  headline: string
  summary: string
  brochureUrl: string
  updatedAt: string | null
}

export interface MicrositeUnit {
  type: string
  size: string
  price: string
  beds: string
}

export interface MicrositeData {
  slug: string
  projectSlug: string
  status: MicrositeStatus
  isPublished: boolean
  name: string
  area: string
  developerName: string
  heroImage: string
  headline: string
  summary: string
  description: string
  brochureUrl: string
  priceFromAed: number | null
  priceToAed: number | null
  rentalYield: number | null
  handover: string
  amenities: string[]
  units: MicrositeUnit[]
  gallery: string[]
  faqs: Array<{ question: string; answer: string }>
  landingSlug: string | null
}

export interface MicrositeListItem {
  projectSlug: string
  name: string
  area: string
  developerName: string
  hasMicrosite: boolean
  status: MicrositeStatus | null
  slug: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const toArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const pickStr = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

const pickNum = (...vals: unknown[]): number | null => {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const n = Number(v.replace(/,/g, "").trim())
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

// ─── Schema ───────────────────────────────────────────────────────────────────

let ensurePromise: Promise<void> | null = null

const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_project_microsites (
      project_slug text PRIMARY KEY,
      slug text UNIQUE,
      status text DEFAULT 'draft',
      headline text,
      summary text,
      brochure_url text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
  for (const [name, type] of [
    ["slug", "text"], ["status", "text DEFAULT 'draft'"], ["headline", "text"],
    ["summary", "text"], ["brochure_url", "text"],
    ["created_at", "timestamptz DEFAULT now()"], ["updated_at", "timestamptz DEFAULT now()"],
  ] as Array<[string, string]>) {
    await query(`ALTER TABLE freehold_site_project_microsites ADD COLUMN IF NOT EXISTS ${name} ${type}`)
  }
}

const ensureSchemaOnce = async () => {
  if (!ensurePromise) {
    ensurePromise = ensureSchema().catch((e) => { ensurePromise = null; throw e })
  }
  await ensurePromise
}

// ─── Project lookup (shared shape with landing pages) ───────────────────────────

type ProjectRow = {
  slug: string
  name: string | null
  area: string | null
  developer_name: string | null
  hero_image: string | null
  price_from_aed: number | null
  price_to_aed: number | null
  rental_yield: number | null
  payload: Record<string, unknown> | null
}

const PROJECT_SELECT = `slug, name, area, developer_name, hero_image, price_from_aed, price_to_aed, rental_yield, payload`

const buildData = (
  row: ProjectRow,
  micro: MicrositeRecord | null,
  landingSlug: string | null,
): MicrositeData => {
  const payload = toObject(row.payload)
  const location = toObject(payload.location)
  const developer = toObject(payload.developer)
  const media = toObject(payload.mediaSource)
  const highlights = toObject(payload.investmentHighlights)

  const name = pickStr(row.name, payload.name) || "Dubai Project"
  const area = pickStr(row.area, location.area) || "Dubai"
  const developerName = pickStr(row.developer_name, developer.name) || "Leading Developer"
  const heroImage = pickStr(row.hero_image, payload.heroImage, media.heroImage) || "/logo.png"

  const unitsRaw = toArray(payload.units)
  const units: MicrositeUnit[] = unitsRaw.map((u) => {
    const o = toObject(u)
    const from = pickNum(o.priceFrom, o.price)
    const to = pickNum(o.priceTo)
    const price = from
      ? to && to !== from
        ? `AED ${(from / 1_000_000).toFixed(1)}M – ${(to / 1_000_000).toFixed(1)}M`
        : `From AED ${(from / 1_000_000).toFixed(1)}M`
      : "Price on request"
    return {
      type: pickStr(o.type, o.name) || "Residence",
      size: pickStr(o.size, o.sizeRange, o.area) || "—",
      beds: pickStr(o.beds, o.bedrooms, o.type) || "—",
      price,
    }
  }).slice(0, 6)

  const gallery = [
    ...toArray(payload.gallery).map((g) => pickStr(g, toObject(g).url)),
    ...toArray(media.images).map((g) => pickStr(g, toObject(g).url)),
  ].filter(Boolean).slice(0, 8)

  const amenities = toArray(payload.amenities).map((a) => pickStr(a)).filter(Boolean)
  const faqs = toArray(payload.faqs)
    .map((f) => toObject(f))
    .map((f) => ({ question: pickStr(f.question), answer: pickStr(f.answer) }))
    .filter((f) => f.question && f.answer)

  const status = (micro?.status || "draft") as MicrositeStatus
  return {
    slug: micro?.slug || slugify(row.slug),
    projectSlug: row.slug,
    status,
    isPublished: status === "published",
    name,
    area,
    developerName,
    heroImage,
    headline: pickStr(micro?.headline) || `${name} — ${area}`,
    summary: pickStr(micro?.summary, payload.summary, payload.tagline) ||
      `An exclusive ${developerName} development in ${area}, Dubai.`,
    description: pickStr(payload.description, payload.overview, payload.about) || "",
    brochureUrl: pickStr(micro?.brochureUrl, payload.brochureUrl),
    priceFromAed: pickNum(row.price_from_aed, toObject(unitsRaw[0]).priceFrom),
    priceToAed: pickNum(row.price_to_aed),
    rentalYield: pickNum(row.rental_yield, highlights.rentalYield),
    handover: pickStr(payload.handover, payload.completionDate, highlights.handover),
    amenities,
    units,
    gallery,
    faqs,
    landingSlug,
  }
}

// ─── Public queries ─────────────────────────────────────────────────────────────

const getProjectRow = async (projectSlug: string): Promise<ProjectRow | null> => {
  const rows = await query<ProjectRow>(
    `SELECT ${PROJECT_SELECT} FROM freehold_site_projects
     WHERE lower(slug) = $1 OR lower(payload->>'slug') = $1 LIMIT 1`,
    [projectSlug.toLowerCase()],
  )
  return rows[0] || null
}

const mapMicroRow = (r: Record<string, unknown>): MicrositeRecord => ({
  projectSlug: pickStr(r.project_slug),
  slug: pickStr(r.slug),
  status: (pickStr(r.status) || "draft") as MicrositeStatus,
  headline: pickStr(r.headline),
  summary: pickStr(r.summary),
  brochureUrl: pickStr(r.brochure_url),
  updatedAt: r.updated_at ? String(r.updated_at) : null,
})

/** Public microsite by its URL slug. */
export async function getMicrositeBySlug(
  slug: string,
  options?: { includeDraft?: boolean },
): Promise<MicrositeData | null> {
  const norm = slug.trim().toLowerCase()
  if (!norm) return null
  try {
    await ensureSchemaOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT project_slug, slug, status, headline, summary, brochure_url, updated_at::text
       FROM freehold_site_project_microsites WHERE lower(slug) = $1 LIMIT 1`,
      [norm],
    )
    const micro = rows[0] ? mapMicroRow(rows[0]) : null
    if (!micro) return null
    if (!options?.includeDraft && micro.status !== "published") return null

    const project = await getProjectRow(micro.projectSlug)
    if (!project) return null

    let landingSlug: string | null = null
    try {
      const lp = await query<{ slug: string }>(
        `SELECT slug FROM freehold_site_project_landing_pages
         WHERE lower(project_slug) = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
        [micro.projectSlug.toLowerCase()],
      )
      landingSlug = lp[0]?.slug || null
    } catch { /* optional */ }

    return buildData(project, micro, landingSlug)
  } catch (error) {
    console.error("[microsites] getMicrositeBySlug failed", error)
    return null
  }
}

/** Web Studio list: all projects + whether each has a microsite. */
export async function listMicrosites(): Promise<MicrositeListItem[]> {
  try {
    await ensureSchemaOnce()
    const [projects, micros] = await Promise.all([
      query<ProjectRow>(
        `SELECT ${PROJECT_SELECT} FROM freehold_site_projects ORDER BY COALESCE(market_score, 0) DESC NULLS LAST LIMIT 300`,
      ),
      query<Record<string, unknown>>(
        `SELECT project_slug, slug, status FROM freehold_site_project_microsites`,
      ),
    ])
    const microMap = new Map(micros.map((m) => [pickStr(m.project_slug).toLowerCase(), mapMicroRow(m)]))
    return projects.map((p) => {
      const m = microMap.get(p.slug.toLowerCase()) || null
      return {
        projectSlug: p.slug,
        name: pickStr(p.name) || p.slug,
        area: pickStr(p.area) || "Dubai",
        developerName: pickStr(p.developer_name) || "—",
        hasMicrosite: !!m,
        status: m?.status ?? null,
        slug: m?.slug ?? null,
      }
    })
  } catch (error) {
    console.error("[microsites] listMicrosites failed", error)
    return []
  }
}

/** Create or update a microsite record for a project. */
export async function upsertMicrosite(input: {
  projectSlug: string
  status?: MicrositeStatus
  headline?: string
  summary?: string
  brochureUrl?: string
  slug?: string
}): Promise<MicrositeRecord | null> {
  const projectSlug = input.projectSlug.trim()
  if (!projectSlug) return null
  await ensureSchemaOnce()
  const project = await getProjectRow(projectSlug)
  if (!project) return null

  const slug = slugify(input.slug || project.slug)
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_project_microsites (project_slug, slug, status, headline, summary, brochure_url, created_at, updated_at)
     VALUES ($1, $2, COALESCE($3, 'draft'), $4, $5, $6, now(), now())
     ON CONFLICT (project_slug) DO UPDATE SET
       slug = COALESCE(EXCLUDED.slug, freehold_site_project_microsites.slug),
       status = COALESCE($3, freehold_site_project_microsites.status),
       headline = COALESCE($4, freehold_site_project_microsites.headline),
       summary = COALESCE($5, freehold_site_project_microsites.summary),
       brochure_url = COALESCE($6, freehold_site_project_microsites.brochure_url),
       updated_at = now()
     RETURNING project_slug, slug, status, headline, summary, brochure_url, updated_at::text`,
    [
      project.slug,
      slug,
      input.status || null,
      input.headline ?? null,
      input.summary ?? null,
      input.brochureUrl ?? null,
    ],
  )
  return rows[0] ? mapMicroRow(rows[0]) : null
}
