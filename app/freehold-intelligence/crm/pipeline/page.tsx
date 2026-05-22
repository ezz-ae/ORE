import { Users, ArrowRight, TrendingUp, Clock } from 'lucide-react'

const STAGES = [
  { name: 'New Lead', count: 12, value: 'AED 18M', delta: '+3 today', tone: 'text-emerald-300', dotBg: 'bg-emerald-400/15' },
  { name: 'Contacted', count: 8, value: 'AED 14M', delta: '2 follow-ups due', tone: 'text-sky-300', dotBg: 'bg-sky-400/15' },
  { name: 'Viewing', count: 5, value: 'AED 11M', delta: '3 booked this week', tone: 'text-violet-300', dotBg: 'bg-violet-400/15' },
  { name: 'Negotiation', count: 3, value: 'AED 7.2M', delta: 'Hot — close watch', tone: 'text-[#D4AF37]', dotBg: 'bg-[#D4AF37]/15' },
  { name: 'Won', count: 4, value: 'AED 9.8M', delta: 'MTD: AED 32M', tone: 'text-emerald-200', dotBg: 'bg-emerald-500/20' },
]

const LEADS_BY_STAGE: Record<string, Array<{ name: string; project: string; agent: string; urgency: string }>> = {
  'Negotiation': [
    { name: 'Mohammed A.', project: 'Damac Lagoons', agent: 'Ahmad K.', urgency: 'Close 48h' },
    { name: 'Priya R.', project: 'Emaar Beachfront', agent: 'Sara M.', urgency: 'Counter sent' },
    { name: 'James W.', project: 'Sobha Hartland', agent: 'Ahmad K.', urgency: 'Awaiting offer' },
  ],
  'Viewing': [
    { name: 'Aisha N.', project: 'Marina Vista', agent: 'Sara M.', urgency: 'Today 4pm' },
    { name: 'Carlos M.', project: 'Creek Beach', agent: 'Rami T.', urgency: 'Tomorrow' },
  ],
}

export default function CrmPipelinePage() {
  const totalValue = STAGES.reduce((acc, s) => acc + parseFloat(s.value.replace(/[^0-9.]/g, '')), 0)
  const totalLeads = STAGES.reduce((acc, s) => acc + s.count, 0)

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
            {totalLeads} active leads · AED {totalValue.toFixed(1)}M pipeline · MTD won AED 9.8M. Stage transitions tracked nightly from HubSpot.
          </p>

          {/* Kanban */}
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {STAGES.map((stage) => (
              <div key={stage.name} className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${stage.dotBg.replace('/15', '').replace('/20', '')}`} />
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">{stage.name}</div>
                </div>
                <div className="mt-3 text-[32px] font-semibold text-white">{stage.count}</div>
                <div className="mt-1 text-[12px] font-medium text-white/55">{stage.value}</div>
                <div className={`mt-3 text-[11px] ${stage.tone}`}>{stage.delta}</div>
              </div>
            ))}
          </div>

          {/* Lead snapshots per stage */}
          <div className="mt-14 space-y-10">
            {Object.entries(LEADS_BY_STAGE).map(([stage, leads]) => (
              <section key={stage}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[18px] font-semibold text-white">{stage}</h2>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">{leads.length} active</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {leads.map((lead) => (
                    <div key={lead.name} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-white">{lead.name}</div>
                          <div className="mt-0.5 truncate text-[12px] text-white/45">{lead.project}</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#D4AF37]">{lead.urgency}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-[11px] text-white/40">
                        <span>Agent: <span className="text-white/70">{lead.agent}</span></span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <TrendingUp className="h-3 w-3" /> Conversion Rate
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">23%</div>
              <div className="mt-1 text-[12px] text-emerald-300">+4pp vs last month</div>
            </div>

            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <Clock className="h-3 w-3" /> Avg. Time-to-Close
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">18d</div>
              <div className="mt-1 text-[12px] text-white/50">target: &lt;21 days</div>
            </div>

            <div className="rounded-[20px] border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.05] to-transparent p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]">Stuck Stage</div>
              <div className="mt-3 text-[15px] font-semibold text-white">Viewing → Negotiation</div>
              <div className="mt-2 text-[12px] leading-relaxed text-white/55">
                3 leads sitting &gt;7 days at Viewing without follow-through. Ask Sara M. for outreach plan.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
