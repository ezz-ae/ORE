import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { syncLeadsToCrm } from '@/lib/freehold/meta-lead-sync'
import { getFormLeads } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.META_LEADGEN_WEBHOOK_VERIFY_TOKEN ?? 'freehold_verify_token'
// Accept both spellings — Meta's dashboard calls it the (Facebook) App Secret.
const APP_SECRET = (process.env.META_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? '').trim()

// Same signature scheme as the WhatsApp webhook (app/api/whatsapp/webhook) —
// Meta signs every webhook product with the app secret the same way.
function verifyMetaSignature(raw: string, header: string | null): 'ok' | 'invalid' | 'unconfigured' {
  if (!APP_SECRET) return process.env.NODE_ENV === 'production' ? 'invalid' : 'unconfigured'
  if (!header) return 'invalid'
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(raw).digest('hex')
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return 'invalid'
  return timingSafeEqual(a, b) ? 'ok' : 'invalid'
}

// Meta webhook verification handshake — configure this URL + this token as
// the Callback URL / Verify Token for the "Page" object's Webhooks
// subscription in the Meta App Dashboard (subscribe the `leadgen` field).
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

interface LeadgenChange {
  field?: string
  value?: { form_id?: string; leadgen_id?: string; page_id?: string }
}
interface WebhookPayload {
  object?: string
  entry?: Array<{ id?: string; changes?: LeadgenChange[] }>
}

/**
 * Real-time lead-form ingestion. Meta pushes ONLY the ids of what changed
 * (leadgen_id, form_id) — we don't trust the payload for lead content, we
 * re-pull that form's leads via our own Graph API token and reuse the SAME
 * dedupe-by-meta_lead_id insert path the on-demand dashboard view and the
 * daily cron safety-net use, so this can never double-insert a lead.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const verdict = verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'))
    if (verdict === 'invalid') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(raw) as WebhookPayload
    const formIds = new Set<string>()
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'leadgen' && change.value?.form_id) formIds.add(change.value.form_id)
      }
    }

    for (const formId of formIds) {
      await getFormLeads(formId)
        .then((leads) => syncLeadsToCrm(formId, leads))
        .catch((error) => console.error('[meta-leadgen webhook] sync failed for form', formId, error))
    }

    return NextResponse.json({ ok: true, formsNotified: formIds.size })
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
