/**
 * RELEVANCE — does this attribute actually predict a buyer?
 *
 * The question behind every targeting argument in real estate is "are frequent
 * travellers worth targeting?", and it is normally answered by someone's
 * instinct. It is answerable. For any attribute we know about a lead —
 * industry, job title, city, workplace, researched interest — the funnel
 * already contains the experiment:
 *
 *      among our leads, do the ones WITH this attribute qualify or close
 *      more often than the ones without?
 *
 * That is a 2×2 table, and a 2×2 table has an exact test. No ad spend, no
 * waiting: it recomputes from the CRM every time it is read, which is what
 * makes it continuous rather than a study someone runs once and forgets.
 *
 * WHAT THIS DOES AND DOES NOT ESTABLISH — the honest boundary, because getting
 * it wrong here would be the same error this system keeps correcting:
 *
 *  · It DOES establish which kind of person converts once they are a lead.
 *    That is a real, causally-meaningful thing to know about your funnel and
 *    it is the right input to who you should try to reach.
 *  · It does NOT establish that targeting a Meta behaviour with a similar name
 *    will deliver those people. Meta's "Frequent Travellers" segment is Meta's
 *    inference, not our observation, and the only way to know whether it
 *    delivers is to run it as its own ad set and measure it. This module tells
 *    you what to go and test; `inventory-quality` tells you whether the test
 *    worked.
 *  · It is conditioned on already being a lead. An attribute that stops people
 *    ever filling the form is invisible here. Nothing in a CRM can see the
 *    people who never arrived.
 *
 * Stating that boundary is not a caveat to skip. A system that says "target
 * finance directors" from this data alone would be inventing the causal step.
 *
 * Pure — no I/O, no clock.
 */
import { lgamma, SIGNIFICANT_P } from '@/lib/freehold/inventory-quality'

/** One attribute's 2×2 table over the lead population. */
export interface AttributeCounts {
  /** Stable identity, e.g. 'company_industry:real estate'. */
  id: string
  /** What kind of fact this is, e.g. 'job_title'. */
  kind: string
  /** The value itself, e.g. 'finance director'. */
  value: string
  /** Leads WITH the attribute, and how many of them converted. */
  withTotal: number
  withWins: number
  /** Leads WITHOUT it, and how many of them converted. */
  withoutTotal: number
  withoutWins: number
}

/**
 * Below this many leads carrying the attribute, nothing is reported at all.
 *
 * The exact test already refuses to call a tiny sample significant, so this is
 * not about false positives — it is about not filling a screen with two
 * hundred one-lead attributes that will never say anything. An attribute has
 * to be common enough to be worth a decision before it earns a row.
 */
export const MIN_LEADS_WITH_ATTRIBUTE = 5

/**
 * Fisher's exact test, two-sided, on a 2×2 table.
 *
 * Exact rather than chi-squared because these tables are small and sparse by
 * nature — a 40-lead CRM with 6 finance directors is the normal case, and
 * chi-squared is unreliable exactly there.
 *
 * Two-sided by summing every table with the same margins whose probability is
 * no greater than the observed one. That is the standard construction, and it
 * matters: a one-sided p would let "this attribute is better" pass at half the
 * evidence, on an attribute chosen precisely because it looked better.
 *
 *      a = with & won      b = with & not
 *      c = without & won   d = without & not
 */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  if ([a, b, c, d].some((n) => !Number.isFinite(n) || n < 0)) return 1
  const r1 = a + b, r2 = c + d, c1 = a + c, c2 = b + d, n = r1 + r2
  if (n === 0 || r1 === 0 || r2 === 0 || c1 === 0 || c2 === 0) return 1

  // The constant part of the hypergeometric log-probability: margins are fixed.
  const K = lgamma(r1 + 1) + lgamma(r2 + 1) + lgamma(c1 + 1) + lgamma(c2 + 1) - lgamma(n + 1)
  const logP = (x: number) =>
    K - lgamma(x + 1) - lgamma(r1 - x + 1) - lgamma(c1 - x + 1) - lgamma(r2 - c1 + x + 1)

  const lo = Math.max(0, c1 - r2)
  const hi = Math.min(r1, c1)
  const observed = logP(a)
  // A hair of tolerance so a table that ties the observed probability in exact
  // arithmetic is not excluded by floating-point noise — excluding it would
  // understate the p-value, which is the dangerous direction.
  const tol = 1e-9
  let total = 0
  for (let x = lo; x <= hi; x++) {
    const lp = logP(x)
    if (lp <= observed + tol) total += Math.exp(lp)
  }
  return Math.min(1, total)
}

export type RelevanceVerdict =
  /** Converts significantly better than leads without it. */
  | 'relevant'
  /** Converts significantly worse — a signal to exclude, not to chase. */
  | 'counter'
  /** Enough leads to look at, not enough to decide. */
  | 'undecided'

