export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { sendMessage, getSessionState } from '@/lib/whatsapp/session'
import { sendText, isConfiguredAsync } from '@/lib/whatsapp/client'

// POST /api/whatsapp/send  { to: "+971...", body: "Hello" }
//
// Send path resolution (the Cloud API is the canonical production backend —
// it works on serverless and matches the inbound webhook; the Baileys QR
// session is a local/dev fallback that cannot run on Vercel):
//   1. Cloud API configured → real Graph send.
//   2. Baileys session connected → session send.
//   3. Neither → 503 (never a fake success).
export async function POST(req: Request) {
  try {
    const { to, body } = await req.json() as { to: string; body: string }
    if (!to || !body?.trim()) {
      return NextResponse.json({ error: 'Missing to or body' }, { status: 400 })
    }

    if (await isConfiguredAsync()) {
      const result = await sendText({ to, body })
      if (result.status !== 'sent') {
        return NextResponse.json({ error: result.error ?? 'Send failed', status: result.status }, { status: 502 })
      }
      return NextResponse.json({ id: result.messageId, status: 'sent', backend: 'cloud' })
    }

    const state = getSessionState()
    if (state.status === 'connected') {
      const msg = await sendMessage(to, body)
      return NextResponse.json({ ...msg, backend: 'session' })
    }

    return NextResponse.json(
      { error: 'WhatsApp not connected — configure the Cloud API or link a device.' },
      { status: 503 },
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
