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
} from "@/lib/ore"

export async function processAiChatMessage(input: {
  message: string
  conversationHistory?: any[]
  isMobile?: boolean
}) {
  const { message, conversationHistory, isMobile } = input
  const resultLimit = 3
  
  const hasPropertyIntent = (text: string) => {
    const t = text.toLowerCase()
    return (t.includes("show") || t.includes("find") || t.includes("search") || t.includes("compare")) && 
           (t.includes("property") || t.includes("project") || t.includes("unit") || t.includes("apartment") || t.includes("villa") || t.includes("options"))
  }

  const wantsProperties = hasPropertyIntent(message)
  let relevantProjects = wantsProperties ? await searchProjects(message, resultLimit) : []
  
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
  
  const result = await chat.sendMessage([{ text: message }])
  const aiReply = result.response.text()

  const requestId = `req_${randomUUID().slice(0, 8)}`
  
  return {
    reply: aiReply,
    content: aiReply,
    request_id: requestId,
    properties: relevantProjects.map(p => projectToProperty(p)),
    projects: relevantProjects,
    dataCards: relevantProjects.map(p => projectToProperty(p)),
    evidence: {
      sources_used: wantsProperties ? ["ORE Intelligence Database"] : ["AI Knowledge Base"]
    },
    compiler_output: {
      output_type: wantsProperties ? "table_spec" : "text",
      table_spec: {
        signals: []
      }
    }
  }
}
