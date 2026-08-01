import { query } from '@/lib/db'

// Real notifications — one table, self-migrating like the repo's other stores.
// `recipient` null = visible to all management users; otherwise the user id or
// email (leads key brokers by either). Text is NOT stored — a `type` + meta
// render through i18n on the client so feeds are trilingual.

let ensured = false
async function ensure() {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_notifications (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      recipient TEXT,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      href TEXT,
      read_by TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
  ensured = true
}

export type NotificationType = 'lead_new' | 'lead_assigned' | 'deal_approved' | 'management_alert'

/** Fire-and-forget emit — a notification failure must never fail the action. */
export async function notify(type: NotificationType, meta: Record<string, unknown>, opts?: { recipient?: string | null; href?: string }) {
  try {
    await ensure()
    await query(
      `INSERT INTO freehold_site_notifications (type, recipient, meta, href) VALUES ($1, $2, $3, $4)`,
      [type, opts?.recipient ?? null, JSON.stringify(meta), opts?.href ?? null],
    )
  } catch (e) {
    console.error('[notify] failed:', e)
  }
}

export interface NotificationRow {
  id: string
  type: string
  meta: Record<string, unknown>
  href: string | null
  read: boolean
  created_at: string
}

/** Last 30 days for this user (their direct + broadcast rows), newest first. */
export async function listNotifications(keys: string[], limit = 30): Promise<NotificationRow[]> {
  await ensure()
  const rows = await query<{ id: string; type: string; meta: Record<string, unknown>; href: string | null; read_by: string[]; created_at: string }>(
    `SELECT id::text, type, meta, href, read_by, created_at::text
     FROM freehold_site_notifications
     WHERE (recipient IS NULL OR recipient = ANY($1))
       AND created_at > now() - INTERVAL '30 days'
     ORDER BY created_at DESC LIMIT $2`,
    [keys, limit],
  )
  return rows.map((r) => ({ id: r.id, type: r.type, meta: r.meta ?? {}, href: r.href, read: r.read_by.some((k) => keys.includes(k)), created_at: r.created_at }))
}

/** Mark everything currently visible to this user as read (idempotent). */
export async function markAllRead(key: string): Promise<void> {
  await ensure()
  await query(
    `UPDATE freehold_site_notifications SET read_by = array_append(read_by, $1)
     WHERE NOT ($1 = ANY(read_by)) AND (recipient IS NULL OR recipient = $1 OR recipient = ANY($2))`,
    [key, [key]],
  )
}
