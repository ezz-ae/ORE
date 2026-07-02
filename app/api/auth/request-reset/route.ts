import { NextRequest, NextResponse } from "next/server"
import { getUserByEmailForAuth, logActivity, setPasswordResetToken } from "@/lib/auth"
import { sendPasswordResetEmail } from "@/lib/transactional-email"
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

    // Deliver the reset link by email — NEVER return the token/link in the
    // response body (that was an account-takeover-by-known-email vector).
    const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://freeholdproperty.ae"
    await sendPasswordResetEmail(email, `${appUrl}/reset/${token}`).catch((err) =>
      console.error("[reset] email dispatch failed", err),
    )

    // Anti-enumeration: identical response whether or not the email exists.
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Password reset request error:", error)
    return NextResponse.json({ error: "Failed to request reset." }, { status: 500 })
  }
}
