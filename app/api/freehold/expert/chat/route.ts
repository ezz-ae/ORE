import { NextRequest, NextResponse } from 'next/server'
import { McpResponseEnvelope } from '@/types/freehold-mcp'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { getSkill } from '@/lib/freehold/ai-skills'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import type { Role } from '@/types/freehold-mcp'

export const runtime = 'nodejs'

type ExpertRole = 'owner' | 'admin' | 'marketing' | 'sales_manager' | 'sales_agent' | 'data_manager' | 'viewer'

interface ExpertChatRequest {
  message: string
  role?: ExpertRole
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

  const [server, blockers, inventory, integrations, leadMachine] = await Promise.all([
    safe('server-summary'),
    safe('launch-blockers'),
    safe('inventory-analysis'),
    safe('integration-summary'),
    safe('lead-machine-summary'),
  ])

  return {
    server,
    launchBlockers: blockers,
    inventory,
    integrations,
    leadMachine,
  }
}

export async function POST(request: NextRequest) {
  const generatedAt = new Date().toISOString()
  try {
    const body = (await request.json()) as ExpertChatRequest
    const message = body.message?.trim() || ''
    const role = (body.role || 'owner') as ExpertRole
    const sessionId = body.sessionId ?? `expert-${crypto.randomUUID()}`

    if (!message) {
      return NextResponse.json(
        { layer: 'expert', status: 'error', data: { answer: 'Ask me anything about the business.' }, generatedAt },
        { status: 400 },
      )
    }

    const skill = getSkill('expert')!

    // Pull a live, compact snapshot of the whole platform.
    const systemContext = await gatherSystemContext(role as Role)

    const fullContext: Record<string, unknown> = {
      currentPage: body.page ?? null,
      role,
      system: systemContext,
      ...(body.context ?? {}),
    }

    const answer = await queryServerAgent(message, {
      sessionId,
      context: fullContext,
      systemPrompt: skill.systemPrompt,
    })

    const data = { answer, skill: skill.id, cardType: 'expert', cards: [] }

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
      nextActions: ['Ask a follow-up', 'Request a sequenced execution plan'],
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
        data: { answer: `Expert error: ${msg}` },
        evidence: ['Request processing failed'],
        warnings: [msg],
        nextActions: ['Check VERTEX_AI_SERVICE_ACCOUNT_JSON environment variable'],
        generatedAt,
      },
      { status: 500 },
    )
  }
}
