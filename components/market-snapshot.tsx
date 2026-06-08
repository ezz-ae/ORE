import Link from "next/link"

const ArrowUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
  </svg>
)
const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)
const MinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
)

const stats = [
  { value: "+12.4%", label: "Price Growth", sub: "Year-on-year 2025", hot: true },
  { value: "24,500", label: "Transactions", sub: "Q4 2025 volume", hot: true },
  { value: "3,500+", label: "Active Projects", sub: "Across all Dubai", hot: false },
  { value: "68%", label: "International Buyers", sub: "Share of total sales", hot: true },
]

const areas = [
  { name: "Dubai Marina",   price: "AED 1.92M", yield: "7.4", bar: 74, trend: "up" as const },
  { name: "Downtown Dubai", price: "AED 3.15M", yield: "5.9", bar: 59, trend: "up" as const },
  { name: "DAMAC Hills",    price: "AED 1.65M", yield: "8.3", bar: 83, trend: "up" as const },
  { name: "Business Bay",   price: "AED 1.58M", yield: "6.7", bar: 67, trend: "up" as const },
  { name: "Palm Jumeirah",  price: "AED 7.80M", yield: "4.8", bar: 48, trend: "stable" as const },
]

export function MarketSnapshot() {
  return (
    <section className="relative bg-[#F2EFE8] py-20 md:py-28 overflow-hidden">
      {/* Subtle texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: "radial-gradient(circle, #152E24 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <div className="container relative z-10">
        {/* Header */}
        <div className="mb-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-16">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C69B3E]">Real-Time Data</p>
            <h2 className="font-serif text-3xl font-bold leading-[1.08] text-[#152E24] md:text-5xl">
              Dubai Market<br className="hidden sm:block" /> Snapshot
            </h2>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-full border border-[#152E24]/12 bg-white/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#152E24]/60 shadow-sm backdrop-blur transition-all hover:border-[#C69B3E]/35 hover:text-[#C69B3E]"
          >
            Full Report
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Four large editorial stats */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#152E24]/[0.07] ring-1 ring-[#152E24]/[0.06] md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="group relative bg-[#F2EFE8] px-7 py-8 transition-colors hover:bg-white/60 md:px-8 md:py-10"
            >
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#152E24]/35">
                {stat.label}
              </p>
              <p className="font-serif text-4xl font-bold leading-none text-[#152E24] md:text-5xl">
                {stat.value}
              </p>
              <p className="mt-3 text-[11px] text-[#152E24]/35">{stat.sub}</p>
              {stat.hot && (
                <div className="absolute right-5 top-5 flex items-center gap-1 text-emerald-600">
                  <ArrowUpIcon />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Area comparison table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#152E24]/[0.07] bg-white/60 shadow-sm backdrop-blur-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 border-b border-[#152E24]/[0.06] bg-[#152E24]/[0.025] px-6 py-3.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35">Area</span>
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35 sm:block">Avg Price</span>
            <span className="min-w-[80px] text-[9px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35">Gross Yield</span>
            <span className="w-8 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35">Trend</span>
          </div>

          {areas.map((area, i) => (
            <div
              key={area.name}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 px-6 py-4 transition-colors hover:bg-[#C69B3E]/[0.04] ${
                i < areas.length - 1 ? "border-b border-[#152E24]/[0.04]" : ""
              }`}
            >
              {/* Area name */}
              <span className="text-sm font-semibold text-[#152E24]">{area.name}</span>

              {/* Price */}
              <span className="hidden text-sm font-medium text-[#152E24]/60 sm:block">
                {area.price}
              </span>

              {/* Yield + bar */}
              <div className="flex min-w-[80px] items-center gap-3">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#152E24]/[0.07]">
                  <div
                    className="h-full rounded-full bg-[#C69B3E]"
                    style={{ width: `${area.bar}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-[#152E24]">{area.yield}%</span>
              </div>

              {/* Trend icon */}
              <div className={`flex w-8 items-center justify-center ${area.trend === "up" ? "text-emerald-600" : "text-[#152E24]/25"}`}>
                {area.trend === "up" ? <ArrowUpIcon /> : <MinusIcon />}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA strip */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#C69B3E]/20 bg-gradient-to-br from-[#C69B3E]/[0.06] to-[#152E24]/[0.02] px-8 py-6 sm:flex-row">
          <div>
            <p className="font-serif text-lg font-bold text-[#152E24]">Ready to invest in Dubai real estate?</p>
            <p className="mt-1 text-sm text-[#152E24]/45">Strong fundamentals, government-backed stability, and 8%+ yields await.</p>
          </div>
          <Link
            href="/chat"
            className="freehold-gradient shrink-0 rounded-xl px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#152E24] shadow-md transition-all hover:shadow-lg hover:brightness-105"
          >
            Start with AI
          </Link>
        </div>
      </div>
    </section>
  )
}
