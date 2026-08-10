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

/** The real objective event — money changed hands. */
export const WON_STATUSES = new Set(['converted', 'closed'])

/**
 * A value rating is the one-click human judgment, 0–10. Six and up is the
 * "buy more of this" zone the follow-up queue already uses, so a highly rated
 * lead counts as qualified even before its stage catches up — brokers rate
 * long before they move a card.
 */
export const VALUABLE_RATING = 6

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
}): WriteBackDecision {
  const status = String(input.status ?? '').toLowerCase()
  const sent = new Set(input.sent ?? [])
  const rating = typeof input.valueRating === 'number' ? input.valueRating : null

  // Won outranks qualified: it is the event worth optimising towards, and a
  // lead that closed is qualified by definition.
  if (WON_STATUSES.has(status) && !sent.has('won')) return { stage: 'won', reason: 'status' }
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
