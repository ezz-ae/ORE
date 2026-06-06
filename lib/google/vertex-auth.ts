/**
 * Shared Vertex AI auth + generation.
 * ───────────────────────────────────
 * Single source of truth for talking to Vertex AI Gemini with the Freehold
 * service account. Used by:
 *   - lib/freehold/server-ai.ts   (Intelligence Server AI)
 *   - lib/google/vertex-agent.ts  (Marketing / Ads Expert)
 *   - lib/gemini.ts               (public + CRM AI fallback when no API key)
 *
 * Auth precedence: VERTEX_AI_API_KEY → VERTEX_AI_SERVICE_ACCOUNT_JSON (OAuth).
 * The project id is derived from the service-account JSON, with env overrides.
 */

import { GoogleAuth } from 'google-auth-library'

const DEFAULT_PROJECT = 'gen-lang-client-0814069297'
export const VERTEX_LOCATION =
  process.env.GOOGLE_CLOUD_REGION || process.env.VERTEX_LOCATION || 'us-central1'

let _cachedToken: string | null = null
let _tokenExpiry = 0
let _projectId: string | null = null

/** True when either Vertex credential is available. */
export function vertexConfigured(): boolean {
  return Boolean(process.env.VERTEX_AI_API_KEY || process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON)
}

export function resolveVertexProject(): string {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT
  if (process.env.VERTEX_PROJECT) return process.env.VERTEX_PROJECT
  if (_projectId) return _projectId
  const credJson = process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON
  if (credJson) {
    try {
      const p = JSON.parse(credJson)?.project_id
      if (p) {
        _projectId = p
        return p
      }
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT_PROJECT
}

export async function getVertexAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.VERTEX_AI_API_KEY
  if (apiKey) return { 'x-goog-api-key': apiKey }

  const credJson = process.env.VERTEX_AI_SERVICE_ACCOUNT_JSON
  if (!credJson) {
    throw new Error(
      'Vertex AI is not configured. Set VERTEX_AI_SERVICE_ACCOUNT_JSON (service-account JSON) ' +
      'or VERTEX_AI_API_KEY in your environment.',
    )
  }

  if (_cachedToken && Date.now() < _tokenExpiry) {
    return { Authorization: `Bearer ${_cachedToken}` }
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
  return { Authorization: `Bearer ${_cachedToken}` }
}

export interface VertexContent {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export interface VertexGenerateOptions {
  model: string
  contents: VertexContent[]
  systemInstruction?: string
  generationConfig?: Record<string, unknown>
}

/** Call Vertex `generateContent` and return the concatenated text. */
export async function vertexGenerateText(opts: VertexGenerateOptions): Promise<string> {
  const headers = await getVertexAuthHeaders()
  const project = resolveVertexProject()
  const url =
    `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${VERTEX_LOCATION}/publishers/google/models/${opts.model}:generateContent`

  const genConfig: Record<string, unknown> = {
    ...(opts.generationConfig ?? { temperature: 0.7, maxOutputTokens: 8192 }),
  }
  // Gemini 2.5 Flash enables "thinking" by default, which consumes the output
  // token budget and can return empty text on short answers. These are direct
  // chat/content surfaces, so disable thinking unless a caller opts in.
  if (
    opts.model.includes('2.5') &&
    opts.model.includes('flash') &&
    !('thinkingConfig' in genConfig)
  ) {
    genConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig: genConfig,
  }
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`Vertex generateContent error (${res.status}): ${err}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
}

/**
 * Map any Gemini model id to a model available in this Vertex project.
 * Only the 2.5 family is enabled here (2.0 / 1.5 ids return 404), so every
 * request resolves to a 2.5 model — keeping older Studio ids from 404-ing.
 */
export function normalizeVertexModel(name: string): string {
  const n = (name || '').toLowerCase()
  if (n.includes('pro')) return 'gemini-2.5-pro'
  if (n.includes('lite')) return 'gemini-2.5-flash-lite'
  return 'gemini-2.5-flash'
}
