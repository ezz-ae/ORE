import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { commentId } = await params
  const body = await request.json().catch(() => ({})) as { projectId?: string; owner?: string; priority?: string }
  return NextResponse.json({
    task: {
      id: crypto.randomUUID(),
      title: "Lead Machine comment follow-up",
      description: "Converted from Lead Machine comment.",
      source: "lead-machine-comment",
      commentId,
      listingProjectId: body.projectId ?? "unassigned",
      systemId: "lead-machine",
      owner: body.owner ?? "Marketing",
      assignedRole: "marketing",
      priority: body.priority ?? "medium",
      expectedOutput: "Resolved listing, landing or ad request issue.",
      successEvent: "Comment is resolved and linked item is ready for review.",
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 })
}
