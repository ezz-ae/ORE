import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomUUID } from "node:crypto"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const KINDS = ["area", "developer", "topic", "page", "listing"]

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_web_content (
      id text PRIMARY KEY,
      kind text NOT NULL,
      name text NOT NULL,
      slug text,
      body text,
      status text DEFAULT 'draft',
      created_by text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

export async function GET(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const kind = new URL(req.url).searchParams.get("kind") || ""
  try {
    await ensureOnce()
    const rows = kind
      ? await query<Record<string, unknown>>(`SELECT id, kind, name, slug, body, status, created_at::text FROM freehold_site_web_content WHERE kind = $1 ORDER BY created_at DESC`, [kind])
      : await query<Record<string, unknown>>(`SELECT id, kind, name, slug, body, status, created_at::text FROM freehold_site_web_content ORDER BY created_at DESC`)
    return NextResponse.json({ items: rows })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const kind = String(body.kind || "")
  const name = String(body.name || "").trim()
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  try {
    await ensureOnce()
    const id = `wc_${randomUUID()}`
    const rows = await query<Record<string, unknown>>(
      `INSERT INTO freehold_site_web_content (id, kind, name, slug, body, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING id, kind, name, slug, body, status, created_at::text`,
      [id, kind, name, slugify(String(body.slug || name)), typeof body.body === "string" ? body.body : "", body.status === "published" ? "published" : "draft", user.brokerId || user.email],
    )
    return NextResponse.json({ item: rows[0] }, { status: 201 })
  } catch (e) {
    console.error("[web-content] create failed", e)
    return NextResponse.json({ error: "Failed to create" }, { status: 500 })
  }
}

// Update a row's body and/or status — lets generated content be saved and
// published instead of only living in the clipboard/local state.
export async function PATCH(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const id = String(body.id || "").trim()
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const sets: string[] = []
  const params: unknown[] = []
  if (typeof body.body === "string") { params.push(body.body); sets.push(`body = $${params.length}`) }
  if (body.status === "published" || body.status === "draft") { params.push(body.status); sets.push(`status = $${params.length}`) }
  if (sets.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  try {
    await ensureOnce()
    params.push(id)
    const rows = await query<Record<string, unknown>>(
      `UPDATE freehold_site_web_content SET ${sets.join(", ")}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING id, kind, name, slug, body, status, created_at::text`,
      params,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ item: rows[0] })
  } catch (e) {
    console.error("[web-content] update failed", e)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
