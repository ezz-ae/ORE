import { NextResponse } from 'next/server'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { currentServerUser } from '@/src/features/freehold-intelligence/server-session'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    message?: string
    sessionId?: string
    context?: Record<string, unknown>
  }
  const message = body.message?.trim()
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  try {
    const answer = await queryServerAgent(message, {
      sessionId: body.sessionId,
      context:   body.context,
    })
    return NextResponse.json({ answer, role: currentServerUser.role })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server AI unavailable'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
