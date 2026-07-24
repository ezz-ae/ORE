import { NextRequest, NextResponse } from "next/server"
import { PDFParse } from "pdf-parse"
import { DEFAULT_GEMINI_MODELS, getGeminiModelByName } from "@/lib/gemini"

// AI "client explainer": take a project brochure PDF and return an organized,
// client-ready explanation (sections + key facts + highlights) that the client
// renders into a branded, ready-to-send PDF. Private route (fail-closed edge
// auth gates /api/freehold/*); it invents nothing — facts come from the file.

export const runtime = "nodejs"

const extractJson = (value: string) => {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(value.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY || process.env.google_api_key)
    if (!hasGeminiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get("file")
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 })
    }

    const langRaw = String(formData.get("lang") || "en").toLowerCase()
    const language = langRaw === "ru" ? "Russian" : "English"

    const buffer = Buffer.from(await (file as File).arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    const text = (parsed.text || "").replace(/\s+/g, " ").trim()
    await parser.destroy()
    if (!text) {
      return NextResponse.json({ error: "Unable to extract brochure text." }, { status: 400 })
    }

    const prompt = `You are a senior real-estate advisor at Freehold. From the brochure text below, write a clean, organized, CLIENT-READY explanation of this project that a broker can send directly to a prospective buyer. Professional, warm and factual — no hype, and NEVER invent a fact: if something is not in the brochure, omit it. Write the entire explanation (every value, heading and sentence) in ${language}.

Return ONLY valid JSON, no markdown:
{
  "title": string,                                    // the project name
  "subtitle": string,                                 // one line: location + property type
  "keyFacts": [{ "label": string, "value": string }], // 3-6 items, e.g. Starting price, Payment plan, Handover, Expected ROI, Developer, Area
  "sections": [{ "heading": string, "body": string }],// 3-6 short sections, e.g. Overview, Location & Connectivity, The Homes, Payment & Investment, Amenities, Why this project
  "highlights": string[]                              // 3-6 punchy one-line selling points
}
Keep each body to 2-4 sentences. Numbers and currency stay in digits (AED).

Brochure text:
${text.slice(0, 14000)}
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
      } catch (error: unknown) {
        const msg = String((error as { message?: string })?.message || "")
        if (!msg.includes("not found") && !msg.includes("not supported")) throw error
      }
    }

    if (!responseText) return NextResponse.json({ error: "Gemini did not return a response." }, { status: 500 })
    const data = extractJson(responseText)
    if (!data) return NextResponse.json({ error: "Unable to parse AI response." }, { status: 500 })

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[pdf-explainer] error:", error)
    return NextResponse.json({ error: "Failed to build the explainer." }, { status: 500 })
  }
}
