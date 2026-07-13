import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { getSessionUser, isAdminRole, canAuthorizePublish } from "@/lib/auth"
import { isLandingTemplateKey, landingTemplate } from "@/lib/landing-pages"
import { normalizePaymentPlan } from "@/lib/payment-plan"

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

const ensureLandingTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_project_landing_pages (
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

  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS id text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS slug text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS project_slug text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS headline text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS subheadline text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS hero_image text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS cta_text text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS status text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS publish_status text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS publish_from timestamptz`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS publish_to timestamptz`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS sections_json jsonb`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS sections jsonb`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS content_json jsonb`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS seo_title text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS seo_description text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS og_image text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS meta_title text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS meta_description text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS meta_pixel_id text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS google_tag_id text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS google_conversion_id text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS tiktok_pixel_id text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS publish_requested_by text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS authorized_by text`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS authorized_at timestamptz`)
  await query(`ALTER TABLE freehold_site_project_landing_pages ADD COLUMN IF NOT EXISTS template text`)
}

const getLandingColumns = async () => {
  const rows = await query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'freehold_site_project_landing_pages'`,
  )
  return new Set(rows.map((row) => row.column_name))
}

const ensureUniqueSlug = async (baseSlug: string) => {
  let candidate = baseSlug
  let i = 2
  while (true) {
    const rows = await query<{ exists: number }>(
      `SELECT 1 AS exists FROM freehold_site_project_landing_pages WHERE lower(slug) = $1 LIMIT 1`,
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
    const template = isLandingTemplateKey(toText(body.template)) ? toText(body.template) : "classic"

    if (!projectSlug) {
      return NextResponse.json({ error: "projectSlug is required" }, { status: 400 })
    }

    const projectRows = await query<ProjectLookupRow>(
      `SELECT slug, name, area, hero_image, payload, price_from_aed, rental_yield
       FROM freehold_site_projects
       WHERE lower(slug) = $1
          OR lower(payload->>'slug') = $1
       LIMIT 1`,
      [projectSlug.toLowerCase()],
    )

    // DB projects only — no seed fallback: a project must exist in Inventory
    // before it can have a landing page.
    const project = projectRows[0]
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const payload = toObject(project.payload)
    // Refreshed projects (Hex FH-REFRESH-02) carry the rich PF fields ONLY under
    // payload.propertyFinderDetail; net-new projects carry them top-level. Read
    // top-level first, then fall back to the PF snapshot so both render fully.
    const pfd = toObject(payload.propertyFinderDetail)
    const amenityItems = (toArray(payload.amenities).length ? toArray(payload.amenities) : toArray(pfd.amenities))
      .filter((item) => typeof item === "string")
    const faqItems = (toArray(payload.faqs).length ? toArray(payload.faqs) : toArray(pfd.faqs))
      .map((item) => {
        const asObj = toObject(item)
        return { question: toText(asObj.question), answer: toText(asObj.answer) }
      })
      .filter((f) => f.question && f.answer)
    const galleryImages = (toArray(payload.images).length ? toArray(payload.images) : toArray(pfd.images))
      .map((img) => (typeof img === "string" ? img : toText(toObject(img).url) || toText(toObject(img).href)))
      .filter(Boolean)
      .slice(0, 8)
    const planStages = normalizePaymentPlan(
      payload.paymentPlan ?? pfd.paymentPlan,
      payload.paymentPlans ?? pfd.paymentPlans,
    )
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

    // Extra content pulled from the (now richer) inventory — PF-snapshot aware,
    // so refreshed projects fill the same holders as net-new ones.
    const realDeveloper = toText(toObject(payload.developer).name) || toText(pfd.developerName)
    const developerName = realDeveloper || "Freehold"
    const developerLogo = toText(toObject(payload.developer).logoUrl) || toText(pfd.developerLogo)
    const descriptionText = (toText(payload.description) || toText(payload.llm_context) || toText(pfd.descriptionPlain)).slice(0, 1400)
    const unitRows = toArray(payload.units)
      .map((u) => {
        const o = toObject(u)
        return {
          type: toText(o.type) || toText(o.name),
          size: toText(o.size),
          price: toText(o.price) || toText(o.priceRange),
          features: toArray(o.features).filter((f) => typeof f === "string"),
        }
      })
      .filter((u) => u.type)
    const propertyTypeLabels = toArray(pfd.propertyTypes).map((t) => toText(t)).filter(Boolean)

    // Build each section's data from its TYPE — one source of truth, so every
    // template renders the same rich data and any empty holder self-hides.
    let leadFormSeen = 0
    const sectionData = (type: string): Record<string, unknown> => {
      switch (type) {
        case "hero":
          return {
            title: headline,
            subtitle: subheadline,
            eyebrow:
              template === "signature"
                ? `Waterfront living · ${toText(project.area) || "Dubai"} · ${developerName}`
                : template === "campaign"
                  ? `Limited units · ${toText(project.area) || "Dubai"} · ${developerName}`
                  : `${toText(project.area) || "Dubai"} · ${developerName}`,
            chips:
              template === "campaign"
                ? [formattedPrice, "Direct payment plan", "No bank required"]
                : template === "signature"
                  ? [toText(project.area) || "Dubai", "Signature community", formattedPrice]
                  : [toText(project.area) || "Dubai", formattedPrice, formattedYield],
          }
        case "market-intelligence":
          return {
            title: "AI Market Read",
            subtitle: "A smarter campaign narrative derived from the listing.",
            summary: `${toText(project.name) || finalProjectSlug} is being positioned in ${toText(project.area) || "Dubai"} for buyers seeking ${formattedYield.toLowerCase()} and guided access to live availability.`,
            bullets: [
              `Area focus: ${toText(project.area) || "Dubai"}`,
              `Entry point: ${formattedPrice}`,
              `Income lens: ${formattedYield}`,
              `Developer: ${developerName}`,
            ],
          }
        case "description":
          return descriptionText ? { title: "About the project", body: descriptionText } : {}
        case "key-facts":
          return {
            items: [
              { label: "Project", value: toText(project.name) || finalProjectSlug },
              { label: "Area", value: toText(project.area) || "Dubai" },
              { label: "Developer", value: developerName },
              { label: "Starting Price", value: formattedPrice },
              ...(formattedYield.startsWith("Yield") ? [] : [{ label: "Rental Yield", value: formattedYield }]),
              ...(propertyTypeLabels.length ? [{ label: "Unit types", value: propertyTypeLabels.join(", ") }] : []),
            ],
          }
        case "payment-plan":
          return planStages ? { ...planStages } : {}
        case "roi":
          return {
            expectedRoi: typeof project.rental_yield === "number" ? project.rental_yield : 0,
            rentalYield: typeof project.rental_yield === "number" ? project.rental_yield : 0,
            startPriceAed: typeof project.price_from_aed === "number" ? project.price_from_aed : 0,
          }
        case "units":
          // Only real unit rows (type + price/size) — bare type labels go to
          // key-facts instead, so we never render empty price/size cards.
          return { units: unitRows }
        case "gallery":
          return { images: galleryImages }
        case "amenities":
          return { items: amenityItems }
        case "developer-profile":
          // Hides for the Freehold-brand fallback; only a real developer shows.
          return realDeveloper ? { name: realDeveloper, logo: developerLogo || undefined } : {}
        case "location":
          return {
            area: toText(project.area) || "Dubai",
            developer: developerName,
            title: "Location & Positioning",
            subtitle: "The commercial frame brokers can use immediately in a client conversation.",
            highlights: [
              `${toText(project.area) || "Dubai"} demand corridor`,
              `Developer: ${developerName}`,
              `Entry point: ${formattedPrice}`,
            ],
          }
        case "neighborhood":
          return { area: toText(project.area) || "Dubai" }
        case "ai-concierge":
          return {
            title: "Ask Freehold AI",
            subtitle: "Let the AI explain ROI, compare areas, and qualify the next step before a broker call.",
            prompts: [
              `Is ${toText(project.name) || finalProjectSlug} better for rental yield or appreciation?`,
              `Compare ${toText(project.area) || "this area"} with Dubai Marina`,
              `What kind of buyer is this project best for?`,
            ],
          }
        case "faq":
          return { items: faqItems }
        case "lead-form": {
          leadFormSeen += 1
          return leadFormSeen === 1
            ? { title: "Register your interest", subtitle: "Limited units — get the price list, floor plans and full payment plan." }
            : { title: "Speak to a specialist", subtitle: "Our team will call you with live availability and the best unit for your budget." }
        }
        // why-dubai / golden-visa / social-proof / download-brochure render from
        // built-in localized content — no per-project data needed.
        default:
          return {}
      }
    }

    const sections = landingTemplate(template).sections.map((type) => ({ type, data: sectionData(type) }))

    await ensureLandingTable()
    const columns = await getLandingColumns()

    const nowIso = new Date().toISOString()

    // Publish authorization gate: a publish request from a non-authorizer is
    // held as `pending_publish` until a manager authorizes it.
    const wantsPublish = ["published", "active", "live"].includes(status.toLowerCase())
    const canAuth = canAuthorizePublish(user.role, user.org_title)
    let effectiveStatus = status
    const publishAudit: Record<string, string> = {}
    if (wantsPublish) {
      if (canAuth) {
        effectiveStatus = "published"
        publishAudit.authorized_by = user.name
        publishAudit.authorized_at = nowIso
      } else {
        effectiveStatus = "pending_publish"
        publishAudit.publish_requested_by = user.name
        publishAudit.publish_requested_at = nowIso
      }
    }

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
      status: effectiveStatus,
      publish_status: effectiveStatus,
      template,
      ...publishAudit,
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
      `INSERT INTO freehold_site_project_landing_pages (${insertCols.join(", ")})
       VALUES (${placeholders.join(", ")})`,
      params,
    )

    return NextResponse.json({
      ok: true,
      slug: finalSlug,
      status: effectiveStatus,
      pendingPublish: effectiveStatus === "pending_publish",
      url: `/lp/${finalSlug}`,
      previewUrl: `/lp/${finalSlug}`,
      crmUrl: `/crm/landing-pages`,
    })
  } catch (error) {
    console.error("[crm-landing-pages] create error", error)
    return NextResponse.json({ error: "Failed to create landing page" }, { status: 500 })
  }
}
