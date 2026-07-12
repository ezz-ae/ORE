import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, isAdminRole } from "@/lib/auth"
import { geminiGenerate, geminiText } from "@/lib/gemini-rest"
import { googleAiKey } from "@/lib/creative-studio/providers"
import { userSafeAiError } from "@/lib/freehold/ai-errors"

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

  // The page's current section types (in order) — lets the AI also rearrange or
  // show/hide sections on the canvas. Only these known types are ever acted on.
  const sectionTypesRaw = (body as { sections?: unknown })?.sections
  const sectionTypes = Array.isArray(sectionTypesRaw)
    ? sectionTypesRaw.map((s) => toText(s)).filter(Boolean)
    : []
  const knownTypes = new Set(sectionTypes)

  // Honest failure handling: without a key we can't do anything real, so tell
  // the UI the feature is unavailable rather than faking an answer.
  const apiKey = googleAiKey()
  if (!apiKey) {
    return NextResponse.json({ changes: {}, note: "", unavailable: true })
  }

  const fieldsBlock = EDITABLE_FIELDS.map(
    (f) => `- ${f} (${FIELD_GUIDANCE[f]})\n  current: ${JSON.stringify(current[f] || "")}`,
  ).join("\n")

  const layoutBlock = sectionTypes.length
    ? `\n\nThe page currently has these sections, in order:\n${sectionTypes.map((t, i) => `${i + 1}. ${t}`).join("\n")}\nIf the instruction asks to reorder, add, or hide sections, you MAY return a "layout" object using ONLY these exact section-type strings:\n- "order": the full desired order of section types (include every current type, moved as needed)\n- "hide": section types to hide\n- "show": section types to show\nOmit "layout" entirely if the instruction is only about copy.`
    : ""

  const prompt = `You are a senior conversion copywriter editing a Dubai freehold real-estate landing page.
You may ONLY change these editable fields — never invent other fields:
${fieldsBlock}${layoutBlock}

The user's instruction:
"""${instruction}"""

Apply the instruction with natural, high-converting marketing copy. Respect field length norms (headline short and punchy, seoTitle MAX 60 characters, seoDescription MAX 160 characters). Only include the fields you actually want to change — leave everything else out.
Return ONLY JSON, no markdown:
{"changes":{"<field>":"<newValue>"},"note":"<one short line describing what you changed>","layout":{"order":["<type>"],"hide":["<type>"],"show":["<type>"]}}`

  let data
  try {
    data = await geminiGenerate(
      apiKey,
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.8, maxOutputTokens: 2048, responseMimeType: "application/json" },
    )
  } catch (error) {
    // Raw provider detail (quota / key) goes to the log; the editor shows a
    // plain sentence a marketer can act on.
    return NextResponse.json(
      { error: userSafeAiError(error, "The AI edit didn’t go through — try again in a moment.") },
      { status: 502 },
    )
  }

  const raw = geminiText(data).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  let parsed: { changes?: Record<string, unknown>; note?: unknown; layout?: Record<string, unknown> }
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

  // Layout ops — validated against the real section types only. Anything the
  // model invents (unknown types) is dropped, so it can't break the page.
  const layoutSrc = parsed.layout && typeof parsed.layout === "object" ? parsed.layout : {}
  const filterTypes = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => toText(x)).filter((x) => knownTypes.has(x)) : []
  const order = filterTypes((layoutSrc as Record<string, unknown>).order)
  const hide = filterTypes((layoutSrc as Record<string, unknown>).hide)
  const show = filterTypes((layoutSrc as Record<string, unknown>).show)
  const layout = order.length || hide.length || show.length ? { order, hide, show } : undefined

  return NextResponse.json({ changes, note: toText(parsed.note), ...(layout ? { layout } : {}) })
}
