import { query } from '@/lib/db'
import type { AutonomyLevel } from '@/lib/freehold/agent-router'

/**
 * Agent autonomy level — the tripartite guardrail (1 advisory · 2 semi-
 * autonomous · 3 full autopilot). Stored server-side and set only by
 * management, so neither a client nor the model can escalate it.
 */

let ensured = false
async function ensureTable(): Promise<void> {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_agent_settings (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      autonomy_level integer NOT NULL DEFAULT 1 CHECK (autonomy_level BETWEEN 1 AND 3),
      updated_by text,
      updated_at timestamptz DEFAULT now()
    )
  `)
  ensured = true
}

export async function getAutonomyLevel(): Promise<AutonomyLevel> {
  try {
    await ensureTable()
    const [row] = await query<{ autonomy_level: number }>(
      `SELECT autonomy_level FROM freehold_agent_settings WHERE id = 1`,
    )
    const lvl = row?.autonomy_level
    return lvl === 2 || lvl === 3 ? lvl : 1
  } catch {
    return 1 // fail closed to advisory
  }
}

export async function setAutonomyLevel(level: AutonomyLevel, updatedBy: string): Promise<void> {
  await ensureTable()
  await query(
    `INSERT INTO freehold_agent_settings (id, autonomy_level, updated_by, updated_at)
     VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET autonomy_level = $1, updated_by = $2, updated_at = now()`,
    [level, updatedBy],
  )
}
