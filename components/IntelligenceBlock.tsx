// ─────────────────────────────────────────────────────────────────
// components/IntelligenceBlock.tsx
// Homepage intelligence block — 3 panels + pulse strip
// ─────────────────────────────────────────────────────────────────
import Image from "next/image"
import Link from "next/link"
import { isPositiveNumber, safeNum, safePercent } from "@/lib/utils/safeDisplay"

type Props = { data: Awaited<ReturnType<typeof import("@/lib/intelligence-block").getIntelligenceBlockData>> }

const formatPriceMillions = (value?: number | null) => {
  const numeric = Number(value ?? 0)
  if (!isPositiveNumber(numeric)) return "Price on request"
  return `AED ${(numeric / 1000000).toFixed(1)}M`
}

const formatDeltaLabel = (value?: number | null) => {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Math.abs(numeric) <= 0) return null
  return `${Math.abs(numeric).toFixed(0)}% below cohort`
}

export function IntelligenceBlock({ data }: Props) {
  if (!data) {
    return (
      <section className="w-full bg-[#0A1F17] text-white py-24">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/30">Market Intelligence data is currently unavailable.</p>
        </div>
      </section>
    )
  }

  const { trending, best_areas, pulse, below_market } = data

  if (!pulse || !trending || !best_areas || !below_market) {
    return (
      <section className="w-full bg-[#0A1F17] text-white py-24">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/30">Partial Market Intelligence data. Display has been suspended.</p>
        </div>
      </section>
    )
  }

  const pulseMetrics = [
    { label: "Off-Plan Projects", value: safeNum(Number(pulse.total_projects)) },
    { label: "Avg Rental Yield", value: safePercent(Number(pulse.avg_yield)) },
    { label: "Golden Visa Eligible", value: safeNum(Number(pulse.gv_count)) },
    { label: "Areas Covered", value: safeNum(Number(pulse.area_count)) },
  ]

  return (
    <section className="w-full bg-[#0A1F17] text-white pt-24 pb-16 px-4 md:pt-28">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[#D4AC50] uppercase tracking-[0.2em] mb-2">
              Live Market Intelligence
            </p>
            <h2 className="text-3xl font-bold font-serif text-white md:text-4xl">
              What Moves Dubai Right Now
            </h2>
          </div>
          <span className="text-[11px] text-white/25 font-medium">
            Data: ORE Intelligence · Updated every 10 min
          </span>
        </div>

        {/* ── Pulse strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-white/[0.06] rounded-2xl p-5 bg-white/[0.03]">
          {pulseMetrics.map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-[#D4AC50]">{value}</p>
              <p className="text-[11px] text-white/35 mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* ── 3-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Panel 1 — Trending Projects */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-[11px] font-semibold text-[#D4AC50] uppercase tracking-[0.2em] pb-1">
              Trending Now
            </h3>
            {trending.slice(0, 4).map((p: any) => {
              const priceLabel = formatPriceMillions(Number(p.price_from_aed))
              const yieldLabel = isPositiveNumber(Number(p.rental_yield))
                ? `${Number(p.rental_yield).toFixed(1)}% yield`
                : null
              return (
                <Link
                  href={`/projects/${p.slug}`}
                  key={p.slug}
                  className="flex gap-3 items-center p-3 rounded-xl border border-white/[0.04] bg-white/[0.03] hover:bg-white/[0.06] transition group"
                >
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                    {p.hero_image ? (
                      <Image
                        src={p.hero_image}
                        alt={p.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[9px] uppercase tracking-wider text-white/20">
                        No img
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-[#D4AC50] transition">
                      {p.name}
                    </p>
                    <p className="text-xs text-white/35 truncate">{p.area}</p>
                    <div className="flex gap-2 mt-1">
                      {yieldLabel && (
                        <span className="text-[11px] text-emerald-400">{yieldLabel}</span>
                      )}
                      {p.golden_visa_eligible && (
                        <span className="text-[11px] text-[#D4AC50]">Golden Visa</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-white/25 shrink-0 font-medium">{priceLabel}</p>
                </Link>
              )
            })}
          </div>

          {/* Panel 2 — Best Yield Areas */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-[11px] font-semibold text-[#D4AC50] uppercase tracking-[0.2em] pb-1">
              Best Yield Areas
            </h3>
            {best_areas.map((a: any) => (
              <Link
                href={`/areas/${a.slug}`}
                key={a.slug}
                className="flex flex-col gap-2 rounded-xl border border-white/[0.04] bg-white/[0.03] p-4 transition hover:border-[#D4AC50]/30 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold text-white/80">{a.name}</div>
                  <div className="text-[11px] text-white/25 font-medium">{safeNum(Number(a.project_count))} projects</div>
                </div>
                <div className="text-2xl font-bold text-[#D4AC50]">{safePercent(Number(a.avg_yield))}</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium">average yield</div>
              </Link>
            ))}
          </div>

          {/* Panel 3 — Below Market */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-[11px] font-semibold text-[#D4AC50] uppercase tracking-[0.2em] pb-1">
              Below Market Price
            </h3>
            {below_market.length === 0 ? (
              <p className="text-sm text-white/25 py-4">No active below-market listings.</p>
            ) : (
              below_market.map((p: any) => {
                const priceLabel = formatPriceMillions(Number(p.price_from_aed))
                const deltaLabel = formatDeltaLabel(Number(p.vs_cohort))
                return (
                  <Link
                    href={`/projects/${p.slug}`}
                    key={p.slug}
                    className="flex gap-3 items-center p-3 rounded-xl border border-white/[0.04] bg-white/[0.03] hover:bg-white/[0.06] transition group"
                  >
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                      {p.hero_image ? (
                        <Image
                          src={p.hero_image}
                          alt={p.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[9px] uppercase tracking-wider text-white/20">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-[#D4AC50] transition">
                        {p.name}
                      </p>
                      <p className="text-xs text-white/35 truncate">{p.area}</p>
                      {deltaLabel && (
                        <span className="inline-block mt-1 text-[11px] bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded-full font-medium">
                          {deltaLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/25 shrink-0 font-medium">{priceLabel}</p>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="text-center pt-4">
          <Link href="/search"
            className="inline-flex items-center gap-2 ore-gradient
                       font-semibold px-8 py-3.5 rounded-xl text-[12px] uppercase tracking-[0.1em] transition">
            Explore All 3,500+ Projects
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>

      </div>
    </section>
  )
}
