import { HeroWithMotion } from "@/components/hero-with-motion"
import { FeaturedProperties } from "@/components/featured-properties"
import { MarketSnapshot } from "@/components/market-snapshot"
import { BlogSection } from "@/components/blog-section"
import { IntelligenceBlock } from "@/components/IntelligenceBlock"
import { getIntelligenceBlockData } from "@/lib/intelligence-block"
import { HomeCallbackForm } from "@/components/home-callback-form"
import { COMPANY_WHATSAPP_URL } from "@/lib/site"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

// ─── Icon helpers ──────────────────────────────────────────────────────────────

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
)
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
)
const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
  </svg>
)
const BrainIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>
  </svg>
)
const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
)
const MessageCircleIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
)
const PhoneIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02z"/>
  </svg>
)
const CheckIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)

const heroPrompts = [
  "Freehold shortlist under AED 2M",
  "Beachfront picks in Dubai Marina",
  "Downtown off-plan opportunities",
]

const mobileQuickLinks = [
  { label: "Damac Lagoons",   href: "/projects/damac-lagoons" },
  { label: "Dubai Marina",    href: "/projects?area=marina" },
  { label: "Downtown",        href: "/projects?area=downtown" },
  { label: "Palm Jumeirah",   href: "/projects?area=palm-jumeirah" },
]

const developers = [
  "Emaar",
  "DAMAC",
  "Meraas",
  "Sobha",
  "Aldar",
  "Azizi",
  "Nakheel",
  "Select Group",
  "Ellington",
  "Danube",
  "Binghatti",
  "Omniyat",
  "Arada",
  "Samana",
  "Dubai Properties",
  "MAG",
  "Deyaar",
  "Bloom",
  "Reportage",
  "Object 1",
  "Tiger",
  "Majid Al Futtaim",
]

const advantages = [
  {
    icon: SparklesIcon,
    title: "AI-powered advisory",
    body: "Ask anything — shortlist projects, compare ROI, build an investment brief. Our AI knows Dubai's market like a seasoned broker.",
    span: "md:col-span-8",
    href: "/chat",
    cta: "Try the AI",
  },
  {
    icon: TrendingUpIcon,
    title: "Market confidence",
    body: "Live data on yields, transaction volumes, and price trends across every Dubai area.",
    span: "md:col-span-4",
    href: "/projects",
    cta: null,
  },
  {
    icon: ShieldCheckIcon,
    title: "RERA licensed",
    body: "Fully regulated, DLD registered, with complete transparency from inquiry to title deed.",
    span: "md:col-span-4",
    href: "/about",
    cta: null,
  },
  {
    icon: BrainIcon,
    title: "End-to-end execution",
    body: "Valuation, media, buyer profiling, negotiation, and handover — one team, clean process.",
    span: "md:col-span-8",
    href: "/contact",
    cta: "Speak with an advisor",
  },
]

const advisorySteps = [
  ["01", "Discovery call", "Understand your budget, goals, residency needs, and ideal timeline."],
  ["02", "Curated shortlist", "AI-generated + advisor-reviewed matches tailored to your profile."],
  ["03", "Deal & handover", "Negotiation, paperwork, payment coordination, and title deed support."],
]

