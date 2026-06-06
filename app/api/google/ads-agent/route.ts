import { NextRequest, NextResponse } from 'next/server'
import { queryAdsAgent } from '@/lib/google/vertex-agent'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message: string
      sessionId?: string
      context?: Record<string, unknown>
    }

    const { message, sessionId, context } = body
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const response = await queryAdsAgent(message.trim(), { sessionId, context })
    return NextResponse.json({ response })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const isConfig = msg.includes('VERTEX_AI_SERVICE_ACCOUNT_JSON')
    return NextResponse.json({ error: msg, type: isConfig ? 'config' : 'api' }, { status: 500 })
  }
}
