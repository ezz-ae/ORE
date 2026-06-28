import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"
import { ensureUsersTable } from "@/lib/data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Per-user workspace settings (notifications, preferences, theme, 2FA) stored
 *  as a jsonb blob on the user row, keyed by the session email. */
export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    await ensureUsersTable()
    const rows = await query<{ settings: Record<string, unknown> | null }>(
      `SELECT settings FROM freehold_site_users WHERE lower(email) = $1 LIMIT 1`,
      [user.email.toLowerCase()],
    )
    return NextResponse.json({ settings: rows[0]?.settings || {} })
  } catch {
    return NextResponse.json({ settings: {} })
  }
}

export async function PUT(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  try {
    await ensureUsersTable()
    // Merge the provided patch into existing settings.
    const rows = await query<{ settings: Record<string, unknown> | null }>(
      `SELECT settings FROM freehold_site_users WHERE lower(email) = $1 LIMIT 1`,
      [user.email.toLowerCase()],
    )
    const merged = { ...(rows[0]?.settings || {}), ...body }
    await query(
      `UPDATE freehold_site_users SET settings = $2::jsonb WHERE lower(email) = $1`,
      [user.email.toLowerCase(), JSON.stringify(merged)],
    )
    return NextResponse.json({ ok: true, settings: merged })
  } catch (e) {
    console.error("[settings] save failed", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
