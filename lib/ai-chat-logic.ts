import { randomUUID } from "node:crypto"
import {
  DEFAULT_GEMINI_MODELS,
  PUBLIC_SYSTEM_PROMPT,
  buildConversationHistory,
  getGeminiModel,
  getGeminiModelByName,
  listGeminiModels,
} from "@/lib/gemini"
import {
  getGoldenVisaProjects,
  getLlmContextByArea,
  getProjectsByArea,
  getTopROIProjects,
  projectToProperty,
  searchProjects,
} from "@/lib/data"

export async function processAiChatMessage(input: {
  message: string
  conversationHistory?: any[]
  isMobile?: boolean
}) {
  const { message, conversationHistory, isMobile } = input
  const resultLimit = 3
  const requestId = `req_${randomUUID().slice(0, 8)}`
  
  const hasPropertyIntent = (text: string) => {
    const t = text.toLowerCase()
    return (t.includes("show") || t.includes("find") || t.includes("search") || t.includes("compare")) && 
           (t.includes("property") || t.includes("project") || t.includes("unit") || t.includes("apartment") || t.includes("villa") || t.includes("options"))
  }

  const hasUnitIntent = (text: string) => {
    const t = text.toLowerCase()
    return /\b\d+\s*br\b/.test(t) || /\b\d+\s*bed(room)?s?\b/.test(t) || t.includes("unit")
  }

  const wantsProperties = hasPropertyIntent(message)
  const wantsUnitDistribution = hasUnitIntent(message)
  let relevantProjects = wantsProperties || wantsUnitDistribution ? await searchProjects(message, resultLimit) : []
  
  const formattedProjects = relevantProjects.map(p => {
    return `Project: ${p.name}
Slug: ${p.slug}
Starting Price: AED ${p.units?.[0]?.priceFrom || 'On Request'}
Location: ${p.location?.area || 'Dubai'}
Bedrooms: ${p.units?.map(u => u.bedrooms).filter(Boolean).join(', ') || 'Various'}
ROI: ${p.investmentHighlights?.expectedROI || 0}%
Highlights: ${(p.highlights || []).join(', ')}`
  }).join("\n\n")

  const history = Array.isArray(conversationHistory) ? conversationHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  })) : []
  
  const model = getGeminiModel("public")
  
  let systemInstruction = PUBLIC_SYSTEM_PROMPT
  if (relevantProjects.length > 0) {
    systemInstruction += `\n\nRELEVANT INVENTORY CONTEXT (Use strictly to recommend options if applicable):\n${formattedProjects}`
  }

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: systemInstruction }]
      },
      {
        role: "model",
        parts: [{ text: "Understood." }]
      },
      ...history
    ]
  })
  
  let aiReply: string
  try {
    const result = await chat.sendMessage([{ text: message }])
    aiReply = result.response.text()
  } catch (error) {
    console.error("Public chat AI fallback:", error)
    aiReply = wantsProperties
      ? "Freehold can still prepare a shortlist from the live inventory. Review the matched options below, then share your budget, preferred area, and handover timing so a Freehold advisor can refine the brief."
      : "Freehold can help with Dubai real estate strategy, market yield, area selection, and investment planning. Share your target budget, preferred area, and timeline, and I will turn it into a practical Freehold investment brief."
  }
  
  return {
    reply: aiReply,
    content: aiReply,
    request_id: requestId,
    properties: relevantProjects.map(p => projectToProperty(p)),
    projects: relevantProjects,
    dataCards: relevantProjects.map(p => projectToProperty(p)),
    evidence: {
      sources_used: wantsProperties ? ["Freehold Intelligence Database"] : ["AI Knowledge Base"]
    },
    compiler_output: {
      output_type: wantsProperties ? "table_spec" : "text",
      table_spec: {
        signals: wantsUnitDistribution ? [{ signal: "unit_distribution_signal" }] : []
      }
    }
  }
}
