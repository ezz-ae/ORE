import { NextRequest, NextResponse } from "next/server"
import { aiConfigured, geminiApiKey, geminiGenerate, geminiText } from "@/lib/gemini-rest"
import { PDFParse } from "pdf-parse"
import { requireSession } from "@/lib/freehold/api-auth"

export const runtime = "nodejs"
// Files-API upload + PROCESSING poll + vision call need headroom.
export const maxDuration = 60

// Hard ceiling for brochures arriving via the Blob-URL path. Small files
// (≤4.3MB) still POST multipart directly; anything larger is uploaded by the
// browser straight to Vercel Blob (the platform rejects request bodies over
// ~4.5MB before this handler runs) and referenced here as JSON {url}.
const MAX_BROCHURE_BYTES = 30 * 1024 * 1024

const extractJson = (value: string) => {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")
  if (start === -1 || end === -1) return null
  const snippet = value.slice(start, end + 1)
  try {
    return JSON.parse(snippet)
  } catch {
    return null
  }
}

/**
 * Upload a large PDF to the Gemini Files API and wait for it to become
 * ACTIVE, returning its file URI (or null on any failure). Only used for
 * image-only brochures too big for inline base64. Not available on the
 * Vertex sentinel path — callers fall back to an honest error there.
 */
async function uploadPdfToGeminiFiles(buffer: Buffer, key: string): Promise<string | null> {
  if (!key || key === "__vertex_sa__") return null
  try {
    const up = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "X-Goog-Upload-Protocol": "raw",
        "Content-Type": "application/pdf",
      },
      body: new Uint8Array(buffer),
    })
    if (!up.ok) return null
    const meta = (await up.json()) as { file?: { uri?: string; name?: string; state?: string } }
    let uri = meta.file?.uri || null
    const name = meta.file?.name
    let state = meta.file?.state || "ACTIVE"
    // PDFs briefly sit in PROCESSING; poll until ACTIVE (bounded).
    for (let i = 0; i < 10 && name && state === "PROCESSING"; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      const st = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, { headers: { "x-goog-api-key": key } })
      if (!st.ok) break
      const j = (await st.json()) as { uri?: string; state?: string }
      state = j.state || state
      uri = j.uri || uri
    }
    return state === "ACTIVE" || state === "SUCCEEDED" ? uri : null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  // Session-gated: an unauthenticated caller must not burn Gemini quota on
  // arbitrary uploads. Any signed-in role may parse (the PDF tools and the
  // Ad Designer both use this).
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  try {
    const hasGeminiKey =
      aiConfigured()
    if (!hasGeminiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 400 })
    }

    // Two intake modes, one pipeline:
    //  - multipart FormData "file" (unchanged fast path for PDFs ≤4.3MB), or
    //  - JSON {url} pointing at a Vercel Blob the browser uploaded directly
    //    (4.3–12MB brochures — the platform caps request bodies at ~4.5MB, so
    //    big files can never arrive as a body; we fetch the bytes ourselves).
    let buffer: Buffer
    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as { url?: unknown } | null
      const url = typeof body?.url === "string" ? body.url : ""
      if (!url) {
        return NextResponse.json({ error: "A blob `url` is required." }, { status: 400 })
      }
      // Only fetch from Vercel Blob storage — this route must not become a
      // generic server-side fetch proxy (SSRF).
      let hostname = ""
      try { hostname = new URL(url).hostname } catch { /* handled below */ }
      if (!(hostname === "blob.vercel-storage.com" || hostname.endsWith(".blob.vercel-storage.com"))) {
        return NextResponse.json({ error: "Only Vercel Blob URLs are accepted." }, { status: 400 })
      }
      let fetched: Response
      try {
        fetched = await fetch(url)
      } catch {
        return NextResponse.json({ error: "Couldn't download the uploaded brochure from Blob storage." }, { status: 502 })
      }
      if (!fetched.ok) {
        return NextResponse.json({ error: `Couldn't download the uploaded brochure (HTTP ${fetched.status}).` }, { status: 502 })
      }
      buffer = Buffer.from(await fetched.arrayBuffer())
      if (buffer.byteLength > MAX_BROCHURE_BYTES) {
        return NextResponse.json({ error: "This PDF is over the 30 MB limit — compress it and try again." }, { status: 413 })
      }
    } else {
      const formData = await req.formData()
      const file = formData.get("file")
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "PDF file is required." }, { status: 400 })
      }
      buffer = Buffer.from(await (file as File).arrayBuffer())
    }
    // Designed brochures are frequently IMAGE-ONLY PDFs with no text layer at
    // all — text extraction is a fast path, never a requirement. When it comes
    // back empty (or near-empty), fall through to Gemini vision on the PDF
    // itself below instead of failing (the reported "Couldn't read that
    // brochure" on perfectly good brochures).
    let text = ""
    try {
      const parser = new PDFParse({ data: buffer })
      const parsed = await parser.getText()
      text = (parsed.text || "").replace(/\s+/g, " ").trim()
      await parser.destroy()
    } catch { /* corrupt text layer — vision path below still works */ }
    const imageOnly = text.length < 200

    const prompt = `You are an AI data extraction engine for real estate brochures.
Return ONLY valid JSON. No markdown.

Extract these fields from the brochure text:
{
  "name": string,
  "slug": string,
  "area": string,
  "developer": string,
  "priceFrom": number | null,
  "priceTo": number | null,
  "roi": number | null,
  "paymentPlan": string,
  "handoverDate": string,
  "description": string,
  "highlights": string[],
  "amenities": string[]
}

Rules:
- slug should be URL-safe and start with "freehold-".
- priceFrom/priceTo should be numbers in AED (no commas).
- roi should be a number (percent) without the % sign.
- If any field is not found, return null or an empty string/array.

${imageOnly ? "The brochure follows as an attached PDF — read it visually (it has little or no text layer)." : `Brochure text:\n${text.slice(0, 12000)}`}
`

    // One hardened path for both modes: geminiGenerate carries the full model
    // ladder, the 5 key-alias spellings, and the Vertex fallback — the same
    // client every other AI feature uses (the old SDK wrapper here had its own
    // narrower key handling and no vision support).
    // Inline base64 rides inside the generateContent request, which Gemini
    // caps around 20 MB total — safe up to ~14 MB of raw PDF. Bigger
    // image-only brochures go through the Files API instead (upload once,
    // reference by URI), which is how 14–30 MB brochures stay readable.
    const INLINE_PDF_LIMIT = 14 * 1024 * 1024
    const parts: unknown[] = []
    if (imageOnly && buffer.byteLength > INLINE_PDF_LIMIT) {
      const fileUri = await uploadPdfToGeminiFiles(buffer, geminiApiKey())
      if (!fileUri) {
        return NextResponse.json({ error: "This brochure has no readable text layer and is too large for direct AI reading — compress it under 14 MB and retry." }, { status: 502 })
      }
      parts.push({ fileData: { mimeType: "application/pdf", fileUri } })
    } else if (imageOnly) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } })
    }
    parts.push({ text: prompt })
    let responseText = ""
    try {
      const resp = await geminiGenerate(geminiApiKey(), [{ role: "user", parts }], { temperature: 0.1, maxOutputTokens: 2048 })
      responseText = geminiText(resp)
    } catch (err) {
      const detail = err instanceof Error ? err.message.slice(0, 200) : "AI request failed"
      return NextResponse.json({ error: `Brochure AI extraction failed: ${detail}` }, { status: 502 })
    }

    if (!responseText) {
      return NextResponse.json({ error: "The AI returned no content for this brochure — try again, or use a smaller/cleaner PDF." }, { status: 502 })
    }

    const extracted = extractJson(responseText)
    if (!extracted) {
      return NextResponse.json({ error: "Unable to parse AI response." }, { status: 500 })
    }

    return NextResponse.json({ data: extracted })
  } catch (error) {
    console.error("[v0] Brochure parse error:", error)
    return NextResponse.json({ error: "Failed to parse brochure." }, { status: 500 })
  }
}
