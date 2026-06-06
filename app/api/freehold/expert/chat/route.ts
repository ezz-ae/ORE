import { NextRequest, NextResponse } from 'next/server'
import { McpResponseEnvelope } from '@/types/freehold-mcp'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { getSkill } from '@/lib/freehold/ai-skills'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { BLOCK_PROTOCOL, type ExpertBlock } from '@/lib/freehold/expert-blocks'
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

  return { server, launchBlockers: blockers, inventory, integrations, leadMachine }
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
    const role = (body.role || 'owner') as ExpertRole
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
