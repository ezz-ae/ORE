import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSessionUser, isAdminRole, canAuthorizePublish } from "@/lib/auth"
import { getLandingPageForEditor } from "@/lib/landing-pages"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const normalizeStatus = (value: unknown): "draft" | "published" => {
  const normalized = toText(value).toLowerCase()
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

    const updated = await getLandingPageForEditor(slug)
    return NextResponse.json({ ok: true, landingPage: updated, pendingPublish: effectiveStatus === "pending_publish" })
  } catch (error) {
    console.error("[crm-landing-pages] update error", error)
    return NextResponse.json({ error: "Failed to update landing page." }, { status: 500 })
  }
}
