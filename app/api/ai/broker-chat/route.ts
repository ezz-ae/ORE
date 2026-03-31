import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import {
  DEFAULT_GEMINI_MODELS,
  BROKER_SYSTEM_PROMPT,
  buildConversationHistory,
  getGeminiModel,
  getGeminiModelByName,
  listGeminiModels,
} from "@/lib/gemini"
import {
  getDashboardProjectBySlug,
  getRecentLeads,
  getTopROIProjects,
  resolveAccessRole,
  searchCrmLeads,
  searchProjects,
  upsertDashboardProject,
} from "@/lib/ore"
import { getSessionUser, logActivity } from "@/lib/auth"
import { appendConversationMessage, upsertConversationMessage } from "@/lib/ai-conversations"
import type { AiMessageRecord } from "@/lib/ai-conversations"

type BrokerIntent =
  | "list_leads"
  | "list_projects"
  | "create_project"
  | "update_project"
  | "create_offer"
  | "prioritize_leads"
  | "whatsapp_draft"
  | "general"

type BrokerAction = {
  intent: BrokerIntent
  query?: string
  projectSlug?: string
  projectName?: string
  leadQuery?: string
  fields?: {
    slug?: string
    name?: string
    area?: string
    developer?: string
    status?: string
    priceFrom?: number | null
    priceTo?: number | null
    roi?: number | null
    paymentPlan?: string
    handoverDate?: string
    description?: string
    highlights?: string[]
    amenities?: string[]
    heroImage?: string
  }
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const getProjectArea = (project: any) =>
  typeof project?.location?.area === "string" && project.location.area.trim()
    ? project.location.area
    : typeof project?.area === "string" && project.area.trim()
      ? project.area
      : "Dubai"

const getProjectPriceFrom = (project: any) =>
  toFiniteNumber(project?.units?.[0]?.priceFrom) ?? toFiniteNumber(project?.priceFrom)

const getProjectRoi = (project: any) =>
  toFiniteNumber(project?.investmentHighlights?.expectedROI) ?? toFiniteNumber(project?.roi)

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

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/^gc-/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const extractField = (message: string, field: string) => {
  const patterns = [
    new RegExp(`${field}\\s*[:=]\\s*([^,\\n]+)`, "i"),
    new RegExp(`${field}\\s+is\\s+([^,\\n]+)`, "i"),
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ""
}

const extractNumberField = (message: string, field: string) => {
  const raw = extractField(message, field)
  if (!raw) return null
  const parsed = Number(raw.replace(/[^0-9.]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

const heuristicAction = (message: string): BrokerAction => {
  const lower = message.toLowerCase()
  const isCreateProject =
    lower.includes("create listing") ||
    lower.includes("add listing") ||
    lower.includes("create project") ||
    lower.includes("add project")
  const isUpdateProject =
    lower.includes("update listing") ||
    lower.includes("edit listing") ||
    lower.includes("update project") ||
    lower.includes("edit project")
  const isPrioritize =
    lower.includes("prioritize") ||
    lower.includes("prioritise") ||
    lower.includes("hot leads") ||
    lower.includes("follow up today") ||
    lower.includes("who should i call") ||
    lower.includes("best leads")
  const isWhatsApp =
    lower.includes("whatsapp") ||
    lower.includes("whats app") ||
    lower.includes("wa message") ||
    lower.includes("draft message") ||
    lower.includes("draft follow")
  const isOffer = lower.includes("offer") || lower.includes("proposal")
  const isLeadList = lower.includes("lead")
  const isProjectList =
    lower.includes("project") ||
    lower.includes("property") ||
    lower.includes("inventory") ||
    lower.includes("roi")

  const name = extractField(message, "name") || extractField(message, "project")
  const explicitSlug = extractField(message, "slug")
  const slug = explicitSlug ? `gc-${toSlug(explicitSlug)}` : name ? `gc-${toSlug(name)}` : undefined

  if (isPrioritize) {
    return { intent: "prioritize_leads", query: message }
  }

  if (isWhatsApp) {
    return {
      intent: "whatsapp_draft",
      query: message,
      leadQuery: extractField(message, "lead") || extractField(message, "client") || extractField(message, "name"),
      projectSlug: slug,
      projectName: name,
    }
  }

  if (isCreateProject || isUpdateProject) {
    return {
      intent: isCreateProject ? "create_project" : "update_project",
      projectSlug: slug,
      projectName: name,
      fields: {
        slug,
        name,
        area: extractField(message, "area"),
        developer: extractField(message, "developer"),
        status: extractField(message, "status"),
        priceFrom: extractNumberField(message, "priceFrom") ?? extractNumberField(message, "price"),
        priceTo: extractNumberField(message, "priceTo"),
        roi: extractNumberField(message, "roi"),
        paymentPlan: extractField(message, "payment plan"),
        handoverDate: extractField(message, "handover"),
        description: extractField(message, "description"),
      },
    }
  }

  if (isOffer) {
    return {
      intent: "create_offer",
      query: message,
      projectSlug: slug,
      projectName: name,
      leadQuery: extractField(message, "lead") || extractField(message, "client"),
    }
  }

  if (isLeadList) {
    return {
      intent: "list_leads",
      query: message,
      leadQuery: extractField(message, "lead") || extractField(message, "client"),
    }
  }

  if (isProjectList) {
    return {
      intent: "list_projects",
      query: message,
      projectSlug: slug,
      projectName: name,
    }
  }

  return { intent: "general", query: message }
}

const classifyWithGemini = async (message: string, history: Array<{ role: string; content: string }>) => {
  const prompt = `Classify the broker request and return ONLY JSON.
Schema:
{
  "intent": "list_leads" | "list_projects" | "create_project" | "update_project" | "create_offer" | "prioritize_leads" | "whatsapp_draft" | "general",
  "query": string | null,
  "projectSlug": string | null,
  "projectName": string | null,
  "leadQuery": string | null,
  "fields": {
    "slug": string | null,
    "name": string | null,
    "area": string | null,
    "developer": string | null,
    "status": string | null,
    "priceFrom": number | null,
    "priceTo": number | null,
    "roi": number | null,
    "paymentPlan": string | null,
    "handoverDate": string | null,
    "description": string | null,
    "highlights": string[] | null,
    "amenities": string[] | null,
    "heroImage": string | null
  }
}

Only choose create/update intents if the user clearly wants the CRM changed.
If the project slug is missing but the project name is clear, generate a slug starting with "gc-".
Conversation:
${history.slice(-6).map((entry) => `${entry.role}: ${entry.content}`).join("\n")}
user: ${message}`

  const model = getGeminiModel("broker")
  const modelCandidates = [
    process.env.GEMINI_MODEL,
    ...(process.env.GEMINI_MODEL_FALLBACKS?.split(",").map((item) => item.trim()).filter(Boolean) || []),
    ...DEFAULT_GEMINI_MODELS,
  ].filter(Boolean) as string[]

  for (const candidate of modelCandidates) {
    try {
      const modelInstance =
        candidate === (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODELS[0])
          ? model
          : getGeminiModelByName(candidate)
      const result = await modelInstance.generateContent(prompt)
      const text = result.response.text()
      const parsed = extractJson(text)
      if (parsed?.intent) {
        return parsed as BrokerAction
      }
    } catch (error: any) {
      const messageText = String(error?.message || "")
      if (!messageText.includes("not found") && !messageText.includes("not supported")) {
        throw error
      }
    }
  }

  const discoveredModels = await listGeminiModels()
  for (const candidate of discoveredModels) {
    try {
      const result = await getGeminiModelByName(candidate).generateContent(prompt)
      const text = result.response.text()
      const parsed = extractJson(text)
      if (parsed?.intent) {
        return parsed as BrokerAction
      }
    } catch (error: any) {
      const messageText = String(error?.message || "")
      if (!messageText.includes("not found") && !messageText.includes("not supported")) {
        throw error
      }
    }
  }

  return null
}

const generateOfferMarkdown = (input: {
  lead?: { name?: string | null; budget_aed?: number | null; interest?: string | null }
  project?: { name: string; area?: string | null; price?: number | null; roi?: number | null }
}) => {
  const budgetText =
    input.lead?.budget_aed && input.lead.budget_aed > 0
      ? `Budget reference: AED ${Number(input.lead.budget_aed).toLocaleString("en-AE")}`
      : "Budget reference: to be confirmed"
  const projectName = input.project?.name || "Recommended Dubai project"
  const areaText = input.project?.area || "Dubai"
  const priceText =
    input.project?.price && input.project.price > 0
      ? `Starting from AED ${input.project.price.toLocaleString("en-AE")}`
      : "Price on request"
  const roiText =
    typeof input.project?.roi === "number" && Number.isFinite(input.project.roi)
      ? `${input.project.roi}% expected ROI`
      : "ROI to be confirmed"

  return [
    `ORE Branded Offer`,
    ``,
    `Client: ${input.lead?.name || "Prospective buyer"}`,
    budgetText,
    ``,
    `Recommended Project: ${projectName}`,
    `Location: ${areaText}`,
    `Commercial Positioning: ${priceText} · ${roiText}`,
    ``,
    `Why this fits`,
    `- Strong alignment with stated Dubai investment brief`,
    `- Suitable for immediate follow-up with brochure, availability, and payment plan`,
    `- Ready for broker outreach and branded presentation packaging`,
  ].join("\n")
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const { message, conversationHistory, conversationId } = await req.json()
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const history = Array.isArray(conversationHistory) ? conversationHistory : []
    const lowerMessage = message.toLowerCase()
    const accessRole = resolveAccessRole(sessionUser.role)
    const brokerId = accessRole === "broker" ? sessionUser.id : undefined
    const hasGeminiKey =
      Boolean(process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY || process.env.google_api_key)

    let action = heuristicAction(message)
    if (hasGeminiKey) {
      try {
        const aiAction = await classifyWithGemini(message, history)
        if (aiAction?.intent) {
          action = {
            ...action,
            ...aiAction,
            fields: {
              ...action.fields,
              ...aiAction.fields,
            },
          }
        }
      } catch (error) {
        console.error("[broker-ai] classify error", error)
      }
    }

    let aiReply = ""
    let attachedData: any = null

    if (action.intent === "prioritize_leads") {
      const leads = await getRecentLeads(20, accessRole, brokerId)
      const scored = leads
        .map((lead) => {
          let score = 0
          if (lead.email) score += 2
          if (lead.phone) score += 2
          if (lead.project_slug) score += 3
          if (lead.source) score += 1
          if (lead.budget_aed && lead.budget_aed > 2_000_000) score += 3
          const age = Date.now() - new Date(lead.created_at).getTime()
          if (age < 86_400_000) score += 4       // < 1 day
          else if (age < 3 * 86_400_000) score += 2  // < 3 days
          const reasons: string[] = []
          if (age < 86_400_000) reasons.push("new today")
          if (lead.budget_aed && lead.budget_aed > 2_000_000) reasons.push("high budget")
          if (lead.project_slug) reasons.push("project interest")
          if (!lead.email) reasons.push("missing email")
          return { ...lead, score, reasons }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)

      attachedData = { type: "leads", data: scored }
      const top3 = scored.slice(0, 3)
      aiReply = scored.length
        ? `Here are your top ${scored.length} prioritized leads:\n\n${top3
            .map(
              (l, i) =>
                `${i + 1}. **${l.name}** (score ${l.score}) — ${l.phone}${l.reasons.length ? ` · ${l.reasons.join(", ")}` : ""}`,
            )
            .join("\n")}\n\nFocus on calling these first — they show the strongest buying signals.`
        : "No leads found in your pipeline."
    } else if (action.intent === "whatsapp_draft") {
      const leadTerm = action.leadQuery || ""
      const candidateLead = leadTerm
        ? (await searchCrmLeads(leadTerm, accessRole, brokerId, 1))[0]
        : (await getRecentLeads(1, accessRole, brokerId))[0]
      const candidateProject =
        action.projectSlug
          ? await getDashboardProjectBySlug(action.projectSlug)
          : action.projectName
            ? (await searchProjects(action.projectName, 1))[0]
            : null

      const clientName = candidateLead?.name || "there"
      const projectName = candidateProject?.name || (action.projectName ? action.projectName : "this exclusive Dubai project")
      const candidatePriceFrom = getProjectPriceFrom(candidateProject)
      const candidateRoi = getProjectRoi(candidateProject)
      const priceText =
        candidatePriceFrom != null
          ? `starting from AED ${candidatePriceFrom.toLocaleString("en-AE")}`
          : "with competitive pricing"
      const roiText =
        candidateRoi != null
          ? ` with ${candidateRoi}% expected ROI`
          : ""

      const waMessage = [
        `Hi ${clientName}! 👋`,
        ``,
        `I wanted to follow up on your inquiry about *${projectName}* ${priceText}${roiText}.`,
        ``,
        `We have limited availability right now and I'd love to share the latest floor plans and payment plan details with you.`,
        ``,
        `Would you be available for a quick call this week? I can answer any questions and walk you through the investment potential. 🏙️`,
        ``,
        `Best regards,`,
        `ORE Brokerage`,
      ].join("\n")

      attachedData = {
        type: "offer",
        data: {
          title: `WhatsApp follow-up for ${candidateLead?.name || "lead"}`,
          content: waMessage,
        },
      }
      aiReply = `Here's a ready-to-send WhatsApp message${candidateLead ? ` for ${candidateLead.name}` : ""}. Copy it from the panel and paste it into WhatsApp.`
    } else if (action.intent === "list_leads") {
      const term = action.leadQuery || action.query || ""
      const leads = term ? await searchCrmLeads(term, accessRole, brokerId, 10) : await getRecentLeads(10, accessRole, brokerId)
      attachedData = { type: "leads", data: leads }
      aiReply = leads.length
        ? `I found ${leads.length} matching leads. Prioritize ${leads[0].name} first based on recency and CRM completeness.`
        : "No leads matched that request."
    } else if (action.intent === "list_projects") {
      const projects = await searchProjects(action.query || message, 5)
      attachedData = {
        type: "projects",
        data: projects.map((project) => ({
          id: project.id,
          title: project.name,
          area: getProjectArea(project),
          priceFrom: getProjectPriceFrom(project) ?? 0,
          roi: getProjectRoi(project),
        })),
      }
      aiReply = projects.length
        ? `I shortlisted ${projects.length} inventory matches. The strongest fit is ${projects[0].name} in ${getProjectArea(projects[0])}.`
        : "I could not find matching inventory for that request."
    } else if (action.intent === "create_project" || action.intent === "update_project") {
      const fields = action.fields || {}
      const slug = fields.slug || action.projectSlug || (fields.name ? `gc-${toSlug(fields.name)}` : "")
      const name = fields.name || action.projectName || ""

      if (!slug || !name) {
        aiReply =
          "I can create or update the listing, but I need at least the project name. Best format: name, area, developer, priceFrom, roi, status."
      } else {
        const savedProject = await upsertDashboardProject({
          slug,
          name,
          area: fields.area,
          developer: fields.developer,
          status: fields.status || "selling",
          priceFrom: fields.priceFrom ?? null,
          priceTo: fields.priceTo ?? null,
          roi: fields.roi ?? null,
          paymentPlan: fields.paymentPlan,
          handoverDate: fields.handoverDate,
          description: fields.description,
          highlights: fields.highlights || [],
          amenities: fields.amenities || [],
          heroImage: fields.heroImage,
        })
        attachedData = {
          type: "project-action",
          data: {
            slug: savedProject.slug,
            name: savedProject.name,
            area: savedProject.area,
            status: savedProject.status,
            priceFrom: savedProject.price_from_aed,
            priceTo: savedProject.price_to_aed,
          },
        }
        aiReply = `${action.intent === "create_project" ? "Created" : "Updated"} listing ${savedProject.name} (${savedProject.slug}) in CRM.`
      }
    } else if (action.intent === "create_offer") {
      const candidateLead = action.leadQuery
        ? (await searchCrmLeads(action.leadQuery, accessRole, brokerId, 1))[0]
        : undefined
      const candidateProject =
        (action.projectSlug ? await getDashboardProjectBySlug(action.projectSlug) : null) ||
        (await searchProjects(action.projectName || action.query || message, 1)).map((project) => ({
          slug: project.slug,
          name: project.name,
          area: getProjectArea(project),
          priceFrom: getProjectPriceFrom(project),
          roi: getProjectRoi(project),
        }))[0]

      const offer = generateOfferMarkdown({
        lead: candidateLead,
        project: candidateProject
          ? {
              name: candidateProject.name,
              area: getProjectArea(candidateProject),
              price: getProjectPriceFrom(candidateProject),
              roi: getProjectRoi(candidateProject),
            }
          : undefined,
      })
      attachedData = {
        type: "offer",
        data: {
          title: candidateProject ? `${candidateProject.name} branded offer` : "Branded offer draft",
          content: offer,
        },
      }
      aiReply = `I prepared a branded offer draft${candidateProject ? ` for ${candidateProject.name}` : ""}. You can copy it from the panel and send it to the client.`
    } else {
      let context = ""

      if (lowerMessage.includes("lead") || lowerMessage.includes("follow up")) {
        const leads = await getRecentLeads(5, accessRole, brokerId)
        if (leads.length) {
          context += `\n\nRECENT LEADS:\n${leads
            .map((lead) => `- ${lead.name} | ${lead.phone} | ${lead.email || "No email"} | ${lead.source || "Unknown source"}`)
            .join("\n")}`
        }
      }

      if (lowerMessage.includes("project") || lowerMessage.includes("propert") || lowerMessage.includes("roi")) {
        const topProjects = await getTopROIProjects(3)
        context += `\n\nTOP ROI PROJECTS:\n${topProjects
          .map((project) => {
            const roi = getProjectRoi(project)
            return `- ${project.name} | ${getProjectArea(project)} | ROI ${roi != null ? `${roi}%` : "n/a"}`
          })
          .join("\n")}`
      }

      if (!hasGeminiKey) {
        aiReply =
          "AI is temporarily unavailable. I can still list leads, shortlist projects, create listings, update listings, and draft branded offers if you phrase the request directly."
      } else {
        try {
          const model = getGeminiModel("broker")
          const createChat = (modelInstance: ReturnType<typeof getGeminiModel>) =>
            modelInstance.startChat({
              history: [
                {
                  role: "user",
                  parts: [{ text: `${BROKER_SYSTEM_PROMPT}\nYou can also tell brokers when you created a project, updated a listing, or drafted an offer.` }],
                },
                {
                  role: "model",
                  parts: [{ text: "Ready to assist with CRM operations, lead intelligence, listings, and branded sales materials." }],
                },
                ...buildConversationHistory(history),
              ],
            })

          const modelCandidates = [
            process.env.GEMINI_MODEL,
            ...(process.env.GEMINI_MODEL_FALLBACKS?.split(",").map((item) => item.trim()).filter(Boolean) || []),
            ...DEFAULT_GEMINI_MODELS,
          ].filter(Boolean) as string[]

          let lastError: unknown = null
          for (const candidate of modelCandidates) {
            try {
              const modelInstance =
                candidate === (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODELS[0])
                  ? model
                  : getGeminiModelByName(candidate)
              const chat = createChat(modelInstance)
              const result = await chat.sendMessage(`${message}${context}`)
              aiReply = result.response.text()
              lastError = null
              break
            } catch (error: any) {
              lastError = error
              const messageText = String(error?.message || "")
              if (!messageText.includes("not found") && !messageText.includes("not supported")) {
                console.error("[broker-ai] chat model error", error)
                break
              }
            }
          }

          if (!aiReply) {
            const discoveredModels = await listGeminiModels()
            for (const candidate of discoveredModels) {
              try {
                const chat = createChat(getGeminiModelByName(candidate))
                const result = await chat.sendMessage(`${message}${context}`)
                aiReply = result.response.text()
                break
              } catch (error: any) {
                const messageText = String(error?.message || "")
                if (!messageText.includes("not found") && !messageText.includes("not supported")) {
                  console.error("[broker-ai] discovered model error", error)
                  break
                }
              }
            }
          }

          if (!aiReply && lastError) {
            console.error("[broker-ai] final chat error", lastError)
          }
        } catch (error) {
          console.error("[broker-ai] general chat failure", error)
        }

        if (!aiReply) {
          aiReply =
            "I could not reach the full AI reasoning model right now, but I can still help with direct CRM tasks. Try asking me to list leads, shortlist projects, create or update a listing, or draft a branded offer."
        }
      }
    }

    let conversation = null
    const now = new Date().toISOString()
    const userMessageRecord: AiMessageRecord = { role: "user", content: message, timestamp: now }
    const assistantMessageRecord: AiMessageRecord = { role: "assistant", content: aiReply, timestamp: now }

    if (conversationId) {
      conversation = await appendConversationMessage(conversationId, userMessageRecord)
    }
    if (!conversation) {
      conversation = await upsertConversationMessage(sessionUser.id, userMessageRecord)
    }
    if (conversation) {
      conversation = await appendConversationMessage(conversation.id, assistantMessageRecord)
    }

    await logActivity("ai_broker_chat", sessionUser.id, {
      conversationId: conversation?.id,
      intent: action.intent,
    })

    return NextResponse.json({
      reply: aiReply,
      data: attachedData,
      conversationId: conversation?.id || null,
    })
  } catch (error) {
    console.error("[broker-ai] error", error)
    return NextResponse.json(
      { error: "Failed to process message. Please try again." },
      { status: 500 },
    )
  }
}
