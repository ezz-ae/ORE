/**
 * WHAT PEOPLE ACTUALLY TYPED — the loop that makes Search run itself.
 *
 * Google reports every real query that triggered an ad. This product has been
 * querying `search_term_view` since the Google client was written and doing
 * exactly one thing with it: printing it in a table.
 *
 * That report is the whole reason Search can be automated where Meta cannot.
 * There is no creative judgement in it. A query either brought a lead at a
 * price this company can pay, or it took money and brought nothing, and both
 * of those are arithmetic. Every day the account tells you which phrases to
 * buy next and which to stop paying for, and every day nobody reads it.
 *
 * THE TWO ACTIONS ARE NOT EQUALLY RISKY, and this module treats them
 * differently on purpose.
 *
 *   A NEGATIVE only ever STOPS spend. The worst case is that a query which
 *   might have converted later stops showing — bounded, visible, reversible in
 *   one click. This is safe to apply on a schedule.
 *
 *   A NEW KEYWORD STARTS spend, on a term whose future performance is a
 *   forecast rather than a measurement. It is proposed and waits for a person.
 *
 * That asymmetry is the honest shape of an autonomous Search account. A tool
 * that automates both equally is not braver, it is just spending somebody
 * else's money on a guess.
 *
 * WHAT IS NEVER NEGATIVED, whatever the arithmetic says:
 *
 *   · Anything containing a project or developer name this company sells. A
 *     brand query with no conversion yet is still the best traffic in the
 *     account, and blocking it hands the name to whoever bids next.
 *   · A term Google already marked ADDED or EXCLUDED. It is somebody's
 *     decision, and re-deciding it every night is how a machine becomes a
 *     thing people switch off.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */

/** Walkable — each renders its own sentence. */
export const HARVEST_VERDICTS = ['addKeyword', 'addNegative', 'watch', 'settled', 'protected'] as const
export type HarvestVerdict = (typeof HARVEST_VERDICTS)[number]

/**
 * Clicks before a zero-conversion term can be called a waste.
 *
 * A term with three clicks and no lead is ordinary variance, not evidence. The
 * cost rule below usually fires first on expensive traffic; this one catches
 * the cheap query that quietly bleeds a hundred clicks a month.
 */
export const MIN_CLICKS_TO_NEGATIVE = 15

/**
 * Wasted spend, as a multiple of what one lead is worth to this account.
 *
 * At 1× a term that cost exactly one lead's budget and returned none would be
 * cut, and that happens constantly to perfectly good queries. At 2× the
 * account has spent two leads' worth and received nothing, which is no longer
 * variance.
 */
export const WASTE_MULTIPLE = 2

/**
 * A converting query is only worth buying if it converted at a price this
 * company can pay. 1.5× target leaves room for a small sample to be unlucky
 * without admitting a term that is simply expensive.
 */
export const ADD_CPL_MULTIPLE = 1.5

/**
 * Most keywords a single harvest may propose.
 *
 * Not a performance limit — a structural one. A search term is not a keyword:
 * adding every converting query produces thousands of one-impression keywords,
 * none of which ever accumulates enough history to be judged, and an account
 * nobody can read. Ten a run is a real week's growth.
 */
export const MAX_ADDS_PER_RUN = 10

export interface SearchTerm {
  term: string
  /** Google's own: NONE / ADDED / EXCLUDED / ADDED_EXCLUDED. */
  status: string
  impressions: number
  clicks: number
  costAed: number
  conversions: number
  /** The ad group it came through, so an add lands in the right place. */
  adGroupName?: string
}

export interface HarvestContext {
  /** What one lead is worth to this account, in AED. The whole judgement
   *  hangs on it, so an absent one means no verdicts at all rather than a
   *  guessed default — a made-up target CPL cuts real queries. */
  targetCplAed: number | null
  /** Project and developer names this company sells, lowercased. Anything
   *  containing one is never negatived. */
  brandTerms: string[]
  /** Terms already present as keywords or negatives in our own plan, so the
   *  harvest does not re-propose what exists. */
  known: string[]
}

export interface HarvestRow {
  term: string
  verdict: HarvestVerdict
  /** The numbers the verdict stands on. Never a claim without them. */
  vars: { clicks: number; costAed: number; conversions: number; cpa: number | null }
  /** For an add: the match type to add it on. */
  matchType?: 'EXACT' | 'PHRASE'
}

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Does this query contain a name this company sells? Word-boundary matched:
 *  a substring test would make the developer "Emaar" protect "emaarketing",
 *  and a brand list of short names would protect most of the account. */
export function isBrandTerm(term: string, brandTerms: string[]): boolean {
  const t = norm(term)
  return brandTerms.some((b) => {
    const n = norm(b)
    if (!n) return false
    return new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(t)
  })
}

/**
 * The verdict for one search term.
 *
 * Order matters and is not arbitrary: what Google already decided comes first,
 * then what must never be cut, then the arithmetic. Reversing any two of those
 * produces a machine that overrules a person, which is the behaviour that gets
 * a tool switched off.
 */
