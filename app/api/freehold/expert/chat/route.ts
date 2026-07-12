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
const REPHRASE_FALLBACK: ExpertBlock[] = [{ type: 'text', content: 'I lost my train of thought there — ask me that once more and I’ll answer properly.' }]

function blocksFromParsed(parsed: unknown): ExpertBlock[] | null {
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as { blocks?: ExpertBlock[]; type?: string }
  if (Array.isArray(obj.blocks) && obj.blocks.length > 0) {
    const arr = obj.blocks.filter((b) => b && typeof b === 'object' && 'type' in b)
    if (arr.length > 0) return arr
  }
  // Tolerate a BARE block (`{"type":"landing",…}`) or a bare array — models
  // sometimes skip the {"blocks":[…]} envelope; without this the user sees
  // raw JSON as text.
  if (Array.isArray(parsed)) {
    const arr = (parsed as ExpertBlock[]).filter((b) => b && typeof b === 'object' && 'type' in b && BLOCK_TYPES.has((b as { type: string }).type))
    if (arr.length > 0) return arr
  }
  if (typeof obj.type === 'string' && BLOCK_TYPES.has(obj.type)) {
    return [parsed as ExpertBlock]
  }
  // Unknown object shape (e.g. {"answer": "..."} / a stray tool_call): salvage
  // any human-readable strings rather than dumping JSON on a non-developer.
  const texts = Object.entries(obj as Record<string, unknown>)
    .filter(([k, v]) => typeof v === 'string' && (v as string).trim().length > 0 && k !== 'type' && k !== 'thinking')
    .map(([, v]) => (v as string).trim())
  if (texts.length > 0) return [{ type: 'text', content: texts.join('\n\n') }]
  return null
}

function parseBlocks(raw: string): ExpertBlock[] {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const found = blocksFromParsed(JSON.parse(trimmed))
    if (found) return found
    return REPHRASE_FALLBACK
  } catch {
    // Not clean JSON. Models sometimes wrap the JSON in prose — try the first
    // balanced {...} region before giving up.
    const start = trimmed.indexOf('{')
    if (start !== -1) {
      let depth = 0
      for (let i = start; i < trimmed.length; i++) {
        const ch = trimmed[i]
        if (ch === '{') depth++
        else if (ch === '}' && --depth === 0) {
          try {
            const found = blocksFromParsed(JSON.parse(trimmed.slice(start, i + 1)))
            if (found) return found
          } catch { /* keep falling through */ }
          break
        }
      }
    }
  }
  // Plain prose is fine to show; anything that still looks like JSON/code is not.
  const text = raw.trim()
  if (!text || text.startsWith('{') || text.startsWith('[')) return REPHRASE_FALLBACK
  return [{ type: 'text', content: text }]
}

// One human-readable line per executed tool, for the "hit the tool limit"
// reply — so a cut-off turn still tells the user what actually happened.
function summarizeToolResult(result: unknown): string {
  if (!result || typeof result !== 'object') return 'done'
  const r = result as Record<string, unknown>
  if (typeof r.error === 'string' && r.error) return `failed — ${r.error.slice(0, 140)}`
  for (const key of ['message', 'summary', 'status', 'url', 'reviewUrl', 'wizardUrl', 'path']) {
    if (typeof r[key] === 'string' && r[key]) return String(r[key]).slice(0, 160)
  }
  return 'done'
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
After each call the conversation gains a TOOL_RESULT message; then either call another tool (max 5 per turn) or give your final answer in the normal {"blocks":[...]} format, grounded in the real results. NEVER invent or guess a tool result. NEVER repeat a call you already made this turn — its result is already in the conversation.
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
    // Guards: a per-turn budget; a duplicate-call breaker (a model re-issuing
    // the identical call would burn the whole budget on one action); and a
    // hard rule that raw tool_call JSON never becomes the reply — leaked call
    // JSON was being persisted into the session and poisoning the next turn
    // (the "repeated tool call without TOOL_RESULT" failure on "continue").
    const MAX_TOOLS_PER_TURN = 5
    const toolsUsed: string[] = []
    const resultNotes: string[] = []
    const seenCalls = new Set<string>()
    const limitReply = () =>
      JSON.stringify({
        blocks: [{
          type: 'text',
          content: resultNotes.length
            ? `I hit this turn's tool limit. Done so far:\n${resultNotes.join('\n')}\nSay "continue" and I'll pick up from here.`
            : `I hit this turn's tool limit before finishing — say "continue" and I'll pick up from here.`,
        }],
      })

    const toolNames = tools.map((tl) => tl.name)
    for (let i = 0; i <= MAX_TOOLS_PER_TURN && tools.length > 0; i++) {
      const call = parseToolCall(raw, toolNames)
      if (!call) break
      if (toolsUsed.length >= MAX_TOOLS_PER_TURN) {
        raw = limitReply()
        break
      }
      const callKey = `${call.name}:${JSON.stringify(call.args)}`
      let observation: string
      if (seenCalls.has(callKey)) {
        observation = `DUPLICATE_CALL ${call.name}: you already ran this exact call this turn — its TOOL_RESULT is above. Use it, or give your final answer now.`
      } else {
        seenCalls.add(callKey)
        const result = await runCoordinatorTool(tools, call, toolCtx)
        toolsUsed.push(call.name)
        resultNotes.push(`• ${call.name}: ${summarizeToolResult(result)}`)
        observation = `TOOL_RESULT ${call.name}: ${JSON.stringify(result).slice(0, 6000)}`
      }
      loopHistory = [
        ...(loopHistory ?? []),
        { role: 'model' as const, text: JSON.stringify({ tool_call: call }) },
        { role: 'user' as const, text: observation },
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

    // Never let a dangling tool_call escape the loop — it would render as
    // gibberish AND corrupt the saved session for every later turn.
    if (tools.length > 0 && parseToolCall(raw, toolNames)) raw = limitReply()

    const blocks = parseBlocks(raw)
    // Persist the turn to the account's session so nothing is lost on reload —
    // and return the (possibly newly created) session id to the client.
    const persistedId = sessionUser
      ? await appendExpertTurn(sessionId, sessionUser.email, message, blocks)
      : sessionId
    const data = { blocks, skill: skill.id, sessionId: persistedId, toolsUsed }

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
    // The chat bubble is read by real-estate people — keep it human. The raw
    // error stays in `warnings` for operators reading the network response.
    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        layer: 'expert',
        status: 'error',
        data: { blocks: [{ type: 'text', content: 'I couldn’t finish that one — give it another try in a moment. If it keeps happening, ask your admin to check the AI connection under Integrations.' }] },
        evidence: ['Request processing failed'],
        warnings: [msg],
        nextActions: ['Retry the question'],
        generatedAt,
      },
      { status: 500 },
    )
  }
}
