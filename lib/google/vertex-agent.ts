import { GoogleAuth } from 'google-auth-library'

const PROJECT  = 'gen-lang-client-0814069297'
const LOCATION = 'us-central1'
const MODEL    = 'gemini-2.0-flash-001'

// Deployed ADK reasoning engine — used for session/memory storage in future
// const REASONING_ENGINE_ID = '2989271399492747264'

const GEMINI_URL = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`

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

let _cachedToken: string | null = null
let _tokenExpiry = 0

async function getAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.VERTEX_AI_API_KEY
  if (apiKey) return { 'x-goog-api-key': apiKey }

  const credJson = process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON
  if (!credJson) {
    throw new Error(
      'Neither VERTEX_AI_API_KEY nor VERTEX_AI_SERVICE_ACCOUNT_JSON is configured. ' +
      'Add VERTEX_AI_SERVICE_ACCOUNT_JSON (vertex-express service account JSON) to your Vercel env vars.',
    )
  }

  if (_cachedToken && Date.now() < _tokenExpiry) {
    return { Authorization: `Bearer ${_cachedToken}` }
  }

  const auth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client   = await auth.getClient()
  const tokenRes = await client.getAccessToken()
  if (!tokenRes.token) throw new Error('Failed to obtain Vertex AI access token')

  _cachedToken = tokenRes.token
  _tokenExpiry = Date.now() + 55 * 60 * 1000
  return { Authorization: `Bearer ${_cachedToken}` }
}

// ─── Session history (warm-instance cache) ────────────────────────────────────

type Turn = { role: 'user' | 'model'; text: string }
const _history = new Map<string, Turn[]>()

// ─── Query ────────────────────────────────────────────────────────────────────

export interface AgentQueryOptions {
  sessionId?: string
  context?: Record<string, unknown>
}

export async function queryAdsAgent(
  message: string,
  { sessionId, context }: AgentQueryOptions = {},
): Promise<string> {
  const authHeaders = await getAuthHeaders()
  const sid     = sessionId ?? 'anon'
  const history = _history.get(sid) ?? []

  // Inject account context only on the first turn of a session
  const inputText =
    context && history.length === 0
      ? `Account context:\n${JSON.stringify(context, null, 2)}\n\nUser question: ${message}`
      : message

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: inputText }] },
  ]

  const res = await fetch(GEMINI_URL, {
    method:  'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
  _history.set(sid, [...history, { role: 'user', text: message }, { role: 'model', text }].slice(-20))

  return text
}
