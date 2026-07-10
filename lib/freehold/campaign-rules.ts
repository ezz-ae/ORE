import { query } from '@/lib/db'

/**
 * Campaign automation rules — "if a metric crosses a threshold, do X". The
 * headline is the lead-QUALITY rule (e.g. quality < 60 → pause; quality > 95 →
 * budget +200%) that no ad platform offers, because only we know the real-world
 * outcome of each lead.
 *
 * Safety: rules are EVALUATED here (pure, side-effect free). Applying an action
 * (which pauses a campaign or changes a real budget) is an explicit, separate
 * step in the UI that reuses the tested control endpoints — this module never
 * spends or pauses money on its own.
 */

export type RuleMetric = 'quality' | 'cpl' | 'leads' | 'spend' | 'ctr'
export type RuleOperator = 'lt' | 'gt'
export type RuleAction = 'pause' | 'resume' | 'budget_up' | 'budget_down' | 'notify'

export const RULE_METRICS: RuleMetric[] = ['quality', 'cpl', 'leads', 'spend', 'ctr']
export const RULE_OPERATORS: RuleOperator[] = ['lt', 'gt']
export const RULE_ACTIONS: RuleAction[] = ['pause', 'resume', 'budget_up', 'budget_down', 'notify']

export interface CampaignRule {
  id: string
  campaignId: string | null   // null = applies to every campaign
  name: string
  metric: RuleMetric
  operator: RuleOperator
  threshold: number
  action: RuleAction
  actionValue: number | null  // percent, for budget_up / budget_down
  enabled: boolean
  lastTriggeredAt: string | null
  createdAt: string
}

/** The live metric snapshot a rule set is evaluated against. `quality` is null
 *  when the campaign has no attributed leads yet (that rule simply can't fire). */
export interface RuleMetrics {
  quality: number | null
  cpl: number
  leads: number
  spend: number
  ctr: number
}

export interface RuleMatch {
  rule: CampaignRule
  currentValue: number
}

let ensured = false
async function ensureRulesTable(): Promise<void> {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_campaign_rules (
      id text PRIMARY KEY,
      owner_email text NOT NULL,
      campaign_id text,
      name text,
      metric text NOT NULL,
      operator text NOT NULL,
      threshold numeric NOT NULL,
      action text NOT NULL,
      action_value numeric,
      enabled boolean DEFAULT true,
      last_triggered_at timestamptz,
      created_at timestamptz DEFAULT now()
    )
  `)
  ensured = true
}

interface RuleRow {
  id: string; campaign_id: string | null; name: string | null
  metric: string; operator: string; threshold: string
  action: string; action_value: string | null; enabled: boolean
  last_triggered_at: string | null; created_at: string
}

function toRule(r: RuleRow): CampaignRule {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    name: r.name ?? '',
    metric: r.metric as RuleMetric,
    operator: r.operator as RuleOperator,
    threshold: Number(r.threshold),
    action: r.action as RuleAction,
    actionValue: r.action_value === null ? null : Number(r.action_value),
    enabled: !!r.enabled,
    lastTriggeredAt: r.last_triggered_at,
    createdAt: r.created_at,
  }
}

/** Rules for a specific campaign PLUS the account's global (campaign_id IS NULL) rules. */
export async function listRules(email: string, campaignId?: string): Promise<CampaignRule[]> {
  await ensureRulesTable()
  const rows = await query<RuleRow>(
    `SELECT * FROM freehold_campaign_rules
      WHERE owner_email = $1 AND ($2 = '' OR campaign_id = $2 OR campaign_id IS NULL)
      ORDER BY created_at DESC`,
    [email, campaignId ?? ''],
  )
  return rows.map(toRule)
}

export interface RuleInput {
  campaignId?: string | null
  name?: string
  metric: RuleMetric
  operator: RuleOperator
  threshold: number
  action: RuleAction
  actionValue?: number | null
}

export async function createRule(email: string, input: RuleInput): Promise<CampaignRule | null> {
  await ensureRulesTable()
  if (!RULE_METRICS.includes(input.metric) || !RULE_OPERATORS.includes(input.operator) || !RULE_ACTIONS.includes(input.action)) return null
  if (!Number.isFinite(input.threshold)) return null
  const id = `rule-${crypto.randomUUID()}`
  const [row] = await query<RuleRow>(
    `INSERT INTO freehold_campaign_rules (id, owner_email, campaign_id, name, metric, operator, threshold, action, action_value, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
    [id, email, input.campaignId || null, input.name ?? '', input.metric, input.operator, input.threshold, input.action, input.actionValue ?? null],
  )
  return row ? toRule(row) : null
}

export async function updateRule(id: string, email: string, patch: { enabled?: boolean; triggered?: boolean }): Promise<boolean> {
  await ensureRulesTable()
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  if (typeof patch.enabled === 'boolean') { sets.push(`enabled = $${i++}`); vals.push(patch.enabled) }
  if (patch.triggered) { sets.push(`last_triggered_at = now()`) }
  if (!sets.length) return false
  vals.push(id, email)
  const res = await query(`UPDATE freehold_campaign_rules SET ${sets.join(', ')} WHERE id = $${i++} AND owner_email = $${i}`, vals)
  return Array.isArray(res) // best-effort truthy
}

export async function deleteRule(id: string, email: string): Promise<void> {
  await ensureRulesTable()
  await query(`DELETE FROM freehold_campaign_rules WHERE id = $1 AND owner_email = $2`, [id, email])
}

/** Pure, side-effect-free evaluation. Returns only the rules that currently fire. */
export function evaluateRules(rules: CampaignRule[], metrics: RuleMetrics): RuleMatch[] {
  const matches: RuleMatch[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    const cur = metrics[rule.metric]
    if (cur === null || cur === undefined || Number.isNaN(cur)) continue // e.g. quality with no leads yet
    const fires = rule.operator === 'lt' ? cur < rule.threshold : cur > rule.threshold
    if (fires) matches.push({ rule, currentValue: cur })
  }
  return matches
}
