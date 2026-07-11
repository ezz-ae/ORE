import {
  listCampaigns, getCampaign, getCampaignInsights,
  updateCampaignStatus, updateAdSet, listAdSets, getAdSet,
} from '@/lib/meta/client'
import type { AutonomyLevel } from '@/lib/freehold/agent-router'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import {
  listRules, createRule,
  RULE_METRICS, RULE_OPERATORS, RULE_ACTIONS,
  type RuleMetric, type RuleOperator, type RuleAction,
} from '@/lib/freehold/campaign-rules'
import { getLandingPagesForDashboard, getLandingPageForEditor } from '@/lib/landing-pages'
import { searchCrmLeads } from '@/lib/data'
import { listLibrary, saveLibraryItem } from '@/lib/freehold/library'
import { genImage } from '@/lib/creative-studio/providers'

/**
 * Coordinator tools — the Vertex-ADK-style "marketing coordinator" layer of
 * the ONE side chat. The coordinator (the chat model) routes work to
 * specialist toolsets — ads / landing / crm / creative / research — and every
 * tool here executes a REAL internal function (the same ones the UI uses).
 * Nothing is simulated; a tool that can't run returns an honest error.
 *
 * Safety model:
 *  - Tools are role-gated server-side (the role comes from the verified
 *    session — the model cannot escalate it).
 *  - Destructive tools (pause/resume/budget/rules) additionally require
 *    args.confirm === true, which the model is instructed to set only after
 *    the user explicitly confirmed in their own words.
 */

export type CoordinatorRole =
  | 'owner' | 'admin' | 'marketing' | 'sales_manager'
  | 'sales_agent' | 'data_manager' | 'viewer'

export interface ToolCtx {
  role: CoordinatorRole
  /** Verified account email (tool ownership scoping — e.g. rules, library). */
  email: string
  brokerId: string | null
  /** Server-stored guardrail: 1 advisory · 2 semi-autonomous · 3 autopilot. */
  autonomy: AutonomyLevel
}

export interface CoordinatorTool {
  /** Stable snake name the model calls, prefixed by specialist. */
  name: string
  /** Specialist agent this tool belongs to (shown in docs + evidence). */
  agent: 'ads_agent' | 'landing_agent' | 'crm_agent' | 'creative_agent' | 'research_agent'
  description: string
  /** Human-readable args spec rendered into the prompt. */
  params: string
  /** Mutates money/live campaigns/content — requires args.confirm === true. */
  destructive?: boolean
  roles: CoordinatorRole[]
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>
}

const OPERATORS: CoordinatorRole[] = ['owner', 'admin', 'marketing']
const ADS_READERS: CoordinatorRole[] = ['owner', 'admin', 'marketing', 'sales_manager']
const EVERYONE: CoordinatorRole[] = ['owner', 'admin', 'marketing', 'sales_manager', 'sales_agent', 'data_manager']

const s = (v: unknown) => String(v ?? '').trim()
const n = (v: unknown) => Number(v)