export interface RelevanceSignal extends AttributeCounts {
  /** Conversion rate with the attribute, and without it. */
  rateWith: number
  rateWithout: number
  /** rateWith / rateWithout. Infinity when the base rate is zero. */
  lift: number
  p: number
  verdict: RelevanceVerdict
  /** How many more leads carrying this attribute would be needed before the
   *  CURRENT effect size could reach significance. Null once it already has,
   *  or when the effect is too small for any realistic sample. This is the
   *  number that turns "not yet" into a plan. */
  leadsNeeded: number | null
  sentence: string
}

const pctOf = (n: number) => `${(n * 100).toFixed(0)}%`

/**
 * How many more leads with this attribute would settle it?
 *
 * Scales the attribute's arm up, keeping its observed rate, until the exact
 * test crosses significance. Capped, because an answer of "4,000 more leads"
 * is not a plan and pretending otherwise is a hopeful arrow.
 *
 * Null therefore means one of two honest things: the rates are identical, or
 * no realistic number of further leads WITH the attribute would settle it —
 * which usually means the comparison group is the thin side, and no amount of
 * the attribute can fix that.
 */
export const LEADS_TO_DECIDE_CAP = 40

function leadsToDecide(s: AttributeCounts, cap = LEADS_TO_DECIDE_CAP): number | null {
  const rateWith = s.withTotal > 0 ? s.withWins / s.withTotal : 0
  const rateWithout = s.withoutTotal > 0 ? s.withoutWins / s.withoutTotal : 0
  if (rateWith === rateWithout) return null
  for (let extra = 1; extra <= cap; extra++) {
    const wt = s.withTotal + extra
    const ww = Math.round(rateWith * wt)
    if (fisherExact(ww, wt - ww, s.withoutWins, s.withoutTotal - s.withoutWins) < SIGNIFICANT_P) {
      return extra
    }
  }
  return null
}

export function assess(counts: AttributeCounts): RelevanceSignal {
  const rateWith = counts.withTotal > 0 ? counts.withWins / counts.withTotal : 0
  const rateWithout = counts.withoutTotal > 0 ? counts.withoutWins / counts.withoutTotal : 0
  const p = fisherExact(
    counts.withWins, counts.withTotal - counts.withWins,
    counts.withoutWins, counts.withoutTotal - counts.withoutWins,
  )
  const lift = rateWithout > 0 ? rateWith / rateWithout : (rateWith > 0 ? Infinity : 1)

  let verdict: RelevanceVerdict = 'undecided'
  if (p < SIGNIFICANT_P && rateWith > rateWithout) verdict = 'relevant'
  else if (p < SIGNIFICANT_P && rateWith < rateWithout) verdict = 'counter'

  const needed = verdict === 'undecided' ? leadsToDecide(counts) : null
  const shown = `${counts.value}`
  const sentence =
    verdict === 'relevant'
      ? `${shown}: ${pctOf(rateWith)} of these leads progress, against ${pctOf(rateWithout)} of everyone else (${counts.withTotal} leads, p=${p.toFixed(3)}). Worth testing as its own ad set.`
      : verdict === 'counter'
      ? `${shown}: ${pctOf(rateWith)} progress, against ${pctOf(rateWithout)} of everyone else (${counts.withTotal} leads, p=${p.toFixed(3)}). This attribute predicts a worse lead, not a better one.`
      : needed !== null
      ? `${shown}: ${pctOf(rateWith)} vs ${pctOf(rateWithout)} on ${counts.withTotal} leads — about ${needed} more would settle it.`
      : `${shown}: ${pctOf(rateWith)} vs ${pctOf(rateWithout)} on ${counts.withTotal} leads — more than ${LEADS_TO_DECIDE_CAP} further leads would be needed, so this one will not settle soon.`

  return { ...counts, rateWith, rateWithout, lift, p, verdict, leadsNeeded: needed, sentence }
}

export interface RelevanceReport {
  /** Every attribute common enough to be worth a row, most decisive first. */
  signals: RelevanceSignal[]
  relevant: RelevanceSignal[]
  counter: RelevanceSignal[]
  undecided: RelevanceSignal[]
  /** Attributes dropped for being too rare to say anything about, and how many. */
  tooRare: number
  headline: string
  /** What to do next, including the honest "nothing yet". */
  nextTest: string
}

/**
 * Rank every attribute by what it establishes.
 *
 * Sorted by p, not by lift: a 10× lift on six leads is a coin flip with a big
 * number attached, and putting it at the top of a screen is how a system
 * teaches an operator to trust noise.
 */
