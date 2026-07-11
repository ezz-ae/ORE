import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession, SESSION_COOKIE } from "@/lib/freehold/auth-edge"
import { createLocalCampaign } from "@/lib/meta/local-store"
import type { LaunchCampaignPayload, MetaCampaignObjective, MetaCta } from "@/lib/meta/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Turn a roadshow PLAN into a real, saved Meta campaign DRAFT (status PAUSED),
// pre-filled from the event + the planner's answers. This is the "we feed Meta,
// we don't replace it" step: the draft lives in the app, ready to review and
// push to Ads Manager — never launched silently. Falls back soft (local store)
// when Meta credentials aren't connected, so the wizard always completes.

const GOAL_OBJECTIVE: Record<string, MetaCampaignObjective> = {
  registrations: "LEAD_GENERATION",
  viewings: "LEAD_GENERATION",
  sales: "CONVERSIONS",
  awareness: "BRAND_AWARENESS",
}

const GOAL_CTA: Record<string, MetaCta> = {
  registrations: "SIGN_UP",
  viewings: "BOOK_NOW",
  sales: "CONTACT_US",
  awareness: "LEARN_MORE",
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function POST(req: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event = (body.event && typeof body.event === "object" ? body.event : {}) as Record<string, unknown>
  const answers = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>
  const plan = (body.plan && typeof body.plan === "object" ? body.plan : {}) as Record<string, unknown>

  const eventTitle = str(event.title) || "Roadshow"
  const goal = str(answers.goal) || "registrations"
  const objective = GOAL_OBJECTIVE[goal] ?? "LEAD_GENERATION"
  const cta = GOAL_CTA[goal] ?? "SIGN_UP"

  // Budget: total AED across the run-up split into a daily figure.
  const totalBudget = Number(str(answers.budget)) || 0
  const days = Math.max(1, Number(str(answers.durationDays)) || 10)
  const dailyBudgetAED = totalBudget > 0 ? Math.max(1, Math.round(totalBudget / days)) : 0

  const keyMessage = str(plan.keyMessage) || str(answers.keyMessage)
  const objectiveLine = str(plan.objective)
  const offer = str(answers.offer)

  const primaryText = [keyMessage, offer && `Offer: ${offer}`, objectiveLine]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 600)

  const payload: LaunchCampaignPayload = {
    campaignName: `${eventTitle} — Roadshow`,
    objective,
    listingId: "roadshow",
    listingName: eventTitle,
    dailyBudgetAED,
    targeting: {
      countries: ["AE"],
      cityKeys: [],
      ageMin: 25,
      ageMax: 60,
      publisherPlatforms: ["facebook", "instagram"],
      interests: [],
    },
    creative: {
      primaryText: primaryText || `Join us at ${eventTitle}.`,
      headline: (keyMessage || eventTitle).slice(0, 60),
      description: (str(plan.where) || "Reserve your place").slice(0, 90),
      landingUrl: "",
      cta,
    },
    // Always a DRAFT — never auto-launch. The team reviews, then pushes to Meta.
    launchStatus: "PAUSED",
  }

  try {
    const { campaignId, status } = await createLocalCampaign(payload, user.email)
    return NextResponse.json({
      ok: true,
      campaignId,
      status,
      link: `/freehold-intelligence/ads-live/meta/${campaignId}`,
    })
  } catch (e) {
    console.error("[roadshow-launch] failed", e)
    return NextResponse.json({ error: "Could not create the campaign draft." }, { status: 502 })
  }
}
