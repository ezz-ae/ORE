import { getVertexAuthHeaders, resolveVertexProject, VERTEX_LOCATION, vertexConfigured } from '@/lib/google/vertex-auth'
import { googleAiKey } from '@/lib/creative-studio/providers'

// Two model tiers. 'flash' is the fast default for bulk surfaces
// (translations, drafts, briefings). 'pro' is for surfaces that must REASON —
// the Expert coordinator's multi-step tool loop ran on flash and it showed:
// wrong-entity answers, asking the user for ids its own tools could fetch.
// Each transport ladders per tier — first available model wins.
const MODEL_BY_TIER = { flash: 'gemini-2.5-flash', pro: 'gemini-2.5-pro' } as const
const API_MODELS_BY_TIER: Record<'flash' | 'pro', string[]> = {
  flash: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'],
  pro: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'],
}

const GEMINI_URL = (model: string) =>
  `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveVertexProject()}` +
  `/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:generateContent`

const SYSTEM_PROMPT = `You are the private Intelligence Server for Freehold — a premium Dubai real estate company.

You serve the owner and management team. Answer concisely and directly about:
- CRM leads: urgency, pipeline stage, recommended next actions, ready-to-send WhatsApp message drafts
- Lead Machine: campaign readiness, ad launch blockers, landing review queue
- Marketing: Google and Meta ad performance, spend optimisation, campaign approvals
- Operations: integration status, server health, milestone progress, blocked items
- Properties: listing readiness, data quality, project pipeline

Always reference specific data provided in context. Be direct and actionable.
When drafting messages, write them ready-to-send with no placeholders.
Use short bullet points for lists. Keep answers under 200 words unless details are requested.`

type Turn = { role: 'user' | 'model'; text: string }
const _history = new Map<string, Turn[]>()

/**
 * Build a useful, context-aware answer when Vertex AI is unreachable (no
 * service-account credentials configured, or the upstream call failed). This
 * keeps every AI surface in the platform responsive — the global Expert panel,
 * the home briefing, notebook, agent and management chats all degrade to a
 * grounded summary instead of returning a 500.
 */
export function buildFallbackAnswer(message: string, context?: Record<string, unknown>): string {
  const lines: string[] = []

  const pickArray = (obj: unknown, key: string): unknown[] => {
    if (obj && typeof obj === 'object' && Array.isArray((obj as Record<string, unknown>)[key])) {
      return (obj as Record<string, unknown>)[key] as unknown[]
    }
    return []
  }
  const titleOf = (item: unknown): string | null => {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      return (o.title as string) || (o.name as string) || (o.label as string) || null
    }
    return null
  }

  // Home / management briefing shape
  const urgent   = pickArray(context, 'urgentTasks')
  const blocked  = pickArray(context, 'blockedItems')
  const pending  = pickArray(context, 'pendingApprovals')
  const actions  = pickArray(context, 'recommendedActions')

  if (urgent.length || blocked.length || pending.length) {
    lines.push(
      `Here's where things stand: ${urgent.length} urgent item${urgent.length === 1 ? '' : 's'}, ` +
      `${blocked.length} blocked, ${pending.length} pending approval${pending.length === 1 ? '' : 's'}.`,
    )
    const top = urgent.map(titleOf).filter(Boolean).slice(0, 3)
    if (top.length) lines.push('Top priorities:\n' + top.map((t) => `• ${t}`).join('\n'))
    const next = actions.map(titleOf).filter(Boolean).slice(0, 2)
    if (next.length) lines.push('Recommended next:\n' + next.map((t) => `• ${t}`).join('\n'))
  }

  // Expert full-system shape
  const sys = (context?.system ?? null) as Record<string, unknown> | null
  if (sys) {
    const blockers = pickArray(sys.launchBlockers, 'blockers')
    if (blockers.length) {
      lines.push(`${blockers.length} launch blocker${blockers.length === 1 ? '' : 's'} are open across campaigns.`)
    }
  }

  if (lines.length === 0) {
    lines.push(
      "I'm running in offline mode right now, so I can't reach the live model — " +
      'but the dashboards, pipelines and reports around you are fully populated. ' +
      'Pick a card to drill in, or ask me again once the AI service is connected.',
    )
  } else {
    lines.push('(Offline mode — connect the AI service for full reasoning and drafting.)')
  }

  return lines.join('\n\n')
}

