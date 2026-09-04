import { createHash } from 'node:crypto'
import { getStoredMetaCreds } from '@/lib/freehold/integration-credentials'
import { getGlobalPixels } from '@/lib/freehold/tracking-pixels'
import { readEventResponse, matchKeysPresent, attributesToAd, acceptedWithLoss } from '@/lib/freehold/capi-ledger'
import { recordCapiEvent } from '@/lib/freehold/capi-ledger-db'

// ─── Meta Conversions API (server-side events) ────────────────────────────────
// The reliable half of the conversion signal. The landing page's browser pixel
// fires `Lead` on submit, but ad blockers and iOS privacy drop a large share of
// those. This module re-fires the same event server-side with the SAME
// event_id, so Meta deduplicates the pair and the optimizer sees every real
// lead. No credentials configured ⇒ silently skip (the lead itself is never
// blocked on ad plumbing).

const GRAPH = 'https://graph.facebook.com/v20.0'

/**
 * TWO PLACES TO SET "THE PIXEL", AND ONLY ONE OF THEM FED THIS.
 *
 * The product has a Pixel screen that saves `metaPixelId` under the TRACKING
 * provider — the id every landing page fires — and an Integrations → Meta
 * screen that saves `pixelId` under the META provider. This function read
 * only the second one.
 *
 * So an operator could choose their dataset on the screen called "Pixel",
 * see it applied to every landing page, and have the Conversions API remain
 * silently unconfigured. Nothing on either screen said the two were
 * different, and the failure was invisible: no credentials produced the same
 * `return false` as a rejected event.
 *
 * On this account: 124 qualified leads, zero reported stages, and a dataset
 * whose last_fired_time was null.
 *
 * The Meta provider still wins when set — it is the more specific choice, and
 * an account deliberately separating its server dataset from its browser
 * pixel must keep that separation. The tracking pixel is the fallback, and
 * `source` is recorded on every ledger row so which one was used is a fact on
 * the record rather than a guess.
 */
