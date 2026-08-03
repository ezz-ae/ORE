import { ensureOnce as dbEnsureOnce, query } from '@/lib/db'

// ─── Draft-everything ─────────────────────────────────────────────────────────
// Any in-progress work — a document being typed, a landing being edited, an
// uploaded image opened in the editor, a half-built campaign — is autosaved as
// a DRAFT so closing the tab never loses it. Drafts are per-user and keyed by
// (kind, refKey) so re-editing the same thing updates one row instead of piling
// up. Explicit Save/Publish clears the draft (the work now lives in its real
// home); until then it shows up under "Continue editing" on the Drive home.

export type DraftKind = 'doc' | 'landing' | 'image' | 'video' | 'pdf' | 'campaign' | 'upload'

export interface DraftRow {
  id: string
  kind: DraftKind
  refKey: string
  title: string
  href: string
  updatedAt: string
}
export interface DraftFull extends DraftRow {
  payload: Record<string, unknown> | null
}

const MAX_PAYLOAD = 300_000 // ~300KB of JSON — plenty for text/form state, not media blobs.

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_drafts (
      id         text PRIMARY KEY,
      user_email text NOT NULL,
      kind       text NOT NULL,
      ref_key    text NOT NULL,
      title      text,
      href       text NOT NULL,
      payload    jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_drafts_user_idx ON freehold_drafts (user_email, updated_at DESC)`)
}
const ensureOnce = () => dbEnsureOnce('freehold_drafts', ensure)

// Deterministic id so autosaving the same editor instance upserts one row.
const draftId = (email: string, kind: string, refKey: string) =>
  `draft:${email}:${kind}:${refKey}`.slice(0, 200)

/** Recent drafts for the "Continue editing" shelf (no payload — light). */
export async function listDrafts(email: string, limit = 12): Promise<DraftRow[]> {
  try {
    await ensureOnce()
    const rows = await query<{ id: string; kind: string; ref_key: string; title: string | null; href: string; updated_at: string }>(
      `SELECT id, kind, ref_key, title, href, updated_at::text
       FROM freehold_drafts WHERE user_email = $1 ORDER BY updated_at DESC LIMIT $2`,
      [email, Math.min(limit, 50)],
    )
    return rows.map((r) => ({
      id: r.id, kind: (r.kind as DraftKind), refKey: r.ref_key,
      title: r.title || 'Untitled', href: r.href, updatedAt: r.updated_at,
    }))
  } catch { return [] }
}

/** Full draft (with payload) to resume an editor exactly where it was left. */
export async function getDraft(email: string, kind: string, refKey: string): Promise<DraftFull | null> {
  try {
    await ensureOnce()
    const rows = await query<{ id: string; kind: string; ref_key: string; title: string | null; href: string; payload: unknown; updated_at: string }>(
      `SELECT id, kind, ref_key, title, href, payload, updated_at::text
       FROM freehold_drafts WHERE id = $1`,
      [draftId(email, kind, refKey)],
    )
    const r = rows[0]
    if (!r) return null
    return {
      id: r.id, kind: (r.kind as DraftKind), refKey: r.ref_key,
      title: r.title || 'Untitled', href: r.href, updatedAt: r.updated_at,
      payload: (r.payload && typeof r.payload === 'object') ? (r.payload as Record<string, unknown>) : null,
    }
  } catch { return null }
}

/** Upsert a draft. Called (debounced) by the client as the user works. */
export async function saveDraft(
  email: string,
  d: { kind: DraftKind; refKey: string; title?: string; href: string; payload?: Record<string, unknown> },
): Promise<DraftRow | null> {
  await ensureOnce()
  const id = draftId(email, d.kind, d.refKey)
  const title = (d.title || 'Untitled').slice(0, 200)
  let payloadJson: string | null = null
  if (d.payload) {
    const j = JSON.stringify(d.payload)
    payloadJson = j.length > MAX_PAYLOAD ? null : j // oversize → keep the pointer, drop the body
  }
  const rows = await query<{ updated_at: string }>(
    `INSERT INTO freehold_drafts (id, user_email, kind, ref_key, title, href, payload, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, href = EXCLUDED.href,
       payload = EXCLUDED.payload, updated_at = now()
     RETURNING updated_at::text`,
    [id, email, d.kind, d.refKey, title, d.href, payloadJson],
  )
  return { id, kind: d.kind, refKey: d.refKey, title, href: d.href, updatedAt: rows[0]?.updated_at ?? new Date().toISOString() }
}

/** Clear a draft — called on explicit Save/Publish, or when the user dismisses it. */
export async function deleteDraft(email: string, opts: { id?: string; kind?: string; refKey?: string }): Promise<boolean> {
  try {
    await ensureOnce()
    const id = opts.id || (opts.kind && opts.refKey ? draftId(email, opts.kind, opts.refKey) : null)
    if (!id) return false
    // Scope the delete to the owner so an id can't remove someone else's draft.
    await query(`DELETE FROM freehold_drafts WHERE id = $1 AND user_email = $2`, [id, email])
    return true
  } catch { return false }
}
