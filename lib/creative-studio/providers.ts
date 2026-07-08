// Creative Studio generation providers.
//
// Freehold runs on Gemini by default (no extra keys). A client that adds a
// fal.ai key (FAL_KEY) gets premium image/video quality — media generation
// tries fal.ai first and falls back to Vertex/Gemini where available. When no
// provider can serve a node, we return a clear, actionable message rather than
// a fake result.

const GEMINI_KEY = () => process.env.GEMINI_API_KEY || process.env.google_api_key || ""
const FAL_KEY = () => process.env.FAL_KEY || ""

export interface TextOptions { temperature?: number; maxTokens?: number; system?: string }

/** Text generation via Gemini (Freehold's default provider). */
export async function genText(prompt: string, opts: TextOptions = {}): Promise<string> {
  const key = GEMINI_KEY()
  if (!key) throw new Error("Text generation needs GEMINI_API_KEY. Add it in your environment (Integrations → AI).")
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp"
  const system = opts.system || "You are a senior creative marketing copywriter for a Dubai real-estate brand. Write clear, specific, publication-ready copy. No placeholders."
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
        generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens ?? 2048 },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini error: ${await res.text().catch(() => res.status)}`)
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
  if (!text) throw new Error("Gemini returned no content.")
  return text
}

export interface ImageOptions { aspectRatio?: string; imageUrl?: string; model?: string }

/** Image generation: fal.ai when configured, otherwise an honest instruction. */
export async function genImage(prompt: string, opts: ImageOptions = {}): Promise<{ url: string; provider: string }> {
  if (FAL_KEY()) {
    const { fal } = await import("@fal-ai/client")
    fal.config({ credentials: FAL_KEY() })
    const model = opts.model || (opts.imageUrl ? "fal-ai/flux-2-pro/edit" : "fal-ai/flux-2-pro")
    const input: Record<string, unknown> = { prompt }
    if (opts.imageUrl) input.image_url = opts.imageUrl
    if (opts.aspectRatio) input.aspect_ratio = opts.aspectRatio
    const result = (await fal.subscribe(model, { input })) as { data?: { images?: Array<{ url?: string }> } }
    const url = result?.data?.images?.[0]?.url
    if (!url) throw new Error("fal.ai returned no image.")
    return { url, provider: "fal.ai" }
  }
  // Vertex Imagen is the intended premium fallback; until it's wired, be honest.
  throw new Error("Image generation needs a fal.ai key (FAL_KEY) — add it in your environment to enable image nodes. Freehold can also route this to Vertex Imagen once configured.")
}

export interface VideoOptions { imageUrl?: string; model?: string; duration?: number }

/** Video generation: fal.ai (Veo) when configured, otherwise an honest instruction. */
export async function genVideo(prompt: string, opts: VideoOptions = {}): Promise<{ url: string; provider: string }> {
  if (FAL_KEY()) {
    const { fal } = await import("@fal-ai/client")
    fal.config({ credentials: FAL_KEY() })
    const model = opts.model || "fal-ai/veo3/image-to-video"
    const input: Record<string, unknown> = { prompt }
    if (opts.imageUrl) input.image_url = opts.imageUrl
    const result = (await fal.subscribe(model, { input })) as { data?: { video?: { url?: string } } }
    const url = result?.data?.video?.url
    if (!url) throw new Error("fal.ai returned no video.")
    return { url, provider: "fal.ai" }
  }
  throw new Error("Video generation needs a fal.ai key (FAL_KEY) — add it in your environment to enable video nodes.")
}
