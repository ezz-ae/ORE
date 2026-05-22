import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { projectId?: string; landingAngle?: string }
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  return NextResponse.json({
    landingRequest: {
      id: `mock_landing_request_${Date.now()}`,
      projectId: body.projectId,
      landingAngle: body.landingAngle ?? "Investor comparison landing",
      status: "Pending Review",
      leadFormType: "High-intent buyer form",
      whatsappCta: "Ask for investor comparison",
      message: "Mock V1 landing request created and held for approval.",
    },
  }, { status: 201 })
}
