// lib/payment-plan.ts
//
// Robust reader for the many payment-plan shapes the inventory pipeline
// (Neon/Hex) produces, normalized to the { downPayment, duringConstruction,
// onHandover, postHandover } percentages the landing PaymentPlanSection renders.
//
// Handles, in order:
//   1. { downPayment, duringConstruction, onHandover, postHandover }  (numbers or "20%")
//   2. { description: "10% down / 50% during build / 40% on handover" }
//   3. a plain description string
//   4. a structured stages array — payload.paymentPlans: [{ label, percent }]
//
// Returns undefined when nothing real is parseable — the section then hides
// rather than inventing a plan (honest-state rule; never advertise a fake
// 20/50/30). Dependency-free so any surface can import it.

export interface PaymentPlanStages {
  downPayment: number
  duringConstruction: number
  onHandover: number
  postHandover: number
}

type Bucket = keyof PaymentPlanStages

// Parse a percent from a number or a string like "20", "20%", "20 %".
function toPct(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const m = v.match(/-?\d+(\.\d+)?/)
    if (m) {
      const n = Number(m[0])
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

// Bucket a stage label into one of the four milestones by its EARLIEST keyword,
// so "50% during build, balance on handover" reads as construction (the word
// "during" precedes "handover") rather than being miscounted as handover.
const BUCKET_TESTS: [Bucket, RegExp][] = [
  ["postHandover", /post[\s-]?hand|after[\s-]?hand/],
  ["downPayment", /down|booking|reservation|deposit|on signing|eoi/],
  ["duringConstruction", /constr|during|installment|instal|milestone|linked|monthly|quarterly/],
  ["onHandover", /hand\s?over|completion|on completion|on delivery/],
]
function bucketFor(label: string): Bucket | null {
  const s = label.toLowerCase()
  let best: Bucket | null = null
  let bestIdx = Infinity
  for (const [bucket, re] of BUCKET_TESTS) {
    const m = s.match(re)
    if (m && m.index !== undefined && m.index < bestIdx) {
      best = bucket
      bestIdx = m.index
    }
  }
  return best
}

function finalize(s: PaymentPlanStages): PaymentPlanStages | undefined {
  const clamp = (n: number) => Math.max(0, Math.round(n))
  const out = {
    downPayment: clamp(s.downPayment),
    duringConstruction: clamp(s.duringConstruction),
    onHandover: clamp(s.onHandover),
    postHandover: clamp(s.postHandover),
  }
  const total = out.downPayment + out.duringConstruction + out.onHandover + out.postHandover
  return total > 0 ? out : undefined
}

// 1) The 4-key object shape (values may be numbers or "20%" strings).
function fromKeys(o: Record<string, unknown>): PaymentPlanStages | undefined {
  const down = toPct(o.downPayment)
  const during = toPct(o.duringConstruction)
  const onH = toPct(o.onHandover)
  const post = toPct(o.postHandover)
  if (down === null && during === null && onH === null && post === null) return undefined
  return finalize({
    downPayment: down ?? 0,
    duringConstruction: during ?? 0,
    onHandover: onH ?? 0,
    postHandover: post ?? 0,
  })
}

// 2/3) Free text, either label order:
//   "10% down / 50% during build / 40% on handover"  (label AFTER the number)
//   "Down payment: 20%, Construction: 50%, Handover: 30%"  (label BEFORE)
function fromDescription(text: string): PaymentPlanStages | undefined {
  const acc: PaymentPlanStages = { downPayment: 0, duringConstruction: 0, onHandover: 0, postHandover: 0 }
  let hit = false
  const pctOf = (s: string): number | null => {
    const m = s.match(/(\d+(?:\.\d+)?)\s*%/)
    return m ? toPct(m[1]) : null
  }
  // When the plan is delimited (comma / slash / newline / "and"), each segment
  // carries its OWN label + number regardless of order — bucket by the segment.
  if (/[,;/\n]|\band\b/i.test(text)) {
    text.split(/[,;/\n]+|\band\b/i).map((s) => s.trim()).filter(Boolean).forEach((seg, i) => {
      const p = pctOf(seg)
      if (p === null) return
      const bucket = bucketFor(seg) ?? (i === 0 ? "downPayment" : "duringConstruction")
      acc[bucket] += p
      hit = true
    })
  } else {
    // Undelimited run: capture each "<pct>%" with the label that FOLLOWS it, up
    // to the next number (so a trailing "60" of the next stage isn't swallowed).
    const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%\s*([^\d%]*)/g)]
    if (!matches.length) return undefined
    matches.forEach((m, i) => {
      const p = toPct(m[1])
      if (p === null) return
      const bucket = bucketFor(m[2] || "") ?? (i === 0 ? "downPayment" : "duringConstruction")
      acc[bucket] += p
      hit = true
    })
  }
  return hit ? finalize(acc) : undefined
}

// 4) Structured stages: [{ label|name|stage|milestone, percent|value|pct|amount }].
function fromStages(arr: unknown[]): PaymentPlanStages | undefined {
  const acc: PaymentPlanStages = { downPayment: 0, duringConstruction: 0, onHandover: 0, postHandover: 0 }
  let hit = false
  arr.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return
    const o = raw as Record<string, unknown>
    const p = toPct(o.percent ?? o.percentage ?? o.pct ?? o.value ?? o.amount ?? o.share)
    if (p === null) return
    const label = String(o.label ?? o.name ?? o.stage ?? o.milestone ?? o.title ?? o.phase ?? "")
    const bucket = bucketFor(label) ?? (i === 0 ? "downPayment" : i === arr.length - 1 ? "onHandover" : "duringConstruction")
    acc[bucket] += p
    hit = true
  })
  return hit ? finalize(acc) : undefined
}

/**
 * Normalize any payment-plan input to milestone percentages, or undefined.
 * @param plan  payload.paymentPlan — object, string, or array
 * @param plans payload.paymentPlans — optional structured stages array
 */
export function normalizePaymentPlan(plan?: unknown, plans?: unknown): PaymentPlanStages | undefined {
  if (plan && typeof plan === "object" && !Array.isArray(plan)) {
    const o = plan as Record<string, unknown>
    const byKeys = fromKeys(o)
    if (byKeys) return byKeys
    const desc = o.description ?? o.summary ?? o.text ?? o.raw
    if (typeof desc === "string") {
      const byDesc = fromDescription(desc)
      if (byDesc) return byDesc
    }
  }
  if (typeof plan === "string") {
    const byDesc = fromDescription(plan)
    if (byDesc) return byDesc
  }
  const arr = Array.isArray(plans) ? plans : Array.isArray(plan) ? plan : null
  if (arr) {
    const byStages = fromStages(arr)
    if (byStages) return byStages
  }
  return undefined
}
