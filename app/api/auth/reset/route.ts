import { NextRequest, NextResponse } from "next/server"
import { hashPassword, logActivity, updatePasswordFromReset } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = String(body?.token || "").trim()
    const password = String(body?.password || "")

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required." }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    const user = await updatePasswordFromReset(token, passwordHash)
    if (!user) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 })
    }

    await logActivity("password_reset_completed", user.id, { email: user.email })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Password reset error:", error)
    return NextResponse.json({ error: "Failed to reset password." }, { status: 500 })
  }
}
