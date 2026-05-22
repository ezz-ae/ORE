import Link from "next/link"
import { Calculator, CreditCard, BarChart3, Sparkles, LineChart, ArrowUpRight } from "lucide-react"

const tools = [
  {
    title: "ROI Calculator",
    description: "Estimate rental yield, ROI, and cash flow performance on any Dubai property.",
    href: "/tools/roi-calculator",
    icon: Calculator,
    tone: "from-[#C69B3E]/25 to-[#C69B3E]/[0.04] text-[#D4AC50] border-[#C69B3E]/25",
  },
  {
    title: "Payment Simulator",
    description: "Model off-plan installment schedules across handover and post-handover splits.",
    href: "/tools/payment-simulator",
    icon: CreditCard,
    tone: "from-emerald-400/25 to-emerald-400/[0.04] text-emerald-300 border-emerald-400/25",
  },
  {
    title: "Project Comparator",
    description: "Side-by-side compare two projects on price, ROI, payment plan, and amenities.",
    href: "/tools/comparator",
    icon: BarChart3,
    tone: "from-sky-400/25 to-sky-400/[0.04] text-sky-300 border-sky-400/25",
  },
  {
    title: "AI Discovery",
    description: "Tell the AI what you want — it returns matching projects, areas, and shortlists.",
    href: "/tools/ai-discovery",
    icon: Sparkles,
    tone: "from-violet-400/25 to-violet-400/[0.04] text-violet-300 border-violet-400/25",
  },
  {
    title: "Market Tracker",
    description: "Track demand signals, price movement, and area health across Dubai.",
    href: "/tools/market-tracker",
    icon: LineChart,
    tone: "from-rose-400/25 to-rose-400/[0.04] text-rose-300 border-rose-400/25",
  },
]

export const metadata = {
  title: "Investment Tools | Freehold Properties UAE",
  description: "ROI calculator, payment simulator, comparator, AI discovery, market tracker — Dubai property intelligence in one place.",
  alternates: { canonical: "/tools" },
}

export default function ToolsPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0A1F17] pt-32 pb-20 text-white md:pt-40 md:pb-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[280px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(212,175,55,0.16),transparent)]" />
          <div className="absolute -bottom-10 right-0 h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
        </div>
        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F0D792] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AC50]" />
              Investment Tools
            </span>
            <h1 className="mt-8 font-serif text-5xl font-bold leading-[1.04] tracking-tight md:text-6xl lg:text-7xl">
              Run the <span className="freehold-text-gradient italic">numbers</span> before you commit.
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/60">
              Five intelligence tools — calculators, simulators, AI discovery, and live market signals. Built so the decision isn't a guess.
            </p>
          </div>
        </div>
      </section>

      {/* TOOLS GRID — premium dark cards */}
      <section className="relative bg-[#152E24] py-20 text-white md:py-24">
        <div className="container">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-white/[0.12] hover:bg-white/[0.05] hover:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] md:p-8"
                >
                  {/* Top gold thread on hover */}
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AC50]/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="flex items-start justify-between">
                    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border bg-gradient-to-br ${tool.tone}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-white/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#D4AC50]" />
                  </div>

                  <h3 className="mt-8 font-serif text-2xl font-semibold leading-tight text-white">{tool.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/55">{tool.description}</p>

                  <div className="mt-7 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 transition-colors group-hover:text-[#D4AC50]">
                    Open Tool
                    <span className="h-[2px] w-6 bg-current opacity-50 transition-all duration-300 group-hover:w-10 group-hover:opacity-100" />
                  </div>
                </Link>
              )
            })}
          </div>

          {/* AI prompt bar */}
          <div className="mt-12 overflow-hidden rounded-[28px] border border-[#D4AC50]/20 bg-gradient-to-br from-[#D4AC50]/[0.08] via-transparent to-transparent p-7 md:p-10">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AC50]">Or just ask</p>
                <h3 className="mt-3 font-serif text-2xl font-semibold leading-tight text-white md:text-3xl">
                  Don't want to pick a tool? Let the AI do the work.
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-white/55 md:text-[15px]">
                  Open the chat and describe your goal — budget, area, timeline — and the AI returns shortlists, ROI projections, and the next step.
                </p>
              </div>
              <Link
                href="/chat"
                className="freehold-gradient inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#152E24]"
              >
                <Sparkles className="h-4 w-4" />
                Open AI Assistant
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
