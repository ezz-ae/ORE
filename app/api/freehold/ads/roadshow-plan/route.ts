import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { geminiGenerate, geminiText } from "@/lib/gemini-rest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Build a strategic roadshow/event campaign PLAN (not a raw ad) from a calendar
// event + the planner's answers. The plan is what feeds Meta Ads Manager.
export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Planning needs GEMINI_API_KEY." }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const event = (body.event && typeof body.event === "object" ? body.event : {}) as Record<string, unknown>
  const a = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>

  const facts = [
    event.title ? `Event: ${event.title}` : "",
    event.startsAt ? `Date: ${event.startsAt}` : "",
    event.location ? `Venue: ${event.location}` : "",
    event.externalParty ? `Developer/partner: ${event.externalParty}` : "",
    event.description ? `Details: ${event.description}` : "",
    a.audience ? `Target audience: ${a.audience}` : "",
    a.goal ? `Primary goal: ${a.goal}` : "",
    a.budget ? `Total budget (AED): ${a.budget}` : "",
    a.offer ? `Offer / incentive: ${a.offer}` : "",
    a.keyMessage ? `Key message: ${a.keyMessage}` : "",
    a.durationDays ? `Campaign run-up (days before event): ${a.durationDays}` : "",
  ].filter(Boolean).join("\n")

  const system =
    "You are a senior Dubai real-estate marketing strategist. Build a STRATEGIC ROADSHOW/EVENT CAMPAIGN PLAN " +
    "(a plan, not a single ad). Answer the classic where/when/how-long/why/how. Return ONLY valid JSON, no markdown fences, " +
    "matching exactly this shape:\n" +
    `{
  "objective": "why we run this — one sentence",
  "audience": "who we target",
  "keyMessage": "the single core message",
  "where": "channels/placements to use (e.g. Meta feed+stories, WhatsApp, landing page)",
  "timeline": [ { "phase": "Tease", "when": "e.g. 10–7 days before", "action": "what happens" } ],
  "budget": "how to split the total budget across phases/channels",
  "steps": [ "concrete step the team takes, in order" ],
  "assets": [ { "type": "landing", "label": "Event landing page", "note": "what it should contain" }, { "type": "fb_event", "label": "Facebook event", "note": "..." }, { "type": "campaign", "label": "Meta campaign", "note": "objective + schedule to set in Ads Manager" } ]
}`

  try {
    const data = await geminiGenerate(
      apiKey,
      [{ role: "user", parts: [{ text: `${system}\n\nEVENT & ANSWERS:\n${facts || "A Dubai property roadshow."}` }] }],
      { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: "application/json" },
    )
    const raw = geminiText(data).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
    let plan: unknown
    try { plan = JSON.parse(raw) } catch { return NextResponse.json({ error: "Plan parse failed" }, { status: 502 }) }
    return NextResponse.json({ plan })
  } catch (e) {
    console.error("[roadshow-plan] failed", e)
    return NextResponse.json({ error: "Plan generation failed" }, { status: 502 })
  }
}
