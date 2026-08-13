/**
 * THE ACCOUNT'S OWN SALES CYCLE AND MEDIAN DEAL — read once, used by every
 * money judgement.
 *
 * money-truth.ts is pure and ships with defaults (six weeks to close, one week
 * to qualify). Defaults are a guess about Dubai off-plan, and a guess is the
 * wrong thing to condemn a campaign with when the account has its own history
 * sitting in the CRM. This is that read.
 *
 * ── WHAT `updated_at` HONESTLY IS ───────────────────────────────────────
 *
 * There is no status-change history on freehold_site_leads: the closest thing
 * to "when did this close" is `updated_at` on a lead whose status is now
 * closed. That is an APPROXIMATION and it errs long — any later edit to the
 * row pushes it forward — so a cycle measured this way is, if anything, more
 * patient than the truth.
 *
 * That is the safe direction and it is the reason this is acceptable at all.
 * Too long means a campaign is judged on leads for longer than strictly
 * necessary, which costs some budget. Too short means a campaign is condemned
 * for not closing a deal it was never given time to close, which kills the
 * winner. When a real status history exists, point this at it.
 *
 * Fail-soft: an unreadable CRM returns the defaults, never throws. A machine
 * cycle must not die because a column is missing.
 */
import { query } from '@/lib/db'
import { WON_STATUSES, QUALIFIED_STATUSES } from '@/lib/freehold/lead-stages'
import { cycleFromHistory, medianDeal, DEFAULT_CYCLE, type SalesCycle } from '@/lib/freehold/money-truth'

/**
 * How far back to look for the cycle.
 *
 * A year, because a median needs a real number of closed deals and property
 * cycles are long. Not "all time": a brokerage that changed inventory two years
 * ago should not be pacing today's campaigns on how a different product sold.
 */
export const CYCLE_LOOKBACK_DAYS = 365

export interface AccountMoneyBasis {
  cycle: SalesCycle
  /** The median closed deal in AED, or null below the floor for a median. */
  medianDealAed: number | null
  /** How many closed deals the median stands on — so a screen can say. */
  closedDeals: number
}

export const DEFAULT_BASIS: AccountMoneyBasis = {
  cycle: DEFAULT_CYCLE, medianDealAed: null, closedDeals: 0,
}

export async function accountMoneyBasis(): Promise<AccountMoneyBasis> {
  type Row = {
    status: string | null
    created_at: string | null
    updated_at: string | null
    deal_value_aed: string | number | null
  }
  let rows: Row[] = []
  try {
    rows = await query<Row>(
      `SELECT status, created_at, updated_at, deal_value_aed
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND created_at > now() - ($1 || ' days')::interval`,
      [String(CYCLE_LOOKBACK_DAYS)],
    )
  } catch {
    // deal_value_aed is created lazily by the deals feature. Ensure and retry
    // once with the REAL data before giving up on the account's own history.
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS deal_value_aed numeric`).catch(() => undefined)
    try {
      rows = await query<Row>(
        `SELECT status, created_at, updated_at, deal_value_aed
           FROM freehold_site_leads
          WHERE archived IS NOT TRUE
            AND created_at > now() - ($1 || ' days')::interval`,
        [String(CYCLE_LOOKBACK_DAYS)],
      )
    } catch { return DEFAULT_BASIS }
  }

  const days = (from: string | null, to: string | null): number | null => {
    if (!from || !to) return null
    const a = Date.parse(from), b = Date.parse(to)
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
    return (b - a) / 86_400_000
  }

  const samples = rows.map((r) => {
    const s = r.status ?? ''
    const elapsed = days(r.created_at, r.updated_at)
    return {
      // A lead that reached qualified-or-deeper took at most this long to do
      // it; one that never did contributes nothing rather than a zero.
      daysToQualify: QUALIFIED_STATUSES.has(s) ? elapsed : null,
      daysToClose: WON_STATUSES.has(s) ? elapsed : null,
    }
  })

  const values = rows
    .filter((r) => WON_STATUSES.has(r.status ?? ''))
    .map((r) => Number(r.deal_value_aed ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0)

  return {
    cycle: cycleFromHistory(samples),
    medianDealAed: medianDeal(values),
    closedDeals: values.length,
  }
}
