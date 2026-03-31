import { NextRequest, NextResponse } from "next/server"
import {
  buildSessionCookie,
  createSession,
  getUserByEmailForAuth,
  logActivity,
  touchUserLogin,
  verifyPassword,
} from "@/lib/auth"

export const runtime = "nodejs"

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
    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Failed to login." }, { status: 500 })
  }
}
