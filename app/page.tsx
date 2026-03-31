import { HeroWithMotion } from "@/components/hero-with-motion"
import { FeaturedProperties } from "@/components/featured-properties"
import { MarketSnapshot } from "@/components/market-snapshot"
import { BlogSection } from "@/components/blog-section"
import { Button } from "@/components/ui/button"
import { IntelligenceBlock } from "@/components/IntelligenceBlock"
import { getIntelligenceBlockData } from "@/lib/intelligence-block"
import Link from "next/link"

// Inline SVGs for Stability
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
  "Best ROI projects in 2026",
  "Beachfront properties in Marina",
  "Off-plan projects in Downtown",
]

export default async function Home() {
  const intelligenceData = await getIntelligenceBlockData()

  return (
    <div className="overflow-x-clip">
      {/* Hero Section */}
      <HeroWithMotion heroPrompts={heroPrompts} />

      <IntelligenceBlock data={intelligenceData} />

      {/* Featured Properties Section */}
      <div className="relative overflow-hidden bg-[#152E24] py-20 text-white md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(198,155,62,0.06),transparent)]" />
        <FeaturedProperties />
      </div>

      {/* Market Snapshot */}
      <div className="relative bg-[#FAF8F5] py-20 md:py-24">
        <MarketSnapshot />
      </div>

      {/* Features Grid - ORE Elite Advantage */}
      <section className="relative overflow-hidden bg-[#152E24] py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_50%,rgba(198,155,62,0.05),transparent)]" />
        <div className="container relative z-10">
          <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
            <p className="text-[11px] font-semibold text-[#D4AC50] uppercase tracking-[0.2em] mb-4">Exclusive Advantage</p>
            <h2 className="font-serif text-3xl font-bold text-white md:text-5xl lg:text-6xl">
              Institutional <span className="ore-text-gradient">Capabilities.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
            {/* AI Capability Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-8 md:p-10">
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-white text-[#152E24] shadow-lg md:h-16 md:w-16">
                    <SparklesIcon />
                  </div>
                  <h3 className="font-serif mb-4 text-2xl font-bold text-white md:text-4xl">Proprietary AI Intelligence</h3>
                  <p className="max-w-xl text-sm leading-relaxed text-white/45 md:text-base">
                    Access real-time data across 45,000+ units. Our engine identifies undervalued opportunities before the market reacts.
                  </p>
                </div>
                <div className="mt-8 flex cursor-pointer items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#D4AC50] transition-all group-hover:gap-5">
                  Learn about our engine <ArrowRightIcon />
                </div>
              </div>
            </div>

            {/* Market Speed Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-4 md:p-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#C69B3E]/10 text-[#D4AC50]">
                <TrendingUpIcon />
              </div>
              <h3 className="font-serif text-xl font-bold mb-3 text-white">Market Speed</h3>
              <p className="text-sm leading-relaxed text-white/40">
                Be the first to receive notifications on price drops and new project phase launches.
              </p>
            </div>

            {/* Global Reach Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-4 md:p-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#C69B3E]/10 text-[#D4AC50]">
                <BuildingIcon />
              </div>
              <h3 className="font-serif text-xl font-bold mb-3 text-white">Boutique Portfolio</h3>
              <p className="text-sm leading-relaxed text-white/40">
                We focus on high-yield assets and trophy properties, not just volume. Quality over everything.
              </p>
            </div>

            {/* Seamless Experience Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 transition-all hover:bg-white/[0.06] md:col-span-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 h-full">
                <div className="max-w-md">
                  <h3 className="font-serif mb-4 text-2xl font-bold text-white md:text-3xl">Seamless Acquisition</h3>
                  <p className="text-white/45 leading-relaxed text-sm md:text-base">
                    From digital selection to Golden Visa processing, we handle the entire investment lifecycle with precision.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.04] text-2xl font-bold tracking-[0.15em] text-white/80 backdrop-blur-sm md:h-32 md:w-32 md:text-3xl">
                    AE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Split-Screen Consultation Section */}
      <section className="relative overflow-hidden bg-[#FAF8F5] py-20 md:py-28">
        <div className="container relative z-10">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            {/* Left Copy */}
            <div className="relative z-10">
              <p className="text-[11px] font-semibold text-[#C69B3E] uppercase tracking-[0.2em] mb-6">Private Advisory</p>
              <h2 className="font-serif text-3xl font-bold leading-[1.05] text-[#152E24] md:text-5xl lg:text-6xl">
                Expert Guidance.<br />
                <span className="text-[#C69B3E] italic">No Obligations.</span>
              </h2>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-[#152E24]/45 md:text-lg">
                Connect with ORE&apos;s specialists. We provide tailored market briefs and private viewing arrangements within one business hour.
              </p>

              <div className="mt-10 space-y-7 md:mt-12">
                <div className="flex items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#152E24]/[0.06] bg-white shadow-sm">
                    <span className="font-serif font-bold text-[#152E24] text-lg">01</span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#152E24] mb-1.5">Portfolio Strategy</h4>
                    <p className="text-[#152E24]/35 text-sm">Align your investment goals with the most promising growth corridors in Dubai.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#152E24]/[0.06] bg-white shadow-sm">
                    <span className="font-serif font-bold text-[#152E24] text-lg">02</span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#152E24] mb-1.5">Curated Intelligence</h4>
                    <p className="text-[#152E24]/35 text-sm">Receive floorplans, ROI projections, and off-market opportunities directly.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Form */}
            <div className="relative">
              <div className="absolute -inset-8 -z-10 rounded-3xl bg-gradient-to-tr from-[#C69B3E]/10 via-transparent to-[#152E24]/[0.04] blur-2xl opacity-50" />
              <div className="relative z-10 rounded-2xl border border-[#152E24]/[0.06] bg-white p-8 shadow-[0_24px_64px_-16px_rgba(21,46,36,0.06)] md:p-10">
                <h3 className="mb-1.5 text-xl font-bold text-[#152E24] md:text-2xl">Request Callback</h3>
                <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.15em] text-[#152E24]/30">Media City Headquarters</p>
                <form className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.15em] text-[#152E24]/35 font-semibold">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="John Doe"
                      className="w-full rounded-xl border border-[#152E24]/[0.06] bg-[#FAF8F5] px-5 py-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#C69B3E]/20 focus:border-[#C69B3E]/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.15em] text-[#152E24]/35 font-semibold">WhatsApp or Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="+971 55 330 8046"
                      className="w-full rounded-xl border border-[#152E24]/[0.06] bg-[#FAF8F5] px-5 py-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#C69B3E]/20 focus:border-[#C69B3E]/30"
                    />
                  </div>
                  <Button type="submit" className="mt-4 h-13 w-full rounded-xl border-0 ore-gradient text-[11px] font-semibold uppercase tracking-[0.12em] md:mt-6 md:h-14">
                    Initiate Briefing
                    <ArrowRightIcon className="ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <div className="bg-[#FAF8F5] py-20 md:py-24 border-t border-[#152E24]/[0.04]">
        <BlogSection />
      </div>

      {/* Final Bottom CTA */}
      <section className="relative overflow-hidden bg-[#152E24] pb-24 pt-20 text-white md:pb-32 md:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_20%,rgba(198,155,62,0.08),transparent)]" />
        <div className="container relative z-10 text-center">
          <h2 className="mx-auto mb-6 max-w-3xl font-serif text-3xl font-bold text-white md:text-5xl lg:text-6xl">
            Build Your Dubai <span className="ore-text-gradient">Portfolio.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/40 md:text-lg">
            Schedule a curated briefing with our team to explore high-yield opportunities tailored to your convictions.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 md:mt-14">
            <Button size="lg" className="h-13 w-full rounded-xl bg-white px-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#152E24] shadow-lg transition-all hover:bg-white/90 sm:h-14 sm:w-auto sm:px-10" asChild>
              <Link href="/contact">Schedule Consultation</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-13 w-full rounded-xl border-white/10 px-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-white/[0.06] sm:h-14 sm:w-auto sm:px-10" asChild>
              <Link href="/market">Market Intelligence</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
