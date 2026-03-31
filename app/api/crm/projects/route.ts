import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, isAdminRole, logActivity } from "@/lib/auth"
import { upsertDashboardProject } from "@/lib/entrestate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toLines = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const body = await req.json()
    const slug = String(body?.slug || "").trim()
    const name = String(body?.name || "").trim()
    if (!slug || !name) {
      return NextResponse.json({ error: "Project name and slug are required." }, { status: 400 })
    }

    const project = await upsertDashboardProject({
      slug,
      name,
      area: body?.area ? String(body.area).trim() : null,
      developer: body?.developer ? String(body.developer).trim() : null,
      status: body?.status ? String(body.status).trim() : "selling",
      priceFrom: toNumber(body?.priceFrom),
      priceTo: toNumber(body?.priceTo),
      roi: toNumber(body?.roi ?? body?.expectedROI),
      paymentPlan: body?.paymentPlan ? String(body.paymentPlan).trim() : null,
      handoverDate: body?.handoverDate ? String(body.handoverDate).trim() : null,
      description: body?.description ? String(body.description).trim() : null,
      highlights: toLines(body?.highlights),
      amenities: toLines(body?.amenities),
      heroImage: body?.heroImage ? String(body.heroImage).trim() : null,
      featured: Boolean(body?.featured),
    })

    await logActivity("project_upserted", user.id, { slug: project.slug, admin: isAdminRole(user.role) })

    return NextResponse.json({ project })
  } catch (error) {
    console.error("[crm-projects] upsert error", error)
    return NextResponse.json({ error: "Failed to save project." }, { status: 500 })
  }
}
