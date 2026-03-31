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
    <div className="overflow-x-clip bg-[#FBF9F6]">
      {/* Hero Section */}
      <HeroWithMotion heroPrompts={heroPrompts} />

      <IntelligenceBlock data={intelligenceData} />

      {/* Featured Properties Section */}
      <div className="relative overflow-hidden bg-[#163327] py-20 text-white md:py-24">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <FeaturedProperties />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* Market Snapshot */}
      <div className="relative bg-[#FBF9F6] py-20 md:py-24">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#C5A059]/05 rounded-full blur-[120px] -z-10" />
        <MarketSnapshot />
      </div>

      {/* Features Grid - ORE Elite Advantage */}
      <section className="relative overflow-hidden bg-[#163327] py-20 text-white md:py-28">
        <div className="container relative z-10">
          <div className="mx-auto mb-16 max-w-3xl text-center text-white md:mb-20">
            <div className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-6">
              Exclusive Advantage
            </div>
            <h2 className="font-serif text-4xl font-bold tracking-tighter text-white md:text-6xl">
              Institutional <span className="ore-text-gradient">Capabilities.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
            {/* AI Capability Card */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl transition-all hover:bg-white/10 md:col-span-8 md:rounded-[3rem] md:p-12">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10" />
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-white text-[#163327] shadow-2xl md:mb-8 md:h-20 md:w-20 md:rounded-[2rem]">
                    <SparklesIcon />
                  </div>
                  <h3 className="font-serif mb-4 text-3xl font-bold text-white text-balance md:mb-6 md:text-5xl">Proprietary AI Intelligence</h3>
                  <p className="max-w-xl text-base font-light leading-relaxed text-white/60 md:text-lg">
                    Access real-time data across 45,000+ units. Our engine identifies undervalued opportunities before the market reacts.
                  </p>
                </div>
                <div className="mt-8 flex cursor-pointer items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-primary transition-all group-hover:gap-6 md:mt-12">
                  Learn about our engine <ArrowRightIcon />
                </div>
              </div>
            </div>

            {/* Market Speed Card */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl transition-all hover:bg-white/10 md:col-span-4 md:rounded-[3rem] md:p-10">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary md:mb-8">
                <TrendingUpIcon />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-4 text-white">Market Speed</h3>
              <p className="text-sm font-light leading-relaxed text-white/50 md:text-base">
                Be the first to receive notifications on price drops and new project phase launches.
              </p>
            </div>

            {/* Global Reach Card */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl transition-all hover:bg-white/10 md:col-span-4 md:rounded-[3rem] md:p-10">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary md:mb-8">
                <BuildingIcon />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-4 text-white">Boutique Portfolio</h3>
              <p className="text-sm font-light leading-relaxed text-white/50 md:text-base">
                We focus on high-yield assets and trophy properties, not just volume. Quality over everything.
              </p>
            </div>

            {/* Seamless Experience Card */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl transition-all hover:bg-white/10 md:col-span-8 md:rounded-[3rem] md:p-12">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -z-10" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-12 h-full">
                <div className="max-w-md">
                  <h3 className="font-serif mb-4 text-3xl font-bold text-white md:text-4xl">Seamless Acquisition</h3>
                  <p className="text-white/60 leading-relaxed font-light text-sm md:text-base">
                    From digital selection to Golden Visa processing, we handle the entire investment lifecycle with precision.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-3xl font-bold tracking-[0.2em] text-white/90 backdrop-blur-sm transition-transform group-hover:rotate-0 md:h-40 md:w-40 md:rounded-[2.5rem] md:text-5xl md:rotate-3">
                    AE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Split-Screen Consultation Section */}
      <section className="relative overflow-hidden border-y border-[#163327]/5 bg-[#FBF9F6] py-20 md:py-32">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_70%_50%,rgba(197,160,89,0.05)_0%,transparent_50%)]" />
        <div className="container relative z-10">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            {/* Left Copy */}
            <div className="relative z-10">
              <div className="inline-block px-4 py-1.5 rounded-full border border-[#C5A059]/20 bg-[#C5A059]/05 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059] mb-8">
                Private Advisory
              </div>
              <h2 className="font-serif text-4xl font-bold leading-[0.9] text-[#163327] md:text-6xl lg:text-7xl">
                Expert Guidance.<br />
                <span className="text-[#C5A059] italic">No Obligations.</span>
              </h2>
              <p className="mt-8 max-w-lg text-lg font-light leading-relaxed text-[#163327]/60">
                Connect with ORE&apos;s specialists. We provide tailored market briefs and private viewing arrangements within one business hour.
              </p>
              
              <div className="mt-10 space-y-8 md:mt-14 md:space-y-10">
                <div className="flex items-start gap-5 md:gap-8">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] border border-[#163327]/10 bg-white shadow-lg md:h-16 md:w-16 md:rounded-[1.5rem]">
                    <span className="font-serif font-bold text-[#163327] text-2xl">01</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-[#163327] mb-3">Portfolio Strategy</h4>
                    <p className="text-[#163327]/40 font-light">Align your investment goals with the most promising growth corridors in Dubai.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 md:gap-8">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] border border-[#163327]/10 bg-white shadow-lg md:h-16 md:w-16 md:rounded-[1.5rem]">
                    <span className="font-serif font-bold text-[#163327] text-2xl">02</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-[#163327] mb-3">Curated Intelligence</h4>
                    <p className="text-[#163327]/40 font-light">Receive floorplans, ROI projections, and off-market opportunities directly.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Form */}
            <div className="relative">
              <div className="absolute -inset-10 -z-10 rounded-[4rem] bg-gradient-to-tr from-[#C5A059]/20 via-transparent to-[#163327]/10 blur-3xl opacity-60" />
              <div className="relative z-10 rounded-[2.25rem] border border-[#163327]/10 bg-white p-8 shadow-[0_64px_128px_-32px_rgba(22,51,39,0.1)] md:rounded-[3rem] md:p-12">
                <h3 className="mb-2 text-2xl font-bold text-[#163327] md:text-3xl">Request Callback</h3>
                <p className="mb-8 text-[12px] font-medium uppercase tracking-widest text-[#163327]/40 md:mb-10 md:text-[13px]">Media City Headquarters</p>
                <form className="space-y-6 md:space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-[#163327]/40 font-bold">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="John Doe"
                      className="w-full rounded-2xl border border-[#163327]/10 bg-[#FBF9F6] px-5 py-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 md:px-6 md:py-5"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-[#163327]/40 font-bold">WhatsApp or Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="+971 55 330 8046"
                      className="w-full rounded-2xl border border-[#163327]/10 bg-[#FBF9F6] px-5 py-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 md:px-6 md:py-5"
                    />
                  </div>
                  <Button type="submit" className="mt-3 h-14 w-full rounded-2xl border-0 text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-2xl transition-all hover:scale-[1.02] md:mt-8 md:h-16">
                    Initiate Briefing &rarr;
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <div className="bg-[#FBF9F6] py-24 md:py-28">
        <BlogSection />
      </div>

      {/* Final Bottom CTA */}
      <section className="relative overflow-hidden bg-[#163327] pb-28 pt-24 text-white md:pb-40 md:pt-32">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#C5A059]/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="container relative z-10 text-center">
          <h2 className="mx-auto mb-8 max-w-4xl font-serif text-4xl font-bold leading-[0.95] text-white md:mb-10 md:text-7xl">
            Build Your Dubai <span className="ore-text-gradient">Portfolio.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light leading-relaxed text-white/50 md:mt-8 md:text-xl">
            Schedule a curated briefing with our team to explore high-yield opportunities tailored to your convictions.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 md:mt-16 md:gap-8">
            <Button size="lg" className="h-14 w-full rounded-full bg-white px-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[#163327] shadow-2xl transition-all hover:bg-white/90 sm:h-16 sm:w-auto sm:px-12" asChild>
              <Link href="/contact">Schedule Consultation</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 w-full rounded-full border-white/20 px-8 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white/5 sm:h-16 sm:w-auto sm:px-12" asChild>
              <Link href="/market">Market Intelligence</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
