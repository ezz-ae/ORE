import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Diagnostic: shows which Gemini key the LIVE deployment is using (masked) and
// what a real test call returns — so a quota/billing/wrong-name issue is
// obvious without ever exposing the key. Visit /api/freehold/creative-studio/ai-status
const KEY_NAMES = ["GEMINI_API_KEY", "Gemini_API_KEY", "GOOGLE_API_KEY", "google_api_key", "GEMINI_KEY"] as const

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const setNames = KEY_NAMES.filter((n) => !!process.env[n])
  const resolvedName = setNames[0] ?? null
  const key = resolvedName ? String(process.env[resolvedName]) : ""
  const mask = key ? `…${key.slice(-4)}` : null

  let test: { ok: boolean; status: number; verdict: string } = { ok: false, status: 0, verdict: "no key" }
  if (key) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 1 } }),
        },
      )
      const body = await res.text().catch(() => "")
      const verdict = res.ok
        ? "OK — the key works. Generation should run."
        : /RESOURCE_EXHAUSTED|"code":\s*429|quota|limit:\s*0/i.test(body)
          ? "QUOTA/BILLING — the key reached Google but the project has no quota. Enable billing on THIS key's Google Cloud project."
          : /API_KEY_INVALID|API key not valid/i.test(body)
            ? "INVALID KEY — Google rejected it. Use a real Gemini key (starts with AIza…)."
            : `Gemini returned HTTP ${res.status}.`
      test = { ok: res.ok, status: res.status, verdict }
    } catch (e) {
      test = { ok: false, status: 0, verdict: `Network error: ${e instanceof Error ? e.message : "unknown"}` }
    }
  }

  return NextResponse.json({
    gemini: {
      keyFoundUnder: resolvedName,           // which env var the app is actually using
      allNamesSet: setNames,                 // every key-name currently populated
      keyTail: mask,                         // last 4 chars only (to confirm which key)
      looksLikeGeminiKey: key.startsWith("AIza"),
      test,
    },
    fal: { present: !!process.env.FAL_KEY },
  })
}
