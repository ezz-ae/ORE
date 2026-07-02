import { NextResponse } from 'next/server'
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto'
import { parseWebhook, markRead, type IncomingMessage } from '@/lib/whatsapp/client'
import { query } from '@/lib/db'
import { ensureLeadActivityTable, ensureLeadsTable } from '@/lib/data'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? 'freehold_verify_token'
const APP_SECRET = (process.env.WHATSAPP_APP_SECRET ?? process.env.META_APP_SECRET ?? '').trim()

// Verify Meta's X-Hub-Signature-256 HMAC over the RAW body. Returns true when
// valid (or, before a secret is configured outside production, skips the check
// so local setup isn't blocked). In production an unset secret is refused.
function verifyMetaSignature(raw: string, header: string | null): 'ok' | 'invalid' | 'unconfigured' {
  if (!APP_SECRET) return process.env.NODE_ENV === 'production' ? 'invalid' : 'unconfigured'
  if (!header) return 'invalid'
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(raw).digest('hex')
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return 'invalid'
  return timingSafeEqual(a, b) ? 'ok' : 'invalid'
}

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

async function ensureMessagesTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS freehold_site_whatsapp_messages (
      id text PRIMARY KEY,
      message_id text UNIQUE,
      from_phone text,
      body text,
      message_type text,
      lead_id text,
      received_at timestamptz,
      created_at timestamptz DEFAULT now()
    )`,
    [],
  )
}

// Match on the last 9 digits so "+971 50 123 4567" and "971501234567" align.
const phoneKey = (value: string) => value.replace(/\D/g, '').slice(-9)

async function storeIncomingMessage(msg: IncomingMessage) {
  await ensureLeadsTable()
  await ensureMessagesTable()

  const digits = phoneKey(msg.from)
  const leadRows = digits
    ? await query<{ id: string }>(
        `SELECT id FROM freehold_site_leads
         WHERE RIGHT(regexp_replace(phone, '\\D', '', 'g'), 9) = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [digits],
      ).catch(() => [] as { id: string }[])
    : []
  const leadId = leadRows[0]?.id ?? null

  await query(
    `INSERT INTO freehold_site_whatsapp_messages (id, message_id, from_phone, body, message_type, lead_id, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
     ON CONFLICT (message_id) DO NOTHING`,
    [
      randomUUID(),
      msg.messageId,
      msg.from,
      msg.body,
      msg.type,
      leadId,
      msg.timestamp || Math.floor(Date.now() / 1000),
    ],
  )

  // Surface the reply on the lead's activity timeline so brokers see it in CRM.
  if (leadId && msg.body) {
    await ensureLeadActivityTable()
    await query(
      `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
       VALUES ($1, $2, 'whatsapp_received', $3, NULL)`,
      [randomUUID(), leadId, msg.body.slice(0, 2000)],
    ).catch((error) => console.error('[WhatsApp webhook] activity insert failed', error))
  }
}

// Receive incoming WhatsApp messages
export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const verdict = verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'))
    if (verdict === 'invalid') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(raw)
    const messages = parseWebhook(payload)

    for (const msg of messages) {
      await markRead(msg.messageId).catch(() => undefined)
      await storeIncomingMessage(msg).catch((error) =>
        console.error('[WhatsApp webhook] failed to store message', error),
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
