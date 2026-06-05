import Link from 'next/link'
import { Users, ArrowRight, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const STAGE_ORDER = ['New', 'Follow-up', 'Qualified', 'Hot', 'Won']

const STAGE_CONFIG: Record<string, { tone: string; dot: string; dotBg: string; value: string }> = {
  'New':       { tone: 'text-sky-300',       dot: 'bg-sky-400',      dotBg: 'bg-sky-400/20',      value: 'AED 12.6M' },
  'Follow-up': { tone: 'text-violet-300',    dot: 'bg-violet-400',   dotBg: 'bg-violet-400/20',   value: 'AED 9.4M'  },
  'Qualified': { tone: 'text-[#D4AF37]',     dot: 'bg-[#D4AF37]',    dotBg: 'bg-[#D4AF37]/20',    value: 'AED 7.2M'  },
  'Hot':       { tone: 'text-red-300',       dot: 'bg-red-400',      dotBg: 'bg-red-400/20',      value: 'AED 11.2M' },
  'Won':       { tone: 'text-emerald-200',   dot: 'bg-emerald-400',  dotBg: 'bg-emerald-500/20',  value: 'AED 9.8M'  },
}

const STAGE_DELTA: Record<string, string> = {
  'New':       '+3 today',
  'Follow-up': '2 follow-ups due',
  'Qualified': 'High intent',
  'Hot':       'Close watch',
  'Won':       'MTD: AED 32M',
}

export default function CrmPipelinePage() {
  // Compute real stage counts from live lead data
  const stageCounts = crmLeads.reduce<Record<string, typeof crmLeads>>(
    (acc, lead) => {
      ;(acc[lead.stage] = acc[lead.stage] || []).push(lead)
      return acc
    },
    {},
  )

  const stages = STAGE_ORDER.map((name) => ({
    name,
    leads: stageCounts[name] || [],
    count: (stageCounts[name] || []).length,
    ...(STAGE_CONFIG[name] ?? { tone: 'text-white/50', dot: 'bg-white/30', dotBg: 'bg-white/10', value: '—' }),
    delta: STAGE_DELTA[name] ?? '',
  }))

  const totalLeads = stages.reduce((s, st) => s + st.count, 0)
  const hotLeads   = stages.find((s) => s.name === 'Hot')?.leads ?? []
  const qualLeads  = stages.find((s) => s.name === 'Qualified')?.leads ?? []

  // Spotlight: hot and qualified (most action-relevant stages)
  const spotlight = [
    { label: 'Hot', leads: hotLeads },
    { label: 'Qualified', leads: qualLeads },
  ].filter((s) => s.leads.length > 0)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Users className="h-3.5 w-3.5" /> Pipeline
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
            Sales pipeline<br/><span className="text-white/35">by stage.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/55">
            {totalLeads} active lead{totalLeads !== 1 ? 's' : ''} · AED 50.2M pipeline · MTD won AED 9.8M. Stage transitions tracked nightly from HubSpot.
          </p>

          {/* Kanban */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stages.map((stage) => (
              <div key={stage.name} className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">{stage.name}</div>
                </div>
                <div className="mt-3 text-[32px] font-semibold text-white">{stage.count}</div>
                <div className="mt-1 text-[12px] font-medium text-white/55">{stage.value}</div>
                <div className={`mt-3 text-[11px] ${stage.tone}`}>{stage.delta}</div>
              </div>
            ))}
          </div>

          {/* Lead snapshots — hot & qualified only */}
          {spotlight.map(({ label, leads }) => (
            <section key={label} className="mt-14">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-white">{label}</h2>
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">{leads.length} active</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/freehold-intelligence/crm/leads/${lead.id}`}
                    className="group rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-[#D4AF37]/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold text-white group-hover:text-white">{lead.name}</div>
                        <div className="mt-0.5 truncate text-[12px] text-white/45">{lead.source}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#D4AF37]">
                        {lead.intentScore}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-[11px] text-white/40">
                      <span>Agent: <span className="text-white/70">{lead.assignedAgent}</span></span>
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
            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <TrendingUp className="h-3 w-3" /> Conversion rate
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">23%</div>
              <div className="mt-1 text-[12px] text-emerald-300">+4pp vs last month</div>
            </div>

            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <Clock className="h-3 w-3" /> Avg. time-to-close
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">18d</div>
              <div className="mt-1 text-[12px] text-white/50">target: &lt;21 days</div>
            </div>

            <div className="rounded-[20px] border border-red-400/20 bg-red-400/[0.04] p-5">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-red-300/80">
                <AlertCircle className="h-3 w-3" /> Stuck stage
              </div>
              <div className="mt-3 text-[15px] font-semibold text-white">Follow-up → Qualified</div>
              <div className="mt-2 text-[12px] leading-relaxed text-white/55">
                {(stageCounts['Follow-up'] || []).length} lead{(stageCounts['Follow-up'] || []).length !== 1 ? 's' : ''} in Follow-up without stage progression this week.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
