/**
 * WHICH LEADS COUNT AS REAL, AND WHEN META IS TOLD.
 *
 * Meta knows one thing about a lead: a form was submitted. It optimises for
 * more of that, which is why a campaign can look excellent in Ads Manager
 * while the phone numbers do not answer. The CRM knows the other half — who
 * picked up, who qualified, who bought — and that half never travelled back.
 *
 * Sending it back is the single change with the most leverage in the account,
 * and it costs no control: it is our own judgment of our own leads, expressed
 * as an event. Nothing about targeting, placement or delivery is handed over.
 *
 * Pure — no I/O, so the rule is testable and lives in one place instead of
 * being re-typed at each call site.
 */

/**
 * EVERY STAGE A LEAD CAN BE IN, in funnel order.
 *
 * Walkable, because a machine now moves leads between them: the assistant's
 * crm_set_lead_status validates against this array, and a status it accepted
 * that the database rejects is a tool that reports success and changes
 * nothing. The same eight are the CHECK constraint on freehold_site_leads
 * (lib/data.ts) and the importer's whitelist (lib/freehold/lead-import.ts) —
 * this is the copy the rest should be read against.
 */
export const LEAD_STATUSES = [
  'new', 'contacted', 'qualified', 'viewing', 'negotiation', 'converted', 'closed', 'lost',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

/** Qualified or deeper: a human decided this lead is real. */
export const QUALIFIED_STATUSES = new Set(['qualified', 'viewing', 'negotiation', 'converted', 'closed'])

/**
 * When an untouched lead becomes a NEGLECTED one: three days without contact.
 *
 * An internal working convention, not a client-facing SLA (the first-response
 * SLA is admin-configurable and separate). Three days is house judgment about
 * when a property lead has gone cold enough to chase — no platform or legal
 * constraint sets it. What IS a hard rule: the follow-up queue, the team
 * metrics rollup and the leader coach must all mean the same thing by
 * "overdue", which is why the number lives here and nowhere else. The coach
 * copy in lib/i18n/dictionaries/coach.ts says "three days" in prose — change
 * this and change those words with it.
 */
export const OVERDUE_FOLLOWUP_HOURS = 72

/**
 * Reached a viewing or deeper.
 *
 * The rung between "worth calling" and "sold", and the one a property team
 * actually plans its week around — a viewing is a Saturday morning and a car.
 * A subset of QUALIFIED_STATUSES by construction; the guard asserts it, so the
 * two can never drift into disagreeing about what a viewing lead is.
 */
export const VIEWING_STATUSES = new Set(['viewing', 'negotiation', 'converted', 'closed'])

/** The real objective event — money changed hands. */
export const WON_STATUSES = new Set(['converted', 'closed'])

/**
 * A value rating is the one-click human judgment, 0–10. Six and up is the
 * "buy more of this" zone the follow-up queue already uses, so a highly rated
 * lead counts as qualified even before its stage catches up — brokers rate
 * long before they move a card.
 */
export const VALUABLE_RATING = 6

/**
 * The other end of the same scale: at or below this, a broker said "stop
 * buying this". It lives here beside VALUABLE_RATING because the two bands are
 * one decision — a seed that admits 6+ and an exclusion that admits 0–2 must
 * never be able to drift into overlapping or leaving a silent gap.
 */
export const AVOID_RATING = 2

/**
 * THE HOUSE SCALE, as this team actually uses it — stated because the numbers
 * are not a generic 0–10 and code that treats them as evenly spaced gets the
 * seed wrong.
 *
 *   0–2   stop buying this            (AVOID_RATING — the exclusion list)
 *   3–5   neither                     (no audience, no event)
 *   6–7   good                        (VALUABLE_RATING — "above 5 is good")
 *   8–9   exactly the lead we want    (PERFECT_RATING)
 *   10    the broker is saying this one became a deal
 *
 * A ten is a claim about an OUTCOME, not a stronger opinion, and the seed
 * scores it on the closed rung for that reason (see seed-cohort.ts).
 *
 * It does NOT send Meta a Purchase event, and that asymmetry is deliberate: a
 * seed is reversible — worst case we copy the wrong people for a week — while
 * a Purchase event cannot be retracted at all, and a mistapped ten would teach
 * the account permanently that a sale happened. The irreversible claim waits
 * for the deal record; the reversible one can take the broker's word.
 */
export const PERFECT_RATING = 8
export const DEAL_RATING = 10

export type WriteBackStage = 'qualified' | 'won'

export interface WriteBackDecision {
  /** null when nothing should be sent. */
  stage: WriteBackStage | null
  /** Why, for the ledger and for anyone reading the logs later. */
  reason: 'status' | 'rating' | null
}

/**
 * Should Meta hear about this lead, and as what?
 *
 * Deliberately one-way and once-only per stage: a lead that moves forward
 * sends, a lead that moves BACKWARD sends nothing. Meta has no "un-qualify"
 * event, so a retraction is impossible — which makes a hasty send permanent
 * and means the bar is the human decision, never an automatic guess.
 */
export function writeBackFor(input: {
  status?: string | null
  valueRating?: number | null
  /** Stages already sent for this lead. */
  sent?: WriteBackStage[]
  /**
   * A deal for this lead reached its final approved/closed state. That IS
   * the won fact, wherever the CRM card happens to sit — deals close in the
   * deals screen while the lead's column lags days behind, and waiting for
   * someone to also drag the card would delay the one event Meta's
   * optimiser learns the most from.
   */
  dealClosed?: boolean
}): WriteBackDecision {
  const status = String(input.status ?? '').toLowerCase()
  const sent = new Set(input.sent ?? [])
  const rating = typeof input.valueRating === 'number' ? input.valueRating : null

  // Won outranks qualified: it is the event worth optimising towards, and a
  // lead that closed is qualified by definition.
  if ((WON_STATUSES.has(status) || input.dealClosed === true) && !sent.has('won')) {
    return { stage: 'won', reason: 'status' }
  }
  if (QUALIFIED_STATUSES.has(status) && !sent.has('qualified')) return { stage: 'qualified', reason: 'status' }
  if (rating !== null && rating >= VALUABLE_RATING && !sent.has('qualified')) {
    return { stage: 'qualified', reason: 'rating' }
  }
  return { stage: null, reason: null }
}

/**
 * The event id Meta deduplicates on. Deterministic, so a retry — or a second
 * server, or a replayed webhook — cannot count the same lead twice.
 */
export function writeBackEventId(leadId: string, stage: WriteBackStage): string {
  return `fh-${stage}-${leadId}`
}
