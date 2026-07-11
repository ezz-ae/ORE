import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { McpResponseEnvelope } from '@/types/freehold-mcp'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { getSkill } from '@/lib/freehold/ai-skills'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { BLOCK_PROTOCOL, type ExpertBlock } from '@/lib/freehold/expert-blocks'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { appendExpertTurn, getExpertSession, blocksToText } from '@/lib/freehold/expert-sessions'
import {
  toolsForRole, renderToolDocs, parseToolCall, runCoordinatorTool,
  type CoordinatorRole, type ToolCtx,
} from '@/lib/freehold/coordinator-tools'
import { MASTER_SYSTEM_PROMPT, detectMode, laneGuidance, autonomyGuidance, stripThinking } from '@/lib/freehold/agent-router'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { gatherTeamMetrics } from '@/lib/freehold/team-metrics'
import { getFinanceTotals } from '@/lib/deals'
import { query } from '@/lib/db'
import type { Role as SessionRole } from '@/lib/freehold/session-types'
import type { Role } from '@/types/freehold-mcp'

export const runtime = 'nodejs'

type ExpertRole = 'owner' | 'admin' | 'marketing' | 'sales_manager' | 'sales_agent' | 'data_manager' | 'viewer'

/**
 * Map the authenticated session role → the MCP/Expert role used for tool
 * authorization. Derived server-side from the verified session so a client can
 * never escalate by claiming a higher role in the request body.
 */
const SESSION_TO_EXPERT: Record<SessionRole, ExpertRole> = {
  broker: 'sales_agent',
  admin: 'admin',
  sales_manager: 'sales_manager',
  director: 'admin',
  ceo: 'owner',
  marketing: 'marketing',
}

interface ExpertChatRequest {
  message: string
  sessionId?: string
  /** Current page path, so the Expert knows where the user is. */
  page?: string
  /** Extra page-specific context the caller wants to add. */
  context?: Record<string, unknown>
}

/**
 * Gather a compact live snapshot of the whole platform so the Expert is
 * genuinely system-aware. Each tool fails soft — a missing slice never breaks
 * the chat.
 */
async function gatherSystemContext(role: Role, brokerId: string | null): Promise<Record<string, unknown>> {
  const safe = async (toolName: string, args?: Record<string, unknown>) => {
    try {
      const res = await executeTool({ toolName, role, args })
      return res.status === 'success' ? res.data : null
    } catch {
      return null
    }
  }

  // Team performance (effort + experience + results) is management-only — it
  // lets the one Expert answer best-performer, ad-budget and retention/flight-risk
  // questions with depth, grounded in live data.
  const canSeeTeam = role === 'owner' || role === 'admin' || role === 'sales_manager'
  // Infrastructure/ops context (server health, launch blockers, integration
  // connection status) is only relevant to operators — owner/admin/marketing.
  // A broker (sales_agent) must NEVER be told to "fix Meta billing" or "connect
  // HubSpot": their world is leads, follow-ups, viewings and deals. So we feed
  // brokers their OWN pipeline instead of the company's infrastructure backlog.
  const isOperator = role === 'owner' || role === 'admin' || role === 'marketing'
  const isBroker = role === 'sales_agent'

  const [server, blockers, inventory, integrations, leadMachine, team, finance, crm, myPipeline] = await Promise.all([
    isOperator ? safe('server-summary') : Promise.resolve(null),
    isOperator ? safe('launch-blockers') : Promise.resolve(null),
    safe('inventory-analysis'),                       // useful to everyone for property advice
    isOperator ? safe('integration-summary') : Promise.resolve(null),
    isOperator ? safe('lead-machine-summary') : Promise.resolve(null),
    canSeeTeam ? gatherTeamMetrics().catch(() => null) : Promise.resolve(null),
    // Finance + CRM pipeline round out the single shared context so the one
    // Expert answers finance/CRM questions with live data — management-gated.
    canSeeTeam ? getFinanceTotals().catch(() => null) : Promise.resolve(null),
    canSeeTeam ? crmPipelineSnapshot().catch(() => null) : Promise.resolve(null),
    // A broker's own book of business — the only pipeline they should be coached on.
    isBroker && brokerId ? brokerPipelineSnapshot(brokerId).catch(() => null) : Promise.resolve(null),
  ])

  return { server, launchBlockers: blockers, inventory, integrations, leadMachine, teamPerformance: team, finance, crm, myPipeline }
}

