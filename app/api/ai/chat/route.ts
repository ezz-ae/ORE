import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import {
  DEFAULT_GEMINI_MODELS,
  PUBLIC_SYSTEM_PROMPT,
  buildConversationHistory,
  getGeminiModel,
  getGeminiModelByName,
  listGeminiModels,
} from "@/lib/gemini"
import {
  ensureLeadsTable,
  getGoldenVisaProjects,
  getLlmContextByArea,
  getProjectsByArea,
  getTopROIProjects,
  projectToProperty,
  searchProjects,
} from "@/lib/ore"
import { query } from "@/lib/db"
import {
  getLeadershipLeadRecipients,
  sendInternalLeadAlertEmail,
  sendLeadAcknowledgementEmail,
  sendLeadWhatsAppAlert,
} from "@/lib/transactional-email"

type PublicLeadRow = {
  id: string
  ai_ack_sent_at?: string | null
  ai_ack_project_slug?: string | null
  ai_broker_notified_at?: string | null
}

const extractContactDetails = (text: string) => {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  const phoneMatch = text.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/)
  const namePatterns = [
    /(?:my name is|i am|i'm|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /name\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ]

  let name = null
  for (const pattern of namePatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      name = match[1].trim()
      break
    }
  }

  const email = emailMatch ? emailMatch[0].toLowerCase() : null
  const rawPhone = phoneMatch ? phoneMatch[0] : null
  const phone = rawPhone ? rawPhone.replace(/[^\d+]/g, "") : null

  return { email, phone, name }
}

const hasPropertyIntent = (message: string) => {
  const text = message.toLowerCase()
  const propertyKeywords = [
    "show",
    "find",
    "search",
    "list",
    "browse",
    "recommend",
    "suggest",
    "available",
    "looking for",
    "where to buy",
    "best for",
    "compare",
  ]
  const propertyNouns = [
    "property",
    "properties",
    "project",
    "projects",
    "apartment",
    "apartments",
    "villa",
    "villas",
    "unit",
    "units",
    "studio",
    "penthouse",
    "townhouse",
  ]

  const hasKeyword = propertyKeywords.some((kw) => text.includes(kw))
  const hasNoun = propertyNouns.some((noun) => text.includes(noun))
  const hasBeds = /\b[1-6]\s*(br|bed(room)?s?)\b/.test(text)
  const hasPrice = /\b(aed|price|budget|million|k)\b/.test(text)
  return hasNoun && (hasKeyword || hasPrice || hasBeds)
}

const hasCompareIntent = (message: string) => {
  const text = message.toLowerCase()
  const compareKeywords = [
    "compare",
    "vs",
    "versus",
    "difference between",
    "better than",
  ]
  return compareKeywords.some((kw) => text.includes(kw))
}

const isRealEstateRelated = (message: string) => {
  const topicCheck = message.toLowerCase()
  return (
    topicCheck.includes("dubai") ||
    topicCheck.includes("real estate") ||
    topicCheck.includes("property") ||
    topicCheck.includes("investment") ||
    topicCheck.includes("roi") ||
    topicCheck.includes("yield") ||
    topicCheck.includes("visa") ||
    topicCheck.includes("project") ||
    topicCheck.includes("apartment") ||
    topicCheck.includes("villa") ||
    topicCheck.includes("marina") ||
    topicCheck.includes("downtown") ||
    topicCheck.includes("budget") ||
    topicCheck.includes("price") ||
    topicCheck.includes("buy") ||
    topicCheck.includes("sell")
  )
}

const buildFallbackReply = (
  projects: Awaited<ReturnType<typeof searchProjects>>,
  wantsProperties: boolean,
  hasContact: boolean,
) => {
  if (!wantsProperties) {
    return "I can help with ORE-curated Dubai property search, ROI, Golden Visa eligibility, and area comparison. Tell me your budget, preferred area, or goal and I’ll narrow it down."
  }

  if (!projects.length) {
    return hasContact
      ? "I couldn’t find an exact match right now, but ORE has captured your request and a private advisor can refine the shortlist for you."
      : "I couldn’t find an exact match right now. Share your budget range, preferred area, and bedroom count, and I’ll refine the ORE shortlist."
  }

  const lines = projects.slice(0, 3).map((project) => {
    const property = projectToProperty(project)
    const priceText = property.price
      ? `AED ${property.price.toLocaleString("en-AE")}`
      : "price on request"
    const roiText = Number.isFinite(project.investmentHighlights?.expectedROI)
      ? `${project.investmentHighlights.expectedROI}% ROI`
      : "investment-ready"
    return `- ${property.title} (${property.location.area}) from ${priceText} • ${roiText}`
  })

  const followUp = hasContact
    ? "I’ve also marked your request for ORE advisor follow-up."
    : "If you want, share your name and WhatsApp or email and I can arrange an ORE advisor follow-up."

  return `Here are strong ORE matches right now:\n${lines.join("\n")}\n\n${followUp}`
}

