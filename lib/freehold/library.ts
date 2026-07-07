import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'

// The Library — one place for everything the workspace produces or collects:
// AI reports and notes, ad creatives, images, videos and PDFs. Text content
// lives inline; media lives as URLs (ready for a generative media model to
// write into the same shelf later).

export type LibraryKind = 'report' | 'note' | 'creative' | 'image' | 'video' | 'pdf'
export const LIBRARY_KINDS: LibraryKind[] = ['report', 'note', 'creative', 'image', 'video', 'pdf']

export interface LibraryItem {
  id: string
  kind: LibraryKind
  title: string
  /** Inline text/HTML/JSON content (reports, notes, creatives). */
  content: string | null
  /** External or hosted media URL (images, videos, PDFs). */
  url: string | null
  createdBy: string
  createdAt: string
}

const isMgmt = (role?: Role | string | null) => MANAGEMENT_ROLES.includes(role as Role)

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_library (
      id          text PRIMARY KEY,
      user_email  text NOT NULL,
      kind        text NOT NULL,
      title       text NOT NULL,
      content     text,
      url         text,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

const mapRow = (r: Record<string, unknown>): LibraryItem => ({
  id: String(r.id),
  kind: (LIBRARY_KINDS.includes(r.kind as LibraryKind) ? r.kind : 'note') as LibraryKind,
  title: String(r.title ?? 'Untitled'),
  content: r.content == null ? null : String(r.content),
  url: r.url == null ? null : String(r.url),
  createdBy: String(r.user_email ?? r.created_by ?? ''),
  createdAt: String(r.created_at ?? ''),
})

/**
 * Everything on the shelf, newest first. Includes the Notebook's saved
 * outputs (reports/comparisons) so the Library is the ONE view of all
 * produced assets. Management sees the team's; others see their own.
 */
export async function listLibrary(email: string, role?: Role | string | null, kind?: string): Promise<LibraryItem[]> {
  try {
    await ensureOnce()
    const own = !isMgmt(role)
    const params: unknown[] = []
    let where = ''
    if (own) { params.push(email); where = `WHERE user_email = $${params.length}` }

    const items = (await query<Record<string, unknown>>(
      `SELECT id, user_email, kind, title, content, url, created_at::text
       FROM freehold_site_library ${where}
       ORDER BY created_at DESC LIMIT 200`,
      params,
    )).map(mapRow)

    // Notebook outputs surface as library reports (read-only union).
    const outParams: unknown[] = []
    let outWhere = ''
    if (own) { outParams.push(email); outWhere = `WHERE created_by = $${outParams.length}` }
    const outputs = (await query<Record<string, unknown>>(
      `SELECT id, created_by AS user_email, type, title, content, created_at::text
       FROM freehold_site_notebook_outputs ${outWhere}
       ORDER BY created_at DESC LIMIT 200`,
      outParams,
    ).catch(() => [])).map((r) => mapRow({ ...r, kind: 'report', url: null }))

    const all = [...items, ...outputs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return kind && LIBRARY_KINDS.includes(kind as LibraryKind) ? all.filter((i) => i.kind === kind) : all
  } catch {
    return []
  }
}

export async function saveLibraryItem(
  email: string,
  item: { kind: LibraryKind; title: string; content?: string | null; url?: string | null },
): Promise<LibraryItem | null> {
  try {
    await ensureOnce()
    const id = `lib-${randomUUID()}`
    await query(
      `INSERT INTO freehold_site_library (id, user_email, kind, title, content, url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email, item.kind, item.title.slice(0, 200), item.content ?? null, item.url ?? null],
    )
    return { id, kind: item.kind, title: item.title, content: item.content ?? null, url: item.url ?? null, createdBy: email, createdAt: new Date().toISOString() }
  } catch {
    return null
  }
}

export async function deleteLibraryItem(id: string, email: string, role?: Role | string | null): Promise<boolean> {
  try {
    await ensureOnce()
    if (isMgmt(role)) await query(`DELETE FROM freehold_site_library WHERE id = $1`, [id])
    else await query(`DELETE FROM freehold_site_library WHERE id = $1 AND user_email = $2`, [id, email])
    return true
  } catch {
    return false
  }
}