/** A single broker's own pipeline snapshot — scopes the Expert to their work. */
async function brokerPipelineSnapshot(brokerId: string): Promise<Record<string, number> | null> {
  try {
    const [row] = await query<{ total: string; new_count: string; hot: string; viewing: string; overdue: string; closed: string }>(`
      SELECT COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'new')::text AS new_count,
        COUNT(*) FILTER (WHERE priority IN ('hot','priority'))::text AS hot,
        COUNT(*) FILTER (WHERE status = 'viewing')::text AS viewing,
        COUNT(*) FILTER (WHERE last_contact_at < now() - INTERVAL '72 hours' AND status NOT IN ('closed','converted','lost'))::text AS overdue,
        COUNT(*) FILTER (WHERE status IN ('closed','converted'))::text AS closed
      FROM freehold_site_leads WHERE assigned_broker_id = $1`, [brokerId])
    if (!row) return null
    return {
      myLeads: parseInt(row.total, 10),
      newLeads: parseInt(row.new_count, 10),
      hotLeads: parseInt(row.hot, 10),
      viewingsScheduled: parseInt(row.viewing, 10),
      overdueFollowups: parseInt(row.overdue, 10),
      closedDeals: parseInt(row.closed, 10),
    }
  } catch {
    return null
  }
}

/** Compact CRM pipeline snapshot (counts by stage) for the Expert context. */
async function crmPipelineSnapshot(): Promise<Record<string, number> | null> {
  try {
    const [row] = await query<{ total: string; new_count: string; closed: string; hot: string; overdue: string }>(`
      SELECT COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'new')::text AS new_count,
        COUNT(*) FILTER (WHERE status IN ('closed','converted'))::text AS closed,
        COUNT(*) FILTER (WHERE priority IN ('hot','priority'))::text AS hot,
        COUNT(*) FILTER (WHERE last_contact_at < now() - INTERVAL '72 hours' AND status NOT IN ('closed','converted','lost'))::text AS overdue
      FROM freehold_site_leads`)
    if (!row) return null
    return {
      totalLeads: parseInt(row.total, 10),
      newLeads: parseInt(row.new_count, 10),
      closedLeads: parseInt(row.closed, 10),
      hotLeads: parseInt(row.hot, 10),
      overdueFollowups: parseInt(row.overdue, 10),
    }
  } catch {
    return null
  }
}

/** Parse the model's JSON into blocks; fall back to a single text block. */
const BLOCK_TYPES = new Set(['text', 'plan', 'actions', 'color', 'landing', 'media', 'path'])
function parseBlocks(raw: string): ExpertBlock[] {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const parsed = JSON.parse(trimmed) as { blocks?: ExpertBlock[]; type?: string }
    if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
      return parsed.blocks.filter((b) => b && typeof b === 'object' && 'type' in b)
    }
    // Tolerate a BARE block (`{"type":"landing",…}`) or a bare array — models
    // sometimes skip the {"blocks":[…]} envelope; without this the user sees
    // raw JSON as text.
    if (Array.isArray(parsed)) {
      const arr = (parsed as unknown as ExpertBlock[]).filter((b) => b && typeof b === 'object' && 'type' in b && BLOCK_TYPES.has((b as { type: string }).type))
      if (arr.length > 0) return arr
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string' && BLOCK_TYPES.has(parsed.type)) {
      return [parsed as unknown as ExpertBlock]
    }
  } catch {
    // fall through
  }
  return [{ type: 'text', content: raw.trim() || 'I could not format a response. Try rephrasing.' }]
}

