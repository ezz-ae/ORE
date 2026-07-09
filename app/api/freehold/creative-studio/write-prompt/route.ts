import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { geminiGenerate, geminiText } from "@/lib/gemini-rest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Turn a property + any supplied info (notes, a link, a brochure PDF) into a
// single vivid image-generation prompt. Gemini reads the PDF natively, so no
// PDF parser is needed.
export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI prompt writing needs GEMINI_API_KEY." }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const property = (body.property && typeof body.property === "object" ? body.property : {}) as Record<string, unknown>
  const format = String(body.format || "creative")
  const notes = String(body.notes || "").trim()
  const link = String(body.link || "").trim()
  const brochureData = typeof body.brochureData === "string" ? body.brochureData.replace(/^data:[^;]+;base64,/, "") : ""
  const brochureMime = String(body.brochureMime || "application/pdf")

  // Best-effort: pull readable text from a supplied link.
  let linkText = ""
  if (/^https?:\/\//.test(link)) {
    try {
      const r = await fetch(link, { headers: { "User-Agent": "Mozilla/5.0" } })
      if (r.ok) {
        const html = await r.text()
        linkText = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 4000)
      }
    } catch { /* ignore unreachable links */ }
  }

  const facts = [
    property.name ? `Project: ${property.name}` : "",
    property.area ? `Area: ${property.area}` : "",
    property.developer ? `Developer: ${property.developer}` : "",
    property.bedrooms ? `Units: ${property.bedrooms}` : "",
    property.price ? `From: AED ${Number(property.price).toLocaleString("en-US")}` : "",
    notes ? `Notes from the agent: ${notes}` : "",
    linkText ? `From the linked page: ${linkText}` : "",
  ].filter(Boolean).join("\n")

  const system =
    "You are a senior creative director for a Dubai real-estate brand. Write ONE vivid image-generation prompt " +
    `for a ${format} creative. Describe the scene, subject, setting, lighting, mood and composition in 2–4 sentences. ` +
    "Be concrete and photographic. Do NOT include any on-image text, logos, watermarks, prices or captions. " +
    "Return ONLY the prompt text — no preamble, quotes or notes."

  const parts: unknown[] = []
  if (brochureData) parts.push({ inline_data: { mime_type: brochureMime, data: brochureData } })
  parts.push({ text: `${system}\n\nUse this information:\n${facts || "A premium Dubai property."}` })

  try {
    const data = await geminiGenerate(apiKey, [{ role: "user", parts }], { temperature: 0.8, maxOutputTokens: 1024 })
    const prompt = geminiText(data).replace(/^["']|["']$/g, "").trim()
    if (!prompt) return NextResponse.json({ error: "No prompt generated" }, { status: 502 })
    return NextResponse.json({ prompt })
  } catch (e) {
    console.error("[creative-studio/write-prompt] failed", e)
    return NextResponse.json({ error: "Prompt writing failed" }, { status: 502 })
  }
}
