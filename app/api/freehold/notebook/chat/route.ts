import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    message?: string
    conversationId?: string
    role?: string
  }
  const message = body.message?.trim()
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  const conversationId = body.conversationId ?? `notebook-${crypto.randomUUID()}`
  const role = body.role ?? 'owner'

  const systemPrompt = `You are the Freehold Notebook AI — a private research and drafting assistant for the Freehold team.

You help with: property research, brochure drafts, market summaries, WhatsApp message templates, and investment narratives for Dubai real estate.

Rules:
- Only use facts explicitly provided in the conversation. Do not invent project names, prices, handover dates, or yields.
- If asked for verified project data, respond: "I don't have live project data in this session — use the Inventory tab to retrieve it."
- When drafting copy, mark any unfilled detail as [VERIFY BEFORE SENDING].
- Keep responses focused and professional.`

  try {
    const answer = await queryServerAgent(message, { systemPrompt })
    return NextResponse.json({
      conversationId,
      role,
      prompt: message,
      answer,
      cards: [],
      source: 'ai',
    })
  } catch {
    return NextResponse.json({
      conversationId,
      role,
      prompt: message,
      answer: 'The AI is currently unavailable. Your note has been saved locally — retry in a moment.',
      cards: [],
      source: 'fallback',
    })
  }
}
