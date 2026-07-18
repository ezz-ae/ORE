import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSessionUser, isAdminRole, canAuthorizePublish } from "@/lib/auth"
import { getLandingPageForEditor } from "@/lib/landing-pages"
import { getSiteUrl } from "@/lib/site"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const normalizeStatus = (value: unknown): "draft" | "published" | "archived" => {
  const normalized = toText(value).toLowerCase()
  if (normalized === "archived") return "archived"
  return ["published", "active", "live"].includes(normalized) ? "published" : "draft"
}

const toIsoOrNull = (value: unknown) => {
  const text = toText(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const hasKey = (body: unknown, key: string) =>
  Boolean(body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, key))

// Load a landing page for the editor (the fields PATCH below can update).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Admins only." }, { status: 403 })
  const { slug } = await params
  const data = await getLandingPageForEditor(slug)
  if (!data) return NextResponse.json({ error: "Landing page not found." }, { status: 404 })
  // The canonical public site domain, resolved server-side (same helper the
  // agent-profile QR code and sitemap/robots use) — never a client-inlined
  // NEXT_PUBLIC_* var, so the editor's trackable-QR link is correct regardless
  // of what was baked into the client bundle at build time.
  return NextResponse.json({ landing: data, siteUrl: getSiteUrl() })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }
    if (!isAdminRole(user.role)) {
      return NextResponse.json({ error: "Only admins can update landing pages." }, { status: 403 })
    }

    const { slug } = await params
    const existing = await getLandingPageForEditor(slug)
    if (!existing) {
      return NextResponse.json({ error: "Landing page not found." }, { status: 404 })
    }

    const body = await req.json()
    const headline = hasKey(body, "headline") ? toText(body?.headline) : existing.headline
    const subheadline = hasKey(body, "subheadline") ? toText(body?.subheadline) : existing.subheadline
    const heroImage = hasKey(body, "heroImage") ? toText(body?.heroImage) : existing.heroImage
    const ctaText = hasKey(body, "ctaText") ? toText(body?.ctaText) : existing.ctaText
    const status = normalizeStatus(body?.status ?? existing.status)
    const publishFrom = body?.publishFrom !== undefined ? toIsoOrNull(body.publishFrom) : toIsoOrNull(existing.publishFrom)
    const publishTo = body?.publishTo !== undefined ? toIsoOrNull(body.publishTo) : toIsoOrNull(existing.publishTo)
    const seoTitle = hasKey(body, "seoTitle") ? toText(body?.seoTitle) : existing.seoTitle
    const seoDescription = hasKey(body, "seoDescription") ? toText(body?.seoDescription) : existing.seoDescription
    const ogImage = hasKey(body, "ogImage") ? toText(body?.ogImage) : existing.ogImage
    const metaPixelId = hasKey(body, "metaPixelId") ? toText(body?.metaPixelId) : existing.metaPixelId
    const googleTagId = hasKey(body, "googleTagId") ? toText(body?.googleTagId) : existing.googleTagId
    const googleConversionId = hasKey(body, "googleConversionId")
      ? toText(body?.googleConversionId)
      : existing.googleConversionId
    const tiktokPixelId = hasKey(body, "tiktokPixelId") ? toText(body?.tiktokPixelId) : existing.tiktokPixelId

    if (!headline) {
      return NextResponse.json({ error: "Headline is required." }, { status: 400 })
    }

    // Publish authorization gate. A publish request from a non-authorizer is
    // held as `pending_publish` until a manager authorizes it.
    const nowIso = new Date().toISOString()
    const canAuth = canAuthorizePublish(user.role, user.org_title)
    let effectiveStatus: string = status
    let authorizedBy: string | null = null
    let authorizedAt: string | null = null
    let requestedBy: string | null = null
    let requestedAt: string | null = null
    if (status === "published") {
      if (canAuth) {
        effectiveStatus = "published"
        authorizedBy = user.name
        authorizedAt = nowIso
      } else {
        effectiveStatus = "pending_publish"
        requestedBy = user.name
        requestedAt = nowIso
      }
    }

    await query(
      `UPDATE freehold_site_project_landing_pages
       SET headline = $2,
           title = $2,
           subheadline = $3,
           subtitle = $3,
           hero_image = $4,
           cta_text = $5,
           status = $6,
           publish_status = $6,
           publish_from = $7,
           publish_to = $8,
           seo_title = $9,
           seo_description = $10,
           meta_title = $9,
           meta_description = $10,
           og_image = $11,
           meta_pixel_id = $12,
           google_tag_id = $13,
           google_conversion_id = $14,
           tiktok_pixel_id = $15,
           authorized_by = COALESCE($16, authorized_by),
           authorized_at = COALESCE($17, authorized_at),
           publish_requested_by = COALESCE($18, publish_requested_by),
           publish_requested_at = COALESCE($19, publish_requested_at),
           updated_at = now()
       WHERE lower(slug) = $1`,
      [
        slug.trim().toLowerCase(),
        headline,
        subheadline,
        heroImage,
        ctaText,
        effectiveStatus,
        publishFrom,
        publishTo,
        seoTitle,
        seoDescription,
        ogImage,
        metaPixelId || null,
        googleTagId || null,
        googleConversionId || null,
        tiktokPixelId || null,
        authorizedBy,
        authorizedAt,
        requestedBy,
        requestedAt,
      ],
    )

    // Layout canvas: persist a reordered / show-hidden section list when sent.
    // Written to BOTH sections_json and sections: every reader
    // (getLandingPageBySlug / getLandingPageForEditor) prefers sections_json,
    // which the create/generate routes populate — writing only `sections`
    // would be silently shadowed by the stale sections_json.
    if (hasKey(body, "sections") && Array.isArray(body.sections)) {
      const clean = (body.sections as unknown[])
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof (s as Record<string, unknown>).type === "string")
        .map((s) => ({ type: String(s.type), data: s.data && typeof s.data === "object" ? s.data : {} }))
      await query(
        `UPDATE freehold_site_project_landing_pages
         SET sections_json = $2::jsonb, sections = $2::jsonb, updated_at = now()
         WHERE lower(slug) = $1`,
        [slug.trim().toLowerCase(), JSON.stringify(clean)],
      )
    }

    // Smart flags: until-sold-out auto-unpublish + auto price-from-market.
    if (hasKey(body, "autoUpdatePricing")) {
      await query(
        `UPDATE freehold_site_project_landing_pages
         SET auto_update_pricing = $2, updated_at = now()
         WHERE lower(slug) = $1`,
        [slug.trim().toLowerCase(), !!body.autoUpdatePricing],
      )
    }

    const updated = await getLandingPageForEditor(slug)
    return NextResponse.json({ ok: true, landing: updated, landingPage: updated, pendingPublish: effectiveStatus === "pending_publish" })
  } catch (error) {
    console.error("[crm-landing-pages] update error", error)
    return NextResponse.json({ error: "Failed to update landing page." }, { status: 500 })
  }
}

