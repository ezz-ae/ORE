import Link from 'next/link'
import { ArrowUpRight, Database, Search, TrendingUp } from 'lucide-react'
import { projects } from '@/src/data/projects'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function statusTone(s: string) {
  if (s === 'Ready') return { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-400/10 border-emerald-400/20' }
  if (s === 'Under construction') return { dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  return { dot: 'bg-sky-400', text: 'text-sky-200', bg: 'bg-sky-400/10 border-sky-400/20' }
}

function readinessTone(n: number) {
  if (n >= 90) return 'bg-emerald-400'
  if (n >= 80) return 'bg-[#D4AF37]'
  return 'bg-white/30'
}

const topStats = [
  { label: 'Projects indexed', value: projects.length.toString() },
  { label: 'Ready inventory', value: projects.filter(p => p.status === 'Ready').length.toString() },
  { label: 'Avg readiness', value: `${Math.round(projects.reduce((a, p) => a + p.campaignReadiness, 0) / projects.length)}%` },
  { label: 'Coverage', value: '3 Emirates' },
]

export default function MarketIntelligencePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14 lg:pt-16">

      {/* Header */}
      <section className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Database className="h-3.5 w-3.5" /> Market Intelligence
          </div>
          <h1 className="mt-4 text-[40px] font-semibold leading-[1.02] tracking-tight text-white sm:text-[52px]">
            {projects.length} projects.
            <br />
            <span className="text-white/35">Full intelligence layer.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
            Internal market database. Every project carries ad angle, buyer profile, payment plan, readiness score, and sales guidance — not for public use.
          </p>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3 lg:shrink-0 lg:grid-cols-4">
          {topStats.map((s) => (
            <div key={s.label} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
              <div className="text-[26px] font-semibold leading-none text-white">{s.value}</div>
              <div className="mt-1 text-[10px] text-white/35">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Prompt */}
      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about any project, area, payment plan, buyer profile…"
          suggestions={[
            'Which projects are ready for Meta ads today?',
            'Compare Palm Jumeirah vs Dubai Hills for HNW buyers.',
            'Show all off-plan below AED 1M.',
            'What is the best Business Bay angle?',
          ]}
        />
      </section>

      {/* Table */}
      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            All projects · sorted by readiness
          </div>
          <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.06] bg-[#0A0D10] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-white/30" />
            <span className="text-[12px] text-white/30">Filter coming in V1</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0A0D10]">
          {/* Table header */}
          <div className="hidden grid-cols-[2fr_1fr_1fr_0.8fr_2fr_auto] gap-4 border-b border-white/[0.05] px-6 py-3.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 lg:grid">
            <span>Project</span>
            <span>Price from</span>
            <span>Status</span>
            <span>Readiness</span>
            <span>Sales angle</span>
            <span />
          </div>

          <div className="divide-y divide-white/[0.04]">
            {[...projects]
              .sort((a, b) => b.campaignReadiness - a.campaignReadiness)
              .map((project) => {
                const tone = statusTone(project.status)
                return (
                  <Link
                    key={project.id}
                    href={`/freehold-intelligence/apps/market/${project.id}`}
                    className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-white/[0.025] lg:grid lg:grid-cols-[2fr_1fr_1fr_0.8fr_2fr_auto] lg:items-center lg:gap-4 lg:px-6 lg:py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white transition-colors group-hover:text-[#D4AF37]">
                        {project.projectName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-white/40">{project.area} · {project.emirate}</p>
                    </div>

                    <div className="text-[13px] font-medium text-white/80">
                      AED {Number(project.startingPrice).toLocaleString()}
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.bg} ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {project.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className={`h-full rounded-full ${readinessTone(project.campaignReadiness)}`} style={{ width: `${project.campaignReadiness}%` }} />
                      </div>
                      <span className="w-8 text-right text-[11px] tabular-nums text-white/40">{project.campaignReadiness}</span>
                    </div>

                    <p className="hidden truncate text-[13px] text-white/50 lg:block">{project.salesAngle}</p>

                    <ArrowUpRight className="hidden h-4 w-4 text-white/20 transition group-hover:text-[#D4AF37] lg:block" />
                  </Link>
                )
              })}
          </div>
        </div>
      </section>

      {/* Intelligence note */}
      <section className="mt-10 rounded-[20px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-6 py-5">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/80">Internal use only</p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/65">
              Sales angles, ad angles, buyer profiles, and ROI notes are internal intelligence — not for client-facing materials. Use the Notebook to adapt them into approved output.
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
