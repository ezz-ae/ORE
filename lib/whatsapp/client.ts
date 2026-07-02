// WhatsApp Business Cloud API client (Meta Graph API v18)

import { getStoredCreds, type WhatsAppStoredCreds } from '@/lib/freehold/integration-credentials'

const BASE = 'https://graph.facebook.com/v18.0'

// Resolve Cloud API config env-first, then a connection saved through
// Integrations → WhatsApp. Returns null when neither is present.
async function resolveCloud(): Promise<{ token: string; phoneNumberId: string } | null> {
  const envTok = process.env.WHATSAPP_ACCESS_TOKEN
  const envPid = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (envTok && envPid) return { token: envTok, phoneNumberId: envPid }
  const stored = await getStoredCreds<WhatsAppStoredCreds>('whatsapp').catch(() => null)
  if (stored?.accessToken && stored?.phoneNumberId) {
    return { token: stored.accessToken, phoneNumberId: stored.phoneNumberId }
  }
  return null
}

/** Sync env-only check (fast path). Prefer isConfiguredAsync for the DB fallback. */
export function isConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/** True when env OR an in-app connection can send through the Cloud API. */
export async function isConfiguredAsync(): Promise<boolean> {
  return (await resolveCloud()) !== null
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
  // 'mock' = Cloud API not configured; NOTHING was delivered. Callers must
  // never treat mock as sent (the old fake-'sent' silently dropped messages).
  status: 'sent' | 'failed' | 'mock'
  error?: string
}

// Send a plain text message
export async function sendText(msg: WATextMessage): Promise<WASendResult> {
  const cfg = await resolveCloud()
  if (!cfg) {
    return { messageId: null, status: 'mock', error: 'WhatsApp Cloud API not configured — message NOT delivered' }
  }
  try {
    const res = await fetch(`${BASE}/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
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
  const cfg = await resolveCloud()
  if (!cfg) {
    return { messageId: null, status: 'mock', error: 'WhatsApp Cloud API not configured — message NOT delivered' }
  }
  try {
    const res = await fetch(`${BASE}/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
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
  const cfg = await resolveCloud()
  if (!cfg) return
  await fetch(`${BASE}/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
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
