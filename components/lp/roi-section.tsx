import { SectionShell } from "@/components/lp/section-shell"
import { TrendingUp, Home, DollarSign } from "lucide-react"

interface RoiSectionProps {
  data: Record<string, unknown>
}

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const formatAed = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

export function RoiSection({ data }: RoiSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Investment Returns"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Projected performance metrics based on area market data."

  const expectedRoi = toNumber(data.expectedRoi)
  const rentalYield = toNumber(data.rentalYield)
  const startPriceAed = toNumber(data.startPriceAed)

  const metrics = [
    expectedRoi > 0
      ? {
          label: "Expected ROI",
          value: `${expectedRoi.toFixed(1)}%`,
          sub: "Capital + rental combined",
          icon: TrendingUp,
          accent: "text-emerald-500 dark:text-emerald-400",
          border: "border-emerald-500/20",
          glow: "bg-emerald-500/5",
        }
      : null,
    rentalYield > 0
      ? {
          label: "Rental Yield",
          value: `${rentalYield.toFixed(1)}%`,
          sub: "Gross annual yield",
          icon: Home,
          accent: "text-blue-500 dark:text-blue-400",
          border: "border-blue-500/20",
          glow: "bg-blue-500/5",
        }
      : null,
    startPriceAed > 0
      ? {
          label: "Starting Price",
          value: formatAed(startPriceAed),
          sub: "Entry point (AED)",
          icon: DollarSign,
          accent: "text-[#C9A961]",
          border: "border-[#C9A961]/25",
          glow: "bg-[#C9A961]/5",
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string
    value: string
    sub: string
    icon: typeof TrendingUp
    accent: string
    border: string
    glow: string
  }>

  if (!metrics.length) return null

  return (
    <SectionShell id="roi" title={title} subtitle={subtitle}>
      <div className="grid gap-5 md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div
              key={metric.label}
              className={`relative overflow-hidden rounded-3xl border ${metric.border} ${metric.glow} p-8 transition-shadow hover:shadow-xl`}
            >
              <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl opacity-30 ${metric.glow}`} />
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border ${metric.border}`}>
                <Icon className={`h-5 w-5 ${metric.accent}`} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {metric.label}
              </p>
              <p className={`mt-1.5 font-serif text-[2.75rem] font-bold leading-none tracking-tight ${metric.accent}`}>
                {metric.value}
              </p>
              <p className="mt-2.5 text-xs text-muted-foreground">{metric.sub}</p>
            </div>
          )
        })}
      </div>
      <p className="mt-6 text-center text-[11px] text-muted-foreground/60">
        Projected estimates only · Past performance does not guarantee future returns · Data: ORE Intelligence
      </p>
    </SectionShell>
  )
}