export function judgeTerm(t: SearchTerm, ctx: HarvestContext): HarvestRow {
  const cpa = t.conversions > 0 ? t.costAed / t.conversions : null
  const vars = { clicks: t.clicks, costAed: t.costAed, conversions: t.conversions, cpa }

  // 1. SOMEBODY ALREADY DECIDED. Google's own status, or our own plan.
  const status = String(t.status || '').toUpperCase()
  if (status.includes('ADDED') || status.includes('EXCLUDED')) {
    return { term: t.term, verdict: 'settled', vars }
  }
  if (ctx.known.some((k) => norm(k) === norm(t.term))) {
    return { term: t.term, verdict: 'settled', vars }
  }

  // 2. NEVER CUT THE NAMES WE SELL. Checked before the arithmetic, because the
  // arithmetic on a brand term with no conversion yet says "negative it" — and
  // blocking your own project's name hands it to whoever bids next.
  const brand = isBrandTerm(t.term, ctx.brandTerms)

  // 3. A CONVERTING QUERY. Added on EXACT: this exact phrase is the thing that
  // converted, and a phrase-match add would buy a wider set on the strength of
  // a narrower result.
  if (t.conversions > 0 && ctx.targetCplAed && cpa !== null) {
    if (cpa <= ctx.targetCplAed * ADD_CPL_MULTIPLE) {
      return { term: t.term, verdict: 'addKeyword', vars, matchType: 'EXACT' }
    }
    // It converted, but not at a price this company can pay. Not a negative
    // either — a term that produces leads is never junk, it is expensive, and
    // those two have different answers.
    return { term: t.term, verdict: 'watch', vars }
  }

  if (brand) return { term: t.term, verdict: 'protected', vars }

  // 4. WASTE. Two independent triggers: money spent, and clicks taken. The
  // cost rule catches expensive traffic; the click rule catches the cheap
  // query that bleeds quietly and never shows up as a big number.
  if (!ctx.targetCplAed) {
    // Without a target CPL there is no such thing as "too expensive", and a
    // guessed default would cut real queries. Watch, and say why elsewhere.
    return { term: t.term, verdict: 'watch', vars }
  }
  const wastedEnough = t.costAed >= ctx.targetCplAed * WASTE_MULTIPLE
  const clickedEnough = t.clicks >= MIN_CLICKS_TO_NEGATIVE
  if (t.conversions === 0 && (wastedEnough || clickedEnough)) {
    return { term: t.term, verdict: 'addNegative', vars }
  }

  return { term: t.term, verdict: 'watch', vars }
}

export interface Harvest {
  /** Proposed keywords, best first. Capped — see MAX_ADDS_PER_RUN. */
  adds: HarvestRow[]
  /** Negatives. Safe to apply automatically: they only ever stop spend. */
  negatives: HarvestRow[]
  /** Everything else, so the screen can show the whole report rather than
   *  only the half that produced an action. */
  watching: HarvestRow[]
  /** Money spent on the negatives, in AED — what this run saves per window. */
  wasteFoundAed: number
  /** How many adds were cut by the cap, so the limit is never silent. */
  addsCapped: number
}

/**
 * The whole report, turned into two lists and a number.
 *
 * ADDS ARE RANKED BY CPA, cheapest first — if only ten can be taken, they
 * should be the ten that convert most cheaply, not the ten that happened to
 * sort first alphabetically.
 *
 * NEGATIVES ARE RANKED BY SPEND, most wasteful first, for the same reason in
 * reverse: the operator reading this list should see the biggest leak at the
 * top even if they read no further.
 */
export function harvest(terms: SearchTerm[], ctx: HarvestContext): Harvest {
  const rows = terms.map((t) => judgeTerm(t, ctx))

  const adds = rows.filter((r) => r.verdict === 'addKeyword')
    .sort((a, b) => (a.vars.cpa ?? Infinity) - (b.vars.cpa ?? Infinity))
  const negatives = rows.filter((r) => r.verdict === 'addNegative')
    .sort((a, b) => b.vars.costAed - a.vars.costAed)
  const watching = rows.filter((r) => r.verdict === 'watch' || r.verdict === 'protected')

  return {
    adds: adds.slice(0, MAX_ADDS_PER_RUN),
    negatives,
    watching,
    // Real spend on queries that returned nothing — the number that answers
    // "what did this actually do for me", and the only honest way to say it.
    wasteFoundAed: Math.round(negatives.reduce((n, r) => n + r.vars.costAed, 0)),
    addsCapped: Math.max(0, adds.length - MAX_ADDS_PER_RUN),
  }
}

/**
 * What one lead costs this account, from real spend and real leads.
 *
 * Returns null below a floor rather than dividing by a small number: a target
 * CPL computed from two leads is a number with an enormous error bar, and
 * every negative in this module is measured against it. A wrong target here
 * cuts queries that were working.
 */
export const MIN_LEADS_FOR_TARGET = 5
export function targetCplFrom(spendAed: number, leads: number): number | null {
  if (leads < MIN_LEADS_FOR_TARGET || spendAed <= 0) return null
  return spendAed / leads
}
