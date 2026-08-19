/**
 * FIFTY GOOD LEADS — a promise with a number, and one number both sides read.
 *
 * The client said: nothing is invoiced until fifty good leads have landed. That
 * sentence is a commercial obligation and it has exactly one dangerous word in
 * it. "Good" is not a fact until somebody writes down which test it passes, and
 * until then every count is arguable — which means the work can be delivered in
 * full and still not be paid for.
 *
 * So this module does not decide what good means. It counts all three tests
 * this system already holds, side by side, always:
 *
 *   contactable  a phone somebody can dial or an email somebody can write to.
 *                The floor. A lead failing this was never a lead.
 *   qualified    a broker moved it to qualified / viewing / negotiation /
 *                converted / closed. A statement about the PIPELINE.
 *   valuable     a broker rated it >= VALUABLE_RATING (6) on the house scale.
 *                A statement about the PERSON, made before anybody knew it
 *                would decide an invoice.
 *
 * Showing all three is the point. Pick one and the other side disputes it;
 * show three and the conversation is about which line to read, not about
 * whether the number is honest. `valuable` is the recommended bar and it is
 * still only a default — see `RECOMMENDED_BAR`.
 *
 * ── THE PROJECTION IS THE PART THAT LIES ─────────────────────────────────
 *
 * "You need AED 5,000 more to finish" is the most useful sentence here and the
 * easiest to get catastrophically wrong. It is a division by the good RATE,
 * and a rate measured on two leads is not a rate. This account has already
 * paid for that mistake once: a campaign read AED 168 per lead and over
 * AED 8,000 per lead worth calling, because the cheap number was measured and
 * the expensive one was not.
 *
 * So the forecast is EVIDENCE-GATED like every other number in this product
 * (min-evidence.ts): below MIN_ATTRIBUTED_FOR_QUALITY rated leads it is
 * withheld outright, and above it, it is a RANGE whose upper bound faces the
 * decision. A budget set from the optimistic end of a wide range is how
 * somebody promises a delivery date they cannot make.
 *
 * Pure — no database, no network, no clock. Runs in `pnpm guards`.
 */
import { VALUABLE_RATING, QUALIFIED_STATUSES } from '@/lib/freehold/lead-stages'
import { countBounds, MIN_ATTRIBUTED_FOR_QUALITY } from '@/lib/freehold/min-evidence'

/** Walkable — the three tests, floor first. Each renders its own word. */
export const DELIVERY_BARS = ['contactable', 'qualified', 'valuable'] as const
export type DeliveryBar = (typeof DELIVERY_BARS)[number]

/**
 * The bar this product recommends putting in the contract.
 *
 * A rating is a judgement about the PERSON made by the broker who called them,
 * usually before anybody knew it would decide an invoice. `qualified` moves
 * with pipeline hygiene — a lead nobody updated reads as junk — and
 * `contactable` is satisfied by anyone who typed a real phone number, which is
 * most of the junk this account has already paid for.
 */
export const RECOMMENDED_BAR: DeliveryBar = 'valuable'

/** One lead, in the only terms this count needs. */
export interface CountableLead {
  phone: string | null
  email: string | null
  status: string | null
  /** 0–10, or null when nobody has rated it yet. */
  valueRating: number | null
  /** False for a lead somebody archived or blocked — it delivers nothing. */
  archived?: boolean
  blocked?: boolean
}

/** Dialable: seven digits is the shortest real number anywhere. */
export const isContactable = (l: CountableLead): boolean => {
  const digits = (l.phone ?? '').replace(/\D/g, '')
  const email = (l.email ?? '').trim()
  return digits.length >= 7 || (email.includes('@') && email.length > 3)
}

export const isQualified = (l: CountableLead): boolean =>
  QUALIFIED_STATUSES.has(String(l.status ?? '').toLowerCase())

export const isValuable = (l: CountableLead): boolean =>
  typeof l.valueRating === 'number' && l.valueRating >= VALUABLE_RATING

/**
 * Does this lead pass this bar?
 *
 * An archived or blocked lead passes NOTHING, whatever else is true of it.
 * Somebody removed it on purpose, and counting it toward a delivery promise
 * would be invoicing for a lead this company has itself disowned.
 */
export function passes(lead: CountableLead, bar: DeliveryBar): boolean {
  if (lead.archived === true || lead.blocked === true) return false
  switch (bar) {
    case 'contactable': return isContactable(lead)
    case 'qualified':   return isQualified(lead)
    case 'valuable':    return isValuable(lead)
  }
}

export interface BarCount {
  bar: DeliveryBar
  met: number
  remaining: number
  /** 0–1, clamped. `met` beyond the target does not read as more than done. */
  fraction: number
  done: boolean
}

/** Every bar counted over the same leads, so the three can be read against each other. */
export function countAll(leads: readonly CountableLead[], target: number): BarCount[] {
  const t = Math.max(1, Math.floor(target))
  return DELIVERY_BARS.map((bar) => {
    const met = leads.reduce((n, l) => n + (passes(l, bar) ? 1 : 0), 0)
    return {
      bar,
      met,
      remaining: Math.max(0, t - met),
      fraction: Math.min(1, met / t),
      done: met >= t,
    }
  })
}

