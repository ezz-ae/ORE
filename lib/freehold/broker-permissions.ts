import { query } from '@/lib/db'

/**
 * Per-broker Lead-Machine permission maps. The permissions page used to fake its
 * Save (a 2s checkmark that persisted nothing) and hardcode every broker to a
 * Bronze default. This is the real store behind it.
 */

let ensured = false
async function ensureTable(): Promise<void> {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_broker_permissions (
      broker_id text PRIMARY KEY,
      perms jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz DEFAULT now()
    )
  `)
  ensured = true
}

/** All stored broker permission maps, keyed by broker id. */
export async function listBrokerPermissions(): Promise<Record<string, Record<string, boolean>>> {
  await ensureTable()
  let rows: { broker_id: string; perms: Record<string, boolean> | null }[] = []
  try {
    rows = await query<{ broker_id: string; perms: Record<string, boolean> | null }>(
      `SELECT broker_id, perms FROM freehold_broker_permissions`,
    )
  } catch { rows = [] }
  const out: Record<string, Record<string, boolean>> = {}
  for (const r of rows) out[r.broker_id] = r.perms ?? {}
  return out
}

export async function saveBrokerPermissions(brokerId: string, perms: Record<string, boolean>): Promise<void> {
  await ensureTable()
  await query(
    `INSERT INTO freehold_broker_permissions (broker_id, perms, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (broker_id) DO UPDATE SET perms = EXCLUDED.perms, updated_at = now()`,
    [brokerId, JSON.stringify(perms)],
  )
}