export default async function Home() {
  const intelligenceData = await getIntelligenceBlockData()

  return (
    <div className="overflow-x-clip">

      {/* ── Mobile entry ──────────────────────────────────────────────── */}
      <div className="block lg:hidden bg-[#0A1F17] px-5 pt-12 pb-8 text-white">
        <div className="mb-6">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AC50]">Freehold</span>
          <h1 className="mt-2 text-[30px] font-bold leading-[1.08] text-white font-serif">
            Invest smarter in<br/>Dubai real estate.
          </h1>
          <p className="mt-3 text-[13px] text-white/45 leading-relaxed">
            AI-powered shortlists, curated projects, expert advisory.
          </p>
        </div>

        <div className="space-y-2">
          {[
            "Damac Lagoons — tell me more",
            "2BR under AED 1.5M in Marina",
            "Best ROI projects right now",
            "Golden Visa eligibility guide",
          ].map((q) => (
            <Link
              key={q}
              href={`/chat?q=${encodeURIComponent(q)}`}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-[13px] text-white/65 transition hover:bg-white/[0.07]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C69B3E]/20 text-[#D4AC50]">
                <SparklesIcon className="h-3 w-3" />
              </span>
              {q}
            </Link>
          ))}
        </div>

        <Link
          href="/chat"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#C69B3E] py-3.5 text-[13px] font-semibold text-[#0A1F17]"
        >
          Open AI Assistant
        </Link>
      </div>

      {/* Mobile quick links */}
      <div className="block lg:hidden bg-[#0A1F17] px-5 pb-8 border-t border-white/[0.04]">
        <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/25">Browse</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
          {mobileQuickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[12px] text-white/55 transition hover:bg-white/[0.07]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Desktop hero ─────────────────────────────────────────────── */}
      <div className="hidden lg:block">
        <HeroWithMotion heroPrompts={heroPrompts} />
      </div>

      {/* ── Developer trust strip ────────────────────────────────────── */}
      <div className="relative border-y border-white/[0.04] bg-[#0A1F17] py-6">
        <div className="container">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <p className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.25em] text-white/25">
              Authorized dealer for
            </p>
            <div className="flex w-full items-center gap-0 overflow-x-auto">
              {developers.map((dev, i) => (
                <span key={dev} className="flex shrink-0 items-center">
                  <span className="whitespace-nowrap px-4 text-[13px] font-semibold text-white/40 transition-colors hover:text-white/70">
                    {dev}
                  </span>
                  {i < developers.length - 1 && (
                    <span className="text-white/[0.12]">·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Intelligence block ───────────────────────────────────────── */}
      <div className="hidden md:block">
        <IntelligenceBlock data={intelligenceData} />
      </div>

      {/* ── Featured properties ──────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#152E24]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_0%,rgba(198,155,62,0.06),transparent)]" />
        <FeaturedProperties />
      </div>

      {/* ── Market snapshot ──────────────────────────────────────────── */}
      <MarketSnapshot />

      {/* ── Freehold Advantage bento grid ───────────────────────────── */}
      <div className="hidden md:block">
        <section className="relative overflow-hidden bg-[#0A1F17] py-24 text-white md:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_20%_60%,rgba(198,155,62,0.06),transparent)]" />
          <div className="container relative z-10">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AC50]">
                The Freehold Advantage
              </p>
              <h2 className="font-serif text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                A brokerage with{" "}
                <span className="freehold-text-gradient">market intelligence.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              {advantages.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.035] p-8 transition-all hover:border-white/[0.1] hover:bg-white/[0.055] md:p-10 ${item.span}`}
                  >
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      <div>
                        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#C69B3E]/12 text-[#D4AC50]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="font-serif mb-3 text-2xl font-bold text-white">{item.title}</h3>
                        <p className="max-w-lg text-sm leading-relaxed text-white/40">{item.body}</p>
                      </div>
                      {item.cta && (
                        <div className="mt-8">
                          <Link
                            href={item.href}
                            className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#D4AC50] transition-all group-hover:gap-4"
                          >
                            {item.cta} <ArrowRightIcon />
                          </Link>
                        </div>
                      )}
                    </div>
                    {/* Subtle corner glow */}
                    <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#C69B3E]/[0.04] blur-2xl transition-opacity group-hover:opacity-150" />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ── Why Freehold trust band ──────────────────────────────────── */}
      <section className="relative bg-[#F2EFE8] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.012]"
          style={{ backgroundImage: "radial-gradient(circle, #152E24 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="container relative z-10">
          <div className="mb-14 text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C69B3E]">Why Freehold</p>
            <h2 className="font-serif text-3xl font-bold text-[#152E24] md:text-4xl lg:text-5xl">
              Local expertise, clean execution.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#152E24]/45">
              Decades of combined experience in Dubai real estate — transactions, project sales, and investment advisory, backed by an AI platform that never sleeps.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { stat: "RERA", label: "Licensed & DLD registered", body: "Fully regulated brokerage with complete transparency from first inquiry to title deed." },
              { stat: "AI-led", label: "Market intelligence", body: "Live data on yields, transactions, and price trends across every freehold area in Dubai." },
              { stat: "End-to-end", label: "One accountable team", body: "Valuation, media, buyer profiling, negotiation, and handover handled in a single clean process." },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#152E24]/[0.07] bg-white/70 p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <p className="font-serif text-3xl font-bold text-[#C69B3E]">{item.stat}</p>
                <h3 className="mt-3 font-serif text-lg font-bold text-[#152E24]">{item.label}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#152E24]/50">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Private Advisory + form ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#152E24] py-20 text-white md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_5%_50%,rgba(198,155,62,0.06),transparent)]" />
        <div className="container relative z-10">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            {/* Left: content */}
            <div>
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AC50]">Private Advisory</p>
              <h2 className="font-serif text-3xl font-bold leading-[1.06] text-white md:text-5xl">
                Buy, sell, rent, or invest<br className="hidden lg:block" />
                <span className="italic text-[#D4AC50]"> with clear advice.</span>
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/40">
                Speak with Freehold for project sales, secondary market, rentals, commercial, or owner valuation support.
              </p>

              <div className="mt-10 space-y-7">
                {advisorySteps.map(([num, title, body]) => (
                  <div key={num} className="flex items-start gap-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
                      <span className="font-serif text-base font-bold text-[#D4AC50]">{num}</span>
                    </div>
                    <div>
                      <h4 className="mb-1 text-[15px] font-bold text-white">{title}</h4>
                      <p className="text-sm text-white/35">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: request form */}
            <div className="relative">
              <div className="absolute -inset-8 -z-10 rounded-3xl bg-gradient-to-tr from-[#C69B3E]/[0.08] to-transparent blur-3xl" />
              <div className="relative z-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.05] p-8 backdrop-blur-xl md:p-10">
                {/* Decorative corner */}
                <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-[#C69B3E]/[0.04]" />
                <h3 className="mb-1 text-xl font-bold text-white md:text-2xl">Request a Callback</h3>
                <p className="mb-8 text-[11px] font-medium uppercase tracking-[0.15em] text-white/25">
                  Business Bay office · Dubai, UAE
                </p>
                <HomeCallbackForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Blog / insights ──────────────────────────────────────────── */}
      <div className="border-t border-[#152E24]/[0.04] bg-[#F2EFE8] py-20 md:py-24">
        <BlogSection />
      </div>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0A1F17] py-24 text-white md:py-32">
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(198,155,62,0.07),transparent)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#C69B3E]/30 to-transparent" />
        </div>

        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#C69B3E]/25 bg-[#C69B3E]/[0.08] px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AC50]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AC50]">
                Freehold Property UAE
              </span>
            </div>

            <h2 className="font-serif text-4xl font-bold leading-[1.06] text-white md:text-5xl lg:text-6xl">
              Work with Dubai's{" "}
              <span className="freehold-text-gradient">most intelligent</span>{" "}
              brokerage.
            </h2>

            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/40">
              Buying, selling, renting, or investing — our advisors and AI platform are ready for your next move.
            </p>

            {/* What's included */}
            <div className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-x-8 gap-y-2.5 text-left">
              {[
                "Free initial consultation",
                "AI-powered shortlist",
                "DLD & RERA guidance",
                "Golden Visa advice",
                "Post-purchase support",
                "Off-plan expertise",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-[12px] text-white/45">
                  <CheckIcon className="h-3.5 w-3.5 text-[#D4AC50]" />
                  {item}
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/contact"
                className="freehold-gradient inline-flex h-13 items-center gap-2 rounded-xl px-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#152E24] shadow-lg transition hover:brightness-105 sm:h-14"
              >
                Schedule Consultation
                <ArrowRightIcon />
              </Link>
              <Link
                href="/chat"
                className="inline-flex h-13 items-center gap-2 rounded-xl border border-white/15 px-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 transition hover:border-white/30 hover:text-white sm:h-14"
              >
                <MessageCircleIcon className="h-4 w-4" />
                Chat with AI
              </Link>
              <a
                href={COMPANY_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-13 items-center gap-2 rounded-xl border border-white/15 px-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 transition hover:border-emerald-400/30 hover:text-emerald-400 sm:h-14"
              >
                <PhoneIcon className="h-4 w-4" />
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
