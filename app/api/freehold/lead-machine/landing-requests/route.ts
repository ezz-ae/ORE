import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { projectId?: string; landingAngle?: string }
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })

  return NextResponse.json({
    landingRequest: {
      id: crypto.randomUUID(),
      projectId: body.projectId,
      landingAngle: body.landingAngle ?? "Investor comparison landing",
      status: "Pending Review",
      leadFormType: "High-intent buyer form",
      whatsappCta: "Ask for investor comparison",
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 })
}
