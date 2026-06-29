import { NextRequest, NextResponse } from "next/server"
import {
  buildSessionCookie,
  createSession,
  getUserByEmailForAuth,
  logActivity,
  touchUserLogin,
  verifyPassword,
  resolveStoredCrmRole,
} from "@/lib/auth"
import { signSession, SESSION_COOKIE as FH_SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import type { Role } from "@/lib/freehold/session-types"

export const runtime = "nodejs"

const FH_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body?.email || "").trim().toLowerCase()
    const password = String(body?.password || "")

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    const user = await getUserByEmailForAuth(email)
    if (!user?.password_hash) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
    }

    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 })
    }

    const { token } = await createSession(user.id)
    await touchUserLogin(user.id)
    await logActivity("login", user.id, { email })

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
    response.cookies.set(buildSessionCookie(token))

    // Unified auth: also establish a platform (fh_session) session so this one
    // sign-in works across the platform too. Best-effort — never blocks login.
    try {
      const role = resolveStoredCrmRole(user.role) as Role
      const initials = String(user.name || user.email)
        .split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()
      const fhToken = await signSession(
        {
          email: user.email,
          name: user.name || user.email,
          initials,
          role,
          brokerId: role === "broker" ? user.id : undefined,
          home: role === "broker" ? "/freehold-intelligence/agent" : "/freehold-intelligence",
        },
        FH_TTL_MS,
      )
      response.cookies.set(FH_SESSION_COOKIE, fhToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: FH_TTL_MS / 1000,
      })
    } catch { /* platform session is best-effort */ }

    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Failed to login." }, { status: 500 })
  }
}
