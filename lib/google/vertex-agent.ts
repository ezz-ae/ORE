import { GoogleAuth } from 'google-auth-library'

const REASONING_ENGINE_URL =
  'https://us-central1-aiplatform.googleapis.com/v1/projects/gen-lang-client-0814069297/locations/us-central1/reasoningEngines/2989271399492747264:query'

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Bearer token cache (service-account path) — valid 55 min
let _cachedToken: string | null = null
let _tokenExpiry = 0

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Preferred: API key (simpler, no service-account JSON needed)
  const apiKey = process.env.VERTEX_AI_API_KEY
  if (apiKey) {
    return { 'x-goog-api-key': apiKey }
  }

  // Fallback: service-account JSON → OAuth bearer token
  const credJson = process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON
  if (!credJson) {
    throw new Error(
      'Neither VERTEX_AI_API_KEY nor VERTEX_AI_SERVICE_ACCOUNT_JSON is configured. ' +
      'Set VERTEX_AI_API_KEY (from the agent deployment output) in your environment variables.',
    )
  }

  if (_cachedToken && Date.now() < _tokenExpiry) {
    return { Authorization: `Bearer ${_cachedToken}` }
  }

  const auth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client    = await auth.getClient()
  const tokenRes  = await client.getAccessToken()
  if (!tokenRes.token) throw new Error('Failed to obtain Vertex AI access token')

  _cachedToken = tokenRes.token
  _tokenExpiry = Date.now() + 55 * 60 * 1000
  return { Authorization: `Bearer ${_cachedToken}` }
}

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

  const inputText = context
    ? `Account context:\n${JSON.stringify(context, null, 2)}\n\nUser question: ${message}`
    : message

  const body: Record<string, unknown> = {
    input: { input: inputText },
  }
  if (sessionId) {
    (body.input as Record<string, unknown>).session_id = sessionId
  }

  const res = await fetch(REASONING_ENGINE_URL, {
    method:  'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Marketing Expert error (${res.status}): ${err}`)
  }

  const data = await res.json() as { output?: string }
  return data.output ?? '(no response from agent)'
}
