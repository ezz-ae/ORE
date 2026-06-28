import { query } from '@/lib/db'
import {
  DEFAULT_WORKSPACE,
  defaultConfig,
  type AutomationRule,
  type WorkspaceAutomationConfig,
} from './types'

/**
 * Persistence for automation rules + workspace config. Tables are scoped by
 * workspace_id so the engine can serve multiple companies; today everything
 * uses the 'default' workspace.
 */

let ready: Promise<void> | null = null
export function ensureAutomationTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS automation_rules (
          id            text PRIMARY KEY,
          workspace_id  text NOT NULL DEFAULT 'default',
          name          text NOT NULL,
          enabled       boolean NOT NULL DEFAULT true,
          trigger       text NOT NULL,
          combinator    text NOT NULL DEFAULT 'all',
          conditions    jsonb NOT NULL DEFAULT '[]'::jsonb,
          actions       jsonb NOT NULL DEFAULT '[]'::jsonb,
          sort_order    integer NOT NULL DEFAULT 0,
          stop_on_match boolean NOT NULL DEFAULT false,
          run_count     integer NOT NULL DEFAULT 0,
          last_run_at   timestamptz,
          created_by    text,
          created_at    timestamptz NOT NULL DEFAULT now(),
          updated_at    timestamptz NOT NULL DEFAULT now()
        )
      `)
      await query(`CREATE INDEX IF NOT EXISTS idx_automation_rules_ws_trigger ON automation_rules (workspace_id, trigger, enabled)`)
      await query(`
        CREATE TABLE IF NOT EXISTS workspace_automation_config (
          workspace_id text PRIMARY KEY,
          config       jsonb NOT NULL,
          updated_at   timestamptz NOT NULL DEFAULT now()
        )
      `)
    })().catch((e) => {
      ready = null
      throw e
    })
  }
  return ready
}

interface RuleRow {
  id: string
  workspace_id: string
  name: string
  enabled: boolean
  trigger: string
  combinator: string
  conditions: unknown
  actions: unknown
  sort_order: number
  stop_on_match: boolean
  run_count: number
  last_run_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

function rowToRule(r: RuleRow): AutomationRule {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger as AutomationRule['trigger'],
    combinator: (r.combinator === 'any' ? 'any' : 'all'),
    conditions: Array.isArray(r.conditions) ? (r.conditions as AutomationRule['conditions']) : [],
    actions: Array.isArray(r.actions) ? (r.actions as AutomationRule['actions']) : [],
    sortOrder: r.sort_order,
    stopOnMatch: r.stop_on_match,
    runCount: r.run_count,
    lastRunAt: r.last_run_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listRules(workspaceId = DEFAULT_WORKSPACE): Promise<AutomationRule[]> {
  await ensureAutomationTables()
  const rows = await query<RuleRow>(
    `SELECT *, created_at::text, updated_at::text, last_run_at::text
     FROM automation_rules WHERE workspace_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [workspaceId],
  )
  return rows.map(rowToRule)
}

export async function listEnabledRulesForTrigger(
  trigger: string,
  workspaceId = DEFAULT_WORKSPACE,
): Promise<AutomationRule[]> {
  await ensureAutomationTables()
  const rows = await query<RuleRow>(
    `SELECT *, created_at::text, updated_at::text, last_run_at::text
     FROM automation_rules
     WHERE workspace_id = $1 AND trigger = $2 AND enabled = true
     ORDER BY sort_order ASC, created_at ASC`,
    [workspaceId, trigger],
  )
  return rows.map(rowToRule)
}

