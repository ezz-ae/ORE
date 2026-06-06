import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { WAMessage, WAExtractedData } from '@/src/features/freehold-intelligence/whatsapp-conversations'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RecapRequest {
  messages: WAMessage[]
  leadName: string
  leadId: string
}

interface RecapResponse {
  summary: string
  keyPoints: string[]
  extractedData: Partial<WAExtractedData>
  nextSteps: string[]
  notebookEntry: {
    title: string
    body: string
    tags: string[]
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as RecapRequest
    const convText = body.messages
      .map((m) => {
        const ts = new Date(m.timestamp).toLocaleString('en-AE', { timeZone: 'Asia/Dubai', dateStyle: 'short', timeStyle: 'short' })
        return `[${ts}] ${m.direction === 'inbound' ? body.leadName : 'Agent'}: ${m.body}`
      })
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      system: `You are a CRM intelligence assistant for Freehold Property, a Dubai real estate agency.
Your job is to analyze WhatsApp conversations and produce structured intelligence for the sales team.
Always output valid JSON. Be concise and actionable.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this WhatsApp conversation with lead "${body.leadName}" and produce a comprehensive recap.

Conversation:
${convText}

Respond with JSON:
{
  "summary": "2-3 sentence plain-English summary of the conversation",
  "keyPoints": [
    "Key fact 1 about the lead (budget, preferences, etc.)",
    "Key fact 2",
    "Key fact 3",
    "Key fact 4 (max 6 points)"
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
  "nextSteps": [
    "Immediate action 1",
    "Action 2 within 48 hours",
    "Follow-up action"
  ],
  "notebookEntry": {
    "title": "Short title for notebook (e.g. 'Khalid Al Mansoori — WhatsApp recap Jun 2026')",
    "body": "Formatted markdown recap suitable for saving in a CRM notebook. Include: intent, requirements, key exchanges, agreed next steps.",
    "tags": ["whatsapp", "lead_recap", "other relevant tags"]
  }
}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) as RecapResponse : null

    if (!result) {
      return NextResponse.json({ error: 'Recap generation failed' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[WhatsApp recap]', err)
    return NextResponse.json({ error: 'Recap failed' }, { status: 500 })
  }
}
