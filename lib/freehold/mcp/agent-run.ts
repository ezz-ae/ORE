// lib/freehold/mcp/agent-run.ts
//
// The platform agent, callable head-lessly (no browser session) so an EXTERNAL
// model can drive it through the remote MCP bridge. This is the WRITE funnel:
// reads are exposed as direct MCP tools, but anything that changes the system
// goes through this one agent.
//
// It runs the SAME multi-step coordinator agent the in-app Expert chat uses
// (native tool-calling over the ads / landing / crm / creative / research
// specialists), scoped to the caller's role. Two guardrails keep it honest:
//   1. Destructive (money/live-mutating) tools are EXCLUDED unless management
//      has raised the server autonomy level (>= 2) — so an outside model gets
//      reads + safe writes by default and merely proposes the rest.
//   2. Any destructive tool that IS present still needs an explicit confirm.
// If the AI-SDK model isn't configured, it falls back to a single grounded
// answer instead of failing.

import { runExpertSdk } from '@/lib/freehold/expert-agent-run'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { getSkill } from '@/lib/freehold/ai-skills'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { toolsForRole, type CoordinatorRole } from '@/lib/freehold/coordinator-tools'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { blocksToText } from '@/lib/freehold/expert-sessions'
import type { ExpertBlock } from '@/lib/freehold/expert-blocks'

export interface AgentPrincipal {
  role: CoordinatorRole
  email: string
  brokerId: string | null
}

export interface AgentRunResult {
  answer: string
  toolsUsed: string[]
  evidence: string[]
}

/** Compact whole-system snapshot from the read tools this role may see. */
async function gatherContext(role: CoordinatorRole): Promise<Record<string, unknown>> {
  const safe = async (toolName: string) => {
    try {
      const res = await executeTool({ toolName, userRoles: [role] })
      return res.status === 'success' ? res.data : null
    } catch {
      return null
    }
  }
  const [server, integrations, blockers, inventory, leadMachine] = await Promise.all([
    safe('server-summary'),
    safe('integration-summary'),
    safe('launch-blockers'),
    safe('inventory-analysis'),
    safe('lead-machine-summary'),
  ])
  return { server, integrations, launchBlockers: blockers, inventory, leadMachine }
}

/** The Expert returns {"blocks":[...]} JSON; flatten it to plain text for chat-less callers. */
function toPlainText(raw: string): string {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const parsed = JSON.parse(trimmed) as { blocks?: ExpertBlock[] }
    if (Array.isArray(parsed.blocks) && parsed.blocks.length) return blocksToText(parsed.blocks)
  } catch {
    /* not block JSON — fall through */
  }
  return raw.trim()
}

/**
 * Run one turn of the platform agent for an external caller. Reads execute for
 * real; writes go through the coordinator's confirm-gated / autonomy-gated
 * tools, so money-moving actions are proposed for approval, not silently run.
 */
export async function runPlatformAgent(
  instruction: string,
  principal: AgentPrincipal,
): Promise<AgentRunResult> {
  const role = principal.role
  const [context, autonomy] = await Promise.all([
    gatherContext(role),
    getAutonomyLevel().catch(() => 1 as const),
  ])
  const skill = getSkill('expert')
  const tools = toolsForRole(role)
  // Advisory autonomy (the default) → the external agent may not fire live
  // money/campaign mutations at all; it reads, prepares and proposes.
  const excludeDestructive = autonomy < 2

  const systemPrompt = `${skill?.systemPrompt ?? ''}

You are the ORE platform agent, driven by an EXTERNAL assistant on the user's behalf (role: ${role}). Use your real specialist tools (ads / landing / crm / creative / research) to answer questions and carry out work. Ground every statement in real tool results and the provided context — invent nothing, and never ask the user for an id or value a tool can fetch.
${excludeDestructive
      ? 'You may READ freely and make safe, reversible changes (drafts, proposals). You CANNOT execute live money/campaign changes from here — when one is needed, prepare it and tell the user to approve it in the platform.'
      : "Tools that change live campaigns, money or content need confirm:true — pass it ONLY when the user's own message explicitly requests or confirms that exact action; otherwise state the exact action and ask them to confirm."}
Answer in clear, concise plain text — no markdown code fences, no JSON.`

  const toolCtx = { role, email: principal.email, brokerId: principal.brokerId, autonomy }

  try {
    const sdk = await runExpertSdk({
      message: instruction,
      systemPrompt,
      context: { role, system: context },
      toolCtx,
      hasTools: tools.length > 0,
      excludeDestructive,
    })
    return {
      answer: toPlainText(sdk.raw) || 'No answer produced.',
      toolsUsed: sdk.toolsUsed,
      evidence: [`Role: ${role}`, `Autonomy: ${autonomy}`, tools.length ? `${tools.length} tools available` : 'No tools for this role'],
    }
  } catch {
    // AI-SDK model unavailable/misconfigured → grounded single-shot answer.
    const raw = await queryServerAgent(instruction, {
      context: { role, system: context },
      systemPrompt: skill?.systemPrompt ?? '',
      maxOutputTokens: 1500,
      temperature: 0.4,
    })
    return {
      answer: toPlainText(raw) || 'No answer produced.',
      toolsUsed: [],
      evidence: [`Role: ${role}`, 'Fallback: single-shot (AI SDK unavailable)'],
    }
  }
}
