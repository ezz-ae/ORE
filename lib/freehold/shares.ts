import { randomBytes } from 'node:crypto'
import { ensureOnce as dbEnsureOnce, query } from '@/lib/db'

// ─── Share center ─────────────────────────────────────────────────────────────
// Turn any Drive/Cloud file into a public link anyone can open — no login. A
// share is a token → (name, url, kind) record; the file itself is already a
// public Blob URL or a self-contained data URL. Revocable; the public reader
// only ever sees non-revoked shares. This is the "global sharing center".

export interface ShareRow {
  token: string
  name: string
  url: string
  kind: string
  source: string | null
  createdAt: string
}

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_shares (
      token      text PRIMARY KEY,
      user_email text NOT NULL,
      name       text NOT NULL,
      url        text NOT NULL,
      kind       text,
      source     text,
      ref_id     text,
      revoked    boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_shares_user_idx ON freehold_shares (user_email, created_at DESC)`)
}
const ensureOnce = () => dbEnsureOnce('freehold_shares', ensure)

const newToken = () => randomBytes(12).toString('hex') // 24 hex chars, unguessable

/** Create (or reuse) a share for a file. Returns the token. */
export async function createShare(
  email: string,
  f: { name: string; url: string; kind?: string; source?: string; refId?: string },
): Promise<string | null> {
  await ensureOnce()
  // Reuse an existing non-revoked share for the same ref so links stay stable.
  if (f.refId) {
    const [existing] = await query<{ token: string }>(
      `SELECT token FROM freehold_shares WHERE user_email = $1 AND ref_id = $2 AND revoked = false LIMIT 1`,
      [email, f.refId],
    )
    if (existing?.token) return existing.token
  }
  const token = newToken()
  await query(
    `INSERT INTO freehold_shares (token, user_email, name, url, kind, source, ref_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [token, email, f.name.slice(0, 200), f.url, f.kind ?? null, f.source ?? null, f.refId ?? null],
  )
  return token
}

/** Public read — only non-revoked shares resolve. */
export async function getShare(token: string): Promise<{ name: string; url: string; kind: string } | null> {
  try {
    await ensureOnce()
    const [row] = await query<{ name: string; url: string; kind: string | null }>(
      `SELECT name, url, kind FROM freehold_shares WHERE token = $1 AND revoked = false`, [token])
    if (!row) return null
    return { name: row.name, url: row.url, kind: row.kind || 'file' }
  } catch { return null }
}

export async function listShares(email: string): Promise<ShareRow[]> {
  try {
    await ensureOnce()
    const rows = await query<{ token: string; name: string; url: string; kind: string | null; source: string | null; created_at: string }>(
      `SELECT token, name, url, kind, source, created_at::text
       FROM freehold_shares WHERE user_email = $1 AND revoked = false ORDER BY created_at DESC`, [email])
    return rows.map((r) => ({ token: r.token, name: r.name, url: r.url, kind: r.kind || 'file', source: r.source, createdAt: r.created_at }))
  } catch { return [] }
}

export async function revokeShare(email: string, token: string): Promise<boolean> {
  try {
    await ensureOnce()
    await query(`UPDATE freehold_shares SET revoked = true WHERE token = $1 AND user_email = $2`, [token, email])
    return true
  } catch { return false }
}
