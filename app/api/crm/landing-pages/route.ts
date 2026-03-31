import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { getSessionUser, isAdminRole } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProjectLookupRow = {
  slug: string | null
  name: string | null
  area: string | null
  hero_image: string | null
  payload: Record<string, unknown> | null
  price_from_aed: number | null
  rental_yield: number | null
}

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const toObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const toArray = (value: unknown) => (Array.isArray(value) ? value : [])

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const normalizePaymentPlan = (plan: Record<string, unknown>) => {
  const normalized = {
    downPayment: Math.max(0, toNumber(plan.downPayment) ?? 20),
    duringConstruction: Math.max(0, toNumber(plan.duringConstruction) ?? 50),
    onHandover: Math.max(0, toNumber(plan.onHandover) ?? 30),
    postHandover: Math.max(0, toNumber(plan.postHandover) ?? 0),
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

const ensureLandingTable = async () => {
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
  await query(`ALTER TABLE gc_project_landing_pages ADD COLUMN IF NOT EXISTS subheadline text`)
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

const getLandingColumns = async () => {
  const rows = await query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'gc_project_landing_pages'`,
  )
  return new Set(rows.map((row) => row.column_name))
}

const ensureUniqueSlug = async (baseSlug: string) => {
  let candidate = baseSlug
  let i = 2
  while (true) {
    const rows = await query<{ exists: number }>(
      `SELECT 1 AS exists FROM gc_project_landing_pages WHERE lower(slug) = $1 LIMIT 1`,
      [candidate.toLowerCase()],
    )
    if (!rows.length) return candidate
    candidate = `${baseSlug}-${i}`
    i += 1
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: "Only admins can create landing pages." }, { status: 403 })
    }

    const body = await req.json()
    const projectSlug = toText(body.projectSlug)
    const campaignName = toText(body.campaignName) || "campaign"
    const status = toText(body.status) || "draft"

    if (!projectSlug) {
      return NextResponse.json({ error: "projectSlug is required" }, { status: 400 })
    }

    const projectRows = await query<ProjectLookupRow>(
      `SELECT slug, name, area, hero_image, payload, price_from_aed, rental_yield
       FROM gc_projects
       WHERE lower(slug) = $1
          OR lower(payload->>'slug') = $1
       LIMIT 1`,
      [projectSlug.toLowerCase()],
    )

    const project = projectRows[0]
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const payload = toObject(project.payload)
    const finalProjectSlug = toText(project.slug) || projectSlug
    const baseSlugFromInput = slugify(toText(body.slug))
    const baseSlug =
      baseSlugFromInput ||
      slugify(`${finalProjectSlug}-${campaignName}`) ||
      slugify(`${finalProjectSlug}-campaign`) ||
      `campaign-${Date.now()}`
    const finalSlug = await ensureUniqueSlug(baseSlug)

    const headline =
      toText(body.headline) ||
      `${toText(project.name) || finalProjectSlug} | ${campaignName.replace(/[-_]+/g, " ")}`
    const subheadline =
      toText(body.subheadline) ||
      `Campaign landing page for ${toText(project.name) || finalProjectSlug} in ${toText(project.area) || "Dubai"}.`
    const heroImage = toText(body.heroImage) || toText(project.hero_image) || "/logo.png"
    const ctaText = toText(body.ctaText) || "Request Availability"
    const formattedPrice =
      typeof project.price_from_aed === "number" && project.price_from_aed > 0
        ? `AED ${project.price_from_aed.toLocaleString("en-AE")}`
        : "Price on request"
    const formattedYield =
      typeof project.rental_yield === "number" && project.rental_yield > 0
        ? `${project.rental_yield.toFixed(1)}% rental yield`
        : "Yield details on request"

    const sections = [
      {
        type: "hero",
        data: {
          title: headline,
          subtitle: subheadline,
          eyebrow: `${toText(project.area) || "Dubai"} · ${toText(toObject(payload.developer).name) || "ORE"}`,
          chips: [toText(project.area) || "Dubai", formattedPrice, formattedYield],
        },
      },
      {
        type: "market-intelligence",
        data: {
          title: "AI Market Read",
          subtitle: "A smarter campaign narrative derived from the listing.",
          summary: `${toText(project.name) || finalProjectSlug} is being positioned in ${toText(project.area) || "Dubai"} for buyers seeking ${formattedYield.toLowerCase()} and guided access to live availability.`,
          bullets: [
            `Area focus: ${toText(project.area) || "Dubai"}`,
            `Entry point: ${formattedPrice}`,
            `Income lens: ${formattedYield}`,
            `Campaign path: /lp/${finalSlug}`,
          ],
        },
      },
      {
        type: "key-facts",
        data: {
          items: [
            { label: "Project", value: toText(project.name) || finalProjectSlug },
            { label: "Area", value: toText(project.area) || "Dubai" },
            {
              label: "Starting Price",
              value: formattedPrice,
            },
            {
              label: "Rental Yield",
              value: formattedYield,
            },
          ],
        },
      },
      {
        type: "payment-plan",
        data: normalizePaymentPlan(toObject(payload.paymentPlan)),
      },
      {
        type: "roi",
        data: {
          expectedRoi: typeof project.rental_yield === "number" ? project.rental_yield : 0,
          rentalYield: typeof project.rental_yield === "number" ? project.rental_yield : 0,
          startPriceAed: typeof project.price_from_aed === "number" ? project.price_from_aed : 0,
        },
      },
      {
        type: "amenities",
        data: {
          items: toArray(payload.amenities).filter((item) => typeof item === "string"),
        },
      },
      {
        type: "faq",
        data: {
          items: toArray(payload.faqs).map((item) => {
            const asObj = toObject(item)
            return {
              question: toText(asObj.question),
              answer: toText(asObj.answer),
            }
          }),
        },
      },
      {
        type: "why-dubai",
        data: {},
      },
      {
        type: "location",
        data: {
          area: toText(project.area) || "Dubai",
          developer: toText(toObject(payload.developer).name) || "ORE",
          title: "Location & Positioning",
          subtitle: "Use this page to qualify the buyer and frame the project quickly.",
          highlights: [
            `${toText(project.area) || "Dubai"} market focus`,
            `Developer: ${toText(toObject(payload.developer).name) || "ORE"}`,
            `Starting price: ${formattedPrice}`,
          ],
        },
      },
      {
        type: "ai-concierge",
        data: {
          title: "Ask ORE AI",
          subtitle: "Use AI to compare this launch, explain ROI, and qualify the lead before a broker handoff.",
          prompts: [
            `Is ${toText(project.name) || finalProjectSlug} better for yield or appreciation?`,
            `Compare ${toText(project.area) || "this area"} with Downtown Dubai`,
            `What type of investor usually buys in this project?`,
          ],
        },
      },
      {
        type: "download-brochure",
        data: {},
      },
      {
        type: "lead-form",
        data: {
          title: "Get brochure & latest inventory",
          subtitle: "Submit your details and our team will contact you with AI-backed talking points and live availability.",
        },
      },
    ]

    await ensureLandingTable()
    const columns = await getLandingColumns()

    const nowIso = new Date().toISOString()
    const columnValues: Record<string, string> = {
      id: randomUUID(),
      slug: finalSlug,
      project_slug: finalProjectSlug,
      headline,
      subheadline,
      title: headline,
      subtitle: subheadline,
      hero_image: heroImage,
      cta_text: ctaText,
      status,
      publish_status: status,
      sections_json: JSON.stringify(sections),
      sections: JSON.stringify(sections),
      content_json: JSON.stringify(sections),
      seo_title: headline,
      seo_description: subheadline,
      meta_title: headline,
      meta_description: subheadline,
      og_image: heroImage,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const insertCols: string[] = []
    const placeholders: string[] = []
    const params: Array<string | number> = []

    for (const [col, value] of Object.entries(columnValues)) {
      if (!columns.has(col)) continue
      insertCols.push(col)
      params.push(value)
      if (["sections_json", "sections", "content_json"].includes(col)) {
        placeholders.push(`$${params.length}::jsonb`)
      } else {
        placeholders.push(`$${params.length}`)
      }
    }

    if (!insertCols.length) {
      return NextResponse.json({ error: "Landing pages table schema is not compatible." }, { status: 500 })
    }

    await query(
      `INSERT INTO gc_project_landing_pages (${insertCols.join(", ")})
       VALUES (${placeholders.join(", ")})`,
      params,
    )

    return NextResponse.json({
      ok: true,
      slug: finalSlug,
      url: `/lp/${finalSlug}`,
      crmUrl: `/crm/landing-pages`,
    })
  } catch (error) {
    console.error("[crm-landing-pages] create error", error)
    return NextResponse.json({ error: "Failed to create landing page" }, { status: 500 })
  }
}
