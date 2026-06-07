import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { WAMessage, WAExtractedData } from '@/src/features/freehold-intelligence/whatsapp-conversations'
import type { CRMLeadIntelligence } from '@/src/features/freehold-intelligence/server-session'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface AiAssistRequest {
  messages: WAMessage[]
  lead: Pick<CRMLeadIntelligence, 'name' | 'pipelineStage' | 'temperature' | 'budgetAED' | 'projectInterest' | 'assignedAgent' | 'intentScore'>
  inventoryContext: Pick<InventoryProperty, 'name' | 'area' | 'startingPriceAED' | 'roi' | 'bedrooms' | 'paymentPlan' | 'handoverYear'>[]
}

interface AiAssistResponse {
  suggestions: string[]
  extractedData: Partial<WAExtractedData>
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
  nextAction: string
  propertyMatches: string[]
}

function buildConversationText(messages: WAMessage[]): string {
  return messages
    .slice(-20)
    .map((m) => `[${m.direction === 'inbound' ? 'Lead' : 'Agent'}]: ${m.body}`)
    .join('\n')
}

/** Sensible offline suggestions when no Anthropic key is configured. */
function fallbackAssist(body: AiAssistRequest): AiAssistResponse {
  const firstName = (body.lead?.name ?? 'there').split(' ')[0]
  const topMatch = body.inventoryContext?.[0]
  return {
    suggestions: [
      `Hi ${firstName}, thanks for reaching out! Are you looking to invest or for end-use? I can share a few options that fit your budget.`,
      topMatch
        ? `Based on what you've shared, ${topMatch.name} in ${topMatch.area} could be a great fit — from AED ${(((topMatch.startingPriceAED ?? 0) / 1_000_000) || 0).toFixed(1)}M with a flexible payment plan. Want the full details?`
        : `I have a few handpicked options that match your criteria. Would you like me to send them over?`,
      `Would you be open to a quick viewing this week? I can arrange a time that works for you.`,
    ],
    extractedData: { purpose: 'unknown', confidence: 0 },
    sentiment: 'neutral',
    nextAction: 'Reply to re-engage the lead and propose a viewing.',
    propertyMatches: topMatch ? [topMatch.name] : [],
  }
}

export async function POST(req: Request) {
  let body: AiAssistRequest
  try {
    body = await req.json() as AiAssistRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Graceful degradation — never 500 the agent inbox when the key is absent.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallbackAssist(body))
  }

  try {
    const convText = buildConversationText(body.messages)
    const inventoryText = body.inventoryContext
      .map((p) => `- ${p.name} (${p.area}): from AED ${((p.startingPriceAED ?? 0) / 1_000_000).toFixed(1)}M, ${p.bedrooms} BR, ${p.roi ?? '–'}% ROI, ${p.paymentPlan}, handover ${p.handoverYear ?? 'Ready'}`)
      .join('\n')

    const systemPrompt = `You are an expert Dubai real estate agent AI assistant for Freehold Property. You help agents respond to WhatsApp conversations with leads.

Lead profile:
- Name: ${body.lead.name}
- Pipeline stage: ${body.lead.pipelineStage}
- Temperature: ${body.lead.temperature}
- Budget: ${body.lead.budgetAED}
- Project interest: ${body.lead.projectInterest}
- Intent score: ${body.lead.intentScore}

Available inventory:
${inventoryText || 'No specific inventory loaded.'}

Rules:
- Be professional, warm, and conversational in WhatsApp style
- Use bullet points and emojis sparingly but appropriately
- Keep replies concise (max 3-4 sentences)
- Always move the lead closer to a viewing or decision
- Respond in the SAME LANGUAGE as the lead's last message
- Never make guaranteed ROI claims — use "estimated" or "projected"

Respond with valid JSON only.`

    const userPrompt = `Conversation so far:
${convText}

Analyze this conversation and respond with JSON:
{
  "suggestions": [
    "Reply option 1 (concise, natural)",
    "Reply option 2 (property-focused)",
    "Reply option 3 (next-step/CTA)"
  ],
  "extractedData": {
    "budget": "string or null",
    "budgetMin": number_or_null,
    "budgetMax": number_or_null,
    "location": "string or null",
    "propertyType": "apartment|villa|townhouse|null",
    "bedrooms": "string or null",
    "timeline": "string or null",
    "paymentMethod": "string or null",
    "nationality": "string or null",
    "purpose": "investment|end_use|unknown",
    "confidence": 0_to_100
  },
  "sentiment": "positive|neutral|negative|urgent",
  "nextAction": "One sentence describing the best next step for this lead",
  "propertyMatches": ["Property name 1 from inventory that fits", "Property name 2"]
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) as AiAssistResponse : null

    if (!result) {
      return NextResponse.json(fallbackAssist(body))
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[WhatsApp AI assist]', err)
    // Degrade to offline suggestions rather than breaking the inbox.
    return NextResponse.json(fallbackAssist(body))
  }
}
