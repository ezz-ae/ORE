import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomUUID, randomBytes, createHash } from "node:crypto"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_api_keys (
      id text PRIMARY KEY,
      owner_email text,
      name text,
      scopes jsonb DEFAULT '[]'::jsonb,
      prefix text,
      key_hash text,
      created_at timestamptz DEFAULT now(),
      last_used_at timestamptz,
      revoked boolean DEFAULT false
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    await ensureOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, scopes, prefix, created_at::text, last_used_at::text, revoked
       FROM freehold_site_api_keys WHERE owner_email = $1 ORDER BY created_at DESC`,
      [user.email.toLowerCase()],
    )
    return NextResponse.json({
      keys: rows.map((r) => ({
        id: str(r.id), name: str(r.name),
        scopes: Array.isArray(r.scopes) ? r.scopes : [],
        prefix: str(r.prefix), createdAt: r.created_at ? String(r.created_at) : null,
        lastUsedAt: r.last_used_at ? String(r.last_used_at) : null, revoked: Boolean(r.revoked),
      })),
    })
  } catch {
    return NextResponse.json({ keys: [] })
  }
}

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const name = str(body.name).trim()
  if (!name) return NextResponse.json({ error: "Key name is required" }, { status: 400 })
  const scopes = Array.isArray(body.scopes) ? body.scopes.filter((s) => typeof s === "string") : []
  try {
    await ensureOnce()
    const id = `key_${randomUUID()}`
    const secret = `fh_${randomBytes(24).toString("hex")}`
    const prefix = secret.slice(0, 11)
    const keyHash = createHash("sha256").update(secret).digest("hex")
    await query(
      `INSERT INTO freehold_site_api_keys (id, owner_email, name, scopes, prefix, key_hash, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())`,
      [id, user.email.toLowerCase(), name, JSON.stringify(scopes), prefix, keyHash],
    )
    // Return the full secret ONCE — it is never stored or shown again.
    return NextResponse.json({ id, name, scopes, prefix, secret }, { status: 201 })
  } catch (e) {
    console.error("[api-keys] create failed", e)
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 })
  }
}
