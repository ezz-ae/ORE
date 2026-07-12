import { tool, type Tool } from 'ai'
import { COORDINATOR_TOOLS, type ToolCtx } from './coordinator-tools'

// Build the role-filtered AI-SDK toolset for one chat turn. Destructive tools
// are gated: without args.confirm === true the tool returns a needs-confirm
// signal instead of executing (same guardrail the current chat enforces).
export function buildExpertTools(ctx: ToolCtx): Record<string, Tool> {
  const out: Record<string, Tool> = {}
  for (const t of COORDINATOR_TOOLS) {
    if (!t.roles.includes(ctx.role)) continue
    out[t.name] = tool({
      description: `${t.description}\nArgs: ${t.params}`,
      inputSchema: t.schema,
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
