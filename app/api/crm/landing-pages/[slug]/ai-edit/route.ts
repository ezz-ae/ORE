import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, isAdminRole } from "@/lib/auth"
import { geminiGenerate, geminiText } from "@/lib/gemini-rest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The only fields the AI is allowed to edit. Anything else the model returns is
// dropped — we never invent or touch fields outside this list.
const EDITABLE_FIELDS = ["headline", "subheadline", "ctaText", "seoTitle", "seoDescription"] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

const FIELD_GUIDANCE: Record<EditableField, string> = {
  headline: "the main hero headline — short, punchy, benefit-led",
  subheadline: "one or two supporting sentences under the headline",
  ctaText: "the call-to-action button label — a few words, action-oriented",
  seoTitle: "the SEO/browser title — MAX 60 characters",
  seoDescription: "the SEO meta description — MAX 160 characters",
}

const toText = (value: unknown) => (typeof value === "string" ? value.trim() : "")

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  if (!isAdminRole(user.role)) return NextResponse.json({ error: "Admins only." }, { status: 403 })

  await params // slug is not needed for generation, but keep the signature honest.

  const body = await req.json().catch(() => null)
  const instruction = toText((body as { instruction?: unknown })?.instruction)
  if (!instruction) {
    return NextResponse.json({ error: "An instruction is required." }, { status: 400 })
  }

  const currentRaw = (body as { current?: Record<string, unknown> })?.current ?? {}
  const current: Record<EditableField, string> = {
    headline: toText(currentRaw.headline),
    subheadline: toText(currentRaw.subheadline),
    ctaText: toText(currentRaw.ctaText),
    seoTitle: toText(currentRaw.seoTitle),
    seoDescription: toText(currentRaw.seoDescription),
  }

  // Honest failure handling: without a key we can't do anything real, so tell
  // the UI the feature is unavailable rather than faking an answer.
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ changes: {}, note: "", unavailable: true })
  }

  const fieldsBlock = EDITABLE_FIELDS.map(
    (f) => `- ${f} (${FIELD_GUIDANCE[f]})\n  current: ${JSON.stringify(current[f] || "")}`,
  ).join("\n")

  const prompt = `You are a senior conversion copywriter editing a Dubai freehold real-estate landing page.
You may ONLY change these editable fields — never invent other fields:
${fieldsBlock}

The user's instruction:
"""${instruction}"""

Apply the instruction with natural, high-converting marketing copy. Respect field length norms (headline short and punchy, seoTitle MAX 60 characters, seoDescription MAX 160 characters). Only include the fields you actually want to change — leave everything else out.
Return ONLY JSON, no markdown:
{"changes":{"<field>":"<newValue>"},"note":"<one short line describing what you changed>"}`

  let data
  try {
    data = await geminiGenerate(
      apiKey,
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.8, maxOutputTokens: 1024, responseMimeType: "application/json" },
    )
  } catch (error) {
    console.error("[landing-ai-edit] gemini error", error)
    return NextResponse.json({ error: "The AI request failed. Try again." }, { status: 502 })
  }

  const raw = geminiText(data).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  let parsed: { changes?: Record<string, unknown>; note?: unknown }
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error("[landing-ai-edit] parse error", error, raw.slice(0, 300))
    return NextResponse.json({ error: "The AI returned an unreadable response. Try again." }, { status: 502 })
  }

  // Keep ONLY known editable string fields, coerce to string, drop empties.
  const changes: Partial<Record<EditableField, string>> = {}
  const source = parsed.changes && typeof parsed.changes === "object" ? parsed.changes : {}
  for (const field of EDITABLE_FIELDS) {
    const next = toText((source as Record<string, unknown>)[field])
    if (next) changes[field] = next
  }

  return NextResponse.json({ changes, note: toText(parsed.note) })
}
