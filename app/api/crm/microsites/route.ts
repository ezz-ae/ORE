import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, isAdminRole } from "@/lib/auth"
import { listMicrosites, upsertMicrosite, type MicrositeStatus } from "@/lib/microsites"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 })

  const microsites = await listMicrosites()
  return NextResponse.json({ microsites })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const projectSlug = String(body.projectSlug || "").trim()
  if (!projectSlug) return NextResponse.json({ error: "projectSlug is required" }, { status: 400 })

  const status = body.status === "published" || body.status === "draft" ? (body.status as MicrositeStatus) : undefined

  try {
    const microsite = await upsertMicrosite({
      projectSlug,
      status,
      headline: typeof body.headline === "string" ? body.headline : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      brochureUrl: typeof body.brochureUrl === "string" ? body.brochureUrl : undefined,
      slug: typeof body.slug === "string" ? body.slug : undefined,
    })
    if (!microsite) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    return NextResponse.json({ microsite })
  } catch (error) {
    console.error("[microsites] upsert failed", error)
    return NextResponse.json({ error: "Failed to save microsite" }, { status: 500 })
  }
}
