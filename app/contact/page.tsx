import { Button } from "@/components/ui/button"
import { Phone, Mail, MapPin, MessageCircle, Instagram, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"
import { ContactEnquiryForm } from "@/components/contact-enquiry-form"

export const metadata = {
  title: "Contact Us",
  description: "Get in touch with Freehold Property UAE - Schedule a consultation, ask questions, or visit our Dubai office.",
  alternates: { canonical: "/contact" },
}

const contactChannels = [
  {
    icon: MessageCircle,
    eyebrow: "Fastest",
    label: "WhatsApp",
    value: "+971 50 417 3622",
    helper: "Available 24/7 · usually answers in minutes",
    href: "https://wa.me/971504173622",
    accent: "from-emerald-500/20 to-emerald-500/[0.05] text-emerald-300 border-emerald-400/25",
  },
  {
    icon: Phone,
    eyebrow: "Direct",
    label: "Call Center",
    value: "+971 50 417 3622",
    helper: "Mon–Sat · 9:00 AM – 7:00 PM (GST)",
    href: "tel:+971504173622",
    accent: "from-[#C69B3E]/20 to-[#C69B3E]/[0.05] text-[#D4AC50] border-[#C69B3E]/25",
  },
  {
    icon: Mail,
    eyebrow: "Detailed",
    label: "Email",
    value: "info@freeholdproperty.ae",
    helper: "Briefings, NDAs, large-document threads",
    href: "mailto:info@freeholdproperty.ae",
    accent: "from-sky-500/20 to-sky-500/[0.05] text-sky-300 border-sky-400/25",
  },
  {
    icon: Instagram,
    eyebrow: "Social",
    label: "Instagram",
    value: "@freeholdproperty",
    helper: "Market notes, launches, behind-the-scenes",
    href: "https://www.instagram.com/freeholdproperty/",
    accent: "from-rose-500/20 to-rose-500/[0.05] text-rose-300 border-rose-400/25",
  },
]

export default function ContactPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0A1F17] pt-32 pb-24 text-white md:pt-40 md:pb-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-1/4 top-0 h-[280px] w-[600px] bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(212,175,55,0.18),transparent)]" />
          <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
        </div>
        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F0D792] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Senior advisors online now
            </span>
            <h1 className="mt-8 font-serif text-5xl font-bold leading-[1.04] tracking-tight md:text-6xl lg:text-7xl">
              Talk to a <span className="freehold-text-gradient italic">Freehold</span> advisor.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/60">
              WhatsApp is fastest. Phone is direct. Email for documents. Pick whatever fits — we route the same to a senior desk.
            </p>
          </div>
        </div>
      </section>

      {/* CHANNELS — premium dark cards */}
      <section className="relative bg-[#152E24] py-20 text-white md:py-24">
        <div className="container">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {contactChannels.map((c) => {
              const Icon = c.icon
              return (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-[#D4AC50]/30 hover:bg-white/[0.05] md:p-7"
                >
                  <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br ${c.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">{c.eyebrow}</p>
                  <h3 className="mt-1.5 font-serif text-xl font-semibold text-white">{c.label}</h3>
                  <p className="mt-3 text-[14px] font-medium text-white/85">{c.value}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">{c.helper}</p>
                  <ArrowRight className="mt-5 h-4 w-4 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-[#D4AC50]" />
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* FORM + INFO */}
      <section className="relative bg-[#FAF8F5] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_20%_50%,rgba(198,155,62,0.04),transparent)]" />
        <div className="container relative z-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
            {/* Office card */}
            <aside>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C69B3E]">Visit Us</p>
              <h2 className="mt-4 font-serif text-3xl font-bold leading-tight text-[#152E24] md:text-4xl">
                Sobha Sapphire,<br/>Business Bay.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-[#152E24]/55">
                Walk-ins welcome by appointment. Coffee, screens, and a senior advisor ready to map your shortlist live.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-4 rounded-2xl border border-[#152E24]/[0.06] bg-white p-5 shadow-[0_10px_30px_-20px_rgba(21,46,36,0.15)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C69B3E]/10 text-[#C69B3E]">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#152E24]/45">Address</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#152E24]">Sobha Sapphire Building, Office 904<br/>Business Bay, Dubai · UAE</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-[#152E24]/[0.06] bg-white p-5 shadow-[0_10px_30px_-20px_rgba(21,46,36,0.15)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C69B3E]/10 text-[#C69B3E]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#152E24]/45">Hours</p>
                    <div className="mt-2 space-y-1 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#152E24]/55">Monday – Saturday</span>
                        <span className="font-semibold text-[#152E24]">9 AM – 7 PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#152E24]/55">Sunday</span>
                        <span className="font-semibold text-[#152E24]">Online only</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] uppercase tracking-[0.16em] text-[#152E24]/40">RERA ORN: 28628</p>
              </div>
            </aside>

            {/* Form card */}
            <div className="relative">
              <div className="absolute -inset-2 -z-10 rounded-[36px] bg-gradient-to-br from-[#C69B3E]/10 via-transparent to-[#152E24]/[0.04] opacity-60 blur-2xl" />
              <div className="relative rounded-[32px] border border-[#152E24]/[0.06] bg-white p-7 shadow-[0_24px_80px_-30px_rgba(21,46,36,0.18)] md:p-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C69B3E]">Briefing Request</p>
                <h2 className="mt-4 font-serif text-3xl font-bold leading-tight text-[#152E24] md:text-4xl">
                  Send a brief.
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-[#152E24]/55">
                  A senior advisor responds the same business day with a curated next-step plan.
                </p>
                <div className="mt-7">
                  <ContactEnquiryForm />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="relative overflow-hidden bg-[#152E24] py-20 text-white md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(212,175,55,0.10),transparent)]" />
        <div className="container relative z-10 text-center">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl font-bold leading-tight md:text-4xl">
            Prefer to explore first?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] text-white/55 md:text-base">
            Open the platform — the chat, projects, and area intelligence are public.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="h-12 rounded-xl bg-white px-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#152E24] hover:bg-white/90" asChild>
              <Link href="/chat">Open AI Assistant</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/5 px-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href="/projects">Browse Projects</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/5 px-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-white/10 hover:text-white" asChild>
              <Link href="/areas">Areas</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