// DELETE — remove a landing page. Admins only; the editor gates it behind a
// typed "delete" confirmation before ever calling this.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    if (!isAdminRole(user.role)) return NextResponse.json({ error: "Only admins can delete landing pages." }, { status: 403 })
    const { slug } = await params
    const normalizedSlug = slug.trim().toLowerCase()

    // Rule: a landing wired to ad campaigns is never deleted — archive it.
    // Deleting it would 404 live ad clicks and orphan the campaign history.
    try {
      const page = await query<{ project_slug: string | null }>(
        `SELECT project_slug FROM freehold_site_project_landing_pages WHERE lower(slug) = $1 LIMIT 1`,
        [normalizedSlug],
      )
      const projectSlug = page[0]?.project_slug?.trim().toLowerCase()
      if (projectSlug) {
        const wired = await query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM meta_campaign_groups WHERE lower(project_slug) = $1`,
          [projectSlug],
        )
        if (Number(wired[0]?.n) > 0) {
          return NextResponse.json(
            { error: "This landing page is wired to ad campaigns and cannot be deleted. Archive it instead.", wiredToAds: true },
            { status: 409 },
          )
        }
      }
    } catch {
      // meta_campaign_groups may not exist yet (no campaigns ever grouped) —
      // in that case there is nothing wired and deletion may proceed.
    }

    const rows = await query<{ slug: string }>(
      `DELETE FROM freehold_site_project_landing_pages WHERE lower(slug) = $1 RETURNING slug`,
      [normalizedSlug],
    )
    if (!rows.length) return NextResponse.json({ error: "Landing page not found." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[crm-landing-pages] delete error", error)
    return NextResponse.json({ error: "Failed to delete landing page." }, { status: 500 })
  }
}
