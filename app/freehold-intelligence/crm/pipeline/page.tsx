'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { Users, ArrowRight, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { AiPrompt } from '@/components/freehold/ai-prompt'

// Static pipeline value data per stage
const PIPELINE_VALUE_DATA = [
  { stage: 'New',       leads: 12, value: 'AED 12.6M', label: 'pipeline',  dot: 'bg-sky-400'     },
  { stage: 'Follow-up', leads:  8, value: 'AED 9.4M',  label: 'pipeline',  dot: 'bg-amber-400'   },
  { stage: 'Qualified', leads:  5, value: 'AED 7.2M',  label: 'pipeline',  dot: 'bg-violet-400'  },
  { stage: 'Hot',       leads:  6, value: 'AED 11.2M', label: 'pipeline',  dot: 'bg-red-400'     },
  { stage: 'Won (MTD)', leads:  4, value: 'AED 6M',    label: 'closed',    dot: 'bg-[#D4AF37]' },
]

const STAGE_ORDER = ['New', 'Follow-up', 'Qualified', 'Hot', 'Won']

const STAGE_CONFIG: Record<string, { tone: string; dot: string; dotBg: string; value: string }> = {
  'New':       { tone: 'text-slate-400',       dot: 'bg-sky-400',      dotBg: 'bg-sky-400/20',      value: 'AED 12.6M' },
  'Follow-up': { tone: 'text-slate-400',        dot: 'bg-violet-400',   dotBg: 'bg-violet-400/20',   value: 'AED 9.4M'  },
  'Qualified': { tone: 'text-[#D4AF37]',        dot: 'bg-[#D4AF37]',    dotBg: 'bg-[#D4AF37]/20',    value: 'AED 7.2M'  },
  'Hot':       { tone: 'text-red-300',          dot: 'bg-red-400',      dotBg: 'bg-red-400/20',      value: 'AED 11.2M' },
  'Won':       { tone: 'text-[#D4AF37]',        dot: 'bg-[#D4AF37]',    dotBg: 'bg-[#D4AF37]/20',    value: 'AED 9.8M'  },
}

const STAGE_DELTA: Record<string, string> = {
  'New':       '+3 today',
  'Follow-up': '2 follow-ups due',
  'Qualified': 'High intent',
  'Hot':       'Close watch',
  'Won':       'MTD: AED 32M',
}

export default function CrmPipelinePage() {
  const { leads } = useLiveLeads()
  const [activeStage, setActiveStage] = useState<string | null>(null)

  // Compute real stage counts from live lead data
  const stageCounts = useMemo(() => leads.reduce<Record<string, typeof leads>>(
    (acc, lead) => {
      ;(acc[lead.stage] = acc[lead.stage] || []).push(lead)
      return acc
    },
    {},
  ), [leads])

  const stages = useMemo(() => STAGE_ORDER.map((name) => ({
    name,
    leads: stageCounts[name] || [],
    count: (stageCounts[name] || []).length,
    ...(STAGE_CONFIG[name] ?? { tone: 'text-slate-400', dot: 'bg-slate-500', dotBg: 'bg-slate-700', value: '—' }),
    delta: STAGE_DELTA[name] ?? '',
  })), [stageCounts])

  const totalLeads = stages.reduce((s, st) => s + st.count, 0)

  // If a stage is selected, show only that stage; otherwise default to Hot + Qualified
  const spotlight = useMemo(() => {
    if (activeStage) {
      const stage = stages.find((s) => s.name === activeStage)
      return stage && stage.leads.length > 0 ? [{ label: stage.name, leads: stage.leads }] : []
    }
    return stages
      .filter((s) => s.name === 'Hot' || s.name === 'Qualified')
      .filter((s) => s.leads.length > 0)
      .map((s) => ({ label: s.name, leads: s.leads }))
  }, [activeStage, stages])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <Users className="h-3.5 w-3.5" /> Pipeline
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
            Sales pipeline<br/><span className="text-slate-500">by stage.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-slate-400">
            {totalLeads} active lead{totalLeads !== 1 ? 's' : ''} · AED 50.2M pipeline · MTD won AED 9.8M. Stage transitions tracked nightly from HubSpot.
          </p>

          {/* Pipeline Value strip */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PIPELINE_VALUE_DATA.map((item) => (
              <div
                key={item.stage}
                className="rounded-2xl border border-slate-800 bg-slate-800/50 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${item.dot}`} />
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 truncate">
                    {item.stage}
                  </span>
                </div>
                <div className="text-[22px] font-semibold text-white leading-none">{item.leads}</div>
                <div className="mt-0.5 text-xs text-slate-400">lead{item.leads !== 1 ? 's' : ''}</div>
                <div className="mt-3 text-sm font-semibold text-slate-300">{item.value}</div>
                <div className="text-xs text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Kanban — click to filter spotlight below */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stages.map((stage) => {
              const isSelected = activeStage === stage.name
              return (
                <button
                  key={stage.name}
                  onClick={() => setActiveStage(isSelected ? null : stage.name)}
                  className={[
                    'rounded-xl border p-5 text-left transition',
                    isSelected
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.06]'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{stage.name}</div>
                  </div>
                  <div className="mt-3 text-[32px] font-semibold text-white">{stage.count}</div>
                  <div className="mt-1 text-xs font-medium text-slate-400">{stage.value}</div>
                  <div className={`mt-3 text-sm ${stage.tone}`}>{stage.delta}</div>
                </button>
              )
            })}
          </div>

          {activeStage && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-slate-400">Showing</span>
              <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/[0.08] px-3 py-1 text-sm font-medium text-[#D4AF37]">{activeStage}</span>
              <button
                onClick={() => setActiveStage(null)}
                className="text-xs text-slate-500 transition hover:text-slate-300"
              >
                Clear
              </button>
            </div>
          )}

          {/* Lead snapshots — filtered by selected stage, or Hot + Qualified by default */}
          {spotlight.map(({ label, leads }) => (
            <section key={label} className="mt-14">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-white">{label}</h2>
                <span className="text-sm uppercase tracking-[0.18em] text-slate-500">{leads.length} active</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/freehold-intelligence/crm/leads/${lead.id}`}
                    className="group rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-[#D4AF37]/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white group-hover:text-white">{lead.name}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">{lead.source}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-0.5 text-xs font-medium text-[#D4AF37]">
                        {lead.intentScore}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-sm text-slate-400">
                      <span>Agent: <span className="text-slate-300">{lead.assignedAgent}</span></span>
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="mt-14">
            <AiPrompt
              placeholder="Ask about pipeline, stage velocity, conversion…"
              suggestions={[
                'Which stage has the most stalled leads?',
                'Which agents have the most hot leads right now?',
                'What is the average time to move from Qualified to Hot?',
              ]}
            />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <TrendingUp className="h-3 w-3" /> Conversion rate
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">23%</div>
              <div className="mt-1 text-xs text-[#D4AF37]">+4pp vs last month</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Clock className="h-3 w-3" /> Avg. time-to-close
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">18d</div>
              <div className="mt-1 text-xs text-slate-400">target: &lt;21 days</div>
            </div>

            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-red-300/80">
                <AlertCircle className="h-3 w-3" /> Stuck stage
              </div>
              <div className="mt-3 text-sm font-semibold text-white">Follow-up → Qualified</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">
                {(stageCounts['Follow-up'] ?? []).length} lead{(stageCounts['Follow-up'] ?? []).length !== 1 ? 's' : ''} in Follow-up without stage progression this week.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