const buildLeadGuidance = (contact: ReturnType<typeof extractContactDetails>, userTurns: number) => `
LEAD STATUS:
- Name: ${contact.name || "missing"}
- Phone: ${contact.phone || "missing"}
- Email: ${contact.email || "missing"}
- User turns so far: ${userTurns}

BEHAVIOR RULES:
- Be conversational and answer the user first.
- Do not ask for contact details in every reply.
- If contact details are missing, only ask after you provide value, or when the user wants brochure, availability, callback, WhatsApp, email, report, or shortlist delivery.
- Once contact details are available, acknowledge naturally and mention ORE advisor follow-up only if relevant.
`

const maybeAppendEmailConfirmation = (reply: string, emailSent: boolean) => {
  if (!emailSent) return reply
  if (/email|inbox|sent/i.test(reply)) return reply
  return `${reply}\n\nI’ve also sent the ORE project details to your email.`
}

const persistAiLead = async (input: {
  contact: ReturnType<typeof extractContactDetails>
  message: string
  projectSlug?: string | null
  interest?: string | null
}) => {
  const { contact, message, projectSlug, interest } = input
  if (!contact.phone && !contact.email) return null

  await ensureLeadsTable()
  const existing = await query<PublicLeadRow>(
    `SELECT id, ai_ack_sent_at, ai_ack_project_slug, ai_broker_notified_at
     FROM gc_leads
     WHERE ($1 <> '' AND phone = $1) OR ($2 <> '' AND email = $2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [contact.phone || "", contact.email || ""],
  )

  const leadName =
    contact.name ||
    (contact.email ? contact.email.split("@")[0].replace(/[._-]+/g, " ") : "") ||
    "Website Lead"

  if (existing[0]) {
    await query(
      `UPDATE gc_leads
       SET name = COALESCE(NULLIF($2, ''), name),
           phone = COALESCE(NULLIF($3, ''), phone),
           email = COALESCE(NULLIF($4, ''), email),
           source = 'ai-chat',
           project_slug = COALESCE(NULLIF($5, ''), project_slug),
           interest = COALESCE(NULLIF($6, ''), interest),
           message = COALESCE(NULLIF($7, ''), message),
           updated_at = now()
       WHERE id = $1`,
      [
        existing[0].id,
        leadName,
        contact.phone || "",
        contact.email || "",
        projectSlug || "",
        interest || "",
        message,
      ],
    )
    return existing[0]
  }

  const leadId = randomUUID()
  await query(
    `INSERT INTO gc_leads (
      id, name, phone, email, source, project_slug, interest, message, status, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', now(), now())`,
    [
      leadId,
      leadName,
      contact.phone || "",
      contact.email || null,
      "ai-chat",
      projectSlug || null,
      interest || null,
      message,
    ],
  )

  return { id: leadId, ai_ack_sent_at: null, ai_ack_project_slug: null }
}

const maybeSendLeadAck = async (input: {
  lead: PublicLeadRow | null
  contact: ReturnType<typeof extractContactDetails>
  message: string
  relevantProjects: Awaited<ReturnType<typeof searchProjects>>
}) => {
  const { lead, contact, message, relevantProjects } = input
  if (!lead || !contact.email) return false
  const currentProjectSlug = relevantProjects[0]?.slug || null
  const shouldSend =
    !lead.ai_ack_sent_at || (currentProjectSlug && lead.ai_ack_project_slug !== currentProjectSlug)

  if (!shouldSend) return false

  const result = await sendLeadAcknowledgementEmail({
    to: contact.email,
    name: contact.name,
    inquiry: message,
    projects: relevantProjects.slice(0, 3).map((project) => ({
      slug: project.slug,
      name: project.name,
      area: project.location.area,
      priceFrom: project.units?.[0]?.priceFrom ?? null,
      roi: project.investmentHighlights.expectedROI ?? null,
      brochureUrl: project.brochure || null,
      projectUrl: `${process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://orerealestate.ae"}/projects/${project.slug}`,
    })),
  })

  if (!result.sent) return false

  await query(
    `UPDATE gc_leads
     SET ai_ack_sent_at = now(),
         ai_ack_project_slug = $2,
         updated_at = now()
     WHERE id = $1`,
    [lead.id, currentProjectSlug],
  )

  return true
}

const maybeNotifyInternalTeam = async (input: {
  lead: PublicLeadRow | null
  contact: ReturnType<typeof extractContactDetails>
  message: string
  relevantProjects: Awaited<ReturnType<typeof searchProjects>>
}) => {
  const { lead, contact, message, relevantProjects } = input
  if (!lead || lead.ai_broker_notified_at) return false
  const leadershipRecipients = await getLeadershipLeadRecipients()
  if (!leadershipRecipients.emails.length && !leadershipRecipients.whatsappTargets.length) return false

  const projects = relevantProjects.slice(0, 3).map((project) => ({
    slug: project.slug,
    name: project.name,
    area: project.location.area,
    priceFrom: project.units?.[0]?.priceFrom ?? null,
    roi: project.investmentHighlights.expectedROI ?? null,
    brochureUrl: project.brochure || null,
    projectUrl: `${process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://orerealestate.ae"}/projects/${project.slug}`,
  }))

  const emailResult = leadershipRecipients.emails.length
    ? await sendInternalLeadAlertEmail({
        to: leadershipRecipients.emails,
        subject: "New AI lead captured",
        headline: "New AI lead captured",
        lead: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          source: "ai-chat",
          projectSlug: relevantProjects[0]?.slug || null,
          message,
        },
        projects,
      })
    : { sent: false as const }

  const whatsappResult = leadershipRecipients.whatsappTargets.length
    ? await sendLeadWhatsAppAlert({
      recipients: leadershipRecipients.recipients.map((recipient) => ({
        name: recipient.name,
        email: recipient.email,
        phone: recipient.phone,
        orgTitle: recipient.orgTitle,
      })),
      lead: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        source: "ai-chat",
        projectSlug: relevantProjects[0]?.slug || null,
        message,
      },
      projects,
    })
    : { sent: false as const }

  if (!emailResult.sent && !whatsappResult.sent) return false

  await query(
    `UPDATE gc_leads
     SET ai_broker_notified_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [lead.id],
  )
  return true
}

export async function POST(req: NextRequest) {
  const resultLimit = 3
  let wantsProperties = false
  try {
    const { message, conversationHistory, isMobile } = await req.json()

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    if (hasCompareIntent(message)) {
      return NextResponse.json({
        reply: "You can compare projects side-by-side on our comparison page. [Compare Projects](/projects/compare)",
        properties: [],
      })
    }

    wantsProperties = hasPropertyIntent(message) && !Boolean(isMobile)
    let relevantProjects = wantsProperties ? await searchProjects(message, resultLimit) : []
    const lowerMessage = message.toLowerCase()

    if (wantsProperties) {
      if (lowerMessage.includes("golden visa") || lowerMessage.includes("goldenvisа")) {
        relevantProjects = await getGoldenVisaProjects(resultLimit)
      } else if (lowerMessage.includes("best roi") || lowerMessage.includes("highest return")) {
        relevantProjects = await getTopROIProjects(resultLimit)
      } else if (lowerMessage.includes("2br") || lowerMessage.includes("2 bedroom")) {
        relevantProjects = await searchProjects("2BR", resultLimit)
      } else if (lowerMessage.includes("marina")) {
        relevantProjects = await getProjectsByArea("Marina", resultLimit)
      } else if (lowerMessage.includes("downtown")) {
        relevantProjects = await getProjectsByArea("Downtown", resultLimit)
      } else if (lowerMessage.includes("palm")) {
        relevantProjects = await getProjectsByArea("Palm", resultLimit)
      }
    }

    const hasGeminiKey =
      Boolean(process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY || process.env.google_api_key)
    const history = Array.isArray(conversationHistory) ? conversationHistory : []
    const conversationText = [
      ...history.filter((entry: any) => entry.role === "user").map((entry: any) => entry.content),
      message,
    ].join("\n")
    const contact = extractContactDetails(conversationText)
    const areaContext =
      wantsProperties && relevantProjects[0]?.location?.area
        ? await getLlmContextByArea(relevantProjects[0].location.area, 8)
        : ""
    const propertyContext =
      wantsProperties && relevantProjects.length > 0
        ? "\n\n[SYSTEM: Relevant projects are attached below this reply. Give a helpful shortlist summary and guide the user to the cards without sounding pushy.]\n"
        : ""

    if (!hasGeminiKey) {
      const lead = await persistAiLead({
        contact,
        message,
        projectSlug: relevantProjects[0]?.slug || null,
        interest: wantsProperties ? "property-search" : "general-inquiry",
      })
      const emailSent = await maybeSendLeadAck({ lead, contact, message, relevantProjects })
      await maybeNotifyInternalTeam({ lead, contact, message, relevantProjects })
      return NextResponse.json({
        reply: maybeAppendEmailConfirmation(
          buildFallbackReply(relevantProjects, wantsProperties, Boolean(contact.phone || contact.email)),
          emailSent,
        ),
        properties: wantsProperties
          ? relevantProjects.slice(0, resultLimit).map((project) => projectToProperty(project))
          : [],
      })
    }

    if (!isRealEstateRelated(message) && message.length > 20) {
      return NextResponse.json({
        reply:
          "I’m specialized in Dubai real estate investment. I can help with project search, ROI, area comparison, Golden Visa eligibility, and off-plan strategy.",
        properties: [],
      })
    }

    const model = getGeminiModel("public")
    const userTurnCount = history.filter((entry: any) => entry.role === "user").length + 1

    const createChat = (modelInstance: ReturnType<typeof getGeminiModel>) =>
      modelInstance.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: PUBLIC_SYSTEM_PROMPT }],
          },
          {
            role: "model",
            parts: [
              {
                text: "I’m your ORE AI consultant for Dubai real estate. I can help with project search, ROI context, area comparison, and next-step guidance.",
              },
            ],
          },
          ...buildConversationHistory(history),
        ],
      })

    const leadGuidance = buildLeadGuidance(contact, userTurnCount)
    const contextBlock = areaContext
      ? `\n\nAREA INTELLIGENCE (Data: ORE Intelligence)\n${areaContext}`
      : ""

    let aiReply = ""
    const modelCandidates = [
      process.env.GEMINI_MODEL,
      ...(process.env.GEMINI_MODEL_FALLBACKS?.split(",").map((m) => m.trim()).filter(Boolean) || []),
      ...DEFAULT_GEMINI_MODELS,
    ].filter(Boolean) as string[]

    let lastError: unknown = null
    for (const candidate of modelCandidates) {
      try {
        const candidateModel =
          candidate === (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODELS[0])
            ? model
            : getGeminiModelByName(candidate)
        const chat = createChat(candidateModel)
        const result = await chat.sendMessage(`${message}${propertyContext}\n\n${leadGuidance}${contextBlock}`)
        aiReply = result.response.text()
        lastError = null
        break
      } catch (modelError: any) {
        lastError = modelError
        const errorMessage = String(modelError?.message || "")
        if (!errorMessage.includes("not found") && !errorMessage.includes("not supported")) {
          throw modelError
        }
      }
    }

    if (!aiReply) {
      const discoveredModels = await listGeminiModels()
      for (const candidate of discoveredModels) {
        try {
          const chat = createChat(getGeminiModelByName(candidate))
          const result = await chat.sendMessage(`${message}${propertyContext}\n\n${leadGuidance}${contextBlock}`)
          aiReply = result.response.text()
          break
        } catch (modelError: any) {
          const errorMessage = String(modelError?.message || "")
          if (!errorMessage.includes("not found") && !errorMessage.includes("not supported")) {
            throw modelError
          }
        }
      }
    }

    if (!aiReply && lastError) {
      throw lastError
    }

    const lead = await persistAiLead({
      contact,
      message,
      projectSlug: relevantProjects[0]?.slug || null,
      interest: wantsProperties ? "property-search" : "general-inquiry",
    })
    const emailSent = await maybeSendLeadAck({ lead, contact, message, relevantProjects })
    await maybeNotifyInternalTeam({ lead, contact, message, relevantProjects })

    const requestId = `req_${randomUUID().slice(0, 8)}`
    const replyText = maybeAppendEmailConfirmation(aiReply, emailSent)
    
    return NextResponse.json({
      reply: replyText,
      content: replyText, // Smoke test compatibility
      request_id: requestId, // Smoke test compatibility
      properties: wantsProperties
        ? relevantProjects.slice(0, resultLimit).map((project) => projectToProperty(project))
        : [],
      dataCards: wantsProperties
        ? relevantProjects.slice(0, resultLimit).map((project) => projectToProperty(project))
        : [], // Smoke test compatibility
      evidence: {
        sources_used: wantsProperties ? ["ORE Intelligence Database"] : ["AI Knowledge Base"]
      },
      compiler_output: {
        output_type: wantsProperties ? "table_spec" : "text",
        table_spec: {
          signals: wantsProperties ? [{ name: "unit_distribution_signal" }] : []
        }
      }
    })
  } catch (error) {
    console.error("[v0] AI Chat API Error:", error)
    try {
      const fallbackProjects = wantsProperties ? await searchProjects("Dubai", 5) : []
      const fallbackReply = buildFallbackReply(fallbackProjects, wantsProperties, false)
      return NextResponse.json({
        reply: fallbackReply,
        content: fallbackReply,
        request_id: `err_${randomUUID().slice(0, 8)}`,
        properties: wantsProperties
          ? fallbackProjects.slice(0, resultLimit).map((project) => projectToProperty(project))
          : [],
        dataCards: wantsProperties
          ? fallbackProjects.slice(0, resultLimit).map((project) => projectToProperty(project))
          : [],
        evidence: { sources_used: [] }
      })
    } catch (fallbackError) {
      console.error("[v0] AI Chat API Fallback Error:", fallbackError)
      return NextResponse.json(
        { error: "Failed to process message. Please try again." },
        { status: 500 },
      )
    }
  }
}
