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

export type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }

/**
 * POST to the Gemini REST generateContent endpoint, trying current models when
 * the configured one is retired (404 / NOT_FOUND). Returns the parsed response,
 * or throws with the last error detail.
 */
export async function geminiGenerate(apiKey: string, contents: unknown, generationConfig?: unknown): Promise<GeminiResponse> {
  let last = ""
  for (const model of geminiModelCandidates()) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig }),
      },
    )
    if (res.ok) return (await res.json()) as GeminiResponse
    last = await res.text().catch(() => String(res.status))
    // 404 = model retired/unknown → try the next candidate; other errors are fatal.
    if (res.status !== 404 && !/NOT_FOUND/i.test(last)) break
  }
  throw new Error(last || "Gemini request failed")
}

export function geminiText(resp: GeminiResponse): string {
  return resp.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
}
