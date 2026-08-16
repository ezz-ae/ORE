import { generateText, stepCountIs } from 'ai'
import { expertModel } from './ai-sdk'
import { buildExpertTools } from './expert-agent-tools'
import type { ToolCtx } from './coordinator-tools'

/** One executed tool and what it answered. */
export interface ExpertToolResult {
  name: string
  output: unknown
  /** True when the tool answered with an error rather than data. */
  failed: boolean
}

/**
 * The AI-SDK coordinator turn: native multi-step tool-calling instead of the
 * hand-rolled JSON tool_call loop. The model calls role-gated tools (each a
 * real internal function), sees the results, and gives its final answer as the
 * {"blocks":[...]} JSON the chat UI renders. Confirm-gating for destructive
 * tools lives in buildExpertTools (needs args.confirm === true).
 *
 * ── IT RETURNS THE RESULTS, NOT ONLY THE NAMES ───────────────────────────
 *
 * It used to return `{ raw, toolsUsed }` — the tool NAMES — and drop every
 * result on the floor. That looked harmless and was not, because the caller
 * uses the results for three things it cannot do without them:
 *
 *   · GROUNDING. `auditFigures` traces every number in the reply back to a
 *     source. With no tool results the only source is the static context, so
 *     every figure the model correctly read OUT OF A TOOL was untraceable —
 *     and a real, accurate answer was replaced by "those figures did not come
 *     from your live data". The model was right and we called it a liar.
 *   · THE LINK CHECK. `sanitizeBlockHrefs` keeps a deep link only if its id
 *     appeared in a tool result, so with none every genuine link was stripped.
 *   · WHAT ACTUALLY HAPPENED. The user-facing "here is what I did" notes are
 *     summarised from results, so the reply said "no data-returning check
 *     completed this turn" directly underneath a chip reading "Checked your
 *     campaigns".
 *
 * A tool call and its result are one fact. Returning half of it is what made
 * three separate features quietly wrong.
 */
export async function runExpertSdk(opts: {
  message: string
  systemPrompt: string
  context: Record<string, unknown>
  history?: Array<{ role: 'user' | 'model'; text: string }>
  toolCtx: ToolCtx
  hasTools: boolean
  /** Drop money/live-mutating tools (external MCP bridge default). */
  excludeDestructive?: boolean
}): Promise<{ raw: string; toolsUsed: string[]; toolResults: ExpertToolResult[] }> {
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

  const toolResults: ExpertToolResult[] = (result.steps ?? []).flatMap((step) =>
    (step.toolResults ?? []).map((r) => {
      const output = (r as { output?: unknown }).output
      return {
        name: String((r as { toolName?: unknown }).toolName ?? ''),
        output,
        // A tool that answered with an error is not a taken action. The legacy
        // loop has always known this; the SDK path did not, so a Forbidden
        // still earned a green "Generated an image" chip.
        failed: !!(output && typeof output === 'object' && 'error' in (output as object)),
      }
    }),
  )

  // ONLY THE CALLS THAT SUCCEEDED become chips. Read from the RESULTS rather
  // than from toolCalls, so a call that threw or was refused cannot be reported
  // to the user as something that happened.
  const toolsUsed = toolResults.filter((r) => !r.failed && r.name).map((r) => r.name)

  return { raw: result.text ?? '', toolsUsed, toolResults }
}
