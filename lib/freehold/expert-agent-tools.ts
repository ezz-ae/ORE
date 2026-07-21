import { z } from 'zod'
import { tool, type Tool } from 'ai'
import { COORDINATOR_TOOLS, type ToolCtx } from './coordinator-tools'

// Gemini's function-calling rejects a declaration whose parameters object has
// NO properties ("parameters.properties: should be non-empty"). No-arg tools
// were given z.object({}) — swap those for a single optional field so the whole
// request isn't rejected (which would fail every tool-bearing turn).
function safeSchema(schema: z.ZodType<Record<string, unknown>>): z.ZodType<Record<string, unknown>> {
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape
  if (schema instanceof z.ZodObject && shape && Object.keys(shape).length === 0) {
    return z.object({ note: z.string().optional().describe('optional — why you are calling this') }) as unknown as z.ZodType<Record<string, unknown>>
  }
  return schema
}

// Build the role-filtered AI-SDK toolset for one chat turn. Destructive tools
// are gated: without args.confirm === true the tool returns a needs-confirm
// signal instead of executing (same guardrail the current chat enforces).
// `excludeDestructive` drops money/live-mutating tools entirely — used by the
// external MCP bridge so an outside model gets reads + safe writes only unless
// management has raised the server autonomy level.
export function buildExpertTools(ctx: ToolCtx, opts?: { excludeDestructive?: boolean }): Record<string, Tool> {
  const out: Record<string, Tool> = {}
  for (const t of COORDINATOR_TOOLS) {
    if (!t.roles.includes(ctx.role)) continue
    if (opts?.excludeDestructive && t.destructive) continue
    out[t.name] = tool({
      description: `${t.description}\nArgs: ${t.params}`,
      inputSchema: safeSchema(t.schema),
      execute: async (args: Record<string, unknown>) => {
        if (t.destructive && args.confirm !== true) {
          return { needsConfirm: true, action: t.name, message: 'Ask the user to confirm this exact action before calling again with confirm:true.' }
        }
        try {
          return await t.run(args, ctx)
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Tool failed' }
        }
      },
    })
  }
  return out
}
