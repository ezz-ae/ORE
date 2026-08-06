/**
 * INVENTORY QUALITY — the signal that arrives 10,000× faster than cost per lead.
 *
 * The account this was built from spent AED 5,088 in six days across eight ad
 * sets and got 26 leads and 295,773 impressions. Every dashboard ranks those
 * ad sets by cost per lead, which is 26 observations. Nothing can be concluded
 * from 26 observations split eight ways, and the measured 3.6× spread between
 * best and worst turned out to support exactly two statements.
 *
 * The same six days produced 295,773 impressions, and THOSE separate cleanly:
 *
 *   Cash offer     CPM 212.45   861 leads per million impressions   CPL 246.75
 *   DAMAC          CPM  11.58   106 leads per million impressions   CPL 108.77
 *   Reportage      CPM   3.81    16 leads per million impressions   CPL 235.43
 *
 * Cash offer and Reportage sit at the same cost per lead — 247 against 235 —
 * while Cash offer's audience converts 53× better per impression, at
 * p = 2×10⁻¹². They are buying two different inventories: one expensive and
 * real, one nearly free and nearly worthless, and the two effects cancel to
 * the same price. Cost per lead cannot see this. It is the number everyone
 * optimises and it is the last one to know.
 *
 * So this module ranks by LEADS PER MILLION IMPRESSIONS, and pairs every
 * comparison with the probability of seeing it by chance. A ranking nobody can
 * defend is worse than no ranking, so an arm that has not separated from the
 * field is labelled as such rather than given a position.
 *
 * Pure — no I/O, no clock. Shares its confidence machinery with `min-evidence`.
 */
import { rateRange, costRange } from '@/lib/freehold/min-evidence'

/** One thing being compared: a campaign, an ad set, a placement, a creative. */
export interface Arm {
  id: string
  name: string
  spend: number
  leads: number
  impressions: number
  clicks?: number
}

/** log Γ(x) — Lanczos, g = 7, n = 9. Accurate to ~15 digits for x > 0.
 *  Needed so the binomial below stays exact at any lead count. Exported
 *  because `relevance.ts` needs the same exact-test machinery. */
export function lgamma(x: number): number {
  const g = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  const z = x - 1
  let a = g[0]
  const t = z + 7.5
  for (let i = 1; i < 9; i++) a += g[i] / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

const logChoose = (n: number, k: number) =>
  lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)

/**
 * Two-sided p-value for "these two arms convert at the same rate per unit of
 * exposure", conditioned on the total number of events.
 *
 * Under that hypothesis the split of `k1 + k2` events between the arms is
 * Binomial(n = k1 + k2, p = e1 / (e1 + e2)) — exposure is known exactly, so
 * this is an exact test, not an approximation. Both tails are computed and the
 * smaller is doubled; a one-tailed p-value here would call a coin flip a
 * discovery half the time.
 *
 * Returns 1 when there is nothing to test (no events, or an arm with no
 * exposure) — "no evidence of a difference", never "no difference".
 */
export function samePace(k1: number, e1: number, k2: number, e2: number): number {
  const n = k1 + k2
  if (n <= 0 || e1 <= 0 || e2 <= 0) return 1
  const p = e1 / (e1 + e2)
  if (p <= 0 || p >= 1) return 1
  const lp = Math.log(p)
  const lq = Math.log1p(-p)
  const pmf = (i: number) => Math.exp(logChoose(n, i) + i * lp + (n - i) * lq)
  let lower = 0
  for (let i = 0; i <= k1; i++) lower += pmf(i)
  let upper = 0
  for (let i = k1; i <= n; i++) upper += pmf(i)
  return Math.min(1, 2 * Math.min(lower, upper))
}

/** The conventional line. Named so a log entry can cite it rather than a
 *  magic 0.05 buried in a comparison. */
export const SIGNIFICANT_P = 0.05

