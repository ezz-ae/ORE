// Shared Gemini REST caller with model fallback.
//
// A deployment's GEMINI_MODEL can point at a retired model (e.g.
// gemini-1.5-flash-latest, now 404). Rather than fail, we try the configured
// model first and fall through current models on a NOT_FOUND.

const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]

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
  let last = ""
  for (const model of geminiModelCandidates()) {
    // 2.5-family models think by default and can burn the whole token budget
    // producing an EMPTY answer — pin thinking off for these text callers.
    const config = model.startsWith("gemini-2.5")
      ? { ...((generationConfig as Record<string, unknown>) ?? {}), thinkingConfig: { thinkingBudget: 0 } }
      : generationConfig
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig: config, ...(tools ? { tools } : {}) }),
      },
    )
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
