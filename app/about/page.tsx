import { Button } from "@/components/ui/button"
import Link from "next/link"

// Inline SVGs for Stability
const TargetIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
)
const EyeIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
)

export const metadata = {
  title: "Our Firm",
  description: "Institutional Dubai property intelligence with 15+ years of conviction and AI-driven excellence.",
  alternates: {
    canonical: "/about",
  },
}

export default function AboutPage() {
  return (
    <div className="bg-[#FBF9F6]">
        {/* Hero Section */}
        <section className="relative bg-[#163327] pt-40 pb-32 md:pt-56 md:pb-48 border-b border-white/05 overflow-hidden text-white">
          <div className="absolute inset-0 z-0 opacity-40">
            <div className="absolute -top-40 -right-20 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_50%_50%,rgba(197,160,89,0.15)_0%,transparent_60%)] rounded-full blur-[120px]" />
          </div>
          <div className="container relative z-10 mx-auto px-6 max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className="max-w-2xl">
                <div className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-10">
                  Institutional Intelligence
                </div>
                <h1 className="font-serif text-6xl font-bold tracking-tight lg:text-8xl text-white leading-[0.95] mb-10">
                  Precision in <br/>
                  <span className="ore-text-gradient">Conviction.</span>
                </h1>
                <p className="text-xl text-white/50 leading-relaxed font-light max-w-xl">
                  ORE is a private advisory delivering premium Dubai real estate intelligence, combining 15+ years of human market expertise with proprietary AI-driven curation.
                </p>
                <div className="mt-16 flex items-center gap-12">
                  <div className="flex flex-col">
                    <span className="text-4xl font-bold text-white">$2B+</span>
                    <span className="text-[10px] text-white/30 mt-2 uppercase tracking-[0.3em] font-bold">AUM Guided</span>
                  </div>
                  <div className="h-12 w-px bg-white/10"></div>
                  <div className="flex flex-col">
                    <span className="text-4xl font-bold text-white">15+</span>
                    <span className="text-[10px] text-white/30 mt-2 uppercase tracking-[0.3em] font-bold">Years Active</span>
                  </div>
                </div>
              </div>
              <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
                <div className="aspect-[4/5] rounded-[3.5rem] bg-white/05 border border-white/10 backdrop-blur-3xl p-12 relative overflow-hidden shadow-2xl flex flex-col justify-end group hover:bg-white/10 transition-all duration-700">
                   <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-[#C5A059]/20 blur-3xl group-hover:bg-[#C5A059]/30 transition-colors"></div>
                   <div className="relative z-10 bg-white/10 backdrop-blur-3xl rounded-[2rem] p-8 border border-white/10">
                     <p className="text-white font-medium italic mb-6 font-serif text-xl leading-relaxed">&ldquo;Navigating Dubai's growth corridors with institutional rigor.&rdquo;</p>
                     <div className="flex items-center gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-white text-[#163327] flex items-center justify-center shrink-0">
                         <TargetIcon />
                       </div>
                       <div>
                         <p className="text-[11px] text-primary uppercase tracking-[0.2em] font-bold">Conviction Desk</p>
                         <p className="text-sm text-white/60 font-light italic">Curated exclusively</p>
                       </div>
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-32 bg-[#FBF9F6]">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="grid gap-20 lg:grid-cols-2 items-start">
              <div className="flex items-start gap-8">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-white border border-[#163327]/05 shadow-xl text-[#163327]">
                  <TargetIcon />
                </div>
                <div>
                  <h2 className="font-serif text-3xl font-bold text-[#163327] mb-4">Our Charter</h2>
                  <p className="text-[#163327]/60 leading-relaxed font-light text-lg">
                    To empower international capital with transparent, data-driven intelligence, making Dubai's premier assets accessible through verified institutional rigor.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-8">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-white border border-[#163327]/05 shadow-xl text-[#163327]">
                  <EyeIcon />
                </div>
                <div>
                  <h2 className="font-serif text-3xl font-bold text-[#163327] mb-4">Our Horizon</h2>
                  <p className="text-[#163327]/60 leading-relaxed font-light text-lg">
                    To be the global standard for Dubai investment intelligence, bridging the gap between high-conviction investors and trophy real estate assets.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-32 bg-[#163327] text-white overflow-hidden relative">
           <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="container mx-auto px-6 max-w-7xl relative z-10">
            <div className="mx-auto max-w-3xl text-center mb-24">
              <h2 className="font-serif text-5xl font-bold tracking-tight md:text-6xl text-white">
                Institutional <span className="ore-text-gradient">Benchmark.</span>
              </h2>
            </div>

            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Years Active", value: "15+" },
                { label: "Assets Guided", value: "$2B+" },
                { label: "Global Desks", value: "50+" },
                { label: "Live Assets", value: "3.6K" }
              ].map((stat, i) => (
                <div key={i} className="text-center p-12 rounded-[2.5rem] bg-white/05 border border-white/05 hover:bg-white/10 transition-all group">
                  <div className="text-6xl font-bold text-white mb-4 group-hover:scale-110 transition-transform duration-500">{stat.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-40 bg-[#FBF9F6]">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="font-serif text-6xl md:text-7xl font-bold tracking-tight text-[#163327] leading-[0.9]">
                Initiate Private<br/>
                <span className="text-[#C5A059] italic">Briefing.</span>
              </h2>
              <p className="mt-10 text-xl text-[#163327]/50 max-w-xl mx-auto font-light leading-relaxed">
                Connect with our senior conviction desk for a personalized market report tailored to your portfolio goals.
              </p>
              <div className="mt-16 flex flex-wrap items-center justify-center gap-8">
                <Button size="lg" className="ore-gradient text-black font-bold uppercase tracking-[0.2em] text-[11px] h-16 px-12 rounded-full shadow-2xl transition-all hover:scale-105 border-0" asChild>
                  <Link href="/contact">Schedule Consultation</Link>
                </Button>
                <Button size="lg" variant="outline" className="h-16 px-12 rounded-full border-[#163327]/10 text-[#163327] font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:bg-[#163327]/05" asChild>
                  <Link href="/properties">Portfolio Access</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
    </div>
  )
}
