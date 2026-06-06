// WhatsApp Business Cloud API client (Meta Graph API v18)

const BASE = 'https://graph.facebook.com/v18.0'

function token() {
  return process.env.WHATSAPP_ACCESS_TOKEN ?? ''
}

function phoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
}

export function isConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

export interface WATextMessage {
  to: string
  body: string
}

export interface WATemplateMessage {
  to: string
  templateName: string
  languageCode?: string
  components?: unknown[]
}

export interface WASendResult {
  messageId: string | null
  status: 'sent' | 'failed'
  error?: string
}

// Send a plain text message
export async function sendText(msg: WATextMessage): Promise<WASendResult> {
  if (!isConfigured()) {
    return { messageId: `mock_${Date.now()}`, status: 'sent' }
  }
  try {
    const res = await fetch(`${BASE}/${phoneNumberId()}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: msg.to.replace(/\D/g, ''),
        type: 'text',
        text: { preview_url: false, body: msg.body },
      }),
    })
    const data = await res.json()
    if (!res.ok) return { messageId: null, status: 'failed', error: data.error?.message }
    return { messageId: data.messages?.[0]?.id ?? null, status: 'sent' }
  } catch (err) {
    return { messageId: null, status: 'failed', error: String(err) }
  }
}

// Send a template message (approved Meta templates)
export async function sendTemplate(msg: WATemplateMessage): Promise<WASendResult> {
  if (!isConfigured()) {
    return { messageId: `mock_${Date.now()}`, status: 'sent' }
  }
  try {
    const res = await fetch(`${BASE}/${phoneNumberId()}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.to.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: msg.templateName,
          language: { code: msg.languageCode ?? 'en_US' },
          components: msg.components ?? [],
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) return { messageId: null, status: 'failed', error: data.error?.message }
    return { messageId: data.messages?.[0]?.id ?? null, status: 'sent' }
  } catch (err) {
    return { messageId: null, status: 'failed', error: String(err) }
  }
}

// Mark a message as read
export async function markRead(messageId: string): Promise<void> {
  if (!isConfigured()) return
  await fetch(`${BASE}/${phoneNumberId()}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  })
}

// Parse an incoming webhook payload
export interface IncomingMessage {
  from: string
  messageId: string
  body: string
  timestamp: number
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'unknown'
}

export function parseWebhook(payload: unknown): IncomingMessage[] {
  const results: IncomingMessage[] = []
  try {
    const p = payload as Record<string, unknown>
    const entry = (p.entry as unknown[])?.[0]
    if (!entry) return results
    const changes = (entry as Record<string, unknown>).changes as unknown[]
    for (const change of changes ?? []) {
      const value = (change as Record<string, unknown>).value as Record<string, unknown>
      const messages = value?.messages as unknown[] | undefined
      for (const msg of messages ?? []) {
        const m = msg as Record<string, unknown>
        results.push({
          from: String(m.from ?? ''),
          messageId: String(m.id ?? ''),
          body: (m.text as Record<string, string> | undefined)?.body ?? '',
          timestamp: Number(m.timestamp ?? 0),
          type: String(m.type ?? 'unknown') as IncomingMessage['type'],
        })
      }
    }
  } catch {
    // ignore parse errors
  }
  return results
}
