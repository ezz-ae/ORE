import { generateText, stepCountIs } from 'ai'
import { expertModel } from './ai-sdk'
import { buildExpertTools } from './expert-agent-tools'
import type { ToolCtx } from './coordinator-tools'

// The AI-SDK coordinator turn: native multi-step tool-calling instead of the
// hand-rolled JSON tool_call loop. The model calls role-gated tools (each a
// real internal function), sees the results, and gives its final answer as the
// {"blocks":[...]} JSON the chat UI renders. Confirm-gating for destructive
// tools lives in buildExpertTools (needs args.confirm === true). Returns the
// raw final text + the tool names actually executed this turn.
export async function runExpertSdk(opts: {
  message: string
  systemPrompt: string
  context: Record<string, unknown>
  history?: Array<{ role: 'user' | 'model'; text: string }>
  toolCtx: ToolCtx
  hasTools: boolean
  /** Drop money/live-mutating tools (external MCP bridge default). */
  excludeDestructive?: boolean
}): Promise<{ raw: string; toolsUsed: string[] }> {
  const tools = opts.hasTools ? buildExpertTools(opts.toolCtx, { excludeDestructive: opts.excludeDestructive }) : undefined

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(opts.history ?? [])
      .filter((h) => h.text)
      .map((h) => ({ role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant', content: h.text })),
    { role: 'user', content: opts.message },
  ]

  // Ground the model in the same live context the JSON path injected.
  const system = `${opts.systemPrompt}\n\nCONTEXT (live data — ground every answer in this, invent nothing):\n${JSON.stringify(opts.context).slice(0, 12000)}`

  const result = await generateText({
    model: expertModel(),
    system,
    messages,
    tools,
    stopWhen: stepCountIs(6),
    temperature: 0.5,
  })

  const toolsUsed = (result.steps ?? []).flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName))
  return { raw: result.text ?? '', toolsUsed }
}
