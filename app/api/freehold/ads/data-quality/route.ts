import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { getInventoryPropertyBySlug } from "@/lib/inventory-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Data Quality Test — before a listing becomes an ad or a landing page, check
// that the info it will show is real and complete. Reports per-field: present or
// missing, whether it's required, and whether it's an editable value the team can
// fix in Inventory (e.g. starting price). Every check reads the LIVE inventory
// row — nothing is assumed.

type Check = {
  key: string
  present: boolean
  value: string | null
  severity: "required" | "recommended"
  editable: boolean
}

const fmtAED = (n: number | null) =>
  n ? (n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(1).replace(".0", "")}M` : `AED ${Math.round(n / 1000)}K`) : null

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const slug = typeof body.listingSlug === "string" ? body.listingSlug.trim() : ""
  if (!slug) return NextResponse.json({ error: "listingSlug is required" }, { status: 400 })

  const p = await getInventoryPropertyBySlug(slug)
  if (!p) return NextResponse.json({ error: "Listing not found" }, { status: 404 })

  const checks: Check[] = [
    { key: "name",        present: !!p.name,                       value: p.name || null,                   severity: "required",    editable: true },
    { key: "area",        present: !!p.area,                       value: p.area || null,                   severity: "required",    editable: true },
    { key: "developer",   present: !!p.developer,                  value: p.developer || null,              severity: "required",    editable: true },
    { key: "price",       present: p.startingPriceAED != null,     value: fmtAED(p.startingPriceAED),       severity: "required",    editable: true },
    { key: "image",       present: !!p.hasImages,                  value: p.imageCount ? `${p.imageCount}` : null, severity: "required", editable: true },
    { key: "bedrooms",    present: !!p.bedrooms,                   value: p.bedrooms || null,               severity: "recommended", editable: true },
    { key: "paymentPlan", present: !!p.paymentPlan,                value: p.paymentPlan || null,            severity: "recommended", editable: true },
    { key: "handover",    present: p.handoverYear != null,         value: p.handoverYear ? String(p.handoverYear) : null, severity: "recommended", editable: true },
    { key: "roi",         present: p.roi != null,                  value: p.roi != null ? `${p.roi}%` : null, severity: "recommended", editable: true },
    { key: "priceMax",    present: p.maxPriceAED != null,          value: fmtAED(p.maxPriceAED),            severity: "recommended", editable: true },
  ]

  const required = checks.filter((c) => c.severity === "required")
  const requiredMet = required.filter((c) => c.present).length
  const allMet = checks.filter((c) => c.present).length
  const score = Math.round((allMet / checks.length) * 100)
  const readyToBuild = requiredMet === required.length

  return NextResponse.json({
    listing: { slug: p.slug, name: p.name, editUrl: `/freehold-intelligence/inventory/${p.slug}` },
    score,
    readyToBuild,
    requiredMissing: required.filter((c) => !c.present).map((c) => c.key),
    checks,
  })
}
