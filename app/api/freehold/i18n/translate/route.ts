import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { LOCALES, LOCALE_LABELS, normalizeLocale, type Locale } from "@/lib/i18n/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const LANG_NAME: Record<Locale, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
}

/**
 * On-demand translation for free-text the dictionary can't cover — team-entered
 * notes, lead messages, and the inline "translate" action on long AR/RU text.
 * Real Gemini call; if no key is configured it returns the original text marked
 * untranslated so the UI degrades gracefully instead of erroring.
 */
export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { text?: unknown; to?: unknown; from?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const text = String(body.text || "").trim()
  const to = normalizeLocale(String(body.to || ""))
  const from = body.from && (LOCALES as readonly string[]).includes(String(body.from))
    ? (String(body.from) as Locale)
    : null
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 })
  if (text.length > 5000) return NextResponse.json({ error: "text too long" }, { status: 413 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ text, to, source: "fallback", translated: false })
  }

  const fromClause = from ? ` from ${LANG_NAME[from]}` : ""
  const system =
    `You are a professional translator for a Dubai real-estate CRM. Translate the user's text${fromClause} into ${LANG_NAME[to]} (${LOCALE_LABELS[to]}). ` +
    `Preserve meaning, names, numbers, currency (AED), and any URLs or @mentions exactly. ` +
    `Return ONLY the translated text with no quotes, labels, or commentary.`

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp"
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\nTEXT:\n${text}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => `HTTP ${res.status}`)
      console.error("[i18n/translate] gemini error", detail)
      return NextResponse.json({ text, to, source: "error", translated: false }, { status: 502 })
    }
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const out = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
    if (!out) return NextResponse.json({ text, to, source: "error", translated: false }, { status: 502 })
    return NextResponse.json({ text: out, to, source: "gemini", translated: true })
  } catch (e) {
    console.error("[i18n/translate] failed", e)
    return NextResponse.json({ text, to, source: "error", translated: false }, { status: 500 })
  }
}
