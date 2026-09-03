/**
 * WHAT WE TOLD META, AND WHAT META SAID BACK.
 *
 * The sender was already careful — deterministic event ids, a stage guard
 * written before the send, hashed PII, `lead_id` so the outcome lands on the
 * originating ad. What it did with the answer was this:
 *
 *     if (!res.ok) { console.error(...); return false }
 *     return true
 *
 * A boolean. Meta's response body — `events_received`, `fbtrace_id`, and the
 * `messages` array that says which parameters it IGNORED — was read only on
 * failure, printed to a log nobody reads, and dropped.
 *
 * So the account could not answer any of the questions that decide whether
 * this loop is real:
 *
 *   · how many rated leads have actually reached Meta, and how many haven't
 *   · what identity each event carried — a hashed email alone matches far
 *     worse than one carrying `lead_id`, and nothing measured the difference
 *   · whether Meta accepted an event and then discarded half of it, which it
 *     reports as a WARNING on a 200 response
 *
 * That last one is the dangerous one. A 200 with warnings looks identical to
 * a 200 without them, so an account can send perfectly formed events for
 * months while Meta drops the field that makes them useful.
 *
 * This is the same shape as the targeting guard: a correct mechanism whose
 * verdict went nowhere. Correct and unobservable is worth what wrong is.
 *
 * NOTHING HERE SENDS ANYTHING. It records what the sender did and reports the
 * gap. Pure half here; the writes live in capi-ledger-db.ts.
 *
 * Runs in `pnpm guards`.
 */

/**
 * The identity keys Meta can match on, strongest first.
 *
 * Order is not cosmetic — it is how well each one identifies a person:
 *
 *   leadId      Meta's own id for the form submission. No matching at all:
 *               Meta already knows which ad, ad set and campaign produced it.
 *   fbc         the click cookie from the visit. The strongest match Meta
 *               accepts for anyone who is not already a known lead.
 *   fbp         the browser cookie. Same device only, and iOS drops it often.
 *   email/phone hashed. Matches a person if Meta has that contact on file.
 *   externalId  our own id, hashed — joins our own events to each other.
 */
export const MATCH_KEYS = ['leadId', 'fbc', 'fbp', 'email', 'phone', 'externalId'] as const
export type MatchKey = (typeof MATCH_KEYS)[number]

/** The keys that let Meta attribute an outcome to the ad that caused it,
 *  rather than merely to a person. This is the distinction that decides
 *  whether a rating teaches the optimiser anything about targeting. */
export const ATTRIBUTING_KEYS: readonly MatchKey[] = ['leadId', 'fbc']

export interface SentIdentity {
  leadId?: string | null
  fbc?: string | null
  fbp?: string | null
  email?: string | null
  phone?: string | null
  externalId?: string | null
}

/** Which match keys an event actually carried. Names, never values — this is
 *  written to a ledger and read on screens, and an unhashed phone number has
 *  no business in either. */
export function matchKeysPresent(id: SentIdentity): MatchKey[] {
  return MATCH_KEYS.filter((k) => String(id[k] ?? '').trim() !== '')
}

/** Can Meta trace this event back to the ad that produced the lead? */
export const attributesToAd = (keys: readonly MatchKey[]): boolean =>
  ATTRIBUTING_KEYS.some((k) => keys.includes(k))

export interface MetaEventResponse {
  ok: boolean
  status: number
  /** Meta's count of events it took. Anything other than the number sent is
   *  a silent partial acceptance. */
  eventsReceived?: number | null
  fbtraceId?: string | null
  /** Meta's own warnings. Present on 200s, and the only place it says a
   *  parameter was ignored. */
  messages?: string[]
  error?: string | null
}

/**
 * Read Meta's `/events` answer without trusting its shape.
 *
 * Every field is optional in practice — Meta has changed this payload before
 * — so a missing field is recorded as unknown rather than defaulted to a
 * number that would read as a fact.
 */
export function readEventResponse(status: number, body: unknown): MetaEventResponse {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const received = Number(b.events_received)
  const messages = Array.isArray(b.messages)
    ? b.messages.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).filter(Boolean)
    : []
  const err = b.error && typeof b.error === 'object'
    ? String((b.error as Record<string, unknown>).message ?? '')
    : null
  return {
    ok: status >= 200 && status < 300 && !err,
    status,
    eventsReceived: Number.isFinite(received) ? received : null,
    fbtraceId: b.fbtrace_id ? String(b.fbtrace_id) : null,
    messages,
    error: err || null,
  }
}

/**
 * Did Meta accept this and quietly keep less than we sent?
 *
 * A 200 carrying warnings, or a received count below what went out, is the
 * failure mode that looks exactly like success. It is separated from `ok` on
 * purpose: the send did not fail and must not be retried — but somebody has
 * to be told.
 */
export function acceptedWithLoss(r: MetaEventResponse, sentCount = 1): boolean {
  if (!r.ok) return false
  if (r.messages && r.messages.length > 0) return true
  return r.eventsReceived !== null && r.eventsReceived !== undefined && r.eventsReceived < sentCount
}

export interface CoverageInput {
  /** Leads a human has rated — the events that SHOULD exist. */
  rated: number
  /** Ledger rows where Meta accepted the event. */
  delivered: number
  /** Delivered events that carried lead_id or fbc. */
  attributing: number
}

export interface Coverage {
  rated: number
  delivered: number
  missing: number
  /** Share of rated leads Meta actually heard about, 0–1. Null when nothing
   *  has been rated: a percentage of zero is not 0%, it is no answer. */
  reach: number | null
  /** Share of DELIVERED events that could be traced to an ad, 0–1. Null when
   *  nothing was delivered, for the same reason. */
  attribution: number | null
}

/**
 * The gap between what the team judged and what Meta was told.
 *
 * Two separate numbers on purpose. `reach` is how much of the CRM's judgment
 * escaped the building. `attribution` is how much of what escaped could be
 * traced to an ad — and an event Meta cannot trace teaches it something about
 * a person while teaching it nothing about targeting, which is the entire
 * reason this loop exists.
 *
 * A single blended score would let a high reach hide a low attribution, and
 * those are different failures with different fixes.
 */
export function coverage(input: CoverageInput): Coverage {
  const rated = Math.max(0, input.rated)
  const delivered = Math.max(0, input.delivered)
  const attributing = Math.max(0, Math.min(input.attributing, delivered))
  return {
    rated,
    delivered,
    missing: Math.max(0, rated - delivered),
    reach: rated > 0 ? Math.min(1, delivered / rated) : null,
    attribution: delivered > 0 ? attributing / delivered : null,
  }
}
