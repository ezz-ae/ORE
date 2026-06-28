import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_review_resolutions (
      item_id text PRIMARY KEY,
      status text NOT NULL,
      resolved_by text,
      resolved_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_review_comments (
      id text PRIMARY KEY,
      item_id text,
      author text,
      body text,
      created_at timestamptz DEFAULT now()
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    await ensureOnce()
    const [res, comments] = await Promise.all([
      query<{ item_id: string; status: string; resolved_by: string | null }>(`SELECT item_id, status, resolved_by FROM freehold_site_review_resolutions`),
      query<Record<string, unknown>>(`SELECT id, item_id, author, body, created_at::text FROM freehold_site_review_comments ORDER BY created_at DESC LIMIT 200`),
    ])
    const resolutions: Record<string, { status: string; by: string | null }> = {}
    for (const r of res) resolutions[r.item_id] = { status: r.status, by: r.resolved_by }
    return NextResponse.json({ resolutions, comments })
  } catch (e) {
    console.error("[reviews] get failed", e)
    return NextResponse.json({ resolutions: {}, comments: [] })
  }
}

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  try {
    await ensureOnce()
    if (body.action === "comment") {
      const text = String(body.body || "").trim()
      if (!text) return NextResponse.json({ error: "Comment required" }, { status: 400 })
      await query(
        `INSERT INTO freehold_site_review_comments (id, item_id, author, body, created_at) VALUES ($1, $2, $3, $4, now())`,
        [`rc_${randomUUID()}`, String(body.itemId || "general"), String(body.author || user.name), text],
      )
      return NextResponse.json({ ok: true })
    }
    // resolve
    const itemId = String(body.itemId || "")
    const status = String(body.status)
    if (!itemId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "itemId and valid status required" }, { status: 400 })
    }
    await query(
      `INSERT INTO freehold_site_review_resolutions (item_id, status, resolved_by, resolved_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (item_id) DO UPDATE SET status = EXCLUDED.status, resolved_by = EXCLUDED.resolved_by, resolved_at = now()`,
      [itemId, status, user.name],
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[reviews] post failed", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
