/**
 * WHAT A BROKER SEES FIRST, AND WHAT THEY DO NOT SEE AT ALL.
 *
 * The complaint this answers is "these leads are a waste of money". The
 * tempting fix is to filter by who the lead appears to be. That fix is illegal
 * in housing, and it does not even work: a guess at someone's background from
 * their name is wrong constantly, and it deletes good buyers while keeping
 * broke ones. It also removes the evidence without removing the cost — the
 * lead was still paid for.
 *
 * What is actually true about a lead, and already recorded here:
 *
 *   · a human rated it 0-10 after speaking to them (`valueRating`)
 *   · the phone number cannot be dialled (`wrongNumberRisk`)
 *   · it is the same person as another lead (`duplicateRisk`)
 *   · someone archived or blocked it
 *
 * Those are judgments about the LEAD. They rank honestly, they improve as more
 * leads are rated, and the relevance engine can learn from them — which is the
 * part that eventually stops the spend that produced them. A nationality guess
 * teaches the machine nothing, because it is not a fact anyone recorded.
 *
 * NOTHING IS DELETED. Set-aside leads keep their place in a second list with a
 * count and a reason. A broker who disagrees can open it and call them. A
 * queue that silently drops rows is the same lie as a lead list capped at 200
 * beside a counter reading 443.
 *
 * Pure — no database, no clock beyond what the caller passes. Runs in
 * `pnpm guards`.
 */

/** The floor at or below which a rated lead leaves the working queue. Matches
 *  the "avoid" threshold campaign-quality.ts already scores against, so a lead
 *  the broker set aside and a lead the machine counts against a campaign are
 *  the same lead. Two different numbers here would be two different opinions
 *  wearing one word. */
export const SET_ASIDE_AT_OR_BELOW = 2

/** The rating at or above which a lead is worth calling before an unrated one.
 *  Also campaign-quality.ts's "valuable" line. */
export const STRONG_AT_OR_ABOVE = 6

export type SetAsideReason = 'rated_poor' | 'archived' | 'blocked' | 'undialable' | 'duplicate'

export interface QueueLead {
  leadId: string
  /** 0-10 from a human who spoke to them. Null means NOT YET RATED, which is
   *  unknown — never the same as bad. */
  valueRating: number | null
  archived?: boolean
  blocked?: boolean
  wrongNumberRisk?: boolean
  duplicateRisk?: boolean
  /** Minutes past the response promise, or null when nothing is breached. */
  slaBreachMinutes: number | null
  overdueHours: number
}

export interface Triaged<T> {
  /** In call order. */
  queue: T[]
  /** Out of the way, not gone. Each carries why. */
  setAside: Array<{ lead: T; reason: SetAsideReason }>
}

/**
 * Why a lead should not be in the working queue — or null when it belongs.
 *
 * Ordered by how certain the reason is. "Blocked" is a decision someone made;
 * "duplicate" is an inference, and it is deliberately LAST and deliberately
 * not on its own enough — a duplicate that a human rated well is still the
 * best version of that person to call.
 */
export function setAsideReason(l: QueueLead): SetAsideReason | null {
  // A BREACHED PROMISE OUTRANKS EVERY QUALITY JUDGMENT. Someone was told they
  // would hear back. Hiding that because the lead scores poorly is how an
  // account learns to distrust its own queue, and the breach is a fact about
  // US, not about them.
  if (l.slaBreachMinutes !== null) return null

  if (l.blocked) return 'blocked'
  if (l.archived) return 'archived'
  if (l.valueRating !== null && l.valueRating <= SET_ASIDE_AT_OR_BELOW) return 'rated_poor'
  // Undialable only sets aside when nobody has rated it well. A 9/10 lead with
  // a mistyped number is a data-entry problem, not a bad lead.
  if (l.wrongNumberRisk && (l.valueRating === null || l.valueRating < STRONG_AT_OR_ABOVE)) return 'undialable'
  return null
}

/**
 * Call order.
 *
 *  1. SLA breaches, worst first. A promise is a promise.
 *  2. Then by what is known about the lead:
 *       rated strong  →  unrated  →  rated middling
 *     UNRATED SITS IN THE MIDDLE, and that is the whole judgment call here.
 *     Sorting unrated last buries every new lead behind every old rated one,
 *     and new leads are the ones with a response clock running. Sorting them
 *     first ignores the rating entirely. The middle is the only position that
 *     treats "unknown" as unknown.
 *  3. Then by how overdue, worst first — the existing behaviour, kept.
 */
const band = (r: number | null): number =>
  r === null ? 1 : r >= STRONG_AT_OR_ABOVE ? 0 : 2

export function callOrder(a: QueueLead, b: QueueLead): number {
  const breach = (b.slaBreachMinutes ?? -1) - (a.slaBreachMinutes ?? -1)
  if (breach !== 0) return breach
  const byBand = band(a.valueRating) - band(b.valueRating)
  if (byBand !== 0) return byBand
  // Within a band a higher rating still wins, so 9 beats 6 and 5 beats 3.
  const byRating = (b.valueRating ?? -1) - (a.valueRating ?? -1)
  if (byRating !== 0 && a.valueRating !== null && b.valueRating !== null) return byRating
  return b.overdueHours - a.overdueHours
}

/** Split a queue into what to call and what to leave, then order both. */
export function triage<T extends QueueLead>(leads: T[]): Triaged<T> {
  const queue: T[] = []
  const setAside: Array<{ lead: T; reason: SetAsideReason }> = []
  for (const l of leads) {
    const reason = setAsideReason(l)
    if (reason) setAside.push({ lead: l, reason })
    else queue.push(l)
  }
  queue.sort(callOrder)
  setAside.sort((x, y) => callOrder(x.lead, y.lead))
  return { queue, setAside }
}
