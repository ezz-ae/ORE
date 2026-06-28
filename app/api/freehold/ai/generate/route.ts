import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * General-purpose text generation used by Web Studio AI buttons
 * (write area guide, complete developer profile, generate topic, improve listing).
 * Real Gemini call; falls back to a structured draft if the key is absent so the
 * button always produces usable content.
 */
export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const prompt = String(body.prompt || "").trim()
  const system = String(body.system || "You are a senior Dubai real-estate content writer for Freehold Property UAE. Write clear, specific, publication-ready copy. No placeholders.")
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      text: `${prompt}\n\n(Connect GEMINI_API_KEY to generate live AI content.)`,
      source: "fallback",
    })
  }

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp"
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => `HTTP ${res.status}`)
      console.error("[ai/generate] gemini error", detail)
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 })
    }
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
    if (!text) return NextResponse.json({ error: "AI returned no content" }, { status: 502 })
    return NextResponse.json({ text, source: "gemini" })
  } catch (e) {
    console.error("[ai/generate] failed", e)
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 })
  }
}
