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
import { readableText } from '@/lib/freehold/expert-blocks'
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
import { APP_ROUTES } from '@/lib/freehold/app-routes.generated'
import { auditFigures, evidenceLine, METRIC_SHAPED, type EvidenceReport } from '@/lib/freehold/evidence'
import { unknownEntities, type EntityKind } from '@/lib/freehold/answer-grounding'
import { unsourcedListedNames } from '@/lib/freehold/listed-records'
import { gatherKnownNames, type KnownNames } from '@/lib/freehold/known-names'
import { linkAllowed } from '@/lib/freehold/link-truth'

export const runtime = 'nodejs'

type ExpertRole = 'owner' | 'admin' | 'marketing' | 'sales_manager' | 'sales_agent' | 'data_manager' | 'viewer'

/**
 * Map the authenticated session role → the MCP/Expert role used for tool
 * authorization. Derived server-side from the verified session so a client can
 * never escalate by claiming a higher role in the request body.
 */
const SESSION_TO_EXPERT: Record<SessionRole, ExpertRole> = {
  broker: 'sales_agent',
  // A team leader's AI scope is a sales manager's: their team's leads,
  // follow-ups, stages and delays — not company money or access.
  team_leader: 'sales_manager',
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

// ── LINK TRUTH: no fabricated deep links (they 404) ────────────────────────
// The model emits hrefs freely. A link is offered only when a real route
// answers it AND every segment that filled a wildcard in that route came back
// from a tool this turn — see lib/freehold/link-truth.ts for why the previous
// version (a hand-kept list of record collections, plus a guess at whether a
// segment "looked like" an id) let /freehold-intelligence/inventory/<invented>
// through to a 404 while appearing to check everything.
const hrefAllowed = (href: unknown, seen: string): boolean => linkAllowed(href, seen, APP_ROUTES)

/** Strip fabricated hrefs: a `path` block with a bad link becomes plain text
 *  (its words are kept, the 404 link is not); a navigate action with a bad
 *  link becomes a normal chat-prompt button instead of a dead link. */
function sanitizeBlockHrefs(blocks: ExpertBlock[], seen: string): ExpertBlock[] {
  return blocks.map((b) => {
    if (b.type === 'path') {
      if (hrefAllowed(b.href, seen)) return b
      const text = [b.label, b.description].filter(Boolean).join(' — ')
      return { type: 'text', content: text || b.label || '' } as ExpertBlock
    }
    if (b.type === 'actions') {
      return {
        type: 'actions',
        actions: b.actions.map((a) =>
          a.kind === 'navigate' && !hrefAllowed(a.href, seen)
            ? { label: a.label, kind: 'prompt' as const, prompt: a.prompt || a.label, style: a.style }
            : a,
        ),
      } as ExpertBlock
    }
    return b
  })
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

// One human-readable line per executed tool, for the cut-off-turn reply — so a
// truncated turn still tells the user what actually happened.
//
// It must READ LIKE A PERSON, not like a stack trace. A client shown
// `• creative_agent.library_list: failed — Unknown tool "…"` concludes the
// product is broken, and they are not wrong to. Internal tool names and
// internal error strings are for the server log; the user gets the outcome.
function summarizeToolResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const r = result as Record<string, unknown>
  // A failed internal call is not a progress note. It is logged server-side and
  // omitted here — reporting "I tried something that doesn't exist" tells the
  // user nothing they can act on.
  if (typeof r.error === 'string' && r.error) return null
  for (const key of ['message', 'summary', 'status', 'url', 'reviewUrl', 'wizardUrl', 'path']) {
    if (typeof r[key] === 'string' && r[key]) return String(r[key]).slice(0, 160)
  }
  return null
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

    // ── THE KILL SWITCH ───────────────────────────────────────────────────
    //
    // EXPERT_FREE_TEXT=0 silences the free-writing agent entirely, without a
    // deploy and without touching any of the deterministic screens.
    //
    // It exists because of a real transcript: asked about "the Zada Tower
    // campaign" — a campaign that does not exist in this account, the
    // inventory, or anywhere in this codebase — the assistant answered at
    // length about its automation rules, its lead quality score, its lead
    // count, its ad copy and its price. All invented, in business prose, with
    // buttons under them.
    //
    // The grounding checks below now catch that specific shape. They are nets,
    // not a cure, and the owner of a business running real money through this
    // screen is entitled to a switch that does not depend on my nets holding.
    // Every panel that reads live data and carries a real button keeps working
    // when this is off; only the part that WRITES SENTENCES stops.
    if (process.env.EXPERT_FREE_TEXT === '0') {
      return NextResponse.json({
        layer: 'expert',
        status: 'ok',
        data: {
          blocks: [{
            type: 'text',
            content:
              'The chat assistant is switched off for this workspace. Everything it could do is on the screens themselves: '
              + 'Live shows every campaign with what is wrong and the button that fixes it, the campaign page shows the ad sets side by side, '
              + 'and the CRM shows the leads. Nothing there is written by a model — every number comes from Meta or from your own database.',
          }],
        },
        generatedAt,
      })
    }

    const skill = getSkill('expert')!
    const brokerId = sessionUser?.role === 'broker' ? (sessionUser.brokerId ?? sessionUser.email) : null
    // The real records this workspace holds, gathered in parallel with the
    // system context — the answer is checked against them below. Server-side
    // and not from body.context, because a guard whose reach depends on which
    // page the user is standing on is not a guard. See known-names.ts.
    const [systemContext, knownNames] = await Promise.all([
      gatherSystemContext(role as Role, brokerId),
      gatherKnownNames(((): KnownNames => {
        const c = (body.context as { campaigns?: unknown } | undefined)?.campaigns
        return Array.isArray(c)
          ? { campaign: c.map((x) => String((x as { name?: unknown })?.name ?? '')).filter(Boolean) }
          : {}
      })()).catch((): KnownNames => ({})),
    ])

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
CAPABILITY TRUTH — THE HARD BOUNDARY: the tools listed below are the COMPLETE set of things you can do. You have NO background jobs, NO import capability, NO scheduled or long-running processes, and NO ability to do anything after this reply is sent. Sentences like "I am initiating the import", "this runs securely in the background", "this may take several hours" are FABRICATED ACTIONS unless a tool in THIS turn actually did the thing — and no such tool exists. If the user asks for something outside your tools (importing historical CRM data, connecting integrations, migrations), say plainly that you cannot do it from chat and point to the exact page where it lives (CRM/HubSpot sync: /freehold-intelligence/integrations/hubspot). Every action button you offer MUST correspond to a tool you can execute when they confirm — a button for a capability you do not have is a lie with styling. You can create a landing page ONLY via the landing_create tool — it makes a DRAFT and returns a real edit link; tell the user to review and PUBLISH it, and never present the public /lp link as live until they publish. You CANNOT create listings or brochures from chat (no tool exists), so never say you created, built or generated one — point to the platform's builder and offer to draft the copy as text instead. You CAN edit, archive and set the Trakheesi permit on an EXISTING listing. Before you name or describe any property, call listing_list and use a project from it — a property that is not in that list does not exist, and describing one is the single failure users report most. Never link to a specific page/record whose id/slug did not come from a tool THIS turn (that link would 404).
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

YOU ARE THE MARKETING COORDINATOR AGENT with REAL tools (ads / landing / inventory / crm / creative / research). Call the tools you need to get real data or take actions, then give your FINAL answer as {"blocks":[...]}. NEVER invent or guess a tool result.
CAPABILITY TRUTH — THE HARD BOUNDARY: the tools listed below are the COMPLETE set of things you can do. You have NO background jobs, NO import capability, NO scheduled or long-running processes, and NO ability to do anything after this reply is sent. Sentences like "I am initiating the import", "this runs securely in the background", "this may take several hours" are FABRICATED ACTIONS unless a tool in THIS turn actually did the thing — and no such tool exists. If the user asks for something outside your tools (importing historical CRM data, connecting integrations, migrations), say plainly that you cannot do it from chat and point to the exact page where it lives (CRM/HubSpot sync: /freehold-intelligence/integrations/hubspot). Every action button you offer MUST correspond to a tool you can execute when they confirm — a button for a capability you do not have is a lie with styling. You can create a landing page ONLY via the landing_create tool — it makes a DRAFT and returns a real edit link; tell the user to review and PUBLISH it, and never present the public /lp link as live until they publish. You CANNOT create listings or brochures from chat (no tool exists), so never say you created, built or generated one — point to the platform's builder and offer to draft the copy as text instead. You CAN edit, archive and set the Trakheesi permit on an EXISTING listing. Before you name or describe any property, call listing_list and use a project from it — a property that is not in that list does not exist, and describing one is the single failure users report most. Never link to a specific page/record whose id/slug did not come from a tool THIS turn (that link would 404).
METRIC QUESTIONS REQUIRE A TOOL CALL: when the user asks about leads, lead quality, campaign performance, spend, CPL, or any other figure not already in your context JSON, call the tool that fetches it BEFORE answering — numbers that came from neither context nor a tool result are fabrication and strictly forbidden; if no tool covers it, say you don't have that data and where it lives. EMPTY IS AN ANSWER: if a list or insights tool returns zero campaigns/leads/rows or an error, report exactly that — NEVER present example, sample, remembered or plausible-looking entities and figures as if they were the user's real data.
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
    // Raw tool-result text for THIS turn. A deep link the model emits (a lead,
    // form, project or landing record) is only trustworthy if its id/slug
    // actually appeared in a tool result — otherwise the model invented the
    // link and it 404s. sanitizeBlockHrefs (below) checks hrefs against this.
    let toolResultsText = ''
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
        // THE RESULTS, NOT ONLY THE NAMES. Without this the grounding audit had
        // nothing but the static context to trace against, so every figure the
        // model correctly read out of a tool was "ungrounded" and a real answer
        // was replaced by a self-accusation — under a chip saying the check had
        // run. Same summariser as the legacy loop, so both paths say the same
        // thing about the same result.
        for (const r of sdk.toolResults) {
          toolResultsText += ' ' + JSON.stringify(r.output)
          const note = summarizeToolResult(r.output)
          if (note) resultNotes.push(`• ${note}`)
        }
      } catch (err) {
        // The SDK path is opt-in and unproven against every tool schema — never
        // let it break the chat: capture why, then fall through to the legacy
        // path below (which cannot throw — its model ladder is fully caught).
        sdkError = err instanceof Error ? err.message : String(err)
        console.error('[expert] AI SDK path failed — falling back to legacy:', sdkError)
      }
    }

    // FALL THROUGH ON AN EMPTY ANSWER, NOT ONLY ON A THROWN ONE.
    //
    // The SDK path was fatal-on-throw and trusting-on-return, so a run that
    // came back with `raw: ''` — the model spending its whole step budget on
    // tools and never writing the final text — ended as "I lost my train of
    // thought there, ask me that once more". A dead end that asks the user to
    // repeat the thing that just failed.
    //
    // ONLY WHEN NO TOOL RAN, though. If tools did run, re-running the whole
    // turn through the legacy loop would execute them a second time, and some
    // of them move money or create campaigns. That case is not a retry, it is
    // a report: the "here is what I did" fallback downstream now has real
    // result notes to say it with.
    if (raw === undefined || (!raw.trim() && toolsUsed.length === 0)) {
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
            // Plain language. "Tool limit" is our implementation detail; what
            // the user needs is what got done and how to carry on.
            content: resultNotes.length
              ? `Here's what I've done so far:\n${resultNotes.join('\n')}\n\nThere's more to do on this — say "continue" and I'll carry on.`
              : `This one needs a few more steps than I can take in a single go — say "continue" and I'll carry on.`,
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
          // The chips render as ACTIONS TAKEN ("Generated an image") — a failed
          // call is not a taken action, so it must not earn a success chip.
          // The failure still reaches the user via resultNotes and the model's
          // observation. (Observed: "Generated an image" chip over a Forbidden.)
          const failed = !!(result && typeof result === 'object' && (result as Record<string, unknown>).error)
          if (!failed) toolsUsed.push(call.name)
          // Progress notes carry the OUTCOME in plain language, never the
          // internal tool name. Failures return null and are logged instead —
          // the model still sees the raw error in its observation below and can
          // recover, but the user never reads our internals.
          const note = summarizeToolResult(result)
          if (note) resultNotes.push(`• ${note}`)
          else if (failed) {
            console.error('[expert] tool failed', {
              tool: call.name,
              error: (result as Record<string, unknown>).error,
            })
          }
          const resultJson = JSON.stringify(result)
          toolResultsText += ' ' + resultJson
          observation = `TOOL_RESULT ${call.name}: ${resultJson.slice(0, 6000)}`
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

    // ── LINK TRUTH ────────────────────────────────────────────────────────────
    // Strip any deep record link whose id/slug did not come from a tool this
    // turn — the fabricated links that produced "every chat link is 404".
    blocks = sanitizeBlockHrefs(blocks, toolResultsText)

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
    // ── FABRICATED-CREATION TRIPWIRE ──────────────────────────────────────────
    // Client-reported, verbatim: "it says campaign launched and nothing
    // happened, it says landing created and nothing." The action tripwire
    // above only covers STARTED-work verbs (initiate/import/sync), so a flat
    // "I've created the landing page" or "your campaign is now live" sailed
    // through untouched.
    //
    // Rule: a claim that something was CREATED or LAUNCHED is true here only
    // if a creating tool actually succeeded this turn. toolsUsed already holds
    // successes only (failed calls are excluded upstream), so an empty
    // intersection means the claim is invented — replace it, never ship it.
    // Deliberately FIRST-PERSON only. "Campaign X is now live" is a legitimate
    // thing to say when merely REPORTING status from a list/insights tool, so
    // matching it would suppress true answers. Only the assistant claiming
    // authorship of a creation counts.
    const CREATION_CLAIM = /\b(?:i\s+(?:have\s+|had\s+)?(?:just\s+|now\s+)?(?:created|launched|published|generated|built|set\s+up|posted)|i['’]ve\s+(?:just\s+|now\s+)?(?:created|launched|published|generated|built|set\s+up|posted))\b/i
    const CREATING_TOOL = /(?:_create|create_|_launch|launch_|_publish|publish_|_generate|generate_|_add|add_|_send|send_|_save|save_)/i
    const creationRan = toolsUsed.some((name) => CREATING_TOOL.test(name))
    if (tools.length > 0 && !creationRan) {
      const claimsCreation = blocks.some((b) => b.type === 'text' && CREATION_CLAIM.test(String((b as { content?: unknown }).content ?? '')))
      if (claimsCreation) {
        blocks = [{
          type: 'text',
          content: resultNotes.length
            ? `I have to correct myself — I did NOT create or launch anything just now. Here is what actually ran this turn:\n${resultNotes.join('\n')}\n\nTell me to go ahead and I will run the real creation tool, then give you the link to the thing itself.`
            : 'I have to correct myself — I did NOT create or launch anything just now; no creation step ran. Ask me again and I will run the real tool, then hand you the link to what it made. If a campaign launch failed silently, Meta is most likely not connected (Integrations → Meta).',
        }]
      }
    }
    // ── FIGURE PROVENANCE ─────────────────────────────────────────────────────
    // Screenshot-verified failure: asked how the ads were doing, the campaigns
    // tool returned nothing usable and the model presented two INVENTED
    // campaigns ("Villanova (C267)" — spend 11,450 AED, CPL 75.33, quality
    // 78/100) as live performance. The user does not run those campaigns.
    //
    // The first fix blocked a reply only when NONE of its numbers appeared in
    // the turn's real data — and, worse, set the "✓ verified" badge when ANY
    // single number did. One true spend figure therefore licensed nine
    // invented ones AND decorated them with a verification mark.
    //
    // Now every figure is traced individually (lib/freehold/evidence.ts):
    // grounded (came from a tool or the context), derived (honest arithmetic
    // over grounded values — a computed CPL is not a fabrication), or
    // ungrounded. One ungrounded figure withholds the whole report. A withheld
    // true number costs a follow-up question; an invented one costs trust in
    // every number after it.
    // ── A CAMPAIGN THAT DOES NOT EXIST ───────────────────────────────────
    //
    // The live failure this was written from: asked about "the Zada Tower
    // campaign", the assistant answered at length about its automation rules,
    // its lead quality score of 45, its 50 leads, its ad copy and its
    // placements. There is no Zada Tower — not in the ad account, not in the
    // inventory, nowhere in this product. Every figure audit in the world
    // would have passed a sentence with no figures in it.
    //
    // So the ENTITY is checked too, against the names this workspace actually
    // holds. Narrow by design (see answer-grounding): only the sentence shapes
    // a model writes when it is being helpful about a record it never looked
    // up, and silent for any kind whose list did not load — an accusation with
    // nothing behind it is its own kind of lie.
    //
    // ── AND IT WAS SILENT ALMOST EVERYWHERE ───────────────────────────────
    //
    // The list of real campaigns was read from context.campaigns, which the
    // CALLING PAGE supplies. The ads screens send it. Nothing else does. So on
    // the inventory screen this check compared against an empty list, returned
    // "nothing to compare against", and logged a clean answer for:
    //
    //   "Saad Aldbsaoy shows high intent… a specific property, Volta Towers…
    //    Originated from 'Volta_Towers_DXB_Leads_2024' campaign… Assigned to
    //    Aya Al-Masri."
    //
    // Four records, none of which exist, with a Draft WhatsApp Message button
    // underneath. The lists are gathered server-side now (known-names.ts) and
    // cover people and projects as well as campaigns, because a fabricated
    // colleague and a fabricated building are worse to act on than a
    // fabricated budget, not better.
    // readableText, NOT blocksToText: the history reader keeps a plan step's
    // `step` and drops its `detail` and `owner`, drops action labels entirely,
    // and truncates at 4,000 characters — and the reply that prompted this
    // check put its invented campaign in a detail, its invented colleague in an
    // owner, and its invented property in a button label. The checker was
    // reading a summary the user never sees. See lib/freehold/expert-blocks.ts.
    const invented = unknownEntities(readableText(blocks), knownNames)
    if (invented.length > 0) {
      console.error('[expert] invented record(s):',
        invented.map((e) => `${e.kind}:${e.name}`).join(', '))
      const KIND_WORD: Record<EntityKind, string> = {
        campaign: 'campaign', project: 'property', person: 'person',
      }
      const first = invented[0]
      const real = (knownNames[first.kind] ?? []) as string[]
      blocks = [{
        type: 'text',
        content:
          `I have to correct myself — there is no ${KIND_WORD[first.kind]} called "${first.name}" in this account, `
          + `so everything I just said about it was invented rather than looked up.`
          + (invented.length > 1
            ? ` The same goes for ${invented.slice(1).map((e) => `"${e.name}"`).join(' and ')}.`
            : '')
          + (real.length > 0
            ? ` What you actually have: ${real.slice(0, 6).join(', ')}`
              + `${real.length > 6 ? ` and ${real.length - 6} more` : ''}. `
              + `Ask me about one of those and I will answer from the real records.`
            : ''),
      }]
    }

    // ── A LIST OF RECORDS IS A LIST OF THINGS THAT EXIST ──────────────────
    //
    // Asked to show unrated leads, with the tool having RUN and returned
    // nothing, the reply was five people who do not exist — each with a "Rate
    // <name>" button beside it. Every other guard passed: the entity check
    // matches sentence shapes ("<Name> campaign", "assigned to <Name>") and a
    // bullet reading `- Aisha Al-Futtaim (Emaar Beachfront)` is none of them,
    // while the PROJECTS in that list were real, lifted from the context,
    // which is exactly what made the invented names beside them credible.
    //
    // So this asks the question ungroundedNumbers has always asked of figures:
    // did this string come from anywhere the model was given? A name in no
    // tool result, no context and nothing the user typed was produced by the
    // model alone — and for a person in a list with a button, that is somebody
    // being sent to phone a stranger.
    const listed = unsourcedListedNames(
      readableText(blocks),
      `${toolResultsText}\n${JSON.stringify(fullContext)}\n${message}`,
    )
    if (listed.length > 0) {
      console.error('[expert] listed record(s) from nowhere:', listed.join(', '))
      blocks = [{
        type: 'text',
        content:
          `I have to stop myself — I listed ${listed.length === 1 ? 'a record' : `${listed.length} records`} `
          + `(${listed.slice(0, 5).join(', ')}) that did not come back from any check I ran, `
          + `so ${listed.length === 1 ? 'it was' : 'they were'} invented rather than looked up. `
          + (resultNotes.length
            ? `What actually ran this turn:\n${resultNotes.join('\n')}`
            : 'No check returned any records this turn.')
          + `\n\nIf the list came back empty, that is the answer — ask me again and I will say so plainly.`,
      }]
    }

    let evidence: EvidenceReport | null = null
    const replyJson = JSON.stringify(blocks)
    // NOT GATED ON HOLDING TOOLS ANY MORE. It was, and that was the hole the
    // Zada Tower answer walked through: a session whose role carries no tools
    // was audited by nothing at all — and that is precisely the session most
    // likely to fabricate, because the model has no way to fetch and fills the
    // gap from itself. Grounding is a property of the CONTEXT, which every
    // session has, not of the toolbelt.
    if (METRIC_SHAPED.test(replyJson)) {
      evidence = auditFigures(replyJson, [toolResultsText, JSON.stringify(fullContext)])
      if (evidence.verdict === 'fabricated' || evidence.verdict === 'tainted') {
        const untraceable = evidence.figures.filter((f) => f.status === 'ungrounded').map((f) => f.value)
        blocks = [{
          type: 'text',
          content:
            (evidence.verdict === 'fabricated'
              ? 'I have to correct myself — none of the figures I was about to show came from your live data, so I will not present them. '
              : `I have to correct myself — some of those figures (${untraceable.slice(0, 4).join(', ')}) did not come from your live data, so I will not present the report with them in it. `) +
            // NEVER CONTRADICT THE CHIP ABOVE IT. "No data-returning check
            // completed this turn" printed under a chip reading "Checked your
            // campaigns" is the reply calling itself a liar, and it sends the
            // user round a loop: it asks them to run again the thing it has
            // just told them did not run.
            (resultNotes.length
              ? `What actually happened this turn:\n${resultNotes.join('\n')}\n\nAsk me to check again and I will report only figures I can trace — and say so plainly if there are none.`
              : toolsUsed.length
                ? `The checks ran (${Array.from(new Set(toolsUsed)).join(', ')}) but came back without figures I can quote. Ask me again and I will report only what I can trace — and say plainly if there is nothing.`
                : 'No check ran this turn, so I have nothing to quote. Ask me to check the campaigns and I will report only figures I can trace.'),
        }]
      }
    }
    const metricsGrounded = evidence?.verdict === 'clean'

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
    const data = {
      blocks, skill: skill.id, sessionId: persistedId, toolsUsed,
      ...(metricsGrounded ? { verified: true } : {}),
      // "How we know this" — per-figure provenance, sent only when the reply
      // actually made numeric claims. The UI renders it verbatim; there is no
      // second place where this could say something different.
      ...(evidence && evidence.verdict !== 'no_figures' ? { evidence: evidence.figures } : {}),
    }

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
        ...(evidence ? [evidenceLine(evidence)] : []),
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
