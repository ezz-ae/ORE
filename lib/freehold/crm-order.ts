/**
 * WHAT ORDER THE LEAD LIST IS IN.
 *
 * "the lead now not showing newest as it should be."
 *
 * The CRM list had NO time ordering. It sorted by `intentScore` descending,
 * always, and the only alternative was a rank-by-value toggle. Newest-first
 * was never an option a person could choose.
 *
 * It used to look like arrival order by accident. `intentScore` was a
 * four-way lookup off `temperature` — 90 or 30 for nearly every row — so the
 * sort was one enormous tie, and `Array.prototype.sort` is stable, so rows
 * kept the order the API sent them in: `ORDER BY created_at DESC`. When the
 * score became a real forecast the ties disappeared, and with them the
 * arrival order nobody had ever actually written down.
 *
 * That is the whole failure: an ordering that was a side effect of a constant
 * cannot survive the constant becoming a measurement. So it is written down
 * here, as the default, and the sort is now a named choice on screen rather
 * than a boolean nobody can name.
 *
 * ── A ROW WITH NO ARRIVAL TIME SORTS LAST, NEVER FIRST ───────────────────
 *
 * Missing dates parse to NaN, and NaN in a comparator silently scrambles the
 * list — every comparison returns false, so the result is neither sorted nor
 * obviously broken. Unknown arrival is pushed to the end explicitly: a lead
 * we cannot date is not a lead that just came in.
 *
 * Pure. Runs in `pnpm guards`.
 */

/** Walkable — the sort options, in the order the control shows them. */
export const CRM_SORTS = ['newest', 'value', 'intent'] as const
export type CrmSort = (typeof CRM_SORTS)[number]

/** What the list is ordered by unless somebody says otherwise. A work queue
 *  is ordered by arrival; every other order is a question being asked of it. */
export const DEFAULT_CRM_SORT: CrmSort = 'newest'

export interface OrderableLead {
  createdAt?: string
  intentScore?: number
  valueRating?: number | null
}

/** Arrival instant, or null when the row carries no usable date. */
const arrived = (l: OrderableLead): number | null => {
  const ms = Date.parse(l.createdAt ?? '')
  return Number.isFinite(ms) ? ms : null
}

/** Newest first; undated last. Total, so it is also the tie-break for the
 *  other sorts — two leads rated the same are still read newest first. */
const byNewest = (a: OrderableLead, b: OrderableLead): number => {
  const x = arrived(a)
  const y = arrived(b)
  if (x === null && y === null) return 0
  if (x === null) return 1
  if (y === null) return -1
  return y - x
}

/** Rated leads before unrated: unknown is not the same fact as unqualified,
 *  so an unrated lead must not be presented as the worst one in the book. */
const RATED_LAST = 99

export function sortLeads<T extends OrderableLead>(leads: readonly T[], sort: CrmSort): T[] {
  const rows = [...leads]
  switch (sort) {
    case 'newest':
      return rows.sort(byNewest)
    case 'value':
      // WORST FIRST — the deliberate inversion. The bottom of the book is not
      // noise to hide; it is the set the ad machine must learn to stop buying.
      return rows.sort((a, b) => {
        const d = (a.valueRating ?? RATED_LAST) - (b.valueRating ?? RATED_LAST)
        return d !== 0 ? d : byNewest(a, b)
      })
    case 'intent':
      return rows.sort((a, b) => {
        const d = (b.intentScore ?? 0) - (a.intentScore ?? 0)
        return d !== 0 ? d : byNewest(a, b)
      })
  }
}