export const COORDINATOR_TOOLS: CoordinatorTool[] = [
  // ── ads_agent ──────────────────────────────────────────────────────────────
  {
    name: 'ads_list_campaigns', agent: 'ads_agent',
    description: 'List the Meta campaigns on the connected ad account (id, name, status, daily budget).',
    params: '{}', roles: ADS_READERS,
    run: async () => {
      const campaigns = await listCampaigns()
      return campaigns.slice(0, 25).map((c) => ({
        id: c.id, name: c.name, status: c.status,
        dailyBudgetAED: c.daily_budget ? Math.round(Number(c.daily_budget) / 100) : null,
      }))
    },
  },
  {
    name: 'ads_campaign_insights', agent: 'ads_agent',
    description: 'Live performance for one campaign: spend, impressions, clicks, leads, CPC/CPM (this month).',
    params: '{ "campaignId": string }', roles: ADS_READERS,
    run: async (args) => {
      const id = s(args.campaignId)
      if (!id) return { error: 'campaignId is required' }
      const [campaign, insights] = await Promise.all([getCampaign(id), getCampaignInsights(id)])
      return { campaign: { id: campaign.id, name: campaign.name, status: campaign.status }, insights }
    },
  },
  {
    name: 'ads_campaign_quality', agent: 'ads_agent',
    description: 'The live lead-quality score (0–100) for a campaign, computed from its REAL CRM leads (wrong numbers, duplicates, funnel progress). Null score = not enough signal yet.',
    params: '{ "campaignId": string, "campaignName": string }', roles: ADS_READERS,
    run: async (args) => getCampaignQuality(s(args.campaignId), s(args.campaignName)),
  },
  {
    name: 'ads_pause_campaign', agent: 'ads_agent', destructive: true,
    description: 'PAUSE a live Meta campaign (stops spend).',
    params: '{ "campaignId": string, "confirm": true }', roles: OPERATORS,
    run: async (args) => {
      await updateCampaignStatus(s(args.campaignId), 'PAUSED')
      return { ok: true, campaignId: s(args.campaignId), status: 'PAUSED' }
    },
  },
  {
    name: 'ads_resume_campaign', agent: 'ads_agent', destructive: true,
    description: 'Set a paused Meta campaign ACTIVE (spend resumes).',
    params: '{ "campaignId": string, "confirm": true }', roles: OPERATORS,
    run: async (args) => {
      await updateCampaignStatus(s(args.campaignId), 'ACTIVE')
      return { ok: true, campaignId: s(args.campaignId), status: 'ACTIVE' }
    },
  },
  {
    name: 'ads_list_adsets', agent: 'ads_agent',
    description: 'List a campaign’s ad sets (id, name, status, daily budget) — budgets live on ad sets.',
    params: '{ "campaignId": string }', roles: ADS_READERS,
    run: async (args) => {
      const sets = await listAdSets(s(args.campaignId))
      return sets.map((x) => ({ id: x.id, name: x.name, status: x.status, dailyBudgetAED: x.daily_budget ? Math.round(Number(x.daily_budget) / 100) : null }))
    },
  },
  {
    name: 'ads_set_adset_budget', agent: 'ads_agent', destructive: true,
    description: 'Change an ad set’s daily budget in AED (min 50).',
    params: '{ "adSetId": string, "dailyBudgetAED": number, "confirm": true }', roles: OPERATORS,
    run: async (args) => {
      const budget = n(args.dailyBudgetAED)
      if (!Number.isFinite(budget) || budget < 50) return { error: 'dailyBudgetAED must be ≥ 50' }
      await updateAdSet(s(args.adSetId), { dailyBudgetAED: budget })
      return { ok: true, adSetId: s(args.adSetId), dailyBudgetAED: budget }
    },
  },
  {
    name: 'ads_list_rules', agent: 'ads_agent',
    description: 'List this account’s automation rules on the lead-quality score / CPL / spend.',
    params: '{ "campaignId"?: string }', roles: ADS_READERS,
    run: async (args, ctx) => listRules(ctx.email, s(args.campaignId) || undefined),
  },
  {
    name: 'ads_add_rule', agent: 'ads_agent', destructive: true,
    description: `Create an automation rule, e.g. "if quality < 60 pause". metric: ${RULE_METRICS.join('|')}; operator: ${RULE_OPERATORS.join('|')}; action: ${RULE_ACTIONS.join('|')} (budget_up/down need actionValue %).`,
    params: '{ "campaignId": string, "metric": string, "operator": string, "threshold": number, "action": string, "actionValue"?: number, "confirm": true }',
    roles: OPERATORS,
    run: async (args, ctx) => {
      const rule = await createRule(ctx.email, {
        campaignId: s(args.campaignId) || null,
        metric: s(args.metric) as RuleMetric,
        operator: s(args.operator) as RuleOperator,
        threshold: n(args.threshold),
        action: s(args.action) as RuleAction,
        actionValue: args.actionValue == null ? null : n(args.actionValue),
      })
      return rule ?? { error: 'Invalid rule — check metric/operator/action values.' }
    },
  },

  // ── landing_agent ──────────────────────────────────────────────────────────
  {
    name: 'landing_list', agent: 'landing_agent',
    description: 'List the landing pages (slug, title, status, leads) — the ONE store behind /lp/<slug>.',
    params: '{}', roles: EVERYONE,
    run: async () => {
      const rows = await getLandingPagesForDashboard(30)
      return rows.map((r) => ({
        slug: r.slug, headline: r.headline, status: r.status,
        isLiveNow: r.isLiveNow, leads: r.leadCount, views: r.pageViews,
      }))
    },
  },
  {
    name: 'landing_get', agent: 'landing_agent',
    description: 'Load one landing page for review: headline, sections (order/visibility), SEO, publish state. Editor: /freehold-intelligence/lead-machine/landings/<slug>/edit',
    params: '{ "slug": string }', roles: EVERYONE,
    run: async (args) => {
      const page = await getLandingPageForEditor(s(args.slug))
      if (!page) return { error: `No landing page with slug "${s(args.slug)}"` }
      return page
    },
  },

  // ── crm_agent ──────────────────────────────────────────────────────────────
  {
    name: 'crm_search_leads', agent: 'crm_agent',
    description: 'Search CRM leads by name/phone/email/project. Brokers see only their own book.',
    params: '{ "q": string }', roles: EVERYONE,
    run: async (args, ctx) => {
      const q = s(args.q)
      if (!q) return { error: 'q is required' }
      const asRole = ctx.role === 'sales_agent' ? 'broker' as const : 'admin' as const
      return searchCrmLeads(q, asRole, ctx.brokerId ?? undefined, 10)
    },
  },

  // ── creative_agent ─────────────────────────────────────────────────────────
  {
    name: 'library_list', agent: 'creative_agent',
    description: 'List the account’s Library assets (reports, notes, creatives, images, videos, pdfs).',
    params: '{ "kind"?: "report"|"note"|"creative"|"image"|"video"|"pdf" }', roles: EVERYONE,
    run: async (args, ctx) => {
      const items = await listLibrary(ctx.email, ctx.role, s(args.kind) || undefined)
      return items.slice(0, 20).map((i) => ({ id: i.id, kind: i.kind, title: i.title, createdAt: i.createdAt }))
    },
  },
  {
    name: 'creative_generate_image', agent: 'creative_agent',
    description: 'Generate a REAL marketing image from a prompt (same engine as Creative Studio), save it to the Library, and return the Drive editor path where it can be QR-stamped/edited and then used as ad media.',
    params: '{ "prompt": string, "aspectRatio"?: "1:1"|"4:5"|"9:16"|"16:9" }', roles: OPERATORS,
    run: async (args, ctx) => {
      const prompt = s(args.prompt)
      if (!prompt) return { error: 'prompt is required' }
      const out = await genImage(prompt, { aspectRatio: s(args.aspectRatio) || undefined })
      const item = await saveLibraryItem(ctx.email, { kind: 'image', title: prompt.slice(0, 80), url: out.url })
      return item
        ? { ok: true, libraryId: item.id, editorPath: `/freehold-intelligence/drive/editor/image/${item.id}` }
        : { error: 'Image generated but could not be saved to the Library.' }
    },
  },

  // ── research_agent ─────────────────────────────────────────────────────────
  {
    name: 'research_save_note', agent: 'research_agent',
    description: 'Save a research note / summary to the Library (kind: note) so it persists beyond the chat.',
    params: '{ "title": string, "content": string }', roles: EVERYONE,
    run: async (args, ctx) => {
      const title = s(args.title); const content = s(args.content)
      if (!title || !content) return { error: 'title and content are required' }
      const item = await saveLibraryItem(ctx.email, { kind: 'note', title, content })
      return item ? { ok: true, libraryId: item.id } : { error: 'Could not save' }
    },
  },
]

