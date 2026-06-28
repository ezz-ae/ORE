import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MGMT = new Set(["admin", "ceo", "director", "sales_manager"])

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_notebook_outputs (
      id          text PRIMARY KEY,
      title       text NOT NULL,
      type        text NOT NULL DEFAULT 'note',
      content     text NOT NULL,
      created_by  text,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    await ensureOnce()
    // Management sees every saved output; everyone else sees their own.
    const rows = MGMT.has(user.role)
      ? await query<Record<string, unknown>>(
          `SELECT id, title, type, content, created_by, created_at::text
           FROM freehold_site_notebook_outputs ORDER BY created_at DESC LIMIT 50`)
      : await query<Record<string, unknown>>(
          `SELECT id, title, type, content, created_by, created_at::text
           FROM freehold_site_notebook_outputs WHERE created_by = $1 ORDER BY created_at DESC LIMIT 50`,
          [user.email])
    return NextResponse.json({ outputs: rows })
  } catch {
    return NextResponse.json({ outputs: [] })
  }
}

export async function POST(request: Request) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { title?: string; content?: string; type?: string }
  if (!body.content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 })

  const output = {
    id: crypto.randomUUID(),
    title: body.title?.trim() || "Untitled output",
    type: body.type || "note",
    content: body.content,
    created_by: user.email,
    created_at: new Date().toISOString(),
  }

  try {
    await ensureOnce()
    await query(
      `INSERT INTO freehold_site_notebook_outputs (id, title, type, content, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [output.id, output.title, output.type, output.content, output.created_by, output.created_at],
    )
    return NextResponse.json({ output: { ...output, status: "saved" } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to save output" }, { status: 500 })
  }
}
