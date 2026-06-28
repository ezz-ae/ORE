import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import { ensureLeadActivityTable } from '@/lib/data'
import { listEnabledRulesForTrigger, markRuleRan, getWorkspaceConfig } from './db'
import { pickAgentForLead, type LeadForDistribution } from './distribution'
import {
  DEFAULT_WORKSPACE,
  type Action,
  type AutomationRule,
  type Condition,
  type RuleTrigger,
} from './types'

/**
 * The rule engine: evaluate IF-conditions against an event context, then run
 * the THEN-actions. Server-only (uses pg). Designed to never throw into the
 * caller — a failing rule logs and is skipped so it can't break lead intake.
 */

export interface LeadContext {
  entity: 'lead'
  id: string
  source: string | null
  status: string | null
  priority: string | null
  country: string | null
  budget_aed: number | null
  project_slug: string | null
  landing_slug: string | null
  assigned_broker_id: string | null
  created_at: string | null
  last_contact_at: string | null
}

export type RuleContext = LeadContext

// ── Condition evaluation ─────────────────────────────────────────────────────
function fieldValue(field: string, ctx: RuleContext): string | number | null {
  const now = Date.now()
  switch (field) {
    case 'lead.source': return ctx.source
    case 'lead.status': return ctx.status
    case 'lead.priority': return ctx.priority
    case 'lead.country': return ctx.country
    case 'lead.budget_aed': return ctx.budget_aed
    case 'lead.project_slug': return ctx.project_slug
    case 'lead.landing_slug': return ctx.landing_slug
    case 'lead.assigned_broker_id': return ctx.assigned_broker_id
    case 'lead.hours_since_created':
      return ctx.created_at ? Math.floor((now - new Date(ctx.created_at).getTime()) / 3.6e6) : null
    case 'lead.hours_since_contact':
      return ctx.last_contact_at ? Math.floor((now - new Date(ctx.last_contact_at).getTime()) / 3.6e6) : null
    default: return null
  }
}

function evalCondition(cond: Condition, ctx: RuleContext): boolean {
  const actual = fieldValue(cond.field, ctx)
  const { operator: op, value } = cond
  switch (op) {
    case 'is_empty': return actual === null || actual === '' || actual === undefined
    case 'is_not_empty': return !(actual === null || actual === '' || actual === undefined)
    case 'eq': return String(actual ?? '').toLowerCase() === String(value ?? '').toLowerCase()
    case 'neq': return String(actual ?? '').toLowerCase() !== String(value ?? '').toLowerCase()
    case 'contains': return String(actual ?? '').toLowerCase().includes(String(value ?? '').toLowerCase())
    case 'in': return Array.isArray(value) && value.map((v) => v.toLowerCase()).includes(String(actual ?? '').toLowerCase())
    case 'not_in': return Array.isArray(value) && !value.map((v) => v.toLowerCase()).includes(String(actual ?? '').toLowerCase())
    case 'gt': return Number(actual) > Number(value)
    case 'gte': return Number(actual) >= Number(value)
    case 'lt': return Number(actual) < Number(value)
    case 'lte': return Number(actual) <= Number(value)
    default: return false
  }
}

export function ruleMatches(rule: AutomationRule, ctx: RuleContext): boolean {
  if (!rule.conditions.length) return true // no conditions ⇒ always fires
  const results = rule.conditions.map((c) => evalCondition(c, ctx))
  return rule.combinator === 'any' ? results.some(Boolean) : results.every(Boolean)
}

// ── Action execution ─────────────────────────────────────────────────────────
async function logLeadActivity(leadId: string, type: string, description: string) {
  await ensureLeadActivityTable()
  await query(
    `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
     VALUES ($1, $2, $3, $4, NULL)`,
    [randomUUID(), leadId, type, description],
  ).catch(() => {})
}

export interface ActionResult { action: string; detail: string }

