import { NextRequest, NextResponse } from "next/server"
import { aiConfigured, geminiApiKey, geminiGenerate, geminiText } from "@/lib/gemini-rest"
import { PDFParse } from "pdf-parse"
import { requireSession } from "@/lib/freehold/api-auth"

export const runtime = "nodejs"

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

    const formData = await req.formData()
    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 })
    }

    const arrayBuffer = await (file as File).arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
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
    const parts: unknown[] = []
    if (imageOnly) parts.push({ inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } })
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
