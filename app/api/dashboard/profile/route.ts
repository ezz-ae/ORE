import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { upsertUserProfile } from "@/lib/entrestate"
import {
  canManageCrmUsers,
  getSessionUser,
  hashPassword,
  logActivity,
  resolveStoredCrmRole,
} from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const body = await req.json()
    const name = String(body?.name || "").trim()
    const email = String(body?.email || "").trim().toLowerCase()
    const requestedRole = String(body?.role || sessionUser.role || "broker").trim()
    const canManageUsers = canManageCrmUsers(sessionUser.role, sessionUser.org_title)
    const role = canManageUsers ? resolveStoredCrmRole(requestedRole) : resolveStoredCrmRole(sessionUser.role)
    const orgTitle = canManageUsers
      ? requestedRole
      : sessionUser.org_title || sessionUser.role
    const phone = body?.phone ? String(body.phone).trim() : null
    const commissionRate = body?.commission_rate ?? body?.commissionRate
    const language = body?.language ? String(body.language).trim() : null
    const aiTone = body?.ai_tone ?? body?.aiTone
    const aiVerbosity = body?.ai_verbosity ?? body?.aiVerbosity
    const notifications = body?.notifications ?? null
    const password = body?.password ? String(body.password) : ""

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 })
    }

    if (!canManageUsers && email !== sessionUser.email) {
      return NextResponse.json({ error: "You can only update your own profile." }, { status: 403 })
    }

    const password_hash = password ? await hashPassword(password) : null

    const parsedCommission =
      commissionRate === undefined || commissionRate === null || commissionRate === ""
        ? null
        : Number(commissionRate)

    const record = await upsertUserProfile({
      id: body?.id || randomUUID(),
      name,
      email,
      role,
      org_title: orgTitle,
      phone,
      commission_rate: Number.isFinite(parsedCommission) ? parsedCommission : null,
      language,
      ai_tone: aiTone ? String(aiTone).trim() : null,
      ai_verbosity: aiVerbosity ? String(aiVerbosity).trim() : null,
      notifications: notifications && typeof notifications === "object" ? notifications : null,
      password_hash,
    })

    await logActivity("profile_updated", sessionUser.id, { email: record.email })

    return NextResponse.json({ profile: record })
  } catch (error) {
    console.error("[v0] Profile update error:", error)
    return NextResponse.json({ error: "Failed to save profile." }, { status: 500 })
  }
}
