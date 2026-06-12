import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Compatibility alias — delegates to /api/freehold/expert/chat
// Normalises message/prompt/query → message field expected by expert/chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const message = (body.message || body.prompt || body.query || '') as string

    const baseUrl = request.nextUrl.origin
    const res = await fetch(`${baseUrl}/api/freehold/expert/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, message }),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[freehold/chat] delegate failed', err)
    return NextResponse.json({ error: 'Chat unavailable' }, { status: 500 })
  }
}