/** Tools this role may use. */
export function toolsForRole(role: CoordinatorRole): CoordinatorTool[] {
  return COORDINATOR_TOOLS.filter((t) => t.roles.includes(role))
}

/** Render the tool docs block for the system prompt, grouped by specialist. */
export function renderToolDocs(tools: CoordinatorTool[]): string {
  const byAgent = new Map<string, CoordinatorTool[]>()
  for (const t of tools) {
    const list = byAgent.get(t.agent) ?? []
    list.push(t); byAgent.set(t.agent, list)
  }
  const lines: string[] = []
  for (const [agent, list] of byAgent) {
    lines.push(`\n[${agent}]`)
    for (const t of list) {
      lines.push(`- ${t.name}${t.destructive ? ' ⚠destructive' : ''}: ${t.description} args: ${t.params}`)
    }
  }
  return lines.join('\n')
}

/** Parse a model turn that is a tool call: {"tool_call":{"name","args"}}. */
export function parseToolCall(raw: string): { name: string; args: Record<string, unknown> } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const parsed = JSON.parse(trimmed) as { tool_call?: { name?: string; args?: Record<string, unknown> } }
    if (parsed.tool_call?.name) {
      return { name: String(parsed.tool_call.name), args: parsed.tool_call.args ?? {} }
    }
  } catch { /* not a tool call */ }
  return null
}

