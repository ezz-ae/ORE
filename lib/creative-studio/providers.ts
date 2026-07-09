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

// Try the configured model first, then fall through current Gemini models so a
// retired GEMINI_MODEL (e.g. gemini-1.5-flash-latest → 404) can't break nodes.
const GEMINI_MODELS = (): string[] => {
  const configured = process.env.GEMINI_MODEL?.trim()
  const current = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]
  return Array.from(new Set([configured, ...current].filter(Boolean) as string[]))
}

// Turn Google's raw error payloads into one clear line for the run panel.
function friendlyGeminiError(raw: string): string {
  if (/RESOURCE_EXHAUSTED|"code":\s*429|quota|rate.?limit/i.test(raw)) {
    return "Gemini is over quota / rate-limited. The free tier is exhausted — enable billing on your Google AI (Gemini) key, or wait a minute and retry."
  }
  if (/API_KEY_INVALID|API key not valid|"code":\s*40[13]/i.test(raw)) {
    return "The Gemini API key was rejected. Check GEMINI_API_KEY in Integrations → AI."
  }
  const short = raw.replace(/\s+/g, " ").slice(0, 200)
  return `Gemini error: ${short}`
}

/** Text generation via Gemini (Freehold's default provider). */
export async function genText(prompt: string, opts: TextOptions = {}): Promise<string> {
  const key = GEMINI_KEY()
  if (!key) throw new Error("Text generation needs GEMINI_API_KEY. Add it in your environment (Integrations → AI).")
  const system = opts.system || "You are a senior creative marketing copywriter for a Dubai real-estate brand. Write clear, specific, publication-ready copy. No placeholders."

  let lastErr = ""
  for (const model of GEMINI_MODELS()) {
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
    if (res.ok) {
      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
      if (!text) throw new Error("Gemini returned no content.")
      return text
    }
    lastErr = await res.text().catch(() => String(res.status))
    // 404 = model retired/unknown → try the next candidate; other errors are fatal.
    if (res.status !== 404 && !/NOT_FOUND/i.test(lastErr)) break
  }
  throw new Error(friendlyGeminiError(lastErr))
}

export interface ImageOptions { aspectRatio?: string; imageUrl?: string; model?: string }

// Google is the default image provider (cheap, uses the existing GEMINI key).
// It returns base64, so we hand back a data: URL — there is no blob host.
const IMAGEN_ASPECTS: Record<string, string> = {
  "1:1": "1:1", "9:16": "9:16", "16:9": "16:9", "4:3": "4:3", "3:4": "3:4",
  "4:5": "3:4", "2:3": "3:4", "3:2": "4:3",
}

// Resolve a reference image (http URL or data: URL) to inline base64 for editing.
async function toInlineImage(imageUrl?: string): Promise<{ data: string; mime: string } | null> {
  if (!imageUrl) return null
  if (imageUrl.startsWith("data:")) {
    const m = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    return m ? { mime: m[1], data: m[2] } : null
  }
  if (/^https?:\/\//.test(imageUrl)) {
    try {
      const r = await fetch(imageUrl)
      if (!r.ok) return null
      const buf = Buffer.from(await r.arrayBuffer())
      return { data: buf.toString("base64"), mime: r.headers.get("content-type") || "image/jpeg" }
    } catch { return null }
  }
  return null
}

// Imagen 3 — clean text-to-image with real aspect-ratio control.
async function imagenGenerate(prompt: string, aspectRatio: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: IMAGEN_ASPECTS[aspectRatio] || "1:1" },
        }),
      },
    )
    if (!res.ok) return null
    const j = (await res.json()) as { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> }
    const p = j.predictions?.[0]
    return p?.bytesBase64Encoded ? `data:${p.mimeType || "image/png"};base64,${p.bytesBase64Encoded}` : null
  } catch { return null }
}

// Gemini native image (also does image→image editing when given a reference).
async function geminiImage(prompt: string, key: string, ref: { data: string; mime: string } | null): Promise<string | null> {
  const models = ["gemini-2.5-flash-image-preview", "gemini-2.0-flash-preview-image-generation"]
  const parts: unknown[] = []
  if (ref) parts.push({ inline_data: { mime_type: ref.mime, data: ref.data } })
  parts.push({ text: prompt })
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
        },
      )
      if (!res.ok) continue
      const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }> }
      for (const part of j.candidates?.[0]?.content?.parts ?? []) {
        const inl = (part.inlineData || part.inline_data) as { data?: string; mimeType?: string; mime_type?: string } | undefined
        if (inl?.data) return `data:${inl.mimeType || inl.mime_type || "image/png"};base64,${inl.data}`
      }
    } catch { continue }
  }
  return null
}

/**
 * Image generation. Google (Imagen / Gemini) is the default — cheap and served
 * by the existing GEMINI key. fal.ai is used only as an optional premium path.
 */
export async function genImage(prompt: string, opts: ImageOptions = {}): Promise<{ url: string; provider: string }> {
  const key = GEMINI_KEY()
  const aspect = opts.aspectRatio || "1:1"

  if (key) {
    const ref = await toInlineImage(opts.imageUrl)
    // With a reference image → Gemini editing. Without → Imagen for aspect control.
    if (!ref) {
      const im = await imagenGenerate(prompt, aspect, key)
      if (im) return { url: im, provider: "google-imagen" }
    }
    const gm = await geminiImage(ref ? `${prompt}\n\nMaintain the composition and use ${aspect} framing.` : `${prompt}\n\nRender in ${aspect} aspect ratio.`, key, ref)
    if (gm) return { url: gm, provider: "google-gemini" }
  }

  // Optional premium provider.
  if (FAL_KEY()) {
    const { fal } = await import("@fal-ai/client")
    fal.config({ credentials: FAL_KEY() })
    const model = opts.model || (opts.imageUrl ? "fal-ai/flux-2-pro/edit" : "fal-ai/flux-2-pro")
    const input: Record<string, unknown> = { prompt }
    if (opts.imageUrl && /^https?:\/\//.test(opts.imageUrl)) input.image_url = opts.imageUrl
    if (opts.aspectRatio) input.aspect_ratio = opts.aspectRatio
    const result = (await fal.subscribe(model, { input })) as { data?: { images?: Array<{ url?: string }> } }
    const url = result?.data?.images?.[0]?.url
    if (!url) throw new Error("fal.ai returned no image.")
    return { url, provider: "fal.ai" }
  }

  // The key exists but every Google attempt failed — almost always the same
  // quota/rate-limit wall (or Imagen not enabled on the key), not a missing key.
  if (key) {
    throw new Error("Image generation failed on Google — likely the Gemini quota/rate limit (free tier exhausted) or Imagen isn't enabled on your key. Enable billing on your Gemini key, or add FAL_KEY for premium image/video.")
  }
  throw new Error("Image generation needs GEMINI_API_KEY (Google, default) or FAL_KEY. Add one in your environment (Integrations → AI).")
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
  throw new Error("Video generation needs a fal.ai key (FAL_KEY), or Google Veo access on your Gemini key — add one in your environment to enable video nodes. Image generation already runs on Google by default.")
}