export function rankRelevance(rows: AttributeCounts[], minLeads = MIN_LEADS_WITH_ATTRIBUTE): RelevanceReport {
  const eligible = rows.filter((r) => r.withTotal >= minLeads && r.withoutTotal > 0)
  const tooRare = rows.length - eligible.length
  const signals = eligible.map(assess).sort((a, b) => a.p - b.p || b.withTotal - a.withTotal)

  const relevant = signals.filter((s) => s.verdict === 'relevant')
  const counter = signals.filter((s) => s.verdict === 'counter')
  const undecided = signals.filter((s) => s.verdict === 'undecided')

  const headline = signals.length === 0
    ? `No attribute appears on ${minLeads} or more leads yet — there is nothing to compare.`
    : relevant.length === 0 && counter.length === 0
    ? `${signals.length} attribute${signals.length === 1 ? '' : 's'} examined; none has separated from the rest of the funnel yet.`
    : `${relevant.length} attribute${relevant.length === 1 ? '' : 's'} predict a better lead, ${counter.length} predict a worse one, ${undecided.length} undecided.`

  // The single most useful next action: the strongest relevant attribute is
  // what to go and buy; failing that, the closest undecided one is what to
  // keep gathering leads on.
  const nextTest = relevant.length > 0
    ? `Build an ad set around "${relevant[0].value}" and measure it on impressions — this is a funnel observation, not proof that Meta can deliver those people.`
    : undecided.length > 0 && undecided[0].leadsNeeded !== null
    ? `Nothing is proven yet. "${undecided[0].value}" is closest — about ${undecided[0].leadsNeeded} more leads carrying it would settle it.`
    : 'Nothing is proven and nothing is close. Keep the current split running and let the funnel fill.'

  return { signals, relevant, counter, undecided, tooRare, headline, nextTest }
}

/**
 * Turn audience snapshots into one 2×2 table per value of a dimension.
 *
 * The same machinery serves every dimension of the registration event, because
 * they are all the same question — "did leads that arrived through X progress
 * more often than leads that did not":
 *
 *   behaviour  — the Meta segment we bought
 *   interest   — the Meta interest we bought
 *   placement  — the surface it was seen on
 *   creative   — the ad, and the copy it carried at that moment
 *
 * A lead counts toward every value its event carried. For placement and
 * creative that is exactly one, so those readings are clean. For behaviours
 * and interests it can be several, and that is the confounding to be honest
 * about: an ad set with three behaviours credits all three, so a strong
 * behaviour drags its bunk-mates up with it. That is why the recommendation
 * this feeds is always "test it as its own ad set", never "this behaviour
 * works". The confounding disappears once a behaviour has run alone, and it
 * shrinks as the same behaviour appears in varied company.
 */
export interface DimensionRow {
  ids: string[]
  names: string[]
  won: boolean
}

export type Dimension = 'behavior' | 'interest' | 'placement' | 'creative' | 'destination'

export function tablesFor(rows: DimensionRow[], kind: Dimension): AttributeCounts[] {
  const names = new Map<string, string>()
  for (const r of rows) r.ids.forEach((id, i) => { if (id && !names.has(id)) names.set(id, r.names[i] ?? id) })

  const out: AttributeCounts[] = []
  for (const [id, name] of names) {
    let withTotal = 0, withWins = 0, withoutTotal = 0, withoutWins = 0
    for (const r of rows) {
      // A row that carries NO value for this dimension is not evidence about
      // it — an instant-form lead has no placement, and counting it as
      // "without feed" would invent a comparison out of a missing field.
      if (r.ids.length === 0) continue
      if (r.ids.includes(id)) { withTotal++; if (r.won) withWins++ }
      else { withoutTotal++; if (r.won) withoutWins++ }
    }
    out.push({ id: `${kind}:${id}`, kind, value: name, withTotal, withWins, withoutTotal, withoutWins })
  }
  return out
}

/** Every dimension of the registration event, each ranked on its own. */
export interface EventRelevance {
  behavior: RelevanceReport
  interest: RelevanceReport
  placement: RelevanceReport
  creative: RelevanceReport
  /** Where the ad sent them. Usually the largest effect of the five, and the
   *  one nothing recorded until the snapshot started carrying it. */
  destination: RelevanceReport
}

export interface EventRow {
  behaviorIds: string[]; behaviorNames: string[]
  interestIds: string[]; interestNames: string[]
  placements: string[]
  creatives: string[]; creativeNames: string[]
  destinations: string[]
  won: boolean
}

export function assessEvents(rows: EventRow[], minLeads = MIN_LEADS_WITH_ATTRIBUTE): EventRelevance {
  const dim = (ids: (r: EventRow) => string[], names: (r: EventRow) => string[], kind: Dimension) =>
    rankRelevance(tablesFor(rows.map((r) => ({ ids: ids(r), names: names(r), won: r.won })), kind), minLeads)
  return {
    behavior: dim((r) => r.behaviorIds, (r) => r.behaviorNames, 'behavior'),
    interest: dim((r) => r.interestIds, (r) => r.interestNames, 'interest'),
    placement: dim((r) => r.placements, (r) => r.placements, 'placement'),
    creative: dim((r) => r.creatives, (r) => r.creativeNames, 'creative'),
    destination: dim((r) => r.destinations, (r) => r.destinations, 'destination'),
  }
}

/**
 * The unconfounded subset: leads whose ad set carried exactly ONE behaviour.
 * Far scarcer, and the reading to trust when it exists — this is the shape a
 * deliberate single-variable trial produces, so a machine that keeps rotating
 * solo behaviours slowly converts the confounded table into a clean one.
 */
export const soloBehaviourRows = (rows: EventRow[]): EventRow[] =>
  rows.filter((r) => r.behaviorIds.length === 1)
