export const runtime = 'nodejs'

import { onMessage, type WAStoredMessage } from '@/lib/whatsapp/session'

/**
 * GET /api/whatsapp/stream?phone=971501234567
 *
 * Server-Sent Events stream. Pushes new messages for the given phone number
 * to the client in real-time. The client reconnects automatically on drop.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const filterPhone = url.searchParams.get('phone')?.replace(/\D/g, '') ?? ''

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25_000)

      // send initial connection event
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'))

      const unsub = onMessage((msg: WAStoredMessage) => {
        const msgPhone = msg.fromMe
          ? msg.to.replace(/\D/g, '')
          : msg.from.replace(/\D/g, '')
        if (filterPhone && msgPhone !== filterPhone) return
        try {
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${JSON.stringify(msg)}\n\n`),
          )
        } catch {
          unsub()
          clearInterval(heartbeat)
        }
      })

      req.signal.addEventListener('abort', () => {
        unsub()
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
