import { Button } from "@/components/ui/button"
import { Search, TrendingUp, FileText, Globe, Shield, HeadphonesIcon, Home, Briefcase, Check, ArrowRight } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Real Estate Services in Dubai | Freehold Properties UAE",
  description: "Full-service real estate solutions: property acquisition, investment advisory, Golden Visa support, mortgages, portfolio management, and consultancy for Dubai investors.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Real Estate Services in Dubai | Freehold Properties UAE",
    description: "Property acquisition, investment advisory, Golden Visa support, mortgages, and portfolio management.",
    url: "/services",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Freehold Property UAE Services" }],
  },
}

const services = [
  {
    icon: Search,
    eyebrow: "01 · Acquisition",
    title: "Property Search & Acquisition",
    description: "3,500+ verified Dubai listings curated to your brief. AI-assisted search, viewings, negotiation, and closing.",
    features: ["Personalized shortlist in 24 hrs", "Virtual & in-person viewings", "Negotiation and offer management", "Due diligence and verification", "Transaction coordination"],
  },
  {
    icon: TrendingUp,
    eyebrow: "02 · Advisory",
    title: "Investment Advisory",
    description: "Strategy work tailored to your timeline, risk profile, and yield expectations across Dubai's freehold market.",
    features: ["Market analysis and insights", "ROI projections and modeling", "Portfolio diversification", "Tax and legal frame", "Entry and exit timing"],
  },
  {
    icon: Globe,
    eyebrow: "03 · International",
    title: "International Buyer Support",
    description: "End-to-end handling for offshore buyers — from compliance to remote closings.",
    features: ["Foreign ownership guidance", "Freehold area recommendations", "Currency exchange assistance", "Remote purchase facilitation", "Document translation"],
  },
  {
    icon: Shield,
    eyebrow: "04 · Residency",
    title: "Golden Visa Assistance",
    description: "Long-term UAE residency through qualifying real estate investment, fully supported.",
    features: ["Eligibility assessment", "Qualifying property (AED 2M+)", "Application process guidance", "Documentation support", "Family sponsorship advice"],
  },
  {
    icon: Briefcase,
    eyebrow: "05 · Portfolio",
    title: "Portfolio Management",
    description: "Active oversight of your Dubai assets — performance tracking, rebalancing, and exit planning.",
    features: ["Performance tracking and reporting", "Market value assessments", "Rental yield optimization", "Rebalancing recommendations", "Exit strategy planning"],
  },
  {
    icon: Home,
    eyebrow: "06 · Operations",
    title: "Property Management",
    description: "Tenanting, collections, maintenance, and compliance — your asset, managed.",
    features: ["Tenant sourcing and screening", "Rent collection and accounting", "Maintenance coordination", "Legal compliance", "Inspections"],
  },
  {
    icon: FileText,
    eyebrow: "07 · Financing",
    title: "Mortgage & Financing",
    description: "Direct lines to UAE bank desks and competitive structures for residents and non-residents.",
    features: ["Lender comparison", "Pre-approval assistance", "Foreign buyer mortgages", "Payment plan structuring", "Rate negotiation"],
  },
  {
    icon: HeadphonesIcon,
    eyebrow: "08 · After-Sales",
    title: "After-Sales Support",
    description: "We don't disappear at handover — utilities, furnishing, insurance, and ongoing updates.",
    features: ["Utility connections", "Handover coordination", "Furnishing recommendations", "Insurance guidance", "Market updates"],
  },
]

const principles = [
  { number: "01", title: "Local Expertise", body: "19 years inside the Dubai market with direct developer relationships across launches and resale." },
  { number: "02", title: "Global Perspective", body: "Investors served across 50+ countries with cross-border documentation and remote closings." },
  { number: "03", title: "Technology-Driven", body: "AI shortlists, ROI modeling, and live market signals — built so decisions don't rely on guesswork." },
]

export default function ServicesPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0A1F17] pt-32 pb-24 text-white md:pt-40 md:pb-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[280px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(212,175,55,0.18),transparent)]" />
          <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
        </div>
        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F0D792] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AC50]" />
              Service Coverage
            </span>
            <h1 className="mt-8 font-serif text-5xl font-bold leading-[1.04] tracking-tight md:text-6xl lg:text-7xl">
              End-to-end <span className="freehold-text-gradient italic">Dubai real estate</span> solutions.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/60">
              Eight services. One desk. Curated for international and resident investors who want clarity, speed, and execution.
            </p>
          </div>
        </div>
      </section>

      {/* SERVICES — editorial card grid on layered cream */}
      <section className="relative bg-[#FAF8F5] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_10%,rgba(198,155,62,0.05),transparent)]" />
        <div className="container relative z-10">
          <div className="mb-14 max-w-2xl md:mb-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C69B3E]">What We Cover</p>
            <h2 className="mt-4 font-serif text-3xl font-bold leading-[1.05] text-[#152E24] md:text-5xl">
              Eight disciplines, run by one team.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:gap-7">
            {services.map((s) => {
              const Icon = s.icon
              return (
                <article
                  key={s.title}
                  className="group relative overflow-hidden rounded-[28px] border border-[#152E24]/[0.06] bg-white p-7 shadow-[0_20px_60px_-40px_rgba(21,46,36,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-[#C69B3E]/30 hover:shadow-[0_32px_80px_-40px_rgba(21,46,36,0.28)] md:p-9"
                >
                  {/* Gold thread top */}
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#C69B3E]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="flex items-start justify-between gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C69B3E]/15 to-[#C69B3E]/[0.04] text-[#C69B3E] ring-1 ring-[#C69B3E]/15 md:h-14 md:w-14">
                      <Icon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#152E24]/35">{s.eyebrow}</span>
                  </div>

                  <h3 className="mt-6 font-serif text-2xl font-semibold leading-tight text-[#152E24]">{s.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[#152E24]/55">{s.description}</p>

                  <ul className="mt-6 grid gap-2.5 border-t border-[#152E24]/[0.06] pt-5">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#152E24]/75">
                        <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#C69B3E]/10">
                          <Check className="h-2.5 w-2.5 text-[#C69B3E]" strokeWidth={3} />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* WHY US — dark numbered editorial */}
      <section className="relative overflow-hidden bg-[#152E24] py-24 text-white md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(198,155,62,0.08),transparent)]" />
        <div className="container relative z-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AC50]">Why Freehold</p>
            <h2 className="mt-4 font-serif text-3xl font-bold leading-[1.05] md:text-5xl">
              Built differently for a reason.
            </h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
            {principles.map((p) => (
              <div key={p.title} className="relative rounded-[24px] border border-white/[0.06] bg-white/[0.03] p-8 backdrop-blur-sm transition-all hover:border-[#D4AC50]/30 hover:bg-white/[0.05]">
                <div className="font-serif text-[64px] font-bold leading-none text-[#D4AC50]/25">{p.number}</div>
                <h3 className="mt-4 font-serif text-xl font-semibold text-white md:text-2xl">{p.title}</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-white/55">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#0A1F17] py-24 text-white md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(212,175,55,0.10),transparent)]" />
        <div className="container relative z-10 text-center">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl font-bold leading-[1.05] md:text-5xl">
            Ready to start a brief?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base text-white/55 md:text-lg">
            Book a 30-minute call with a senior advisor. We'll discuss the goal, the budget, and the next two moves.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="freehold-gradient h-14 rounded-xl px-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#152E24]" asChild>
              <Link href="/contact">Book Consultation <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 rounded-xl border-white/15 bg-white/5 px-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href="/properties">Explore Properties</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
