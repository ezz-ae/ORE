/**
 * WHICH DESIGN WON — and whether there was a race at all.
 *
 * The designs panel crowned a winner like this:
 *
 *   best = ads.filter(a => a.leads > 0).sort(by cpl)[0]
 *
 * Any ad with a single lead takes the badge, whatever the others were given a
 * chance to do. On a live campaign that produced:
 *
 *   cashoffer            WINNER   25 leads   CPL 106   spend AED 2,650
 *   cashoffer creative 1           0 leads   CPL —     spend AED 84
 *   cashoffer creative 2           0 leads   CPL —     spend AED 26
 *
 * A lead on this campaign costs about AED 106. Creative 2 was given AED 26 —
 * a quarter of one lead's worth of budget. It did not lose; it never ran.
 * Creative 1, at AED 84, had not yet bought its first lead's worth either.
 *
 * WHY THIS IS EXPENSIVE AND NOT COSMETIC. The panel's own subtitle says the
 * budget moves to the winner by itself, and it offers a Pause button on every
 * row. So the badge is an invitation to switch off two designs on the strength
 * of a comparison that never happened — and the one thing that could have told
 * this campaign something new dies at AED 26 having proven nothing.
 *
 * THE RULE. A design is a CONTENDER once it has spent at least what a lead
 * costs on this campaign. Below that it is TOO EARLY, never losing. And a
 * winner needs somebody to have beaten: with one contender there is no race,
 * so there is no badge — the same reason a single bar is not a comparison in
 * placement-bars.ts.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */

/** Walkable — each renders its own word. */
export const DESIGN_STANDINGS = ['winner', 'contender', 'tooEarly', 'noLeads'] as const
export type DesignStanding = (typeof DESIGN_STANDINGS)[number]

/**
 * A design must have spent this multiple of one lead's price before it can be
 * judged at all.
 *
 * One lead's worth is the floor a person would accept as "it had a go": below
 * it, zero leads is the arithmetic outcome of the budget rather than a verdict
 * on the creative. Not higher, because a design that has spent two leads'
 * worth with nothing to show genuinely is losing and should be sayable.
 */
export const FAIR_CHANCE_MULTIPLE = 1

/** A race needs somebody to beat. */
export const MIN_CONTENDERS = 2

export interface DesignRow {
  id: string
  leads: number
  spendAed: number
  /** Cost per lead, when it has produced one. */
  cpl: number | null
}

export interface DesignStandingRow {
  id: string
  standing: DesignStanding
  /** What one lead costs here, for the sentence that explains "too early". */
  leadPriceAed: number | null
  /** How much more this design needs to spend before it can be judged. */
  shortfallAed: number
}

/**
 * What a lead costs on this campaign.
 *
 * From the designs that HAVE produced one — total spend over total leads
 * across them, rather than the best design's CPL alone. Using the winner's own
 * price would set the bar by the cheapest performer and call everything else
 * unproven for longer than is fair.
 *
 * null when nothing has converted anywhere: then no design can be called too
 * early OR losing, because there is no price to measure a fair chance against.
 */
export function leadPriceOf(rows: DesignRow[]): number | null {
  const withLeads = rows.filter((r) => r.leads > 0)
  if (withLeads.length === 0) return null
  const spend = withLeads.reduce((n, r) => n + r.spendAed, 0)
  const leads = withLeads.reduce((n, r) => n + r.leads, 0)
  return leads > 0 && spend > 0 ? spend / leads : null
}

/**
 * The standings, and the winner when there is one.
 *
 * `winnerId` is null whenever the comparison would be unearned — nothing has
 * converted, or only one design was ever given enough budget to convert. The
 * badge is the loudest thing on the panel and it must not be the least
 * evidenced.
 */
export function standingsOf(rows: DesignRow[]): {
  standings: DesignStandingRow[]
  winnerId: string | null
  leadPriceAed: number | null
  contenders: number
} {
  const leadPriceAed = leadPriceOf(rows)

  const hadAChance = (r: DesignRow): boolean =>
    leadPriceAed !== null && r.spendAed >= leadPriceAed * FAIR_CHANCE_MULTIPLE

  // A design with leads has self-evidently had its chance, whatever it spent.
  const contenderRows = rows.filter((r) => r.leads > 0 || hadAChance(r))
  const contenders = contenderRows.length

  // Cheapest lead wins, among designs that actually produced one.
  const best = contenderRows
    .filter((r) => r.leads > 0 && r.cpl !== null)
    .sort((a, b) => (a.cpl as number) - (b.cpl as number))[0]

  const winnerId = contenders >= MIN_CONTENDERS && best ? best.id : null

  return {
    winnerId,
    leadPriceAed,
    contenders,
    standings: rows.map((r): DesignStandingRow => {
      const shortfall = leadPriceAed !== null
        ? Math.max(0, leadPriceAed * FAIR_CHANCE_MULTIPLE - r.spendAed)
        : 0
      const standing: DesignStanding =
        r.id === winnerId ? 'winner'
          // TOO EARLY IS THE DEFAULT FOR THE UNPROVEN. A design that has not
          // spent one lead's worth has not lost — and neither has anything,
          // when nothing anywhere has converted and there is no price to
          // measure against.
          : leadPriceAed === null || (r.leads === 0 && !hadAChance(r)) ? 'tooEarly'
          : r.leads === 0 ? 'noLeads'
          : 'contender'
      return { id: r.id, standing, leadPriceAed, shortfallAed: Math.round(shortfall) }
    }),
  }
}
