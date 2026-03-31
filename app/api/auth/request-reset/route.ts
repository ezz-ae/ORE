import { NextRequest, NextResponse } from "next/server"
import { getUserByEmailForAuth, logActivity, setPasswordResetToken } from "@/lib/auth"
import { randomBytes } from "node:crypto"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body?.email || "").trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 })
    }

    const user = await getUserByEmailForAuth(email)
    if (!user) {
      return NextResponse.json({ success: true })
    }

    const token = randomBytes(24).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await setPasswordResetToken(user.id, token, expiresAt)
    await logActivity("password_reset_requested", user.id, { email })

    return NextResponse.json({
      success: true,
      resetLink: `/crm/reset/${token}`,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error("[v0] Password reset request error:", error)
    return NextResponse.json({ error: "Failed to request reset." }, { status: 500 })
  }
}
