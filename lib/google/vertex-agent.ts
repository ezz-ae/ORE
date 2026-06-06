import { GoogleAuth } from 'google-auth-library'

const REASONING_ENGINE_URL =
  'https://us-west1-aiplatform.googleapis.com/v1/projects/gen-lang-client-0814069297/locations/us-west1/reasoningEngines/5025322292796719104:query'

// Vertex AI token — cached for up to 55 minutes to avoid re-fetching on every request
let _cachedToken: string | null = null
let _tokenExpiry = 0

async function getVertexToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken

  const credJson = process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON
  if (!credJson) {
    throw new Error(
      'VERTEX_AI_SERVICE_ACCOUNT_JSON is not configured. ' +
      'Add a service account JSON key with Vertex AI User role for project gen-lang-client-0814069297.',
    )
  }

  const auth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })

  const client = await auth.getClient()
  const tokenRes = await client.getAccessToken()
  if (!tokenRes.token) throw new Error('Failed to obtain Vertex AI access token')

  _cachedToken = tokenRes.token
  _tokenExpiry = Date.now() + 55 * 60 * 1000
  return _cachedToken
}

export interface AgentMessage {
  role: 'user' | 'agent'
  content: string
}

export interface AgentQueryOptions {
  sessionId?: string
  context?: Record<string, unknown>
}

export async function queryAdsAgent(
  message: string,
  { sessionId, context }: AgentQueryOptions = {},
): Promise<string> {
  const token = await getVertexToken()

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
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Vertex AI AdExpert error (${res.status}): ${err}`)
  }

  const data = await res.json() as { output?: string }
  return data.output ?? '(no response from agent)'
}
