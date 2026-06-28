import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { updateTaskStatus, type TaskStatus } from "@/lib/tasks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const status = String(body.status)
  if (!["open", "in_progress", "blocked", "done"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  const task = await updateTaskStatus(id, status as TaskStatus)
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })
  return NextResponse.json({ task })
}
