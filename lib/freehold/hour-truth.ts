/**
 * WHEN THE GOOD LEADS ARRIVE — and whether a bad hour is a bad hour.
 *
 * Nothing in this product reads the clock. Not the machine, not the launcher,
 * not one report: every number is a total over thirty days, and an ad account
 * that spends the same at 03:00 as at 19:00 is leaving the easiest money on
 * the table there is. Meta and Google both accept an hourly schedule and this
 * product has never set one.
 *
 * ── BUT THE OBVIOUS VERSION OF THIS IS WRONG ─────────────────────────────
 *
 * "Leads at 3am never convert, so stop advertising at 3am" is the analysis
 * every dashboard does, and on a brokerage it is usually backwards. A lead that
 * arrives at 03:00 is not called at 03:00 — it waits until somebody opens their
 * laptop at 09:00, six hours cold, by which time the buyer has filled in three
 * other forms. The hour did not fail. The COVER failed, and switching the hour
 * off hides the evidence of it.
 *
 * So a block that converts badly is only called weak when its leads were
 * answered as quickly as everywhere else. When they were not, the verdict is
 * `unanswered` and it points at the rota, not at the ad schedule. That is the
 * difference between an optimiser and a tool that quietly shrinks your account
 * to the hours your team already covers.
 *
 * ── FOUR BLOCKS, NOT TWENTY-FOUR HOURS ───────────────────────────────────
 *
 * Twenty-four buckets over a month of property leads is two or three leads a
 * bucket, and nothing is ever significant — so the report would be noise
 * rendered as a chart, which is worse than no report. Four blocks give counts
 * that can actually separate, and they are the blocks a Dubai desk already
 * thinks in.
 *
 * Dubai time throughout (+04), stated because an hour report computed in UTC
 * is wrong by four hours and looks perfectly reasonable.
 *
 * Pure — no I/O, no clock (every timestamp is passed in). Runs in `pnpm guards`.
 */
import { samePace, SIGNIFICANT_P } from '@/lib/freehold/inventory-quality'

/** Walkable — each renders its own word. Ordered as the day runs. */
export const DAY_BLOCKS = ['night', 'morning', 'afternoon', 'evening'] as const
export type DayBlock = (typeof DAY_BLOCKS)[number]

/** Walkable — each renders its own word on the bar. */
export const HOUR_VERDICTS = ['strong', 'weak', 'unanswered', 'even', 'thin'] as const
export type HourVerdict = (typeof HOUR_VERDICTS)[number]

/**
 * The verdicts that carry a SENTENCE under the bar.
 *
 * 'even' does not: "this block is like the others" beside a bar that already
 * shows it is like the others is a line nobody reads, in three languages, that
 * still has to be translated and maintained. Same position the readiness strip
 * takes on its 'ok' rows.
 */
export const EXPLAINED_VERDICTS = HOUR_VERDICTS.filter((v) => v !== 'even')

/** Dubai is UTC+4 all year — no daylight saving to track. */
export const DUBAI_UTC_OFFSET_HOURS = 4

/**
 * The blocks, as [startHour, endHour) in Dubai time.
 *
 * Cut where a brokerage's day actually changes, not into equal quarters:
 * nobody is at a desk before 08:00, the working day breaks around 13:00, and
 * 18:00–24:00 is when people browse property from home — which on this account
 * is a different buyer, not the same buyer later.
 */
export const BLOCK_HOURS: Record<DayBlock, readonly [number, number]> = {
  night:     [0, 8],
  morning:   [8, 13],
  afternoon: [13, 18],
  evening:   [18, 24],
}

/**
 * Leads a block needs before it can be called anything.
 *
 * Twelve, because the comparison is a proportion — how many of this block's
 * leads qualified — and below about a dozen a single qualified lead moves the
 * rate by more than ten points. Under this the verdict is `thin`, which is a
 * statement about the evidence and not about the hours.
 */
export const MIN_LEADS_PER_BLOCK = 12

/**
 * How much slower a block's first response must be before its bad conversion
 * is blamed on the desk rather than on the hour.
 *
 * Twice the best block. Not 1.5x — some spread between blocks is normal and
 * meaningless, and a threshold that trips on normal spread would excuse every
 * genuinely bad hour as "nobody answered". At twice, the leads in that block
 * are waiting materially longer than the leads the same team handles
 * elsewhere, and that is a real difference in the cover.
 */
export const SLOW_RESPONSE_MULTIPLE = 2

/** One lead, reduced to the three things this module needs. */
export interface HourLead {
  /** When it arrived, ISO or ms — read in Dubai time. */
  createdAt: string | number
  /** Did it reach qualified or deeper? */
  qualified: boolean
  /** Minutes to the first broker response, or null if nobody ever answered. */
  responseMinutes: number | null
}

export interface BlockReading {
  block: DayBlock
  leads: number
  qualified: number
  /** Qualified per lead, 0–1. null with no leads. */
  rate: number | null
  /** Median minutes to first response among the leads anybody answered.
   *  null when nobody in this block was ever answered. */
  medianResponseMinutes: number | null
  /** How many of this block's leads nobody ever responded to. */
  neverAnswered: number
  verdict: HourVerdict
  /** The separation behind 'strong' or 'weak'. 1 when nothing separated. */
  p: number
}

