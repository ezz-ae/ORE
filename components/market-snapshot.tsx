import Link from "next/link"
import { formatCompactCount, getMarketStats } from "@/lib/market-stats"

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)

const tileGridCols: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
}

export async function MarketSnapshot() {
  const { liveProjects, areasCovered, avgYield, developersTracked, topAreas } = await getMarketStats()

  const stats: Array<{ value: string; label: string; sub: string }> = []
  if (liveProjects != null) {
    stats.push({ value: formatCompactCount(liveProjects), label: "Projects Mapped", sub: "Live in our database" })
  }
  if (areasCovered != null) {
    stats.push({ value: formatCompactCount(areasCovered), label: "Areas Covered", sub: "Across Dubai & UAE" })
  }
  if (avgYield != null) {
    stats.push({ value: `${avgYield.toFixed(1)}%`, label: "Avg Gross Yield", sub: "Across covered areas" })
  }
  if (developersTracked != null) {
    stats.push({ value: formatCompactCount(developersTracked), label: "Developers Tracked", sub: "Profiles on platform" })
  }

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

        {/* Large editorial stats — only DB-backed numbers render */}
        {stats.length > 0 && (
          <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#152E24]/[0.07] ring-1 ring-[#152E24]/[0.06] ${tileGridCols[stats.length] || "md:grid-cols-4"}`}>
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
              </div>
            ))}
          </div>
        )}

        {/* Area comparison table — driven by live area profiles */}
        {topAreas.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#152E24]/[0.07] bg-white/60 shadow-sm backdrop-blur-sm">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6 border-b border-[#152E24]/[0.06] bg-[#152E24]/[0.025] px-6 py-3.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35">Area</span>
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35 sm:block">Avg Price / Sqft</span>
              <span className="min-w-[80px] text-[9px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35">Gross Yield</span>
            </div>

            {topAreas.map((area, i) => (
              <div
                key={area.name}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-6 px-6 py-4 transition-colors hover:bg-[#C69B3E]/[0.04] ${
                  i < topAreas.length - 1 ? "border-b border-[#152E24]/[0.04]" : ""
                }`}
              >
                {/* Area name */}
                <span className="text-sm font-semibold text-[#152E24]">{area.name}</span>

                {/* Price per sqft */}
                <span className="hidden text-sm font-medium text-[#152E24]/60 sm:block">
                  {area.pricePerSqft ? `AED ${Math.round(area.pricePerSqft).toLocaleString("en-US")}` : "—"}
                </span>

                {/* Yield + bar */}
                <div className="flex min-w-[80px] items-center gap-3">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#152E24]/[0.07]">
                    <div
                      className="h-full rounded-full bg-[#C69B3E]"
                      style={{ width: `${Math.min(Math.round((area.rentalYield || 0) * 10), 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-[#152E24]">
                    {area.rentalYield ? `${area.rentalYield.toFixed(1)}%` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom CTA strip */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#C69B3E]/20 bg-gradient-to-br from-[#C69B3E]/[0.06] to-[#152E24]/[0.02] px-8 py-6 sm:flex-row">
          <div>
            <p className="font-serif text-lg font-bold text-[#152E24]">Ready to invest in Dubai real estate?</p>
            <p className="mt-1 text-sm text-[#152E24]/45">Strong fundamentals, government-backed stability, and income-led rental yields await.</p>
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
