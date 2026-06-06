import { getVertexAuthHeaders, resolveVertexProject, VERTEX_LOCATION } from '@/lib/google/vertex-auth'

const MODEL = 'gemini-2.5-flash'

// Deployed ADK reasoning engine (Freehold Marketing Expert) — primary path.
// Falls back to the direct Gemini call below if the engine is unreachable.
const REASONING_ENGINE_ID = '6954127921439047680'

const REASONING_ENGINE_URL = () =>
  `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveVertexProject()}` +
  `/locations/${VERTEX_LOCATION}/reasoningEngines/${REASONING_ENGINE_ID}:streamQuery`
const GEMINI_URL = () =>
  `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${resolveVertexProject()}` +
  `/locations/${VERTEX_LOCATION}/publishers/google/models/${MODEL}:generateContent`

const SYSTEM_PROMPT = `You are the Marketing Expert for Freehold — a premium Dubai real estate brand.

Your expertise covers:
- Google Ads (Search, Performance Max, Display, Video)
- Meta Ads (Facebook & Instagram, lead-gen objectives)
- Social media content (LinkedIn, Instagram, TikTok, YouTube)
- Dubai / UAE real estate market — off-plan and ready residential properties
- Lead generation funnels, landing page optimisation, conversion rate improvements
- Ad copywriting — RSA headlines (≤30 chars each), descriptions (≤90 chars each), social copy

When writing RSA ad copy, always use this exact format so it can be sent directly to the RSA Generator:
Headline 1: <text>
Headline 2: <text>
Headline 3: <text>
Description 1: <text>
Description 2: <text>

Provide specific, actionable advice grounded in the UAE market. Be concise but thorough.`

// ─── Auth ─────────────────────────────────────────────────────────────────────

// ─── Session history (warm-instance cache) ────────────────────────────────────

type Turn = { role: 'user' | 'model'; text: string }
const _history = new Map<string, Turn[]>()

// ─── Query ────────────────────────────────────────────────────────────────────

export interface AgentQueryOptions {
  sessionId?: string
  context?: Record<string, unknown>
}

// ─── Deployed ADK reasoning engine (primary path) ─────────────────────────────
//
// The AdkApp on Vertex Agent Engine exposes stream_query. It returns a stream of
// ADK event objects; we concatenate every model text part into the final answer.
// Any failure here causes queryAdsAgent to fall back to the direct Gemini call.

async function queryReasoningEngine(
  message: string,
  sid: string,
  context?: Record<string, unknown>,
): Promise<string> {
  const authHeaders = await getVertexAuthHeaders()

  const messageText =
    context
      ? `Account context:\n${JSON.stringify(context, null, 2)}\n\nUser question: ${message}`
      : message

  const res = await fetch(REASONING_ENGINE_URL(), {
    method:  'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_method: 'stream_query',
      input: { user_id: sid, message: messageText },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Reasoning engine error (${res.status}): ${err}`)
  }

  // The response body is a stream of JSON event objects (one per line / SSE).
  const raw = await res.text()
  let answer = ''
  for (const line of raw.split('\n')) {
    const trimmed = line.replace(/^data:\s*/, '').trim()
    if (!trimmed) continue
    try {
      const event = JSON.parse(trimmed) as {
        content?: { role?: string; parts?: Array<{ text?: string }> }
      }
      if (event.content?.role !== 'user') {
        for (const part of event.content?.parts ?? []) {
          if (part.text) answer += part.text
        }
      }
    } catch {
      // Skip non-JSON keepalive / partial lines.
    }
  }

  const text = answer.trim()
  if (!text) throw new Error('Reasoning engine returned no text')
  return text
}

export async function queryAdsAgent(
  message: string,
  { sessionId, context }: AgentQueryOptions = {},
): Promise<string> {
  const sid     = sessionId ?? 'anon'
  const history = _history.get(sid) ?? []

  // ── Primary: deployed ADK reasoning engine ──
  try {
    const text = await queryReasoningEngine(
      message,
      sid,
      history.length === 0 ? context : undefined,
    )
    _history.set(sid, [...history, { role: 'user' as const, text: message }, { role: 'model' as const, text }].slice(-20))
    return text
  } catch (engineErr) {
    console.warn('[vertex-agent] reasoning engine failed, falling back to Gemini direct:', engineErr)
  }

  // ── Fallback: direct Gemini call with local history ──
  const authHeaders = await getVertexAuthHeaders()

  // Inject account context only on the first turn of a session
  const inputText =
    context && history.length === 0
      ? `Account context:\n${JSON.stringify(context, null, 2)}\n\nUser question: ${message}`
      : message

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: inputText }] },
  ]

  const res = await fetch(GEMINI_URL(), {
    method:  'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Marketing Expert error (${res.status}): ${err}`)
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    '(no response from agent)'

  // Keep last 20 turns to stay within context limits
  _history.set(sid, [...history, { role: 'user' as const, text: message }, { role: 'model' as const, text }].slice(-20))

  return text
}
