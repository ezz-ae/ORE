import { randomUUID } from 'node:crypto'
import { del } from '@vercel/blob'
import { query } from '@/lib/db'

// ─── Cloud — account-level file storage ───────────────────────────────────────
// Real files (images, PDFs, spreadsheets, anything) live in Vercel Blob; this
// table holds their metadata + which folder the user filed them under. Bulk
// uploads go browser→Blob directly (signed by /api/freehold/cloud/upload),
// then the client records the returned URL here. Personal to each account.
//
// Needs BLOB_READ_WRITE_TOKEN in the environment; without it the upload route
// says so honestly and nothing else here is reachable.

export const cloudConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN

export interface CloudFile {
  id: string
  folder: string | null
  name: string
  mime: string | null
  url: string
  pathname: string
  size: number
  createdAt: string
}

export interface CloudFolder { name: string; files: number }

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_cloud_files (
      id         text PRIMARY KEY,
      user_email text NOT NULL,
      folder     text,
      name       text NOT NULL,
      mime       text,
      url        text NOT NULL,
      pathname   text NOT NULL,
      size       bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_cloud_files_user_idx ON freehold_cloud_files (user_email, created_at DESC)`)
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_cloud_folders (
      user_email text NOT NULL,
      name       text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_email, name)
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

const cleanFolder = (v: unknown): string | null => {
  const s = String(v ?? '').trim().slice(0, 80)
  return s || null
}

const mapRow = (r: Record<string, unknown>): CloudFile => ({
  id: String(r.id),
  folder: r.folder ? String(r.folder) : null,
  name: String(r.name),
  mime: r.mime ? String(r.mime) : null,
  url: String(r.url),
  pathname: String(r.pathname),
  size: Number(r.size ?? 0),
  createdAt: String(r.created_at),
})

/** Record a file the client already uploaded to Blob. */
export async function recordCloudFile(
  email: string,
  f: { name: string; mime?: string | null; url: string; pathname: string; size?: number; folder?: string | null },
): Promise<CloudFile | null> {
  await ensureOnce()
  const id = `cf-${randomUUID()}`
  const folder = cleanFolder(f.folder)
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_cloud_files (id, user_email, folder, name, mime, url, pathname, size)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, folder, name, mime, url, pathname, size, created_at::text AS created_at`,
    [id, email, folder, String(f.name).slice(0, 200), f.mime ?? null, f.url, f.pathname, Math.max(0, Math.round(f.size ?? 0))],
  )
  // Filing into a folder makes it exist even before other files land there.
  if (folder) await createCloudFolder(email, folder).catch(() => {})
  return rows[0] ? mapRow(rows[0]) : null
}

export async function listCloudFiles(email: string, folder?: string | null): Promise<CloudFile[]> {
  try {
    await ensureOnce()
    const rows = folder === undefined
      ? await query<Record<string, unknown>>(
          `SELECT id, folder, name, mime, url, pathname, size, created_at::text AS created_at
           FROM freehold_cloud_files WHERE user_email = $1 ORDER BY created_at DESC`, [email])
      : await query<Record<string, unknown>>(
          `SELECT id, folder, name, mime, url, pathname, size, created_at::text AS created_at
           FROM freehold_cloud_files WHERE user_email = $1 AND folder IS NOT DISTINCT FROM $2 ORDER BY created_at DESC`,
          [email, cleanFolder(folder)])
    return rows.map(mapRow)
  } catch { return [] }
}

/** Remove a file: drop its Blob object AND its row (owner-scoped). */
export async function deleteCloudFile(email: string, id: string): Promise<boolean> {
  try {
    await ensureOnce()
    const rows = await query<{ url: string }>(
      `DELETE FROM freehold_cloud_files WHERE id = $1 AND user_email = $2 RETURNING url`, [id, email])
    const url = rows[0]?.url
    if (!url) return false
    if (cloudConfigured()) await del(url).catch(() => { /* row already gone; orphan blob is harmless */ })
    return true
  } catch { return false }
}

export async function listCloudFolders(email: string): Promise<CloudFolder[]> {
  try {
    await ensureOnce()
    // Named folders (incl. empty ones) plus any folder referenced by a file.
    const rows = await query<{ name: string; files: string }>(
      `SELECT f.name,
              COALESCE(c.n, 0)::text AS files
       FROM (
         SELECT name FROM freehold_cloud_folders WHERE user_email = $1
         UNION
         SELECT DISTINCT folder AS name FROM freehold_cloud_files WHERE user_email = $1 AND folder IS NOT NULL
       ) f
       LEFT JOIN (
         SELECT folder, COUNT(*) AS n FROM freehold_cloud_files WHERE user_email = $1 AND folder IS NOT NULL GROUP BY folder
       ) c ON c.folder = f.name
       ORDER BY f.name`,
      [email],
    )
    return rows.map((r) => ({ name: r.name, files: parseInt(r.files, 10) || 0 }))
  } catch { return [] }
}

export async function createCloudFolder(email: string, name: string): Promise<boolean> {
  const clean = cleanFolder(name)
  if (!clean) return false
  await ensureOnce()
  await query(
    `INSERT INTO freehold_cloud_folders (user_email, name) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [email, clean],
  )
  return true
}

/** Delete an (empty-or-not) folder record; files inside fall back to root. */
export async function deleteCloudFolder(email: string, name: string): Promise<boolean> {
  try {
    await ensureOnce()
    const clean = cleanFolder(name)
    if (!clean) return false
    await query(`UPDATE freehold_cloud_files SET folder = NULL WHERE user_email = $1 AND folder = $2`, [email, clean])
    await query(`DELETE FROM freehold_cloud_folders WHERE user_email = $1 AND name = $2`, [email, clean])
    return true
  } catch { return false }
}

/** Move a file to another folder (null = root). Owner-scoped. */
export async function moveCloudFile(email: string, id: string, folder: string | null): Promise<boolean> {
  try {
    await ensureOnce()
    const clean = cleanFolder(folder)
    await query(`UPDATE freehold_cloud_files SET folder = $3 WHERE id = $1 AND user_email = $2`, [id, email, clean])
    if (clean) await createCloudFolder(email, clean).catch(() => {})
    return true
  } catch { return false }
}
