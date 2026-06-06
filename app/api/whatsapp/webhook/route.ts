import { NextResponse } from 'next/server'
import { parseWebhook, markRead } from '@/lib/whatsapp/client'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? 'freehold_verify_token'

// Meta webhook verification handshake
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// Receive incoming WhatsApp messages
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const messages = parseWebhook(payload)

    for (const msg of messages) {
      // Mark as read
      await markRead(msg.messageId)

      // TODO: store incoming message in DB and trigger any automation
      console.log('[WhatsApp webhook] incoming message', {
        from: msg.from,
        body: msg.body,
        timestamp: msg.timestamp,
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
