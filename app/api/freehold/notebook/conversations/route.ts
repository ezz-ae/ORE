import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { listConversations } from "@/lib/freehold/notebook-conversations"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Real, per-user persisted threads (management sees the whole team's).
  const conversations = await listConversations(user.email, user.role)
  return NextResponse.json({ conversations })
}
