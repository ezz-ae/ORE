import type { AIJsonResponse } from "@/src/lib/ai/schemas"

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found")
    return JSON.parse(text.slice(start, end + 1))
  }
}

function getGeminiModels() {
  const primary = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest"
  const fallbacks = (process.env.GEMINI_MODEL_FALLBACKS || "gemini-1.5-flash,gemini-1.5-pro-latest")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)
  return Array.from(new Set([primary, ...fallbacks]))
}

export async function generateJsonWithGemini<T extends object>(prompt: string, fallback: T): Promise<AIJsonResponse<T>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { source: "Local engine", data: fallback }

  for (const model of getGeminiModels()) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.35 },
        }),
      })
      if (!response.ok) throw new Error(`Gemini request failed with ${response.status}`)
      const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error("Empty Gemini response")
      const parsed = extractJson(text)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid Gemini object")
      return { source: "Gemini", data: { ...fallback, ...(parsed as Partial<T>) } as T }
    } catch {
      continue
    }
  }
  return { source: "Local engine", data: fallback }
}