async function capiCreds(): Promise<{ token: string; pixelId: string; source: 'env' | 'meta' | 'tracking' } | null> {
  let token = process.env.META_ACCESS_TOKEN
  let pixelId = process.env.META_PIXEL_ID
  let source: 'env' | 'meta' | 'tracking' = 'env'
  if (!token || !pixelId) {
    const stored = await getStoredMetaCreds().catch(() => null)
    if (stored) {
      token = token || stored.accessToken
      if (!pixelId && stored.pixelId) {
        pixelId = stored.pixelId
        source = 'meta'
      }
    }
  }
  if (!pixelId) {
    const tracking = await getGlobalPixels().catch(() => null)
    if (tracking?.metaPixelId) {
      pixelId = tracking.metaPixelId
      source = 'tracking'
    }
  }
  return token && pixelId ? { token, pixelId, source } : null
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

// ─── The other half of the signal: what the CRM decided ───────────────────────
// Meta knows a form was submitted. It does not know whether anyone answered
// the phone, whether the lead qualified, or whether a property was sold. That
// is the half that decides whether the money worked, and until now it never
// travelled back — so the optimiser kept buying more of whatever produced
// submissions.
//
// Sending it costs no control. It is our own judgment of our own leads,
// expressed as an event; targeting, placement and delivery stay exactly where
// they are.

export interface QualifiedLeadParams {
  /** Deterministic — see writeBackEventId. A retry must not count twice. */
  eventId: string
  /**
   * Our own id for this person, hashed before it leaves.
   *
   * It lets Meta join the submission event and this one as the same human
   * without a cookie surviving in between — which on iOS it usually does not.
   * Hashed because it is still an identifier: Meta matches on equality, so it
   * has no need of the readable value and no business holding it.
   */
  externalId?: string
  /** 'qualified' → someone real. 'won' → a deal. */
  stage: 'qualified' | 'won'
  email?: string
  phone?: string
  /** What this lead is worth, in AED. Omitted when we do not really know. */
  valueAED?: number | null
  /** Listing / project name, for Meta's breakdowns. */
  contentName?: string
  /**
   * The click cookie from the visit that produced this person, stored on the
   * lead at submission and read back here.
   *
   * `_fbc` is the strongest match Meta accepts. It was being read at
   * submission, spent on that one Lead event and dropped — so these events,
   * which fire weeks later and carry the only outcome Meta cannot see for
   * itself, went out identified by a hashed email and phone alone. The
   * strongest signal this account can send was going out with the weakest
   * identity it had. See lib/freehold/click-identity.ts.
   */
  fbc?: string
  fbp?: string
  /**
   * THE META LEADGEN ID — the field that credits the right AD.
   *
   * "when the lead come rated send conversion result meta fix the same ad that
   *  generated the lead."
   *
   * Everything else here identifies a PERSON: a hashed email, a hashed phone,
   * a click cookie. Meta then has to work out which ad that person came from,
   * and for a lead that arrived through an instant form weeks ago it usually
   * cannot — so the outcome landed on the campaign at best, and the ad that
   * actually produced the buyer got no credit for it.
   *
   * `lead_id` is Meta's own id for that form submission. Given it, Meta joins
   * the event straight to the ad, the ad set and the campaign that generated
   * it, with no matching involved. It is the difference between telling Meta
   * "somebody good bought" and telling it WHICH AD FOUND THEM.
   *
   * Stored on every synced lead as meta_lead_id since the sync existed, and
   * never sent until now. Not hashed — it is Meta's own identifier, matched by
   * equality, exactly like fbc.
   */
  leadId?: string
}

/** Meta's custom event names for the two stages. */
const STAGE_EVENT: Record<'qualified' | 'won', string> = {
  qualified: 'QualifiedLead',
  won: 'Purchase',
}

/**
 * The exact event body. Split out from the send so the shape can be tested
 * without a network — the hashing especially: a raw email reaching Meta would
 * be a privacy failure that no amount of retry logic fixes afterwards.
 */
export function buildQualifiedLeadEvent(params: QualifiedLeadParams): Record<string, unknown> | null {
  const userData: Record<string, unknown> = {}
  const em = params.email ? hashEmail(params.email) : null
  const ph = params.phone ? hashPhone(params.phone) : null
  if (em) userData.em = [em]
  if (ph) userData.ph = [ph]
  if (params.externalId) userData.external_id = [sha256(params.externalId.trim().toLowerCase())]
  // NOT hashed, and that is Meta's rule not a lapse: fbc and fbp are Meta's
  // own opaque tokens, matched by equality against what its pixel wrote. A
  // hashed one matches nothing.
  if (params.fbc) userData.fbc = params.fbc
  if (params.fbp) userData.fbp = params.fbp
  // Meta's own id for the form submission. Not hashed — like fbc, it is
  // matched by equality against what Meta itself issued. This is what credits
  // the exact AD rather than leaving Meta to guess from a hashed email.
  if (params.leadId) userData.lead_id = params.leadId
  // No match key means Meta cannot attach this to anyone. Sending it anyway
  // would inflate the count with events that teach the optimiser nothing.
  // An external id alone does not count: it only matches a person Meta has
  // already seen it against, so on its own it identifies nobody. A click
  // cookie DOES identify somebody, so it counts — and so does a lead_id,
  // which identifies not just the person but the submission they made.
  if (!em && !ph && !params.fbc && !params.leadId) return null

  const custom: Record<string, unknown> = { content_category: 'real_estate' }
  if (params.contentName) custom.content_name = params.contentName
  // A value is sent only when it is real — a placeholder number here becomes
  // the optimiser's idea of what a customer is worth — and only on the
  // PURCHASE. A QualifiedLead carrying the eventual deal value would teach
  // Meta that qualification IS the money, and it would optimise for form
  // answers instead of closings.
  if (params.stage === 'won' && typeof params.valueAED === 'number' && params.valueAED > 0) {
    custom.value = Math.round(params.valueAED * 100) / 100
    custom.currency = 'AED'
  }

  return {
    event_name: STAGE_EVENT[params.stage],
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    // The decision happened in the CRM, not in a browser.
    action_source: 'system_generated',
    user_data: userData,
    custom_data: custom,
  }
}

/**
 * Tell Meta this lead turned out to be real. Never throws and never blocks the
 * CRM write that triggered it — a failed event is logged and the lead is
 * unaffected.
 */
export async function sendQualifiedLead(params: QualifiedLeadParams): Promise<boolean> {
  try {
    // ── A MISSING CONFIGURATION MUST NOT LOOK LIKE A REJECTED EVENT ─────
    //
    // Both used to `return false`, so the caller rolled the stage back and
    // tried again on the next update, forever, with nothing written down.
    // On this account that produced 124 qualified leads, zero reported
    // stages, and a pixel whose last_fired_time was null — a loop that had
    // never run once, and no screen anywhere that could say so.
    //
    // Recorded as distinct reasons so coverage can say "nothing is
    // configured" rather than "0% reach", which are different problems.
    const creds = await capiCreds()
    if (!creds) {
      void recordCapiEvent({
        leadId: params.externalId ?? null, stage: params.stage, eventId: params.eventId,
        eventName: null,
        response: { ok: false, status: 0, error: 'no_capi_credentials', messages: [] },
        matchKeys: [], attributesToAd: false,
      })
      return false
    }
    const event = buildQualifiedLeadEvent(params)
    if (!event) {
      // No match key at all — nothing Meta could attach this outcome to.
      void recordCapiEvent({
        leadId: params.externalId ?? null, stage: params.stage, eventId: params.eventId,
        eventName: null,
        response: { ok: false, status: 0, error: 'no_match_key', messages: [] },
        matchKeys: [], attributesToAd: false,
      })
      return false
    }
    const res = await fetch(`${GRAPH}/${creds.pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: creds.token }),
      signal: AbortSignal.timeout(8000),
    })

    // ── META'S ANSWER IS EVIDENCE, NOT A STATUS CODE ────────────────────
    //
    // This used to read the body only on failure, print it, and return a
    // boolean. Everything Meta says about what it actually did — how many
    // events it took, the trace id, and the `messages` warnings naming
    // parameters it IGNORED — was discarded on the successful path.
    //
    // That is the path that matters. A 200 carrying warnings is
    // indistinguishable from a clean 200, so an account can send perfectly
    // formed events for months while Meta drops the field that made them
    // worth sending.
    const body: unknown = await res.json().catch(() => ({}))
    const response = readEventResponse(res.status, body)
    const matchKeys = matchKeysPresent({
      leadId: params.leadId, fbc: params.fbc, fbp: params.fbp,
      email: params.email, phone: params.phone, externalId: params.externalId,
    })
    // Fire-and-forget: bookkeeping must never fail the send it describes,
    // and the caller's retry decision must not wait on a second write.
    void recordCapiEvent({
      leadId: params.externalId ?? null,
      stage: params.stage,
      eventId: params.eventId,
      eventName: (event as { event_name?: string }).event_name ?? null,
      response,
      pixelSource: creds.source,
      matchKeys,
      attributesToAd: attributesToAd(matchKeys),
    })

    if (!response.ok) {
      console.error(`[meta-capi] ${params.stage} event rejected`, res.status, response.error ?? '')
      return false
    }
    // Accepted, and Meta kept less than we sent. NOT a failure and must not
    // be retried — a duplicate outcome event is worse than a lossy one — but
    // it is now on the ledger where somebody can see it.
    if (acceptedWithLoss(response)) {
      console.warn(`[meta-capi] ${params.stage} accepted with warnings`, response.messages?.join(' | '))
    }
    return true
  } catch (error) {
    console.error(`[meta-capi] ${params.stage} event failed`, error)
    return false
  }
}
