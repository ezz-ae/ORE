import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_GEMINI_MODELS, getGeminiModel, getGeminiModelByName, listGeminiModels } from "@/lib/gemini"
import { getLeadById, getProjectBySlug } from "@/lib/entrestate"
import { getSessionUser, isAdminRole } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const fallbackDrafts = (input: {
  leadName: string
  projectName?: string | null
  area?: string | null
  roi?: number | null
}) => {
  const projectLine = input.projectName
    ? `${input.projectName}${input.area ? ` in ${input.area}` : ""}`
    : "a suitable Dubai project"
  const roiLine =
    typeof input.roi === "number" && Number.isFinite(input.roi)
      ? ` Expected ROI is around ${input.roi.toFixed(1)}%.`
      : ""

  return {
    whatsapp: `Hi ${input.leadName}, this is ORE. I’m following up on your inquiry. I have details for ${projectLine}.${roiLine} If you want, I can send the brochure, payment plan, and current availability.`,
    emailSubject: `Your ORE project update`,
    emailBody: `Hi ${input.leadName},

Thank you for your interest in ORE.

I wanted to follow up with details on ${projectLine}.${roiLine}

If useful, I can send you the brochure, payment plan, and current availability, or shortlist a few similar options based on your budget and investment goal.

Best regards,
ORE`,
    nextSteps: [
      "Send brochure and payment plan",
      "Confirm buyer budget and timeline",
      "Offer a shortlist of 2-3 comparable projects",
    ],
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const body = await req.json()
    const leadId = String(body?.leadId || "").trim()
    if (!leadId) {
      return NextResponse.json({ error: "Lead ID is required." }, { status: 400 })
    }

    const lead = await getLeadById(leadId)
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 })
    }

    if (!isAdminRole(user.role) && lead.assigned_broker_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const project = lead.project_slug ? await getProjectBySlug(lead.project_slug) : null
    const fallback = fallbackDrafts({
      leadName: lead.name || "there",
      projectName: project?.name || null,
      area: project?.location.area || null,
      roi: project?.investmentHighlights.expectedROI ?? null,
    })

    const hasGeminiKey =
      Boolean(process.env.GEMINI_API_KEY || process.env.Gemini_APIKey || process.env.google_api_key || process.env.Gemini_API_KEY)

    if (!hasGeminiKey) {
      return NextResponse.json(fallback)
    }

    const prompt = `Return ONLY valid JSON.
Schema:
{
  "whatsapp": string,
  "emailSubject": string,
  "emailBody": string,
  "nextSteps": string[]
}

Write concise, professional broker follow-up drafts for this CRM lead.
Lead:
- Name: ${lead.name}
- Email: ${lead.email || "missing"}
- Phone: ${lead.phone}
- Status: ${lead.status || "new"}
- Interest: ${lead.interest || "unknown"}
- Source: ${lead.source || "website"}
- Project: ${project?.name || lead.project_slug || "not specified"}
- Area: ${project?.location.area || "Dubai"}
- ROI: ${project?.investmentHighlights.expectedROI ?? "unknown"}

Rules:
- WhatsApp should sound natural and broker-ready.
- Email should be short and polished.
- nextSteps should be 3 short actionable bullets.
- Do not invent unavailable facts beyond the input.`

    const model = getGeminiModel("broker")
    const modelCandidates = [
      process.env.GEMINI_MODEL,
      ...(process.env.GEMINI_MODEL_FALLBACKS?.split(",").map((m) => m.trim()).filter(Boolean) || []),
      ...DEFAULT_GEMINI_MODELS,
    ].filter(Boolean) as string[]

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

    for (const candidate of modelCandidates) {
      try {
        const candidateModel =
          candidate === (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODELS[0])
            ? model
            : getGeminiModelByName(candidate)
        const result = await candidateModel.generateContent(prompt)
        const parsed = extractJson(result.response.text())
        if (parsed?.whatsapp && parsed?.emailSubject && parsed?.emailBody) {
          return NextResponse.json(parsed)
        }
      } catch (error: any) {
        const errorMessage = String(error?.message || "")
        if (!errorMessage.includes("not found") && !errorMessage.includes("not supported")) {
          throw error
        }
      }
    }

    const discoveredModels = await listGeminiModels()
    for (const candidate of discoveredModels) {
      try {
        const result = await getGeminiModelByName(candidate).generateContent(prompt)
        const parsed = extractJson(result.response.text())
        if (parsed?.whatsapp && parsed?.emailSubject && parsed?.emailBody) {
          return NextResponse.json(parsed)
        }
      } catch (error: any) {
        const errorMessage = String(error?.message || "")
        if (!errorMessage.includes("not found") && !errorMessage.includes("not supported")) {
          throw error
        }
      }
    }

    return NextResponse.json(fallback)
  } catch (error) {
    console.error("[lead-ai-message] error", error)
    return NextResponse.json({ error: "Failed to generate AI message." }, { status: 500 })
  }
}
