import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"

// Lightweight internal directory for the attendee picker. Available to any
// signed-in user (you can invite a colleague to a meeting). Returns only
// name/email/role/initials — no phone, commission, or account-status fields.
export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT name, email, role FROM freehold_site_users
       WHERE COALESCE(suspended, false) = false AND COALESCE(banned, false) = false
       ORDER BY name ASC LIMIT 500`,
    )
    const people = rows
      .map((r) => {
        const email = String(r.email ?? "")
        const name = String(r.name ?? "") || email.split("@")[0]
        return { key: email, name, email, role: String(r.role ?? ""), initials: initials(name) }
      })
      .filter((p) => p.email)
    return NextResponse.json({ people, count: people.length })
  } catch (error) {
    console.error("[calendar] people failed", error)
    return NextResponse.json({ people: [], count: 0 })
  }
}
