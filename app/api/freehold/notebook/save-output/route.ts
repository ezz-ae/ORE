import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { title?: string; content?: string; type?: string }
  if (!body.content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 })

  return NextResponse.json({
    output: {
      id: crypto.randomUUID(),
      title: body.title ?? "Untitled output",
      type: body.type ?? "note",
      content: body.content,
      status: "saved",
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 })
}
