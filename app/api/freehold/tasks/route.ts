import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { listTasks, createTask, type TaskPriority } from "@/lib/tasks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const sid = (u: { brokerId?: string; email: string }) => u.brokerId || u.email

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ tasks: await listTasks() })
}

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const title = String(body.title || "").trim()
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
  const task = await createTask({
    title,
    description: typeof body.description === "string" ? body.description : "",
    assignee: typeof body.assignee === "string" ? body.assignee : "",
    priority: (["critical", "high", "medium", "low"].includes(String(body.priority)) ? body.priority : "medium") as TaskPriority,
    dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
  }, { id: sid(user) })
  return NextResponse.json({ task }, { status: 201 })
}