export async function POST(request: NextRequest) {
  const generatedAt = new Date().toISOString()
  try {
    const body = (await request.json()) as ExpertChatRequest
    const message = body.message?.trim() || ''
    // Derive the role from the verified session — never from the request body.
    // Unauthenticated callers get the least-privilege 'viewer' role.
    const sessionUser = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
    const role: ExpertRole = sessionUser ? (SESSION_TO_EXPERT[sessionUser.role] ?? 'viewer') : 'viewer'
    const sessionId = body.sessionId?.trim() ? body.sessionId : `expert-${crypto.randomUUID()}`

    if (!message) {
      return NextResponse.json(
        { layer: 'expert', status: 'error', data: { blocks: [{ type: 'text', content: 'Ask me anything about the business.' }] }, generatedAt },
        { status: 400 },
      )
    }

    // Cap AI usage per user (per-IP-ish for anon) so a runaway loop can't drain credits.
    const rl = await checkRateLimit(`expert-chat:${sessionUser?.email ?? 'anon'}`, { limit: 40, windowSec: 60 })
    if (!rl.ok) {
      return NextResponse.json(
        { layer: 'expert', status: 'error', data: { blocks: [{ type: 'text', content: 'You’re sending requests too quickly — give me a few seconds.' }] }, retryAfterSec: rl.retryAfterSec, generatedAt },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      )
    }

    const skill = getSkill('expert')!
    const brokerId = sessionUser?.role === 'broker' ? (sessionUser.brokerId ?? sessionUser.email) : null
    const systemContext = await gatherSystemContext(role as Role, brokerId)

    const fullContext: Record<string, unknown> = {
      currentPage: body.page ?? null,
      role,
      system: systemContext,
      ...(body.context ?? {}),
    }

    // Role guidance keeps the one Expert in the right lane. A broker must be
    // coached only on their own sales work — never on company infrastructure,
    // billing, integrations or other people's books.
    const roleGuidance = role === 'sales_agent'
      ? `\n\nYOU ARE ADVISING A BROKER (sales agent). Focus ONLY on their own sales work: their leads in context.myPipeline, follow-ups, viewings, qualifying, and closing deals. Recommend the single highest-leverage next action on THEIR pipeline. NEVER tell them to fix billing, connect integrations, resolve DNS, manage other agents, or touch company infrastructure — those are not their job. If there is no live pipeline data, coach them on prospecting and follow-up discipline.`
      : role === 'marketing'
        ? `\n\nYou are advising MARKETING: focus on campaigns, ads, landing pages, content and attribution. Infrastructure/integration fixes are in scope only when they block ad delivery.`
        : `\n\nYou are advising an OPERATOR (owner/admin/manager): full-system scope is appropriate.`

    // Supervisor-Worker router: the composer's explicit mode chip wins;
    // otherwise the supervisor detects the lane from the message's intent
    // verbs (sync/nurture/debug/…) and swaps in that worker's prompt.
    const chatMode = String((body.context as Record<string, unknown> | undefined)?.chatMode ?? '')
    const lane = detectMode(message, chatMode || null)
    // Tripartite guardrail — stored server-side, management-set; the model
    // only receives a description of what it may attempt.
    const autonomy = sessionUser ? await getAutonomyLevel() : 1
    const modeGuidance = laneGuidance(lane)

    // Durable session memory: replay the conversation's recent turns from the
    // DB so a resumed chat (new device, cold instance) still remembers itself.
    let durableHistory: Array<{ role: 'user' | 'model'; text: string }> | undefined
    if (sessionUser && body.sessionId) {
      const stored = await getExpertSession(body.sessionId, sessionUser.email)
      if (stored?.messages.length) {
        durableHistory = stored.messages.slice(-20).map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('model' as const),
          text: m.role === 'user' ? (m.content ?? '') : blocksToText(m.blocks),
        })).filter((h) => h.text)
      }
    }

    // ── Coordinator tools (Vertex-ADK style): the one chat can CALL REAL
    //    specialist tools — ads / landing / crm / creative / research. Only
    //    authenticated users get tools; the toolset is role-gated server-side.
    const tools = sessionUser ? toolsForRole(role as CoordinatorRole) : []
    const toolCtx: ToolCtx = { role: role as CoordinatorRole, email: sessionUser?.email ?? '', brokerId, autonomy }
    const toolProtocol = tools.length === 0 ? '' : `

YOU ARE THE MARKETING COORDINATOR AGENT. You can execute REAL tools via your specialist agents. To call one, respond with ONLY this JSON (no blocks, no prose):
{"tool_call": {"name": "<tool_name>", "args": { ... }}}
After each call the conversation gains a TOOL_RESULT message; then either call another tool (max 3 per turn) or give your final answer in the normal {"blocks":[...]} format, grounded in the real results. NEVER invent or guess a tool result.
Tools marked ⚠destructive change live campaigns/money/content: set "confirm": true ONLY when the user's own latest message explicitly requests or confirms that exact action. Otherwise first answer with blocks that ask for confirmation (an "actions" block whose prompt states the exact action, e.g. "Yes — pause campaign X").
The user is currently on ${body.page ?? 'an unknown page'} — prefer that surface's specialist when routing.
Your tools:${renderToolDocs(tools)}`

    const systemPrompt = `${skill.systemPrompt}\n\n${MASTER_SYSTEM_PROMPT}${roleGuidance}${modeGuidance}${tools.length ? `\n\n${autonomyGuidance(autonomy)}` : ''}${toolProtocol}\n${BLOCK_PROTOCOL}`

    let loopHistory = durableHistory
    let raw = stripThinking(await queryServerAgent(message, {
      sessionId,
      context: fullContext,
      systemPrompt,
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.5,
      history: loopHistory,
    }))

    // Tool loop: execute → feed the observation back → let the model continue.
    const toolsUsed: string[] = []
    for (let i = 0; i < 4 && tools.length > 0; i++) {
      const call = parseToolCall(raw)
      if (!call) break
      if (toolsUsed.length >= 3) {
        raw = JSON.stringify({ blocks: [{ type: 'text', content: 'I hit the tool limit for one turn — here is what I have so far. Ask me to continue.' }] })
        break
      }
      const result = await runCoordinatorTool(tools, call, toolCtx)
      toolsUsed.push(call.name)
      loopHistory = [
        ...(loopHistory ?? []),
        { role: 'model' as const, text: JSON.stringify({ tool_call: call }) },
        { role: 'user' as const, text: `TOOL_RESULT ${call.name}: ${JSON.stringify(result).slice(0, 6000)}` },
      ]
      raw = stripThinking(await queryServerAgent(message, {
        sessionId,
        context: fullContext,
        systemPrompt,
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        temperature: 0.5,
        history: loopHistory,
      }))
    }

    const blocks = parseBlocks(raw)
    // Persist the turn to the account's session so nothing is lost on reload —
    // and return the (possibly newly created) session id to the client.
    const persistedId = sessionUser
      ? await appendExpertTurn(sessionId, sessionUser.email, message, blocks)
      : sessionId
    const data = { blocks, skill: skill.id, sessionId: persistedId }

    const response: McpResponseEnvelope<typeof data> = {
      requestId: crypto.randomUUID(),
      layer: 'expert',
      status: 'success',
      data,
      evidence: [
        `Role: ${role}`,
        'Skill: expert (full-system)',
        `Context: ${Object.entries(systemContext).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}`,
        ...(toolsUsed.length ? [`Tools executed: ${toolsUsed.join(', ')}`] : []),
      ],
      warnings: [],
      nextActions: ['Act on a button', 'Ask a follow-up'],
      generatedAt,
    }

    return NextResponse.json(response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        layer: 'expert',
        status: 'error',
        data: { blocks: [{ type: 'text', content: `Expert error: ${msg}` }] },
        evidence: ['Request processing failed'],
        warnings: [msg],
        nextActions: ['Check VERTEX_AI_SERVICE_ACCOUNT_JSON environment variable'],
        generatedAt,
      },
      { status: 500 },
    )
  }
}
