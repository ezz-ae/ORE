export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { sendMessage, getSessionState } from '@/lib/whatsapp/session'

// POST /api/whatsapp/send  { to: "+971...", body: "Hello" }
export async function POST(req: Request) {
  const state = getSessionState()
  if (state.status !== 'connected') {
    return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 503 })
  }
  try {
    const { to, body } = await req.json() as { to: string; body: string }
    if (!to || !body?.trim()) {
      return NextResponse.json({ error: 'Missing to or body' }, { status: 400 })
    }
    const msg = await sendMessage(to, body)
    return NextResponse.json(msg)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
