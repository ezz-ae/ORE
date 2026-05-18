import { HeroWithMotion } from "@/components/hero-with-motion"
import { FeaturedProperties } from "@/components/featured-properties"
import { MarketSnapshot } from "@/components/market-snapshot"
import { BlogSection } from "@/components/blog-section"
import { Button } from "@/components/ui/button"
import { IntelligenceBlock } from "@/components/IntelligenceBlock"
import { getIntelligenceBlockData } from "@/lib/intelligence-block"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
}

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
)
const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
)
const BuildingIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
)
const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
)

const heroPrompts = [
  "Create a Freehold shortlist under AED 2M",
  "Show Freehold beachfront picks in Dubai Marina",
  "Build a Freehold brief for Downtown off-plan opportunities",
]

export default async function Home() {
  const intelligenceData = await getIntelligenceBlockData()

  return (
    <div className="overflow-x-clip">
      <HeroWithMotion heroPrompts={heroPrompts} />

      <IntelligenceBlock data={intelligenceData} />

      <div className="relative overflow-hidden bg-[#152E24] py-20 text-white md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(198,155,62,0.06),transparent)]" />
        <FeaturedProperties />
      </div>

      <div className="relative bg-[#FAF8F5] py-20 md:py-24">
        <MarketSnapshot />
      </div>

      <section className="relative overflow-hidden bg-[#152E24] py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_50%,rgba(198,155,62,0.05),transparent)]" />
        <div className="container relative z-10">
          <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AC50]">Freehold Advantage</p>
            <h2 className="font-serif text-3xl font-bold text-white md:text-5xl lg:text-6xl">
              Brokerage service with <span className="ore-text-gradient">market intelligence.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-8 md:p-10">
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div>
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-white text-[#152E24] shadow-lg md:h-16 md:w-16">
                    <SparklesIcon />
                  </div>
                  <h3 className="font-serif mb-4 text-2xl font-bold text-white md:text-4xl">Project sales, leasing, and investment advisory</h3>
                  <p className="max-w-xl text-sm leading-relaxed text-white/45 md:text-base">
                    Freehold Property UAE supports residential and commercial sales, leasing, project marketing, investments, consultancy, and valuation coordination.
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#D4AC50] transition-all group-hover:gap-5">
                  Explore services <ArrowRightIcon />
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-4 md:p-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#C69B3E]/10 text-[#D4AC50]">
                <TrendingUpIcon />
              </div>
              <h3 className="font-serif mb-3 text-xl font-bold text-white">Market Confidence</h3>
              <p className="text-sm leading-relaxed text-white/40">
                Compare areas, payment plans, and buyer goals before making a property decision.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-4 md:p-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#C69B3E]/10 text-[#D4AC50]">
                <BuildingIcon />
              </div>
              <h3 className="font-serif mb-3 text-xl font-bold text-white">Residential and Commercial</h3>
              <p className="text-sm leading-relaxed text-white/40">
                Apartments, villas, land, shops, offices, rentals, ready properties, and under-construction projects.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-8 md:p-10">
              <div className="flex h-full flex-col justify-between gap-10 md:flex-row md:items-center">
                <div className="max-w-md">
                  <h3 className="font-serif mb-4 text-2xl font-bold text-white md:text-3xl">Local advisory, clean execution</h3>
                  <p className="text-sm leading-relaxed text-white/45 md:text-base">
                    From first inquiry to viewing, negotiation, paperwork, and handover, Freehold keeps the process clear and practical.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.04] text-2xl font-bold tracking-[0.15em] text-white/80 backdrop-blur-sm md:h-32 md:w-32 md:text-3xl">
                    FH
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#FAF8F5] py-20 md:py-28">
        <div className="container relative z-10">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div className="relative z-10">
              <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C69B3E]">Private Advisory</p>
              <h2 className="font-serif text-3xl font-bold leading-[1.05] text-[#152E24] md:text-5xl lg:text-6xl">
                Sell, buy, rent, or invest with <span className="text-[#C69B3E] italic">clear advice.</span>
              </h2>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-[#152E24]/45 md:text-lg">
                Speak with Freehold Property UAE for project sales, secondary market advice, rentals, commercial property, or owner valuation support.
              </p>

              <div className="mt-10 space-y-7 md:mt-12">
                {[
                  ["01", "Project and investment strategy", "Align your budget, area preference, and timeline with current UAE opportunities."],
                  ["02", "Owner sales and leasing support", "Build a valuation, media, buyer profile, and launch plan before going to market."],
                ].map(([number, title, body]) => (
                  <div className="flex items-start gap-5" key={title}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#152E24]/[0.06] bg-white shadow-sm">
                      <span className="font-serif text-lg font-bold text-[#152E24]">{number}</span>
                    </div>
                    <div>
                      <h4 className="mb-1.5 text-base font-bold text-[#152E24]">{title}</h4>
                      <p className="text-sm text-[#152E24]/35">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 -z-10 rounded-3xl bg-gradient-to-tr from-[#C69B3E]/10 via-transparent to-[#152E24]/[0.04] opacity-50 blur-2xl" />
              <div className="relative z-10 rounded-2xl border border-[#152E24]/[0.06] bg-white p-8 shadow-[0_24px_64px_-16px_rgba(21,46,36,0.06)] md:p-10">
                <h3 className="mb-1.5 text-xl font-bold text-[#152E24] md:text-2xl">Request Callback</h3>
                <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.15em] text-[#152E24]/30">Business Bay office</p>
                <form className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#152E24]/35">Full Name</label>
                    <input type="text" name="name" required placeholder="John Doe" className="w-full rounded-xl border border-[#152E24]/[0.06] bg-[#FAF8F5] px-5 py-4 text-sm transition-all focus:border-[#C69B3E]/30 focus:outline-none focus:ring-2 focus:ring-[#C69B3E]/20" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#152E24]/35">WhatsApp or Phone</label>
                    <input type="tel" name="phone" required placeholder="+971 50 417 3622" className="w-full rounded-xl border border-[#152E24]/[0.06] bg-[#FAF8F5] px-5 py-4 text-sm transition-all focus:border-[#C69B3E]/30 focus:outline-none focus:ring-2 focus:ring-[#C69B3E]/20" />
                  </div>
                  <Button type="submit" className="mt-4 h-13 w-full rounded-xl border-0 ore-gradient text-[11px] font-semibold uppercase tracking-[0.12em] md:mt-6 md:h-14">
                    Request Consultation
                    <ArrowRightIcon className="ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-[#152E24]/[0.04] bg-[#FAF8F5] py-20 md:py-24">
        <BlogSection />
      </div>

      <section className="relative overflow-hidden bg-[#152E24] pb-24 pt-20 text-white md:pb-32 md:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_20%,rgba(198,155,62,0.08),transparent)]" />
        <div className="container relative z-10 text-center">
          <h2 className="mx-auto mb-6 max-w-3xl font-serif text-3xl font-bold text-white md:text-5xl lg:text-6xl">
            Work with <span className="ore-text-gradient">Freehold Property UAE.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/40 md:text-lg">
            Schedule a consultation for buying, selling, renting, project sales, or investment advisory.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 md:mt-14">
            <Button size="lg" className="h-13 w-full rounded-xl bg-white px-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#152E24] shadow-lg transition-all hover:bg-white/90 sm:h-14 sm:w-auto sm:px-10" asChild>
              <Link href="/contact">Schedule Consultation</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-13 w-full rounded-xl border-white/15 px-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 transition-all hover:border-[#D4AC50]/30 hover:bg-white/[0.06] hover:text-white sm:h-14 sm:w-auto sm:px-10" asChild>
              <Link href="/market">Market Intelligence</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
