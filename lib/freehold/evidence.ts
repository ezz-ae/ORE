/**
 * Figure provenance — "how we know this", computed rather than promised.
 *
 * The incident this exists for: asked how the ads were doing, the chat
 * presented two campaigns that do not exist, with spend, CPL and a quality
 * score, as live performance. A tripwire was added that blocked a reply when
 * NONE of its numbers appeared in that turn's tool results.
 *
 * That test was too weak in both directions, and this module replaces it:
 *
 *   · It blocked only total fabrication. A reply quoting one real spend figure
 *     and inventing nine others passed the check untouched.
 *   · Worse, `some(grounded)` also SET the "✓ verified" badge. One real number
 *     out of ten did not merely fail to block the reply — it decorated it with
 *     a claim of verification. A badge that overstates is more damaging than no
 *     badge, because it teaches people to stop checking.
 *
 * So every figure is now classified individually:
 *
 *   grounded    the exact value appears in a tool result or the injected
 *               context this turn — the model read it, it did not invent it.
 *   derived     the value is simple arithmetic over grounded values (a CPL of
 *               75.3 from a spend of 1,506 and 20 leads is honest work, and
 *               demanding it appear verbatim would flag correct maths).
 *   ungrounded  neither. Nothing in this turn produced it.
 *
 * A single ungrounded figure in a performance report is enough to withhold the
 * report. The asymmetry is deliberate: a withheld true number costs a follow-up
 * question, an invented one costs the client's trust in every number after it.
 *
 * Pure and dependency-free so it can be exhaustively tested without a model, a
 * database or a network — see scripts/evidence-test.ts.
 */

/** How a figure earned its place in the reply. */
export type FigureStatus = 'grounded' | 'derived' | 'ungrounded'

export interface FigureAudit {
  /** The number as the reply wrote it, normalised (commas stripped). */
  value: string
  status: FigureStatus
  /** For `derived`, the arithmetic that produced it — shown in the drawer. */
  formula?: string
}

export interface EvidenceReport {
  figures: FigureAudit[]
  /**
   * `clean`      — every figure traces back to this turn.
   * `tainted`    — at least one figure came from nowhere.
   * `fabricated` — nothing traces back at all.
   * `no_figures` — nothing numeric worth checking.
   */
  verdict: 'clean' | 'tainted' | 'fabricated' | 'no_figures'
  groundedCount: number
  derivedCount: number
  ungroundedCount: number
}

/**
 * Figures below this are noise — ratings out of 10, "3 campaigns", step
 * numbers, ordinals. Chasing them produces false alarms without catching
 * anything: nobody is defrauded by an invented "4".
 */
const MIN_SIGNIFICANT = 10

/**
 * Derivations are only searched over this many grounded values. With enough
 * candidates, pairwise arithmetic can hit almost any target by chance, which
 * would quietly turn `derived` into "anything goes". Bounded search keeps the
 * classification meaningful — and anything beyond the bound simply falls
 * through to `ungrounded`, which is the safe direction.
 */
const MAX_DERIVATION_BASE = 40

/** Relative tolerance for a derived match — covers ordinary display rounding. */
const TOLERANCE = 0.005

const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g

/** Every number in a blob of text, comma-stripped, in order of appearance. */
export function extractFigures(text: string): string[] {
  return (text.match(NUMBER_RE) ?? []).map((m) => m.replace(/,/g, ''))
}

/** The significant ones, de-duplicated, order preserved. */
export function significantFigures(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of extractFigures(text)) {
    const n = Number.parseFloat(raw)
    if (!Number.isFinite(n) || n < MIN_SIGNIFICANT) continue
    if (seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
  }
  return out
}

const close = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(Math.abs(b) * TOLERANCE, 0.01)

/**
 * Can `target` be built from two grounded values by the arithmetic a report
 * legitimately does? Ratios (CPL, cost per click), percentages (conversion
 * rate, share of spend), totals and differences (week over week).
 */
function derivation(target: number, base: number[]): string | null {
  for (let i = 0; i < base.length; i++) {
    for (let j = 0; j < base.length; j++) {
      if (i === j) continue
      const a = base[i]
      const b = base[j]
      if (b !== 0) {
        if (close(target, a / b)) return `${a} ÷ ${b}`
        if (close(target, (a / b) * 100)) return `${a} ÷ ${b} × 100`
      }
      if (close(target, a - b)) return `${a} − ${b}`
      if (close(target, a + b)) return `${a} + ${b}`
      if (close(target, a * b)) return `${a} × ${b}`
    }
  }
  return null
}

/**
 * Audit a reply's figures against everything this turn actually produced.
 *
 * @param replyText  the reply, serialised — blocks, captions, table cells, all
 *                   of it, because a fabricated number in a table is still a
 *                   fabricated number.
 * @param sources    raw tool results and injected context, serialised. Order
 *                   and structure are irrelevant; only the values matter.
 */
export function auditFigures(replyText: string, sources: string[]): EvidenceReport {
  const claimed = significantFigures(replyText)
  if (claimed.length === 0) {
    return { figures: [], verdict: 'no_figures', groundedCount: 0, derivedCount: 0, ungroundedCount: 0 }
  }

  // Ground truth is every number the sources contain — including small ones,
  // because a lead count of 20 is a legitimate base for a derived CPL even
  // though 20 would not itself be worth auditing in a reply.
  const groundSet = new Set<string>()
  for (const src of sources) for (const n of extractFigures(src)) groundSet.add(n)

  const groundNums = [...groundSet]
    .map(Number.parseFloat)
    .filter((n) => Number.isFinite(n))
    .slice(0, MAX_DERIVATION_BASE)

  const figures: FigureAudit[] = claimed.map((value) => {
    if (groundSet.has(value)) return { value, status: 'grounded' }
    const n = Number.parseFloat(value)
    const formula = derivation(n, groundNums)
    if (formula) return { value, status: 'derived', formula }
    return { value, status: 'ungrounded' }
  })

  const groundedCount = figures.filter((f) => f.status === 'grounded').length
  const derivedCount = figures.filter((f) => f.status === 'derived').length
  const ungroundedCount = figures.filter((f) => f.status === 'ungrounded').length

  const verdict: EvidenceReport['verdict'] =
    ungroundedCount === 0 ? 'clean'
    : groundedCount + derivedCount === 0 ? 'fabricated'
    : 'tainted'

  return { figures, verdict, groundedCount, derivedCount, ungroundedCount }
}

/**
 * Does this reply read like a performance report? Only those are audited —
 * "your 24 hour window" and "3,500 projects in the catalogue" are prose, not
 * claims about money and results, and holding them to this standard would
 * block ordinary conversation.
 */
export const METRIC_SHAPED =
  /\b(?:CPL|cost\s+per\s+lead|spend|spent|leads?|budget|ROAS|ROI|CTR|CPC|CPM|impressions|reach|quality\s+score|conversions?|revenue)\b/i

/** A one-line summary for the response envelope's `evidence` array. */
export function evidenceLine(r: EvidenceReport): string {
  if (r.verdict === 'no_figures') return 'Figures: none to verify'
  const parts = [`${r.groundedCount} from live data`]
  if (r.derivedCount) parts.push(`${r.derivedCount} calculated from it`)
  if (r.ungroundedCount) parts.push(`${r.ungroundedCount} NOT traceable`)
  return `Figures: ${parts.join(', ')}`
}