const median = (xs: number[]): number | null => {
  const s = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (s.length === 0) return null
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Which block a moment falls in, in Dubai time. */
export function blockOf(when: string | number): DayBlock | null {
  const ms = typeof when === 'number' ? when : Date.parse(when)
  if (!Number.isFinite(ms)) return null
  // Shift into Dubai time, then read the hour off the UTC clock — no locale
  // parsing, no host timezone, same answer on any machine.
  const hour = new Date(ms + DUBAI_UTC_OFFSET_HOURS * 3_600_000).getUTCHours()
  for (const b of DAY_BLOCKS) {
    const [from, to] = BLOCK_HOURS[b]
    if (hour >= from && hour < to) return b
  }
  return null
}

/**
 * Read the day.
 *
 * Every block is compared against ALL THE OTHER BLOCKS COMBINED, not against
 * the best one. Against the best, three of four blocks are always "worse" and
 * the report says nothing; against the rest of the day, "worse than the rest of
 * the day" is a claim somebody can act on.
 */
export function readDay(leads: HourLead[]): BlockReading[] {
  const byBlock = new Map<DayBlock, HourLead[]>(DAY_BLOCKS.map((b) => [b, []]))
  for (const l of leads) {
    const b = blockOf(l.createdAt)
    if (b) (byBlock.get(b) as HourLead[]).push(l)
  }

  const raw = DAY_BLOCKS.map((block) => {
    const rows = byBlock.get(block) as HourLead[]
    const answered = rows.map((r) => r.responseMinutes).filter((n): n is number => n !== null)
    return {
      block,
      rows,
      leads: rows.length,
      qualified: rows.filter((r) => r.qualified).length,
      medianResponseMinutes: median(answered),
      neverAnswered: rows.length - answered.length,
    }
  })

  // The fastest block anybody actually answered in — the yardstick for whether
  // a slow block is slow because of the desk.
  const fastest = raw
    .map((r) => r.medianResponseMinutes)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b)[0] ?? null

  return raw.map(({ rows: _rows, ...r }): BlockReading => {
    // The lead rows are dropped here ON PURPOSE. `{ ...r }` used to carry them
    // into the reading, the route spreads the reading into its JSON, and the
    // browser would have received every lead's arrival time, qualified flag and
    // response delay — a per-person export nobody asked for, from a panel about
    // four bars. Counts leave this function; people do not.
    const rate = r.leads > 0 ? r.qualified / r.leads : null

    if (r.leads < MIN_LEADS_PER_BLOCK) {
      return { ...r, rate, verdict: 'thin', p: 1 }
    }

    // The rest of the day, combined.
    const others = raw.filter((o) => o.block !== r.block)
    const otherLeads = others.reduce((n, o) => n + o.leads, 0)
    const otherQualified = others.reduce((n, o) => n + o.qualified, 0)
    if (otherLeads < MIN_LEADS_PER_BLOCK) {
      return { ...r, rate, verdict: 'thin', p: 1 }
    }

    const p = samePace(r.qualified, r.leads, otherQualified, otherLeads)
    if (p >= SIGNIFICANT_P) return { ...r, rate, verdict: 'even', p }

    const better = r.qualified / r.leads > otherQualified / otherLeads
    if (better) return { ...r, rate, verdict: 'strong', p }

    // WORSE — but is it the hour or the cover? A block whose leads waited
    // twice as long as the best block's has not been given the same chance,
    // and switching the ads off would delete the evidence rather than the
    // problem. Nobody answering at all counts as the slowest possible answer.
    const slow =
      r.medianResponseMinutes === null
        ? r.neverAnswered > 0
        : fastest !== null && r.medianResponseMinutes >= fastest * SLOW_RESPONSE_MULTIPLE
    return { ...r, rate, verdict: slow ? 'unanswered' : 'weak', p }
  })
}

/**
 * The hours worth buying, as a schedule a launch can carry.
 *
 * Only blocks proven WEAK are dropped. Not 'unanswered' — that one is a rota
 * problem and the ads are the wrong lever — and not 'thin' or 'even', which
 * are the absence of a reason rather than a reason.
 *
 * Returns null when nothing is proven either way, and null must be rendered as
 * "run all day" rather than as an empty schedule: a launch that accidentally
 * received an empty list would buy no hours at all.
 */
export function scheduleFrom(readings: BlockReading[]): DayBlock[] | null {
  const drop = readings.filter((r) => r.verdict === 'weak').map((r) => r.block)
  if (drop.length === 0) return null
  const keep = DAY_BLOCKS.filter((b) => !drop.includes(b))
  // NEVER RETURN AN EMPTY DAY. If every block reads weak the comparison has
  // eaten itself — each was measured against the others — and the honest
  // answer is that there is no schedule to apply.
  return keep.length > 0 ? keep : null
}

/** The hour ranges a schedule covers, for the sentence and for the platform. */
export function hoursOf(blocks: DayBlock[]): Array<readonly [number, number]> {
  return blocks.map((b) => BLOCK_HOURS[b])
}