export interface ArmReading extends Arm {
  /** Leads per million impressions — the audience-quality number. */
  lpm: number | null
  /** Its 95% range, so a 2-lead arm cannot masquerade as a ranked result. */
  lpmRange: { lo: number; hi: number } | null
  /** Cost per thousand impressions — the price of the inventory. Exact:
   *  impressions are counted in the hundreds of thousands, not estimated. */
  cpm: number | null
  /** Cost per lead, and the honest range around it. */
  cpl: number | null
  cplRange: { lo: number; hi: number } | null
  ctr: number | null
}

export function read(arm: Arm): ArmReading {
  const imp = arm.impressions
  const lpmR = imp > 0 ? rateRange(arm.leads, imp, 1_000_000) : null
  const cplR = arm.spend > 0 ? costRange(arm.spend, arm.leads) : null
  return {
    ...arm,
    lpm: imp > 0 ? (arm.leads / imp) * 1_000_000 : null,
    lpmRange: lpmR,
    cpm: imp > 0 ? (arm.spend / imp) * 1000 : null,
    cpl: arm.leads > 0 ? arm.spend / arm.leads : null,
    cplRange: cplR,
    ctr: imp > 0 && arm.clicks !== undefined ? (arm.clicks / imp) * 100 : null,
  }
}

export interface Comparison {
  a: string
  b: string
  /** How many times better `a` converts per impression than `b`. */
  ratio: number
  p: number
  established: boolean
  /** One line an operator can read without knowing what a p-value is. */
  sentence: string
}

/**
 * Every pairwise comparison, on impressions — the basis that separates.
 *
 * Deliberately NOT corrected for multiple comparisons. With eight arms there
 * are 28 pairs and a Bonferroni correction would demand p < 0.0018, which on
 * this account would still pass the comparison that matters (p = 2×10⁻¹²) but
 * would silence honest medium-strength findings on smaller accounts. The
 * caller gets the raw p and the pair count; a decision that pauses money
 * should want the strong ones anyway.
 */
export function compareAll(arms: Arm[]): Comparison[] {
  const out: Comparison[] = []
  for (let i = 0; i < arms.length; i++) {
    for (let j = i + 1; j < arms.length; j++) {
      const a = arms[i], b = arms[j]
      if (a.impressions <= 0 || b.impressions <= 0) continue
      const ra = a.leads / a.impressions
      const rb = b.leads / b.impressions
      const p = samePace(a.leads, a.impressions, b.leads, b.impressions)
      const established = p < SIGNIFICANT_P
      const ratio = rb > 0 ? ra / rb : (ra > 0 ? Infinity : 1)
      const better = ra >= rb ? a : b
      const worse = ra >= rb ? b : a
      const times = rb > 0 && ra > 0 ? Math.max(ra, rb) / Math.min(ra, rb) : Infinity
      out.push({
        a: a.id, b: b.id, ratio, p, established,
        sentence: established
          ? `"${better.name}" reaches people who convert ${Number.isFinite(times) ? `${times.toFixed(1)}×` : 'far'} better per impression than "${worse.name}" (p=${p < 0.0001 ? p.toExponential(1) : p.toFixed(4)}).`
          : `"${a.name}" and "${b.name}" have not separated on audience quality yet (p=${p.toFixed(3)}).`,
      })
    }
  }
  return out.sort((x, y) => x.p - y.p)
}

export interface Ranking {
  readings: ArmReading[]
  comparisons: Comparison[]
  /** Arms that beat at least one other arm at p < 0.05, best first. */
  proven: ArmReading[]
  /** Arms beaten by at least one other arm at p < 0.05, worst first. */
  disproven: ArmReading[]
  /** Everything that has not separated from anything. Not "average" — unknown. */
  undecided: ArmReading[]
  /** The plain-language summary, or the honest absence of one. */
  headline: string
}

