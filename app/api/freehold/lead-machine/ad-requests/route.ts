import { NextResponse } from "next/server"
import { leadMachineAdRequests } from "@/src/features/freehold-intelligence/lead-machine"

export async function GET() {
  return NextResponse.json({ adRequests: leadMachineAdRequests })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { projectId?: string; platform?: string; campaignAngle?: string }
  if (!body.projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  return NextResponse.json({
    adRequest: {
      id: `mock_ad_request_${Date.now()}`,
      projectId: body.projectId,
      platform: body.platform ?? "Meta",
      campaignAngle: body.campaignAngle ?? "Investor readiness angle",
      status: "Draft",
      approvalStatus: "Pending Review",
      message: "Mock V1 ad request created. No external ad account action was performed.",
    },
  }, { status: 201 })
}
