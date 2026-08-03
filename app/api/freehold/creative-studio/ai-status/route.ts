import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { geminiModelCandidates } from "@/lib/gemini-rest"
import { vertexConfigured } from "@/lib/google/vertex-auth"

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

  // Test the SAME models the app actually calls (with fallback), not one
  // hardcoded id — a valid key can 404 on a single retired/ungated model while
  // others serve fine, which made this endpoint report a false failure.
  let test: { ok: boolean; status: number; verdict: string; workingModel?: string; perModel?: Record<string, number> } =
    { ok: false, status: 0, verdict: "no key" }
  let availableModels: string[] = []

  if (key) {
    // 1) What models can this key actually see? ListModels is the ground truth.
    try {
      const lm = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=50`)
      if (lm.ok) {
        const data = (await lm.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }
        availableModels = (data.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => (m.name ?? "").replace(/^models\//, ""))
          .filter(Boolean)
      }
    } catch { /* fall through to the generate probe */ }

    // 2) Probe generateContent across the app's real candidate list.
    const perModel: Record<string, number> = {}
    let lastBody = ""
    let okModel: string | null = null
    for (const model of geminiModelCandidates()) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 1 } }),
          },
        )
        perModel[model] = res.status
        if (res.ok) { okModel = model; break }
        lastBody = await res.text().catch(() => "")
      } catch (e) {
        perModel[model] = 0
        lastBody = e instanceof Error ? e.message : "network error"
      }
    }

    const verdict = okModel
      ? `OK — the key works on ${okModel}. Generation should run.`
      : /RESOURCE_EXHAUSTED|"code":\s*429|quota|limit:\s*0|billing/i.test(lastBody)
        ? "QUOTA/BILLING — the key reached Google but the project has no quota. Enable billing on THIS key's Google Cloud project."
        : /API_KEY_INVALID|API key not valid/i.test(lastBody)
          ? "INVALID KEY — Google rejected it. Use a real Gemini key (starts with AIza…)."
          : availableModels.length === 0
            ? "The key can't list or call any generateContent model — likely the Generative Language API isn't enabled on its Google Cloud project, or the key is API-restricted. Enable 'Generative Language API' for this key's project."
            : `None of the app's candidate models worked, but the key CAN see: ${availableModels.slice(0, 5).join(", ")}. Set GEMINI_MODEL to one of these.`
    test = { ok: !!okModel, status: okModel ? 200 : (Object.values(perModel).find((s) => s > 0) ?? 0), verdict, workingModel: okModel ?? undefined, perModel }
  }

  return NextResponse.json({
    gemini: {
      keyFoundUnder: resolvedName,           // which env var the app is actually using
      allNamesSet: setNames,                 // every key-name currently populated
      keyTail: mask,                         // last 4 chars only (to confirm which key)
      looksLikeGeminiKey: key.startsWith("AIza"),
      configuredModel: process.env.GEMINI_MODEL || null,
      availableModels: availableModels.slice(0, 20),
      test,
    },
    vertex: { configured: vertexConfigured() },
    fal: { present: !!process.env.FAL_KEY },
  })
}
