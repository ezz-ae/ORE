import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { currentServerUser, serverSummary } from "@/src/features/freehold-intelligence/server-session"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ user: currentServerUser, summary: serverSummary })
}