/**
 * Rank a set of arms by audience quality, admitting what cannot be ranked.
 *
 * The three buckets are the point. A dashboard that sorts eight ad sets by CPL
 * implies eight positions; usually the data supports two groups and a large
 * pile of "we do not know yet", and saying so is what stops an operator
 * killing the wrong arm in week one.
 */
export function rank(arms: Arm[]): Ranking {
  const readings = arms.map(read)
  const comparisons = compareAll(arms)
  const winners = new Set<string>()
  const losers = new Set<string>()
  for (const c of comparisons) {
    if (!c.established) continue
    const [w, l] = c.ratio >= 1 ? [c.a, c.b] : [c.b, c.a]
    winners.add(w)
    losers.add(l)
  }
  // An arm can be both — better than one thing, worse than another. It belongs
  // with the losers, because the actionable fact is that something beats it.
  const byLpm = (x: ArmReading, y: ArmReading) => (y.lpm ?? -1) - (x.lpm ?? -1)
  const proven = readings.filter((r) => winners.has(r.id) && !losers.has(r.id)).sort(byLpm)
  const disproven = readings.filter((r) => losers.has(r.id)).sort((x, y) => (x.lpm ?? -1) - (y.lpm ?? -1))
  const undecided = readings.filter((r) => !winners.has(r.id) && !losers.has(r.id)).sort(byLpm)

  const totalImp = arms.reduce((n, a) => n + a.impressions, 0)
  const totalLeads = arms.reduce((n, a) => n + a.leads, 0)
  let headline: string
  if (proven.length === 0) {
    headline = `Nothing has separated yet across ${arms.length} arms — ${totalImp.toLocaleString()} impressions, ${totalLeads} leads. Ranking them would be reading noise.`
  } else {
    const top = proven[0]
    const bottom = disproven[0]
    headline = `"${top.name}" reaches the best audience of the ${arms.length}: ${Math.round(top.lpm ?? 0)} leads per million impressions${bottom ? `, against ${Math.round(bottom.lpm ?? 0)} for "${bottom.name}"` : ''}.` +
      (undecided.length ? ` ${undecided.length} arm${undecided.length === 1 ? ' has' : 's have'} not separated from the field.` : '')
  }
  return { readings, comparisons, proven, disproven, undecided, headline }
}

/**
 * Cheap impressions that do not convert — the pattern that hides inside a
 * healthy-looking cost per lead.
 *
 * An arm flagged here is buying inventory nobody else wants: a CPM far below
 * the account's own average while converting far below it too. Netted against
 * each other those two effects can produce a perfectly ordinary CPL, which is
 * why this cannot be found by looking at cost per lead at all.
 *
 * Only flagged when the conversion gap is ESTABLISHED against the account
 * average — a cheap arm that simply has not run long enough is not junk.
 */
export function junkInventory(arms: Arm[], cpmFloorRatio = 0.35, lpmCeilingRatio = 0.35): ArmReading[] {
  const totalImp = arms.reduce((n, a) => n + a.impressions, 0)
  const totalSpend = arms.reduce((n, a) => n + a.spend, 0)
  const totalLeads = arms.reduce((n, a) => n + a.leads, 0)
  if (totalImp <= 0 || totalSpend <= 0) return []
  const avgCpm = (totalSpend / totalImp) * 1000
  const avgLpm = (totalLeads / totalImp) * 1_000_000
  if (avgLpm <= 0) return []

  return arms
    .filter((a) => {
      if (a.impressions <= 0) return false
      const cpm = (a.spend / a.impressions) * 1000
      const lpm = (a.leads / a.impressions) * 1_000_000
      if (cpm > avgCpm * cpmFloorRatio) return false
      if (lpm > avgLpm * lpmCeilingRatio) return false
      // Compare this arm against everything else pooled — the gap has to be real.
      const restLeads = totalLeads - a.leads
      const restImp = totalImp - a.impressions
      return samePace(a.leads, a.impressions, restLeads, restImp) < SIGNIFICANT_P
    })
    .map(read)
}
