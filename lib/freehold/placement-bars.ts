/**
 * THE PLACEMENT READ AS A PICTURE.
 *
 * The row already leads with the number its verdict is made on — leads per
 * million impressions. But eight rows of numbers still have to be read and
 * compared in somebody's head, and the whole point of this panel is one
 * comparison: which surfaces convert and which take money.
 *
 * A bar per surface makes a twenty-fold difference visible without reading
 * anything. Instagram feed at 2,129 against Facebook reels at 108 is a full
 * bar beside a stub; nobody has to divide.
 *
 * TWO HONESTY RULES, and they are the only reason this is a module rather than
 * a division in the render.
 *
 *  1. NO EVIDENCE IS NOT A ZERO. A surface with no impressions has no
 *     conversion rate, and drawing it as a zero-length bar in a row of long
 *     ones says "this one is terrible" about something nobody has tested. It
 *     gets no bar at all and says so.
 *
 *  2. ONE BAR IS NOT A COMPARISON. With a single measurable surface the scale
 *     is that surface, so it renders full-width and reads as excellent
 *     whatever its actual rate. A picture that flatters by construction is
 *     worse than no picture, so below two measurable surfaces there is no
 *     chart — the numbers stand alone.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

export interface BarInput {
  id: string
  /** Leads per million impressions. null when Meta reported none, which is
   *  NOT the same as zero and is never drawn as one. */
  lpm: number | null
  /** Impressions behind it. Zero means nothing was ever tested here. */
  impressions: number
}

export interface Bar {
  id: string
  /** 0–1 of the widest bar, or null when there is nothing to draw. */
  fill: number | null
  /** The value this bar stands on, carried so the label cannot drift from it. */
  lpm: number | null
}

/**
 * Impressions before a surface's conversion rate is worth drawing.
 *
 * One lead on forty impressions is 25,000 per million and would draw the
 * longest bar on the panel off a single accident. The panel's own verdicts
 * already run a significance test; this is the cruder floor that keeps the
 * PICTURE from making a claim the verdict would not.
 */
export const MIN_IMPRESSIONS_FOR_BAR = 500

/** At least this many measurable surfaces, or no chart at all. */
export const MIN_BARS_TO_COMPARE = 2

export const isMeasurable = (r: BarInput): boolean =>
  typeof r.lpm === 'number' && Number.isFinite(r.lpm) && r.impressions >= MIN_IMPRESSIONS_FOR_BAR

/**
 * Bars for a set of surfaces, scaled to the best MEASURABLE one.
 *
 * Returns every input in order — a surface that cannot be drawn still gets a
 * row with fill null, because dropping it would hide a placement that is
 * taking spend.
 */
export function barsFor(rows: BarInput[]): { bars: Bar[]; show: boolean; topLpm: number } {
  const measurable = rows.filter(isMeasurable)
  const topLpm = measurable.reduce((m, r) => Math.max(m, r.lpm as number), 0)
  const show = measurable.length >= MIN_BARS_TO_COMPARE && topLpm > 0

  return {
    show,
    topLpm,
    bars: rows.map((r) => ({
      id: r.id,
      lpm: r.lpm,
      // A measurable ZERO is a real zero — tested, and it converted nobody —
      // so it draws an empty bar. An UNMEASURABLE row draws none. Those are
      // different claims and the picture has to keep them apart.
      fill: show && isMeasurable(r) ? Math.min(1, (r.lpm as number) / topLpm) : null,
    })),
  }
}
