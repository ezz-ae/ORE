import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Building2,
  Clock3,
  MapPinned,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { isPositiveNumber, safeNum, safePercent } from "@/lib/utils/safeDisplay"

type MarketData = Awaited<ReturnType<typeof import("@/lib/intelligence-block").getIntelligenceBlockData>>
type Props = { data: MarketData }

const formatPriceMillions = (value?: number | null) => {
  const numeric = Number(value ?? 0)
  if (!isPositiveNumber(numeric)) return "Price on request"
  return `AED ${(numeric / 1000000).toFixed(1)}M`
}

const formatAverageEntry = (value?: number | string | null) => {
  const numeric = Number(value ?? 0)
  if (!isPositiveNumber(numeric)) return "—"
  return `AED ${numeric.toFixed(1)}M`
}

const formatDeltaLabel = (value?: number | null) => {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Math.abs(numeric) <= 0) return null
  return `${Math.abs(numeric).toFixed(0)}% below cohort`
}

const formatUpdatedAt = (value?: string) => {
  if (!value) return "Updated live"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Updated live"
  return new Intl.DateTimeFormat("en-AE", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

const metricCardClassName =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]"

const listCardClassName =
  "rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-sm shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)]"

export function IntelligenceBlock({ data }: Props) {
  if (!data) {
    return (
      <section className="w-full bg-[#0A1F17] py-24 text-white">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-white/30">Market Intelligence data is currently unavailable.</p>
        </div>
      </section>
    )
  }

  const { trending, best_areas, pulse, below_market, generated_at } = data

  if (!pulse || !trending || !best_areas || !below_market) {
    return (
      <section className="w-full bg-[#0A1F17] py-24 text-white">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-white/30">Partial Market Intelligence data. Display has been suspended.</p>
        </div>
      </section>
    )
  }

  const featuredProject = trending[0]
  const trendingRows = (trending.length > 1 ? trending.slice(1, 5) : trending.slice(0, 4)) as typeof trending
  const leadArea = best_areas[0]
  const leadDiscount = below_market[0]
  const pulseMetrics = [
    {
      label: "Live inventory",
      value: safeNum(Number(pulse.total_projects)),
      icon: Building2,
      accent: "text-white",
    },
    {
      label: "Avg rental yield",
      value: safePercent(Number(pulse.avg_yield)),
      icon: TrendingUp,
      accent: "text-[#D4AC50]",
    },
    {
      label: "Verified listings",
      value: safeNum(Number(pulse.verified_listings)),
      icon: ShieldCheck,
      accent: "text-emerald-300",
    },
    {
      label: "Avg entry ticket",
      value: formatAverageEntry(pulse.avg_price_m),
      icon: BarChart3,
      accent: "text-[#F0D792]",
    },
  ]

  return (
    <section className="relative overflow-hidden bg-[#0A1F17] px-4 py-24 text-white md:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,172,80,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_26%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[36px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.85)] backdrop-blur-sm md:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AC50]/20 bg-[#D4AC50]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0D792]">
                <Sparkles className="h-3.5 w-3.5" />
                Live Market Intelligence
              </div>

              <div className="max-w-3xl">
                <h2 className="font-serif text-4xl font-bold leading-tight text-white md:text-5xl">
                  What Moves Dubai Right Now
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/55 md:text-lg">
                  A live market read on momentum, yield leadership, and pricing gaps across Dubai’s most investable corridors.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  <Clock3 className="h-3.5 w-3.5 text-[#D4AC50]" />
                  Refreshed {formatUpdatedAt(generated_at)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  <MapPinned className="h-3.5 w-3.5 text-[#D4AC50]" />
                  {safeNum(Number(pulse.area_count))} areas under active watch
                </span>
              </div>

              {featuredProject && (
                <Link
                  href={`/projects/${featuredProject.slug}`}
                  className="group relative block overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.025]"
                >
                  <div className="relative min-h-[360px] overflow-hidden">
                    {featuredProject.hero_image ? (
                      <Image
                        src={featuredProject.hero_image}
                        alt={featuredProject.name}
                        fill
                        sizes="(min-width: 1024px) 52vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,172,80,0.18),transparent_30%),linear-gradient(135deg,#12291F,#0A1F17)]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#081510] via-[#081510]/50 to-transparent" />
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />

                    <div className="absolute left-5 right-5 top-5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#152E24] shadow-sm">
                        Momentum leader
                      </span>
                      {featuredProject.golden_visa_eligible && (
                        <span className="rounded-full bg-[#D4AC50]/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F0D792] backdrop-blur-sm">
                          Golden Visa
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                      <div className="max-w-2xl">
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
                          {featuredProject.area || "Dubai"}
                        </div>
                        <h3 className="mt-2 font-serif text-2xl font-bold text-white md:text-3xl">
                          {featuredProject.name}
                        </h3>
                        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
                          <div className="flex flex-wrap gap-4 text-sm text-white/65">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">From</div>
                              <div className="mt-1 text-lg font-semibold text-white">
                                {formatPriceMillions(Number(featuredProject.price_from_aed))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">Yield signal</div>
                              <div className="mt-1 text-lg font-semibold text-[#F0D792]">
                                {isPositiveNumber(Number(featuredProject.rental_yield))
                                  ? `${Number(featuredProject.rental_yield).toFixed(1)}%`
                                  : "—"}
                              </div>
                            </div>
                          </div>

                          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors group-hover:text-[#F0D792]">
                            View project
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>

            <div className="space-y-5 lg:pl-2">
              <div className="grid gap-4 sm:grid-cols-2">
                {pulseMetrics.map(({ label, value, icon: Icon, accent }) => (
                  <div key={label} className={metricCardClassName}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                        {label}
                      </span>
                      <Icon className="h-4 w-4 text-[#D4AC50]" />
                    </div>
                    <div className={`mt-4 text-3xl font-bold tracking-tight ${accent}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link href={leadArea ? `/areas/${leadArea.slug}` : "/market/areas"} className={`${metricCardClassName} group block`}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      Yield leader
                    </span>
                    <TrendingUp className="h-4 w-4 text-emerald-300" />
                  </div>

                  {leadArea ? (
                    <>
                      <div className="mt-4 font-serif text-2xl font-bold text-white">{leadArea.name}</div>
                      <div className="mt-2 text-sm text-white/55">
                        {safeNum(Number(leadArea.project_count))} live projects · {safePercent(Number(leadArea.avg_yield))} avg yield
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 text-sm text-white/45">Area insights are loading.</div>
                  )}

                  <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F0D792] transition-transform duration-300 group-hover:translate-x-1">
                    Explore areas
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>

                <Link href={leadDiscount ? `/projects/${leadDiscount.slug}` : "/projects"} className={`${metricCardClassName} group block`}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      Pricing gap
                    </span>
                    <TrendingDown className="h-4 w-4 text-violet-300" />
                  </div>

                  {leadDiscount ? (
                    <>
                      <div className="mt-4 font-serif text-2xl font-bold text-white">{leadDiscount.name}</div>
                      <div className="mt-2 text-sm text-white/55">
                        {formatDeltaLabel(Number(leadDiscount.vs_cohort)) || "Value pricing detected"}
                      </div>
                      <div className="mt-3 inline-flex rounded-full bg-violet-500/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                        {formatPriceMillions(Number(leadDiscount.price_from_aed))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 text-sm text-white/45">No live price dislocations right now.</div>
                  )}

                  <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F0D792] transition-transform duration-300 group-hover:translate-x-1">
                    Review pricing
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.85fr_1fr]">
            <div className={listCardClassName}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D792]">
                    Trending Projects
                  </div>
                  <h3 className="mt-2 font-serif text-2xl font-bold text-white">Momentum board</h3>
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/25">
                  High attention launches
                </div>
              </div>

              <div className="space-y-3">
                {trendingRows.map((project) => {
                  const yieldLabel = isPositiveNumber(Number(project.rental_yield))
                    ? `${Number(project.rental_yield).toFixed(1)}% yield`
                    : null

                  return (
                    <Link
                      key={project.slug}
                      href={`/projects/${project.slug}`}
                      className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-[#D4AC50]/25 hover:bg-white/[0.05]"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                        {project.hero_image ? (
                          <Image
                            src={project.hero_image}
                            alt={project.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white transition-colors group-hover:text-[#F0D792]">
                          {project.name}
                        </div>
                        <div className="mt-1 truncate text-xs text-white/35">{project.area || "Dubai"}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {yieldLabel && <span className="text-emerald-300">{yieldLabel}</span>}
                          {project.golden_visa_eligible && <span className="text-[#F0D792]">Golden Visa</span>}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/25">From</div>
                        <div className="mt-1 text-xs font-semibold text-white/80">
                          {formatPriceMillions(Number(project.price_from_aed))}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className={listCardClassName}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D792]">
                    Best Yield Areas
                  </div>
                  <h3 className="mt-2 font-serif text-2xl font-bold text-white">Area leaders</h3>
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/25">
                  Ranked by average yield
                </div>
              </div>

              <div className="space-y-3">
                {best_areas.slice(0, 4).map((area, index) => {
                  const yieldValue = Number(area.avg_yield)
                  const barWidth = Number.isFinite(yieldValue)
                    ? Math.max(18, Math.min(yieldValue * 12, 100))
                    : 18

                  return (
                    <Link
                      key={area.slug}
                      href={`/areas/${area.slug}`}
                      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition hover:border-[#D4AC50]/25 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25">
                            {String(index + 1).padStart(2, "0")}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white transition-colors group-hover:text-[#F0D792]">
                            {area.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-[#F0D792]">{safePercent(yieldValue)}</div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-white/25">
                            {safeNum(Number(area.project_count))} projects
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#C69B3E] via-[#D4AC50] to-[#F0D792]"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className={listCardClassName}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D792]">
                    Pricing Window
                  </div>
                  <h3 className="mt-2 font-serif text-2xl font-bold text-white">Below-market opportunities</h3>
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/25">
                  Relative to local cohort
                </div>
              </div>

              {below_market.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/35">
                  No active below-market listings at the moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {below_market.slice(0, 4).map((project) => (
                    <Link
                      key={project.slug}
                      href={`/projects/${project.slug}`}
                      className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition hover:border-violet-300/25 hover:bg-white/[0.05]"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                        {project.hero_image ? (
                          <Image
                            src={project.hero_image}
                            alt={project.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white transition-colors group-hover:text-violet-200">
                          {project.name}
                        </div>
                        <div className="mt-1 truncate text-xs text-white/35">{project.area || "Dubai"}</div>
                        {formatDeltaLabel(Number(project.vs_cohort)) && (
                          <span className="mt-2 inline-flex rounded-full bg-violet-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                            {formatDeltaLabel(Number(project.vs_cohort))}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/25">From</div>
                        <div className="mt-1 text-xs font-semibold text-white/80">
                          {formatPriceMillions(Number(project.price_from_aed))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[28px] border border-white/[0.08] bg-gradient-to-r from-white/[0.03] to-white/[0.01] px-6 py-5 text-center lg:flex-row lg:text-left">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D792]">
                ORE Intelligence Desk
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                Explore the full search inventory to compare high-momentum projects, yield-led communities, and pricing anomalies in one place.
              </p>
            </div>

            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-xl ore-gradient px-8 py-3.5 text-[12px] font-semibold uppercase tracking-[0.1em] transition"
            >
              Explore All 3,500+ Projects
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
