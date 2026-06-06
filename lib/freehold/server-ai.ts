import { GoogleAuth } from 'google-auth-library'

const PROJECT  = 'gen-lang-client-0814069297'
const LOCATION = 'us-central1'
const MODEL    = 'gemini-2.0-flash-001'

const GEMINI_URL = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`

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

let _cachedToken: string | null = null
let _tokenExpiry = 0

async function getAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.VERTEX_AI_API_KEY
  if (apiKey) return { 'x-goog-api-key': apiKey }

  const credJson = process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON
  if (!credJson) {
    throw new Error(
      'Neither VERTEX_AI_API_KEY nor VERTEX_AI_SERVICE_ACCOUNT_JSON is set. ' +
      'Add VERTEX_AI_SERVICE_ACCOUNT_JSON to your environment variables.',
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

type Turn = { role: 'user' | 'model'; text: string }
const _history = new Map<string, Turn[]>()

export interface ServerQueryOptions {
  sessionId?: string
  context?: Record<string, unknown>
  systemPrompt?: string
}

export async function queryServerAgent(
  message: string,
  { sessionId, context, systemPrompt }: ServerQueryOptions = {},
): Promise<string> {
  const authHeaders = await getAuthHeaders()
  const sid     = sessionId ?? 'server-anon'
  const history = _history.get(sid) ?? []

  const inputText =
    context && history.length === 0
      ? `Server context:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${message}`
      : message

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: inputText }] },
  ]

  const res = await fetch(GEMINI_URL, {
    method:  'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt ?? SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
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

  _history.set(sid, [...history, { role: 'user' as const, text: message }, { role: 'model' as const, text }].slice(-20))

  return text
}