export async function getRule(id: string, workspaceId = DEFAULT_WORKSPACE): Promise<AutomationRule | null> {
  await ensureAutomationTables()
  const rows = await query<RuleRow>(
    `SELECT *, created_at::text, updated_at::text, last_run_at::text
     FROM automation_rules WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [id, workspaceId],
  )
  return rows[0] ? rowToRule(rows[0]) : null
}

export interface RuleInput {
  name: string
  enabled?: boolean
  trigger: string
  combinator?: string
  conditions?: unknown
  actions?: unknown
  sortOrder?: number
  stopOnMatch?: boolean
}

export async function createRule(
  input: RuleInput,
  createdBy: string | null,
  workspaceId = DEFAULT_WORKSPACE,
): Promise<AutomationRule> {
  await ensureAutomationTables()
  const id = `rule_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
  const rows = await query<RuleRow>(
    `INSERT INTO automation_rules
       (id, workspace_id, name, enabled, trigger, combinator, conditions, actions, sort_order, stop_on_match, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11)
     RETURNING *, created_at::text, updated_at::text, last_run_at::text`,
    [
      id, workspaceId, input.name, input.enabled ?? true, input.trigger,
      input.combinator === 'any' ? 'any' : 'all',
      JSON.stringify(input.conditions ?? []), JSON.stringify(input.actions ?? []),
      input.sortOrder ?? 0, input.stopOnMatch ?? false, createdBy,
    ],
  )
  return rowToRule(rows[0])
}

export async function updateRule(
  id: string,
  patch: Partial<RuleInput>,
  workspaceId = DEFAULT_WORKSPACE,
): Promise<AutomationRule | null> {
  await ensureAutomationTables()
  const sets: string[] = []
  const vals: unknown[] = []
  const add = (col: string, val: unknown, cast = '') => { vals.push(val); sets.push(`${col} = $${vals.length}${cast}`) }
  if (patch.name !== undefined) add('name', patch.name)
  if (patch.enabled !== undefined) add('enabled', patch.enabled)
  if (patch.trigger !== undefined) add('trigger', patch.trigger)
  if (patch.combinator !== undefined) add('combinator', patch.combinator === 'any' ? 'any' : 'all')
  if (patch.conditions !== undefined) add('conditions', JSON.stringify(patch.conditions), '::jsonb')
  if (patch.actions !== undefined) add('actions', JSON.stringify(patch.actions), '::jsonb')
  if (patch.sortOrder !== undefined) add('sort_order', patch.sortOrder)
  if (patch.stopOnMatch !== undefined) add('stop_on_match', patch.stopOnMatch)
  if (!sets.length) return getRule(id, workspaceId)
  sets.push(`updated_at = now()`)
  vals.push(id, workspaceId)
  const rows = await query<RuleRow>(
    `UPDATE automation_rules SET ${sets.join(', ')}
     WHERE id = $${vals.length - 1} AND workspace_id = $${vals.length}
     RETURNING *, created_at::text, updated_at::text, last_run_at::text`,
    vals,
  )
  return rows[0] ? rowToRule(rows[0]) : null
}

export async function deleteRule(id: string, workspaceId = DEFAULT_WORKSPACE): Promise<boolean> {
  await ensureAutomationTables()
  const rows = await query<{ id: string }>(
    `DELETE FROM automation_rules WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [id, workspaceId],
  )
  return rows.length > 0
}

export async function markRuleRan(id: string): Promise<void> {
  await query(`UPDATE automation_rules SET run_count = run_count + 1, last_run_at = now() WHERE id = $1`, [id])
    .catch(() => {})
}

// ── Workspace config ─────────────────────────────────────────────────────────
export async function getWorkspaceConfig(workspaceId = DEFAULT_WORKSPACE): Promise<WorkspaceAutomationConfig> {
  await ensureAutomationTables()
  const rows = await query<{ config: WorkspaceAutomationConfig }>(
    `SELECT config FROM workspace_automation_config WHERE workspace_id = $1 LIMIT 1`,
    [workspaceId],
  )
  if (!rows[0]?.config) return defaultConfig()
  // Merge over defaults so newly-added fields are always present.
  const d = defaultConfig()
  const c = rows[0].config
  return {
    ...d,
    ...c,
    steps: { ...d.steps, ...(c.steps || {}) },
    approvals: { ...d.approvals, ...(c.approvals || {}) },
    distribution: { ...d.distribution, ...(c.distribution || {}) },
  }
}

export async function saveWorkspaceConfig(
  config: WorkspaceAutomationConfig,
  workspaceId = DEFAULT_WORKSPACE,
): Promise<WorkspaceAutomationConfig> {
  await ensureAutomationTables()
  await query(
    `INSERT INTO workspace_automation_config (workspace_id, config, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (workspace_id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
    [workspaceId, JSON.stringify(config)],
  )
  return config
}
