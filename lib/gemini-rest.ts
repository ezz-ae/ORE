// Shared Gemini REST caller with model fallback.
//
// A deployment's GEMINI_MODEL can point at a retired model (e.g.
// gemini-1.5-flash-latest, now 404). Rather than fail, we try the configured
// model first and fall through current models on a NOT_FOUND.

import { vertexConfigured, vertexGenerateContent } from "@/lib/google/vertex-auth"

const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]

// Sentinel returned by geminiApiKey() when there is no AI-Studio key but a
// Vertex service account IS configured. Callers pass it straight to
// geminiGenerate (their `if (!apiKey)` guards still pass because it's non-empty),
// and geminiGenerate routes to Vertex instead of the AI-Studio REST endpoint.
export const VERTEX_SENTINEL = "__vertex_sa__"

/**
 * The single source of truth for "what AI credential do I use?" — returns the
 * real AI-Studio key (any accepted casing), else the Vertex sentinel when a
 * service account is configured, else "". Use this everywhere instead of
 * reading process.env.GEMINI_API_KEY directly, so a deployment with ONLY a
 * Vertex service account still runs AI.
 */
export function geminiApiKey(): string {
  const k = (
    process.env.GEMINI_API_KEY ||
    process.env.Gemini_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.google_api_key ||
    process.env.GEMINI_KEY ||
    ""
  ).trim()
  if (k) return k
  if (vertexConfigured()) return VERTEX_SENTINEL
  return ""
}

/** True when any AI credential (AI-Studio key OR Vertex service account) exists. */
export function aiConfigured(): boolean {
  return geminiApiKey() !== ""
}

export function geminiModelCandidates(): string[] {
  const configured = process.env.GEMINI_MODEL?.trim()
  return Array.from(new Set([configured, ...FALLBACK_MODELS].filter(Boolean) as string[]))
}

export type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    /** Present when the call ran with the google_search tool and the model
     *  actually grounded its answer — absent means NO search happened. */
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
      webSearchQueries?: string[]
    }
  }>
}

/**
 * POST to the Gemini REST generateContent endpoint, trying current models when
 * the configured one is retired (404) or rate-limited (429 — free-tier quota
 * buckets are PER MODEL, so the next model usually still serves). Returns the
 * parsed response, or throws with the last error detail.
 */
export async function geminiGenerate(apiKey: string, contents: unknown, generationConfig?: unknown, tools?: unknown): Promise<GeminiResponse> {
  // Vertex path: either the caller passed the sentinel, or there's no usable
  // AI-Studio key but a Vertex service account is available. Vertex preserves
  // the multimodal contents and returns the same {candidates} shape.
  if (apiKey === VERTEX_SENTINEL || (!apiKey && vertexConfigured())) {
    return (await vertexGenerateContent(contents, generationConfig, tools)) as GeminiResponse
  }
  let last = ""
  for (const model of geminiModelCandidates()) {
    // 2.5-family models think by default and can burn the whole token budget
    // producing an EMPTY answer — pin thinking off for these text callers.
    const config = model.startsWith("gemini-2.5")
      ? { ...((generationConfig as Record<string, unknown>) ?? {}), thinkingConfig: { thinkingBudget: 0 } }
      : generationConfig
    // Per-model timeout so one hung model can't consume the whole serverless
    // budget and get the function killed with a non-JSON body (which the caller
    // would then fail to parse). 45s leaves room to fall through to another
    // model within a 120s route budget.
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 45_000)
    let res: Response
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          // Key travels as a header, not a URL query param — a URL key leaks
          // into proxy/edge access logs.
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents, generationConfig: config, ...(tools ? { tools } : {}) }),
          signal: ctrl.signal,
        },
      )
    } catch (e) {
      last = e instanceof Error && e.name === "AbortError" ? `timeout after 45s on ${model}` : String(e)
      continue // try the next model
    } finally {
      clearTimeout(timer)
    }
    if (res.ok) return (await res.json()) as GeminiResponse
    last = await res.text().catch(() => String(res.status))
    const retryable = res.status === 404 || res.status === 429 || /NOT_FOUND|RESOURCE_EXHAUSTED/i.test(last)
    if (!retryable) break
  }
  throw new Error(last || "Gemini request failed")
}

export function geminiText(resp: GeminiResponse): string {
  return resp.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
}
