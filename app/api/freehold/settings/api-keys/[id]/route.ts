import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  try {
    await query(
      `UPDATE freehold_site_api_keys SET revoked = true WHERE id = $1 AND owner_email = $2`,
      [id, user.email.toLowerCase()],
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to revoke" }, { status: 500 })
  }
}
