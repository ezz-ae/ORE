import { NextResponse } from "next/server"
import { clearSessionCookie, destroySession, getSessionUserFromToken, logActivity, SESSION_COOKIE } from "@/lib/auth"
import { SESSION_COOKIE as FH_SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    const user = await getSessionUserFromToken(token)
    if (token) {
      await destroySession(token)
    }
    if (user) {
      await logActivity("logout", user.id, { email: user.email })
    }
    const response = NextResponse.json({ success: true })
    response.cookies.set(clearSessionCookie())
    // Unified auth: also clear the platform session so logout signs out fully.
    response.cookies.set(FH_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
    return response
  } catch (error) {
    console.error("[v0] Logout error:", error)
    return NextResponse.json({ error: "Failed to logout." }, { status: 500 })
  }
}