/**
 * HOW MANY LEADS ARE STILL UNRATED.
 *
 * Reported next to the `valuable` count and never folded into it. An unrated
 * lead is not a bad lead — it is a lead nobody has looked at, and the two are
 * opposite facts. This account has 247 leads and a rating loop that does
 * nothing while they sit untouched: if the bar is `valuable`, every unrated
 * lead is delivery already paid for and not yet claimed.
 */
export const unratedCount = (leads: readonly CountableLead[]): number =>
  leads.reduce((n, l) => n + (
    l.archived === true || l.blocked === true ? 0 : l.valueRating == null ? 1 : 0
  ), 0)

/**
 * Walkable — every reason a forecast can refuse to answer.
 *
 * A union rather than inline strings so the screen's sentences can be walked
 * from it by `dynamic-keys-test`: a refusal added here and not translated
 * would render as its own key on the one screen that decides whether this
 * account gets paid.
 */
export const FORECAST_REFUSALS = ['done', 'tooFewRated', 'noSpend', 'noneGood'] as const
export type ForecastRefusal = (typeof FORECAST_REFUSALS)[number]

/** What finishing the promise is likely to cost, or an honest refusal to say. */
export type Forecast =
  | { known: false; reason: ForecastRefusal }
  | {
      known: true
      /** Leads still needed at this bar. */
      remaining: number
      /** Credible range of the good rate, 0–1. */
      rate: { lo: number; hi: number }
      /** Leads that must be BOUGHT to net `remaining` good ones. */
      leadsNeeded: { lo: number; hi: number }
      /** Spend to finish. `hi` is the number a budget is set from. */
      spendAed: { lo: number; hi: number }
    }

/**
 * What the rest of the promise costs.
 *
 * Built from the campaign's OWN measured good rate and its OWN cost per lead —
 * never from a target CPL somebody typed, which is a wish rather than a
 * measurement.
 *
 * Refuses to answer in four cases, each named so a screen can say which:
 *
 *   done          the bar is already met. Nothing to forecast.
 *   tooFewRated   below MIN_ATTRIBUTED_FOR_QUALITY judged leads. A good rate
 *                 measured on two leads is a coin flip wearing a percentage.
 *   noSpend       no money spent, so there is no cost per lead to divide by.
 *   noneGood      judged enough and NONE passed. The honest answer is not a
 *                 huge number — it is that this campaign has not shown it can
 *                 produce a good lead at any price, and the fix is the
 *                 targeting or the form, not the budget.
 */
export function forecast(input: {
  bar: DeliveryBar
  target: number
  /** Leads that pass the bar so far. */
  met: number
  /**
   * Leads the bar has actually been APPLIED to. For `valuable` that is the
   * RATED ones — an unrated lead has not failed, it has not been judged, and
   * counting it as a failure makes the rate read far worse than it is.
   */
  judged: number
  /** Total leads bought, judged or not — what the money actually purchased. */
  leadsBought: number
  spentAed: number
}): Forecast {
  const target = Math.max(1, Math.floor(input.target))
  const remaining = target - input.met
  if (remaining <= 0) return { known: false, reason: 'done' }
  if (input.judged < MIN_ATTRIBUTED_FOR_QUALITY) return { known: false, reason: 'tooFewRated' }
  if (!(input.spentAed > 0) || !(input.leadsBought > 0)) return { known: false, reason: 'noSpend' }
  if (input.met <= 0) return { known: false, reason: 'noneGood' }

  // The good rate, as a range rather than a point. Same Poisson bounds every
  // other count in this product is reported through.
  const b = countBounds(input.met)
  const rate = {
    lo: Math.min(1, b.lo / input.judged),
    hi: Math.min(1, b.hi / input.judged),
  }
  // Inverted: a LOW rate means MANY leads needed, so the bounds swap.
  const leadsNeeded = {
    lo: rate.hi > 0 ? Math.ceil(remaining / rate.hi) : Infinity,
    hi: rate.lo > 0 ? Math.ceil(remaining / rate.lo) : Infinity,
  }
  const cpl = input.spentAed / input.leadsBought
  return {
    known: true,
    remaining,
    rate,
    leadsNeeded,
    spendAed: {
      lo: Math.round(leadsNeeded.lo * cpl),
      hi: Number.isFinite(leadsNeeded.hi) ? Math.round(leadsNeeded.hi * cpl) : Infinity,
    },
  }
}

/**
 * IS THIS CAMPAIGN CAPABLE OF FINISHING THE PROMISE?
 *
 * The question the forecast cannot answer on its own. A campaign whose good
 * rate is 2% does not need a bigger budget, it needs a different audience or a
 * different form — and a forecast that quietly returns "AED 400,000" invites
 * somebody to read it as a plan rather than as a refusal.
 *
 * The threshold is deliberately generous. This is not a performance target, it
 * is the line below which MORE MONEY IS THE WRONG ANSWER.
 */
export const HOPELESS_RATE = 0.05

export const isHopeless = (f: Forecast): boolean =>
  f.known === true && f.rate.hi < HOPELESS_RATE
