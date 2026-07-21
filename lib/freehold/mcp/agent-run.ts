// lib/freehold/mcp/agent-run.ts
//
// The platform agent, callable head-lessly (no browser session) so an EXTERNAL
// model can drive it through the remote MCP bridge. This is the WRITE funnel:
// reads are exposed as direct MCP tools, but anything that changes the system
// goes through this one agent, which runs with the caller's role and stages
// external writes as gated approval intents — never a blank cheque.

import { queryServerAgent } from '@/lib/freehold/server-ai'
import { getSkill } from '@/lib/freehold/ai-skills'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { mcpTools } from '@/lib/freehold/mcp/registry'
import type { Role } from '@/types/freehold-mcp'

export interface AgentRunResult {
  answer: string
  /** Any gated write the agent staged for human approval (never auto-executed externally). */
  stagedAction?: { tool: string; status: string; warnings: string[]; nextActions: string[] }
  evidence: string[]
}

const READ_TOOLS = mcpTools.filter((t) => !t.canWriteExternal).map((t) => t.id)
const WRITE_TOOLS = mcpTools.filter((t) => t.canWriteExternal)

/** Compact whole-system snapshot from the read tools this role may see. */
async function gatherContext(role: Role): Promise<Record<string, unknown>> {
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

/**
 * Run one turn of the platform agent for an external caller.
 *
 * The agent answers grounded in live system context. When the instruction
 * intends a change to an external system (ads, CRM, WhatsApp), the model is
 * asked to emit a single JSON action line; we run it through executeTool, which
 * — by design — returns a gated `pendingApproval` intent for every external
 * write. So the external model can PROPOSE and STAGE a change, but a human
 * still approves it inside the platform. Read intents execute for real.
 */
export async function runPlatformAgent(
  instruction: string,
  role: Role,
): Promise<AgentRunResult> {
  const context = await gatherContext(role)
  const skill = getSkill('expert')

  const actionCatalog = WRITE_TOOLS
    .map((t) => `- ${t.id}: ${t.description} (roles: ${t.allowedRoles.join('/')})`)
    .join('\n')

  const protocol = `\n\nYou are being driven by an external assistant on the user's behalf, with role "${role}".\nAnswer concisely and factually, grounded ONLY in the provided system context.\nIf — and only if — the user clearly intends to CHANGE something in an external system, append a final line of the exact form:\nACTION: {"tool":"<one of the write tools>","args":{...}}\nAvailable write tools:\n${actionCatalog || '(none)'}\nDo NOT emit ACTION for questions, analysis, or read requests. Never invent tool names.`

  const raw = await queryServerAgent(instruction, {
    context: { role, system: context },
    systemPrompt: `${skill?.systemPrompt ?? ''}${protocol}`,
    maxOutputTokens: 2048,
    temperature: 0.4,
  })

  // Pull an optional single ACTION line without letting it leak into the answer.
  let answer = raw.trim()
  let stagedAction: AgentRunResult['stagedAction']
  const m = answer.match(/ACTION:\s*(\{[\s\S]*\})\s*$/)
  if (m) {
    answer = answer.slice(0, m.index).trim()
    try {
      const parsed = JSON.parse(m[1]) as { tool?: string; args?: Record<string, unknown> }
      if (parsed.tool && READ_TOOLS.indexOf(parsed.tool) === -1) {
        const res = await executeTool({ toolName: parsed.tool, userRoles: [role], args: parsed.args })
        stagedAction = {
          tool: res.tool ?? parsed.tool,
          status: res.status,
          warnings: res.warnings ?? [],
          nextActions: res.nextActions ?? [],
        }
      }
    } catch {
      // Malformed action → ignore; the textual answer still stands.
    }
  }

  const evidence = [`Role: ${role}`, `Context: ${Object.entries(context).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}`]
  return { answer: answer || 'No answer produced.', stagedAction, evidence }
}
