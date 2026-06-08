import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { getLeadMachineComments } from "@/src/features/freehold-intelligence/lead-machine"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ comments: getLeadMachineComments() })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { projectId?: string; body?: string; type?: string }
  if (!body.projectId || !body.body?.trim()) {
    return NextResponse.json({ error: "projectId and body are required" }, { status: 400 })
  }
  return NextResponse.json({
    comment: {
      id: crypto.randomUUID(),
      projectId: body.projectId,
      body: body.body,
      type: body.type ?? "suggestion",
      systemId: "lead-machine",
      status: "open",
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 })
}
