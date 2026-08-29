/**
 * THE RATING MOVES THE LEAD.
 *
 * This team rates and does not drag cards. That is not a failure of discipline
 * — rating is one click and moving a card through six columns is not — but it
 * left the status column frozen at 'new' across an entire account, and the
 * status column is what most of this product reads. The follow-up queue, the
 * team metrics, the money ladder and the campaign funnel all ask "what stage
 * is this lead at", get 'new', and report a business that has done nothing.
 *
 * So the two stop being separate acts. A broker who rates a lead 8 has said it
 * is worth pursuing, and that sentence already has a name in this product's
 * vocabulary: qualified. `writeBackFor` has been telling Meta exactly that,
 * on exactly this threshold, since the write-back shipped. The CRM simply
 * never agreed with it.
 *
 * ── WHAT A RATING MAY AND MAY NOT DO TO A STATUS ─────────────────────────
 *
 * FORWARD ONLY. A lead at 'negotiation' rated 7 does not fall back to
 * 'qualified'. The status records work that was done; a rating cannot undo it,
 * and a system that could would lose a viewing because somebody re-rated.
 *
 * NEVER PAST QUALIFIED. A rating says the lead is worth pursuing. It does not
 * say anyone has been to a viewing, opened a negotiation or closed. Those are
 * events, and inventing them would put fictional deals in the funnel — the
 * exact failure this codebase spends most of its guards preventing, arriving
 * this time through a helpful automation rather than a model.
 *
 * A LOW RATING CLOSES NOTHING. 0–2 is AVOID_RATING, and lead-stages.ts is
 * explicit that it means "stop buying this" — a verdict on the AUDIENCE, for
 * the exclusion list. It is not "this person will never buy". Marking a lead
 * lost is a decision about a human being that belongs to a human being, and a
 * broker who wants it has a status control. So a bad rating records itself,
 * counts as work, and moves nothing.
 *
 * THE MIDDLE SAYS NOTHING. 3–5 is "I cannot tell" (see `bandOf` in points.ts,
 * where the same band earns nothing precisely because it forecasts nothing).
 * A status change on the back of it would be a claim built from a shrug.
 *
 * ── AND THE OTHER DIRECTION ──────────────────────────────────────────────
 *
 * Moving a lead forward without rating it leaves the strongest signal in the
 * product unrecorded on exactly the leads that matter most — the ones somebody
 * thought were worth advancing. `needsRating` names that state so it can be
 * chased. It does NOT invent a rating from a status: a status is what was
 * done, a rating is what somebody thinks, and deriving one from the other
 * would manufacture a broker's opinion and then feed it to the ad machine as
 * if a person had given it.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import { VALUABLE_RATING, LEAD_STATUSES, type LeadStatus } from '@/lib/freehold/lead-stages'

/**
 * The progress ladder, in order.
 *
 * `lost` is deliberately absent: it is terminal and NEGATIVE, not the far end
 * of progress. Ranking it highest — which `LEAD_STATUSES` order would — would
 * make a lost lead immune to every forward move and, worse, read as further
 * along than a closed one.
 */
export const FUNNEL_ORDER = [
  'new', 'contacted', 'qualified', 'viewing', 'negotiation', 'converted', 'closed',
] as const
export type FunnelStatus = (typeof FUNNEL_ORDER)[number]

/** Terminal and off the ladder. Nothing automatic reopens or advances it. */
export const TERMINAL_STATUSES = ['lost'] as const

/** How far along, or -1 for a status that is not on the ladder at all. */
export const rankOf = (status: string | null | undefined): number =>
  (FUNNEL_ORDER as readonly string[]).indexOf(String(status ?? '').toLowerCase())

/** The furthest a rating alone may take a lead. See the header. */
export const RATING_STATUS_CEILING: FunnelStatus = 'qualified'

/**
 * The status this rating implies, or null to leave the lead where it is.
 *
 * Returns null — not the current status — so a caller can tell "no change" from
 * "write this again", and never writes a status update that changes nothing.
 */
export function statusForRating(
  rating: number | null | undefined,
  currentStatus: string | null | undefined,
): FunnelStatus | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null
  // Below the band that means "worth pursuing", nothing is claimed.
  if (rating < VALUABLE_RATING) return null

  const current = String(currentStatus ?? '').toLowerCase()
  // A lead somebody marked lost is not quietly reopened by a rating.
  if ((TERMINAL_STATUSES as readonly string[]).includes(current)) return null

  const here = rankOf(current)
  const ceiling = rankOf(RATING_STATUS_CEILING)
  // Unknown status: leave it alone rather than guess where it sits.
  if (here < 0) return null
  // Already at or past what a rating can assert — forward only.
  if (here >= ceiling) return null
  return RATING_STATUS_CEILING
}

/**
 * Has this lead been advanced without anybody saying what it is worth?
 *
 * True only at qualified-or-deeper: somebody thought it was worth moving on,
 * which is exactly when their opinion is worth the most and when its absence
 * costs the ad machine the most.
 */
export function needsRating(
  status: string | null | undefined,
  rating: number | null | undefined,
): boolean {
  if (typeof rating === 'number' && Number.isFinite(rating)) return false
  const here = rankOf(status)
  return here >= rankOf(RATING_STATUS_CEILING)
}

/** Every status is either on the ladder or explicitly terminal — no orphans. */
export const STATUSES_ACCOUNTED_FOR = LEAD_STATUSES.every(
  (s: LeadStatus) =>
    (FUNNEL_ORDER as readonly string[]).includes(s)
    || (TERMINAL_STATUSES as readonly string[]).includes(s),
)
