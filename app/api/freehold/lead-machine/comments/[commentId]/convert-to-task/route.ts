import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params
  const body = await request.json().catch(() => ({})) as { projectId?: string; owner?: string; priority?: string }
  return NextResponse.json({
    task: {
      id: `mock_task_${Date.now()}`,
      title: "Lead Machine comment follow-up",
      description: "Converted from Lead Machine comment.",
      source: "lead-machine-comment",
      commentId,
      listingProjectId: body.projectId ?? "unassigned",
      systemId: "lead-machine",
      milestoneId: "M5",
      owner: body.owner ?? "Marketing",
      assignedRole: "marketing",
      priority: body.priority ?? "medium",
      expectedOutput: "Resolved listing, landing or ad request issue.",
      successEvent: "Comment is resolved and linked item is ready for review.",
      dueDate: "2026-05-24",
    },
  }, { status: 201 })
}