/** At level 2, actions that ACTIVATE spend still need an explicit human yes. */
const L2_STILL_CONFIRM = new Set(['ads_resume_campaign'])

/**
 * Execute one tool call with role + autonomy enforcement. Never throws.
 *
 * Autonomy policy (server-enforced — the model only sees a description):
 *  L1 advisory        destructive requires args.confirm === true (the model
 *                     proposes an action card first).
 *  L2 semi-autonomous destructive runs unconfirmed EXCEPT spend-activating
 *                     tools; budget deltas clamped to ±15%; every unconfirmed
 *                     destructive action is written to the audit log.
 *  L3 autopilot       destructive runs unconfirmed; same clamp + audit.
 */
export async function runCoordinatorTool(
  tools: CoordinatorTool[],
  call: { name: string; args: Record<string, unknown> },
  ctx: ToolCtx,
): Promise<unknown> {
  const tool = tools.find((t) => t.name === call.name)
  if (!tool) return { error: `Unknown tool "${call.name}" — use only the tools listed for you.` }

  const confirmed = call.args.confirm === true
  if (tool.destructive && !confirmed) {
    const allowed = ctx.autonomy >= 2 && !(ctx.autonomy === 2 && L2_STILL_CONFIRM.has(tool.name))
    if (!allowed) {
      return {
        error: 'confirmation_required',
        hint: 'This action changes live campaigns/money. Ask the user to confirm explicitly, then retry with "confirm": true.',
      }
    }
    // Semi-autonomous budget safety: clamp to ±15% of the CURRENT budget.
    if (tool.name === 'ads_set_adset_budget') {
      try {
        const current = await getAdSet(s(call.args.adSetId))
        const cur = current.daily_budget ? Math.round(Number(current.daily_budget) / 100) : null
        if (cur && cur > 0) {
          const requested = n(call.args.dailyBudgetAED)
          const min = Math.max(50, Math.round(cur * 0.85))
          const max = Math.round(cur * 1.15)
          const clamped = Math.min(max, Math.max(min, requested))
          if (clamped !== requested) call.args = { ...call.args, dailyBudgetAED: clamped, clampedFrom: requested }
        }
      } catch { /* clamp is best-effort; the tool itself still validates */ }
    }
  }

  try {
    const result = await tool.run(call.args, ctx)
    // Audit trail: unconfirmed destructive executions are recorded where the
    // manager already looks (the Library) — the L2/L3 "system alert".
    if (tool.destructive && !confirmed && ctx.autonomy >= 2) {
      const summary = JSON.stringify({ tool: tool.name, args: call.args, result }).slice(0, 4000)
      await saveLibraryItem(ctx.email, {
        kind: 'note',
        title: `Agent action (L${ctx.autonomy}): ${tool.name}`,
        content: summary,
      }).catch(() => null)
    }
    return result
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Tool failed' }
  }
}