export interface ServerQueryOptions {
  sessionId?: string
  context?: Record<string, unknown>
  systemPrompt?: string
  /** Set to 'application/json' to force a pure-JSON response (generative UI). */
  responseMimeType?: string
  /** Override the output token cap (default 1024). */
  maxOutputTokens?: number
  /** Override sampling temperature (default 0.4). */
  temperature?: number
  /**
   * Durable conversation history to replay when this process holds none for
   * the session (cold start / new instance). The warm in-memory cache still
   * wins — this fallback makes session memory survive restarts and devices.
   */
  history?: Array<{ role: 'user' | 'model'; text: string }>
  /**
   * 'pro' = gemini-2.5-pro with a real thinking budget — for surfaces that
   * reason across tool results (the Expert coordinator). Default 'flash'.
   */
  modelTier?: 'pro' | 'flash'
}

export async function queryServerAgent(
  message: string,
  opts: ServerQueryOptions = {},
): Promise<string> {
  // Transport ladder: Vertex (service account) → Gemini API (GEMINI_API_KEY)
  // → grounded offline summary. Before the API-key rung existed, a deployment
  // with only GEMINI_API_KEY got the canned fallback on EVERY chat turn —
  // the whole platform read like a FAQ bot instead of a live agent.
  if (vertexConfigured()) {
    try {
      return await callVertex(message, opts)
    } catch { /* fall through to the API key, then offline */ }
  }
  if (googleAiKey()) {
    try {
      return await callGeminiApi(message, opts)
    } catch { /* fall through to offline */ }
  }
  return buildFallbackAnswer(message, opts.context)
}

/** Shared request assembly for both transports (history, context, config). */
function buildRequest(
  message: string,
  { sessionId, context, systemPrompt, responseMimeType, maxOutputTokens, temperature, history: durableHistory, modelTier }: ServerQueryOptions,
) {
  const sid = sessionId ?? 'server-anon'
  const history = _history.get(sid) ?? durableHistory ?? []
  const inputText =
    context && history.length === 0
      ? `Server context:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${message}`
      : message
  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: inputText }] },
  ]
  const generationConfig: Record<string, unknown> = {
    temperature: temperature ?? 0.4,
    maxOutputTokens: maxOutputTokens ?? 1024,
    // flash: thinking disabled — it exhausts the token budget on bulk surfaces
    // and those callers want direct answers (and generative-UI JSON) reliably.
    // pro: a bounded REAL thinking budget — reasoning across tool results is
    // the point of the tier; thinking tokens count toward maxOutputTokens, so
    // the bound keeps room for the answer itself.
    thinkingConfig: { thinkingBudget: modelTier === 'pro' ? 2048 : 0 },
  }
  if (responseMimeType) generationConfig.responseMimeType = responseMimeType
  const remember = (text: string) =>
    _history.set(sid, [...history, { role: 'user' as const, text: message }, { role: 'model' as const, text }].slice(-20))
  return { contents, generationConfig, system: systemPrompt ?? SYSTEM_PROMPT, remember }
}

/** Gemini API transport (key-based) — same brain, no service account needed. */
async function callGeminiApi(message: string, opts: ServerQueryOptions = {}): Promise<string> {
  const key = googleAiKey()
  const { contents, generationConfig, system, remember } = buildRequest(message, opts)
  let lastErr = ''
  for (const model of API_MODELS_BY_TIER[opts.modelTier === 'pro' ? 'pro' : 'flash']) {
    // thinkingConfig is a 2.5-family knob — older models reject it with 400.
    const config = model.startsWith('gemini-2.5')
      ? generationConfig
      : Object.fromEntries(Object.entries(generationConfig).filter(([k]) => k !== 'thinkingConfig'))
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: config }),
      },
    )
    if (res.ok) {
      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (!text) throw new Error('Gemini returned no content')
      remember(text)
      return text
    }
    lastErr = await res.text().catch(() => `HTTP ${res.status}`)
    // 404 = model unknown on this key → try the next; other errors are fatal.
    if (res.status !== 404 && !/NOT_FOUND/i.test(lastErr)) break
  }
  throw new Error(`Gemini API error: ${lastErr.slice(0, 300)}`)
}

async function callVertex(message: string, opts: ServerQueryOptions = {}): Promise<string> {
  const authHeaders = await getVertexAuthHeaders()
  const { contents, generationConfig, system, remember } = buildRequest(message, opts)

  const res = await fetch(GEMINI_URL(MODEL_BY_TIER[opts.modelTier === 'pro' ? 'pro' : 'flash']), {
    method:  'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Server AI error (${res.status}): ${err}`)
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    '(no response)'

  remember(text)

  return text
}
