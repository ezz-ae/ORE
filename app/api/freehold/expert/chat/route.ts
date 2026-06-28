import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { McpResponseEnvelope } from '@/types/freehold-mcp'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { getSkill } from '@/lib/freehold/ai-skills'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { BLOCK_PROTOCOL, type ExpertBlock } from '@/lib/freehold/expert-blocks'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { gatherTeamMetrics } from '@/lib/freehold/team-metrics'
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
async function gatherSystemContext(role: Role): Promise<Record<string, unknown>> {
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

  const [server, blockers, inventory, integrations, leadMachine, team] = await Promise.all([
    safe('server-summary'),
    safe('launch-blockers'),
    safe('inventory-analysis'),
    safe('integration-summary'),
    safe('lead-machine-summary'),
    canSeeTeam ? gatherTeamMetrics().catch(() => null) : Promise.resolve(null),
  ])

  return { server, launchBlockers: blockers, inventory, integrations, leadMachine, teamPerformance: team }
}

/** Parse the model's JSON into blocks; fall back to a single text block. */
function parseBlocks(raw: string): ExpertBlock[] {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const parsed = JSON.parse(trimmed) as { blocks?: ExpertBlock[] }
    if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
      return parsed.blocks.filter((b) => b && typeof b === 'object' && 'type' in b)
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
    const sessionId = body.sessionId ?? `expert-${crypto.randomUUID()}`

    if (!message) {
      return NextResponse.json(
        { layer: 'expert', status: 'error', data: { blocks: [{ type: 'text', content: 'Ask me anything about the business.' }] }, generatedAt },
        { status: 400 },
      )
    }

    const skill = getSkill('expert')!
    const systemContext = await gatherSystemContext(role as Role)

    const fullContext: Record<string, unknown> = {
      currentPage: body.page ?? null,
      role,
      system: systemContext,
      ...(body.context ?? {}),
    }

    const raw = await queryServerAgent(message, {
      sessionId,
      context: fullContext,
      systemPrompt: `${skill.systemPrompt}\n${BLOCK_PROTOCOL}`,
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.5,
    })

    const blocks = parseBlocks(raw)
    const data = { blocks, skill: skill.id }

    const response: McpResponseEnvelope<typeof data> = {
      requestId: crypto.randomUUID(),
      layer: 'expert',
      status: 'success',
      data,
      evidence: [
        `Role: ${role}`,
        'Skill: expert (full-system)',
        `Context: ${Object.entries(systemContext).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}`,
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
