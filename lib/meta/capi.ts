import { createHash } from 'node:crypto'
import { getStoredMetaCreds } from '@/lib/freehold/integration-credentials'

// ─── Meta Conversions API (server-side events) ────────────────────────────────
// The reliable half of the conversion signal. The landing page's browser pixel
// fires `Lead` on submit, but ad blockers and iOS privacy drop a large share of
// those. This module re-fires the same event server-side with the SAME
// event_id, so Meta deduplicates the pair and the optimizer sees every real
// lead. No credentials configured ⇒ silently skip (the lead itself is never
// blocked on ad plumbing).

const GRAPH = 'https://graph.facebook.com/v20.0'

async function capiCreds(): Promise<{ token: string; pixelId: string } | null> {
  let token = process.env.META_ACCESS_TOKEN
  let pixelId = process.env.META_PIXEL_ID
  if (!token || !pixelId) {
    const stored = await getStoredMetaCreds().catch(() => null)
    if (stored) {
      token = token || stored.accessToken
      pixelId = pixelId || stored.pixelId || undefined
    }
  }
  return token && pixelId ? { token, pixelId } : null
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

// Meta wants SHA-256 of the lowercased, trimmed email.
const hashEmail = (email: string): string | null => {
  const e = email.trim().toLowerCase()
  return e.includes('@') ? sha256(e) : null
}

// Meta wants SHA-256 of digits-only phone WITH country code. Leads arrive in
// local UAE formats ("050 123 4567") as often as international ones, so
// normalize the common shapes before hashing.
const hashPhone = (phone: string): string | null => {
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.length === 10 && digits.startsWith('0')) digits = `971${digits.slice(1)}`
  else if (digits.length === 9) digits = `971${digits}`
  return digits.length >= 10 ? sha256(digits) : null
}

export interface LeadConversionParams {
  /** Shared with the browser pixel's eventID so Meta dedups the pair. */
  eventId: string
  email?: string
  phone?: string
  /** The landing page URL the lead converted on. */
  sourceUrl?: string
  clientIp?: string
  userAgent?: string
  /** Meta browser cookies forwarded from the submitting request. */
  fbp?: string
  fbc?: string
  /** Project / landing name for Meta's content breakdowns. */
  contentName?: string
}

/**
 * Fire a server-side `Lead` event at the configured pixel. Never throws and
 * never blocks intake: returns false when credentials are absent or Meta
 * rejects the event (logged for the operator).
 */
export async function sendLeadConversion(params: LeadConversionParams): Promise<boolean> {
  try {
    const creds = await capiCreds()
    if (!creds) return false

    const userData: Record<string, unknown> = {}
    const em = params.email ? hashEmail(params.email) : null
    const ph = params.phone ? hashPhone(params.phone) : null
    if (em) userData.em = [em]
    if (ph) userData.ph = [ph]
    if (params.clientIp) userData.client_ip_address = params.clientIp
    if (params.userAgent) userData.client_user_agent = params.userAgent
    if (params.fbp) userData.fbp = params.fbp
    if (params.fbc) userData.fbc = params.fbc
    // Without at least one match key the event can't attribute — skip honestly.
    if (Object.keys(userData).length === 0) return false

    const event: Record<string, unknown> = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: params.eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        content_category: 'real_estate',
        ...(params.contentName ? { content_name: params.contentName } : {}),
      },
    }
    if (params.sourceUrl) event.event_source_url = params.sourceUrl

    const res = await fetch(`${GRAPH}/${creds.pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: creds.token }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[meta-capi] Lead event rejected', res.status, detail.slice(0, 400))
      return false
    }
    return true
  } catch (error) {
    console.error('[meta-capi] Lead event failed', error)
    return false
  }
}
