import { query, ensureOnce } from '@/lib/db'
import { DEFAULT_WORKSPACE } from '@/lib/automation/types'

/**
 * Workspace-wide data-security policy — separate from per-user settings
 * (freehold_site_users.settings) because these are organization-level
 * decisions (network-benchmark participation, number masking), not personal
 * preferences. Same minimal jsonb-blob-per-workspace shape as
 * workspace_automation_config, kept in its own table since the concerns are
 * unrelated to automation rules.
 */
export interface DataSecurityConfig {
  /** When true, this tenant's aggregated signals are excluded from the
   * cross-tenant network benchmarks (still SEES other tenants' benchmarks —
   * this only controls whether it CONTRIBUTES). */
  networkBenchmarksOptOut: boolean
  /** When true, exact lead counts in the shared benchmark view are bucketed
   * into ranges (5-9, 10-24, …) instead of shown as exact numbers — applied
   * server-side, so it's a real control, not a client-side cosmetic mask. */
  maskBenchmarkNumbers: boolean
}

const DEFAULTS: DataSecurityConfig = {
  networkBenchmarksOptOut: false,
  maskBenchmarkNumbers: true,
}

async function ensureTable(): Promise<void> {
  await ensureOnce('workspace_data_security_config', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS workspace_data_security_config (
        workspace_id text PRIMARY KEY,
        config       jsonb NOT NULL,
        updated_at   timestamptz NOT NULL DEFAULT now()
      )
    `)
  })
}

export async function getDataSecurityConfig(workspaceId = DEFAULT_WORKSPACE): Promise<DataSecurityConfig> {
  try {
    await ensureTable()
    const rows = await query<{ config: Partial<DataSecurityConfig> }>(
      `SELECT config FROM workspace_data_security_config WHERE workspace_id = $1 LIMIT 1`,
      [workspaceId],
    )
    return { ...DEFAULTS, ...(rows[0]?.config ?? {}) }
  } catch {
    return DEFAULTS
  }
}

export async function updateDataSecurityConfig(
  patch: Partial<DataSecurityConfig>,
  workspaceId = DEFAULT_WORKSPACE,
): Promise<DataSecurityConfig> {
  await ensureTable()
  const current = await getDataSecurityConfig(workspaceId)
  const merged = { ...current, ...patch }
  await query(
    `INSERT INTO workspace_data_security_config (workspace_id, config, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (workspace_id) DO UPDATE SET config = $2::jsonb, updated_at = now()`,
    [workspaceId, JSON.stringify(merged)],
  )
  return merged
}