async function runAction(action: Action, ctx: LeadContext, workspaceId: string): Promise<ActionResult | null> {
  switch (action.type) {
    case 'assign_to_agent': {
      if (!action.brokerId) return null
      await query(`UPDATE freehold_site_leads SET assigned_broker_id = $1, updated_at = now() WHERE id = $2`, [action.brokerId, ctx.id])
      ctx.assigned_broker_id = action.brokerId
      await logLeadActivity(ctx.id, 'assignment', `Auto-assigned to ${action.brokerId} by rule`)
      return { action: 'assign_to_agent', detail: action.brokerId }
    }
    case 'assign_round_robin':
    case 'assign_load_balanced': {
      const strategy = action.type === 'assign_round_robin' ? 'round_robin' : 'load_balanced'
      const cfg = await getWorkspaceConfig(workspaceId)
      const lead: LeadForDistribution = { id: ctx.id, source: ctx.source, project_slug: ctx.project_slug, interest: null, country: ctx.country }
      const broker = await pickAgentForLead(
        { ...cfg.distribution, mode: 'auto', strategy, pool: action.pool ?? cfg.distribution.pool },
        lead,
      )
      if (!broker) return null
      await query(`UPDATE freehold_site_leads SET assigned_broker_id = $1, updated_at = now() WHERE id = $2`, [broker, ctx.id])
      ctx.assigned_broker_id = broker
      await logLeadActivity(ctx.id, 'assignment', `Auto-assigned to ${broker} (${strategy}) by rule`)
      return { action: action.type, detail: broker }
    }
    case 'set_priority': {
      if (!action.value) return null
      await query(`UPDATE freehold_site_leads SET priority = $1, updated_at = now() WHERE id = $2`, [action.value, ctx.id])
      ctx.priority = action.value
      return { action: 'set_priority', detail: action.value }
    }
    case 'set_status': {
      if (!action.value) return null
      await query(`UPDATE freehold_site_leads SET status = $1, updated_at = now() WHERE id = $2`, [action.value, ctx.id])
      ctx.status = action.value
      return { action: 'set_status', detail: action.value }
    }
    case 'snooze': {
      const hours = action.hours ?? 24
      await query(`UPDATE freehold_site_leads SET snooze_until = now() + ($1 || ' hours')::interval, updated_at = now() WHERE id = $2`, [String(hours), ctx.id])
        .catch(() => {})
      await logLeadActivity(ctx.id, 'follow_up', `Follow-up scheduled in ${hours}h by rule`)
      return { action: 'snooze', detail: `${hours}h` }
    }
    case 'notify': {
      const target = action.target ?? 'management'
      await logLeadActivity(ctx.id, 'note', `Notification (${target}): ${action.message || 'Rule triggered'}`)
      return { action: 'notify', detail: target }
    }
    case 'require_approval': {
      await logLeadActivity(ctx.id, 'note', `Flagged for approval by rule`)
      return { action: 'require_approval', detail: 'flagged' }
    }
    case 'pause_campaign':
      // Campaign pause is handled by the ads pipeline; record intent here.
      return { action: 'pause_campaign', detail: 'requested' }
    default:
      return null
  }
}

// ── Public entry points ──────────────────────────────────────────────────────
export interface EngineRunResult {
  matched: number
  actions: ActionResult[]
}

/** Run all enabled rules for a trigger against a lead context. */
export async function runRules(
  trigger: RuleTrigger,
  ctx: LeadContext,
  workspaceId = DEFAULT_WORKSPACE,
): Promise<EngineRunResult> {
  const out: EngineRunResult = { matched: 0, actions: [] }
  let rules: AutomationRule[]
  try {
    rules = await listEnabledRulesForTrigger(trigger, workspaceId)
  } catch {
    return out
  }
  for (const rule of rules) {
    let matched = false
    try {
      matched = ruleMatches(rule, ctx)
    } catch {
      continue
    }
    if (!matched) continue
    out.matched++
    for (const action of rule.actions) {
      try {
        const r = await runAction(action, ctx, workspaceId)
        if (r) out.actions.push(r)
      } catch (e) {
        console.error('[automation] action failed', rule.id, action.type, e)
      }
    }
    await markRuleRan(rule.id)
    if (rule.stopOnMatch) break
  }
  return out
}

/**
 * Full handling for a newly-created lead: apply auto-distribution first (if the
 * workspace has it on and the lead is unassigned), then run lead.created rules.
 * Never throws — lead intake must succeed regardless.
 */
export async function handleNewLead(leadId: string, workspaceId = DEFAULT_WORKSPACE): Promise<EngineRunResult> {
  const empty: EngineRunResult = { matched: 0, actions: [] }
  try {
    const rows = await query<LeadContext & { interest: string | null }>(
      `SELECT 'lead'::text AS entity, id, source, status, priority, country, budget_aed,
              project_slug, landing_slug, assigned_broker_id, interest,
              created_at::text, last_contact_at::text
       FROM freehold_site_leads WHERE id = $1 LIMIT 1`,
      [leadId],
    )
    if (!rows.length) return empty
    const ctx = rows[0] as LeadContext & { interest: string | null }

    // 1) Auto-distribution (only if unassigned).
    const cfg = await getWorkspaceConfig(workspaceId)
    if (cfg.distribution.mode === 'auto' && !ctx.assigned_broker_id) {
      const broker = await pickAgentForLead(cfg.distribution, {
        id: ctx.id, source: ctx.source, project_slug: ctx.project_slug, interest: ctx.interest, country: ctx.country,
      })
      if (broker) {
        await query(`UPDATE freehold_site_leads SET assigned_broker_id = $1, updated_at = now() WHERE id = $2`, [broker, ctx.id])
        ctx.assigned_broker_id = broker
        await logLeadActivity(ctx.id, 'assignment', `Auto-distributed to ${broker} (${cfg.distribution.strategy})`)
      }
    }

    // 2) lead.created rules.
    const ruleResult = await runRules('lead.created', ctx, workspaceId)
    return ruleResult
  } catch (e) {
    console.error('[automation] handleNewLead failed', e)
    return empty
  }
}
