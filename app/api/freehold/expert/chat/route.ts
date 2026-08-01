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
import { runExpertSdk } from '@/lib/freehold/expert-agent-run'
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

// A line that is tool-call pseudo-code — `print(agent.tool(...))`, a dotted
// call, or a bare snake_case invocation. These are instructions the model
// meant to EXECUTE; rendering them as chat both looks broken and, worse,
// leaves the metric question unanswered so the next turn fabricates numbers.
const PSEUDO_CALL_LINE = /^\s*(?:print\s*\()?\s*[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*\([^)]*\)+\s*;?\s*$/i

/** Strip pseudo-call lines out of a text block; null when nothing human remains. */
function stripPseudoCalls(content: string): string | null {
  const kept = content.split(/\n/).filter((line) => !PSEUDO_CALL_LINE.test(line))
  const out = kept.join('\n').trim()
  return out ? out : null
}

function blocksFromParsed(parsed: unknown): ExpertBlock[] | null {
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as { blocks?: ExpertBlock[]; type?: string }
  if (Array.isArray(obj.blocks) && obj.blocks.length > 0) {
    // Drop blank text blocks — a {"blocks":[{"type":"text","content":""}]}
    // reply otherwise renders as a naked tool-chip bubble with no answer.
    // Text blocks also shed any tool-call pseudo-code lines (see
    // PSEUDO_CALL_LINE); a block that was ONLY pseudo-code drops entirely,
    // which lets the rephrase/grounded fallbacks downstream take over.
    const arr = obj.blocks
      .map((b) => {
        if (b && typeof b === 'object' && (b as { type?: string }).type === 'text') {
          const cleaned = stripPseudoCalls(String((b as { content?: unknown }).content ?? ''))
          return cleaned === null ? null : ({ ...(b as object), content: cleaned } as ExpertBlock)
        }
        return b
      })
      .filter((b): b is ExpertBlock => !!b && typeof b === 'object' && 'type' in b &&
        !((b as { type?: string }).type === 'text' && !String((b as { content?: unknown }).content ?? '').trim()))
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
    // Never surface bare tool identifiers as an "answer": a malformed
    // tool-call object salvaged here is exactly how raw names like
    // "ads_campaign_insights" leaked into chat bubbles (twice, when the
    // object carried the name under two keys). A snake_case token is never
    // a human answer — dropping them lets the grounded tools-ran fallback
    // downstream take over instead.
    .filter((t) => !/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(t))
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
  // Plain prose is fine to show; anything that still looks like JSON/code is
  // not — this is the backstop for a tool-call shape parseToolCall couldn't
  // recognize (an unknown/misspelled tool name, or a genuinely new drift
  // pattern): never let raw call/print syntax reach the user as a "reply".
  const text = raw.trim()
  const looksLikeCode = /^\s*(?:print\s*\(|[a-z][a-z0-9_.]*\s*\([^)]*\)\s*;?\s*$)/i
  if (!text || text.startsWith('{') || text.startsWith('[') || looksLikeCode.test(text)) return REPHRASE_FALLBACK
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
    // Each turn can fan out to up to 6 pro-tier model calls (initial + 5 tool
    // continuations) — the cap is per POST, so keep it sized for pro pricing.
    const rl = await checkRateLimit(`expert-chat:${sessionUser?.email ?? 'anon'}`, { limit: 20, windowSec: 60 })
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

    // A detail page's "Ask the Expert" strip can pin a specific record to
    // this turn (see lib/freehold/expert-bus.ts ExpertContextRef) — hand the
    // model the exact id instead of making it infer one from a name in
    // prose, which breaks when two records share a name.
    const ref = body.context?.ref as { kind?: string; id?: string; label?: string } | undefined
    const refGuidance = ref?.kind && ref.id
      ? `\n\nThe user has attached ${ref.kind.toUpperCase()} id="${ref.id}" ("${ref.label ?? ref.id}") as the subject of this turn. Call the matching lookup tool with this EXACT id — do not search by name.`
      : ''

    // What the user can currently SEE — a text snapshot of their open page,
    // captured client-side at send time. Without it the model only knows the
    // URL and reads as "unaware of the page".
    const pageGuidance = typeof (body.context as Record<string, unknown> | undefined)?.pageContent === 'string'
      ? `\n\ncontext.pageContent is the TEXT CURRENTLY VISIBLE on the user's screen (their open page). When the user says "this campaign", "this offer", "the page", or similar, resolve it from context.pageContent first — they expect you to see what they see.
SCREEN TRUTH: before presenting any entity (an ad, campaign, lead, form) as "this one", cross-check it against context.pageContent — the names, copy and numbers on screen are ground truth. If your tool result doesn't match what's on the page, you fetched the WRONG entity: re-list, find the one whose details match the screen, and answer with that. If the user says you described the wrong one, that re-listing is YOUR job — never apologize and ask them for an identifier.`
      : ''

    // Language: answer in the user's interface language (they set it in the
    // app) unless THIS message is clearly written in another language, in which
    // case mirror the language they just used.
    // The user can attach a file (PDF/image/audio) to a turn — it is extracted
    // to text client-side and rides in context.attachment. Tell the model it is
    // there so it grounds the answer in the file, not just the page.
    const attachment = (body.context as { attachment?: { name?: string; content?: string } } | undefined)?.attachment
    const attachmentGuidance = attachment?.content
      ? `\n\nThe user has ATTACHED A FILE to this message ("${attachment.name ?? 'file'}") — its extracted text is provided to you. Read it and ground your answer in it: when the user says "this file", "the brochure", "the attachment", "this PDF/image", they mean this. Use it to fill forms, extract project facts, or answer questions about its contents.`
      : ''

    const localeName: Record<string, string> = { ar: 'Arabic (العربية)', ru: 'Russian (Русский)', en: 'English' }
    const uiLocale = String((body.context as Record<string, unknown> | undefined)?.locale ?? 'en')
    const languageGuidance = ` \n\nLANGUAGE: The user's interface language is ${localeName[uiLocale] ?? 'English'}. Write your entire reply — every block, label and button — in that language, UNLESS the user's latest message is clearly written in a different language, in which case reply in the language they just used. Keep proper nouns, project names, and identifiers as-is. Numbers and currency stay in digits.`

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
CAPABILITY TRUTH — THE HARD BOUNDARY: the tools listed below are the COMPLETE set of things you can do. You have NO background jobs, NO import capability, NO scheduled or long-running processes, and NO ability to do anything after this reply is sent. Sentences like "I am initiating the import", "this runs securely in the background", "this may take several hours" are FABRICATED ACTIONS unless a tool in THIS turn actually did the thing — and no such tool exists. If the user asks for something outside your tools (importing historical CRM data, connecting integrations, migrations), say plainly that you cannot do it from chat and point to the exact page where it lives (CRM/HubSpot sync: /freehold-intelligence/integrations/hubspot). Every action button you offer MUST correspond to a tool you can execute when they confirm — a button for a capability you do not have is a lie with styling.
METRIC QUESTIONS REQUIRE A TOOL CALL: when the user asks about leads, lead quality, campaign performance, spend, CPL, or any other figure that is not already in your context JSON, your FIRST response must be the tool call that fetches it — never a direct answer. Answering a metric question with numbers that came from neither context nor a tool result is fabrication and strictly forbidden; if no tool covers it, say you don't have that data and where it lives.
DO THE WORK YOURSELF — never ask the user for an id, a list, or a current value your tools or context.pageContent can supply. Need an ad set id? List the ad sets. Need the current budget? Read it from the listing or the page. Asking the user "please provide the ad set ID" when you have a list tool is a failure.
If the target is unambiguous — the campaign has exactly one ad set, or the page shows exactly one campaign — act on it directly; do not ask "which one".
SCREEN TRUTH: before presenting any entity's details as "this ad/campaign/lead", verify they MATCH context.pageContent — the copy and numbers on the user's screen are ground truth. A mismatch means you fetched the wrong entity: re-list and pick the one that matches the screen. If the user corrects you, re-resolving is YOUR job — never ask them for an identifier.
When the user asks for a directional change without a number ("spend more", "lower the budget"), read the CURRENT value yourself and propose ONE concrete change (~20–30% in that direction, floor AED 50) as a one-click confirmation showing current → new. Never ask the user to supply the number.
Tools marked ⚠destructive change live campaigns/money/content: set "confirm": true ONLY when the user's own latest message explicitly requests or confirms that exact action. Otherwise first answer with blocks that ask for confirmation (an "actions" block whose prompt states the exact action, e.g. "Yes — pause campaign X").
The user is currently on ${body.page ?? 'an unknown page'} — prefer that surface's specialist when routing.
Your tools:${renderToolDocs(tools)}`

    const systemPrompt = `${skill.systemPrompt}\n\n${MASTER_SYSTEM_PROMPT}${roleGuidance}${modeGuidance}${refGuidance}${pageGuidance}${attachmentGuidance}${languageGuidance}${tools.length ? `\n\n${autonomyGuidance(autonomy)}` : ''}${toolProtocol}\n${BLOCK_PROTOCOL}`

    // Behind EXPERT_USE_AI_SDK: the same guidance, but tools are called
    // natively by the AI SDK (no JSON tool_call protocol). The confirm rule and
    // block-output contract are unchanged.
    const sdkToolGuidance = tools.length === 0 ? '' : `

YOU ARE THE MARKETING COORDINATOR AGENT with REAL tools (ads / landing / crm / creative / research). Call the tools you need to get real data or take actions, then give your FINAL answer as {"blocks":[...]}. NEVER invent or guess a tool result.
CAPABILITY TRUTH — THE HARD BOUNDARY: the tools listed below are the COMPLETE set of things you can do. You have NO background jobs, NO import capability, NO scheduled or long-running processes, and NO ability to do anything after this reply is sent. Sentences like "I am initiating the import", "this runs securely in the background", "this may take several hours" are FABRICATED ACTIONS unless a tool in THIS turn actually did the thing — and no such tool exists. If the user asks for something outside your tools (importing historical CRM data, connecting integrations, migrations), say plainly that you cannot do it from chat and point to the exact page where it lives (CRM/HubSpot sync: /freehold-intelligence/integrations/hubspot). Every action button you offer MUST correspond to a tool you can execute when they confirm — a button for a capability you do not have is a lie with styling.
METRIC QUESTIONS REQUIRE A TOOL CALL: when the user asks about leads, lead quality, campaign performance, spend, CPL, or any other figure not already in your context JSON, call the tool that fetches it BEFORE answering — numbers that came from neither context nor a tool result are fabrication and strictly forbidden; if no tool covers it, say you don't have that data and where it lives.
DO THE WORK YOURSELF — never ask the user for an id, a list, or a current value your tools or context.pageContent can supply. If the target is unambiguous (one ad set, one campaign on the page), act on it directly. For a directional ask without a number ("spend more"), read the current value and propose ONE concrete change (~20–30%, floor AED 50) as a one-click confirmation showing current → new — never ask the user to supply the number.
SCREEN TRUTH: before presenting any entity's details as "this ad/campaign/lead", verify they MATCH context.pageContent — the screen is ground truth. A mismatch means you fetched the wrong entity: re-list and pick the one that matches. If the user corrects you, re-resolving is YOUR job — never ask them for an identifier.
Tools marked destructive change live campaigns/money/content: pass confirm:true ONLY when the user's own latest message explicitly requests or confirms that exact action. If a tool returns needsConfirm, do NOT retry it — answer with an "actions" block whose prompt states the exact action (e.g. "Yes — pause campaign X") and wait.
The user is currently on ${body.page ?? 'an unknown page'} — prefer that surface's specialist when routing.`
    const sdkSystemPrompt = `${skill.systemPrompt}\n\n${MASTER_SYSTEM_PROMPT}${roleGuidance}${modeGuidance}${refGuidance}${pageGuidance}${attachmentGuidance}${languageGuidance}${tools.length ? `\n\n${autonomyGuidance(autonomy)}` : ''}${sdkToolGuidance}\n${BLOCK_PROTOCOL}`

    let raw: string | undefined
    const toolsUsed: string[] = []
    // Human-readable one-liners of real tool results this turn — shared by the
    // legacy loop's limit reply AND the grounded never-empty fallback below.
    const resultNotes: string[] = []
    let sdkError: string | null = null

    if (process.env.EXPERT_USE_AI_SDK === '1' && sessionUser) {
      // ── AI SDK path (native multi-step tool-calling) ──────────────────────
      try {
        const sdk = await runExpertSdk({
          message, systemPrompt: sdkSystemPrompt, context: fullContext,
          history: durableHistory, toolCtx, hasTools: tools.length > 0,
        })
        raw = stripThinking(sdk.raw)
        toolsUsed.push(...sdk.toolsUsed)
      } catch (err) {
        // The SDK path is opt-in and unproven against every tool schema — never
        // let it break the chat: capture why, then fall through to the legacy
        // path below (which cannot throw — its model ladder is fully caught).
        sdkError = err instanceof Error ? err.message : String(err)
        console.error('[expert] AI SDK path failed — falling back to legacy:', sdkError)
      }
    }

    if (raw === undefined) {
      // ── Legacy path: JSON tool_call loop (also the AI-SDK fallback) ────────
      let loopHistory = durableHistory
      raw = stripThinking(await queryServerAgent(message, {
        sessionId,
        context: fullContext,
        systemPrompt,
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        temperature: 0.5,
        history: loopHistory,
        // The coordinator REASONS across tools and page state — pro tier.
        modelTier: 'pro',
      }))

      // Tool loop: execute → feed the observation back → let the model continue.
      // Guards: a per-turn budget; a duplicate-call breaker (a model re-issuing
      // the identical call would burn the whole budget on one action); and a
      // hard rule that raw tool_call JSON never becomes the reply — leaked call
      // JSON was being persisted into the session and poisoning the next turn
      // (the "repeated tool call without TOOL_RESULT" failure on "continue").
      const MAX_TOOLS_PER_TURN = 5
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
          modelTier: 'pro',
        }))
      }

      // Never let a dangling tool_call escape the loop — it would render as
      // gibberish AND corrupt the saved session for every later turn.
      if (tools.length > 0 && parseToolCall(raw, toolNames)) raw = limitReply()
    }

    let blocks = parseBlocks(raw ?? '')

    // ── FABRICATED-ACTION TRIPWIRE ────────────────────────────────────────────
    // Screenshot-verified failure: asked to import historical CRM leads (a
    // capability that does not exist), the model answered "I am initiating the
    // one-time import… runs securely in the background… may take several
    // hours." No tool ran. Nothing was initiated. The user walked away
    // believing a multi-hour job was working for them.
    //
    // A claim of STARTED WORK is only ever true here if a mutating tool
    // executed this turn — the assistant has no other way to start anything.
    // So: first-person initiation/background-process language + zero
    // destructive tools executed = fabrication, and the claim is replaced with
    // an honest correction rather than delivered. English-pattern only (the
    // model's own drift is overwhelmingly English) — a partial net that
    // catches the observed lie beats a perfect net that ships never.
    const FABRICATED_ACTION = /\b(?:i(?:\s+(?:am|have|will\s+now)|['’]ve)\s+(?:now\s+)?(?:initiat\w*|start\w*|begun|beginn\w*|queu\w*|kick\w*\s+off|import\w*|migrat\w*|sync\w*)|(?:runs?|running)\s+(?:securely\s+)?in\s+the\s+background|may\s+take\s+(?:several|a\s+few)\s+(?:hours|minutes))\b/i
    const destructiveRan = toolsUsed.some((name) => tools.find((tl) => tl.name === name)?.destructive)
    if (tools.length > 0 && !destructiveRan) {
      const claimsAction = blocks.some((b) => b.type === 'text' && FABRICATED_ACTION.test(String((b as { content?: unknown }).content ?? '')))
      if (claimsAction) {
        blocks = [{
          type: 'text',
          content: 'I have to correct myself: I did not actually start anything — no action ran just now, and I have no background-import capability. What I can genuinely do here: search and update the leads already in the CRM, and manage campaigns. For importing or syncing CRM data, use Integrations → HubSpot (Sync) in the platform — that is a real import, visible and verifiable.',
        }]
      }
    }
    // Never end a turn with tool chips and no answer: if the model executed
    // real tools but produced no meaningful text, answer with what actually
    // happened (real results — never invented) and invite a follow-up.
    const meaningless = blocks === REPHRASE_FALLBACK ||
      blocks.every((b) => b.type === 'text' && !String((b as { content?: unknown }).content ?? '').trim())
    if (meaningless && toolsUsed.length > 0) {
      blocks = [{
        type: 'text',
        content: resultNotes.length
          ? `Here is what I did:\n${resultNotes.join('\n')}\n\nI could not finish a full answer from that — tell me what to do next with these results.`
          : `I ran ${toolsUsed.length} action(s) (${Array.from(new Set(toolsUsed)).join(', ')}) but could not finish a full answer. Ask me to continue, or rephrase what you need.`,
      }]
    }
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
      warnings: sdkError ? [`AI SDK path fell back to legacy: ${sdkError}`] : [],
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
