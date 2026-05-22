import { NextResponse } from "next/server"
import { getLeadMachineComments } from "@/src/features/freehold-intelligence/lead-machine"

export async function GET() {
  return NextResponse.json({ comments: getLeadMachineComments() })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { projectId?: string; body?: string; type?: string }
  if (!body.projectId || !body.body?.trim()) return NextResponse.json({ error: "projectId and body are required" }, { status: 400 })
  return NextResponse.json({
    comment: {
      id: `mock_comment_${Date.now()}`,
      projectId: body.projectId,
      body: body.body,
      type: body.type ?? "suggestion",
      systemId: "lead-machine",
      status: "open",
      message: "Mock V1 comment created. It can be converted to a task through the placeholder endpoint.",
    },
  }, { status: 201 })
}
