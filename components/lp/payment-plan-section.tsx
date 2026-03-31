import { SectionShell } from "@/components/lp/section-shell"

interface PaymentPlanSectionProps {
  data: Record<string, unknown>
}

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const normalizePaymentPlan = (plan: {
  downPayment: number
  duringConstruction: number
  onHandover: number
  postHandover: number
}) => {
  const normalized = {
    downPayment: Math.max(0, plan.downPayment),
    duringConstruction: Math.max(0, plan.duringConstruction),
    onHandover: Math.max(0, plan.onHandover),
    postHandover: Math.max(0, plan.postHandover),
  }

  const total =
    normalized.downPayment +
    normalized.duringConstruction +
    normalized.onHandover +
    normalized.postHandover

  if (total > 0 && total < 100) {
    normalized.postHandover += 100 - total
  }

  return normalized
}

export function PaymentPlanSection({ data }: PaymentPlanSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Payment Plan"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Flexible milestone structure aligned to project progress."

  const plan = normalizePaymentPlan({
    downPayment: toNumber(data.downPayment, 20),
    duringConstruction: toNumber(data.duringConstruction, 50),
    onHandover: toNumber(data.onHandover, 30),
    postHandover: toNumber(data.postHandover, 0),
  })

  const rows = [
    { label: "Down Payment", sub: "Paid on reservation", value: plan.downPayment, step: 1 },
    { label: "During Construction", sub: "Phased installments", value: plan.duringConstruction, step: 2 },
    { label: "On Handover", sub: "Keys released", value: plan.onHandover, step: 3 },
    { label: "Post Handover", sub: "Post-completion", value: plan.postHandover, step: 4 },
  ].filter((row) => row.value > 0)

  if (!rows.length) return null

  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <SectionShell id="payment-plan" title={title} subtitle={subtitle}>
      <div className="mx-auto max-w-2xl">
        {/* Timeline steps */}
        <div className="relative">
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1
            const barFill = Math.min(100, Math.round((row.value / total) * 100))
            return (
              <div key={row.label} className="relative flex gap-5">
                {/* Stem + circle */}
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 font-bold text-sm text-primary">
                    {row.step}
                  </div>
                  {!isLast && (
                    <div className="mt-1 w-px flex-1 bg-gradient-to-b from-primary/30 to-primary/5" />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-8 ${isLast ? "pb-0" : ""}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.sub}</p>
                    </div>
                    <span className="font-serif text-3xl font-bold text-primary">{row.value}%</span>
                  </div>
                  {/* Bar */}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#C9A961] to-[#B8860B] transition-all duration-700"
                      style={{ width: `${barFill}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total pill */}
        <div className="mt-8 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Total Payment
          </span>
          <span className="font-serif text-2xl font-bold text-primary">{total}%</span>
        </div>
      </div>
    </SectionShell>
  )
}
