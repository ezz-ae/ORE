import { NextRequest, NextResponse } from "next/server"
import { PDFParse } from "pdf-parse"
import { DEFAULT_GEMINI_MODELS, getGeminiModelByName } from "@/lib/gemini"

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
  try {
    const hasGeminiKey =
      Boolean(process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY || process.env.google_api_key)
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
    const parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    const text = (parsed.text || "").replace(/\s+/g, " ").trim()
    await parser.destroy()
    if (!text) {
      return NextResponse.json({ error: "Unable to extract brochure text." }, { status: 400 })
    }

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
- slug should be URL-safe and start with "gc-".
- priceFrom/priceTo should be numbers in AED (no commas).
- roi should be a number (percent) without the % sign.
- If any field is not found, return null or an empty string/array.

Brochure text:
${text.slice(0, 12000)}
`

    let responseText = ""
    const modelCandidates = [
      process.env.GEMINI_MODEL,
      ...(process.env.GEMINI_MODEL_FALLBACKS?.split(",").map((m) => m.trim()).filter(Boolean) || []),
      ...DEFAULT_GEMINI_MODELS,
    ].filter(Boolean) as string[]

    for (const candidate of modelCandidates) {
      try {
        const model = getGeminiModelByName(candidate)
        const result = await model.generateContent(prompt)
        responseText = result.response.text()
        if (responseText) break
      } catch (error: any) {
        const errorMessage = String(error?.message || "")
        if (!errorMessage.includes("not found") && !errorMessage.includes("not supported")) {
          throw error
        }
      }
    }

    if (!responseText) {
      return NextResponse.json({ error: "Gemini did not return a response." }, { status: 500 })
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
