import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import {
  buildSessionCookie,
  createSession,
  getUserByEmailForAuth,
  hashPassword,
  logActivity,
} from "@/lib/auth"
import { upsertUserProfile } from "@/lib/ore"

export const runtime = "nodejs"

const getSetupKey = () =>
  process.env.CRM_ADMIN_SETUP_KEY?.trim() || process.env.ADMIN_SETUP_KEY?.trim() || ""

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const setupKey = String(body?.setupKey || "").trim()
    const name = String(body?.name || "").trim()
    const email = String(body?.email || "")
      .trim()
      .toLowerCase()
    const password = String(body?.password || "")

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      )
    }

    const expectedKey = getSetupKey()
    if (!expectedKey && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Admin bootstrap is disabled. Set CRM_ADMIN_SETUP_KEY and try again." },
        { status: 503 },
      )
    }

    if (expectedKey && setupKey !== expectedKey) {
      return NextResponse.json({ error: "Invalid setup key." }, { status: 403 })
    }

    const existing = await getUserByEmailForAuth(email)
    const passwordHash = await hashPassword(password)

    const record = await upsertUserProfile({
      id: existing?.id || randomUUID(),
      name: name || existing?.name || "CRM Admin",
      email,
      role: "admin",
      org_title: existing?.org_title || existing?.role || "Admin",
      phone: existing?.phone || null,
      commission_rate: existing?.commission_rate || null,
      language: existing?.language || null,
      ai_tone: existing?.ai_tone || null,
      ai_verbosity: existing?.ai_verbosity || null,
      notifications: existing?.notifications || null,
      password_hash: passwordHash,
    })

    const { token } = await createSession(record.id)
    await logActivity("bootstrap_admin", record.id, { email })

    const response = NextResponse.json({
      user: {
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role,
      },
    })
    response.cookies.set(buildSessionCookie(token))
    return response
  } catch (error) {
    console.error("[auth-bootstrap-admin] error", error)
    return NextResponse.json({ error: "Failed to bootstrap admin." }, { status: 500 })
  }
}
