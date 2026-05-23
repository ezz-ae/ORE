import { TrendingUp, BarChart3, Target, Users } from 'lucide-react'

const SOURCE_BREAKDOWN = [
  { source: 'WhatsApp inbound', leads: 47, conversion: 28, color: 'bg-emerald-400' },
  { source: 'Property page form', leads: 32, conversion: 22, color: 'bg-[#D4AF37]' },
  { source: 'Meta Ads (warm)', leads: 24, conversion: 19, color: 'bg-sky-400' },
  { source: 'Referral', leads: 18, conversion: 41, color: 'bg-violet-400' },
  { source: 'Cold outbound', leads: 12, conversion: 7, color: 'bg-rose-400' },
]

const MONTHLY = [
  { month: 'Jan', revenue: 18.4, deals: 6 },
  { month: 'Feb', revenue: 22.1, deals: 8 },
  { month: 'Mar', revenue: 19.7, deals: 7 },
  { month: 'Apr', revenue: 27.5, deals: 10 },
  { month: 'May', revenue: 32.0, deals: 12 },
]

const MAX_LEADS = Math.max(...SOURCE_BREAKDOWN.map((s) => s.leads))
const MAX_REV = Math.max(...MONTHLY.map((m) => m.revenue))

export default function CrmReportsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <TrendingUp className="h-3.5 w-3.5" /> Reports
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
            Lead intelligence<br/><span className="text-white/35">at a glance.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/55">
            Source mix, conversion velocity, and monthly revenue trend. Pulled nightly from HubSpot · WhatsApp Business · Meta Ads.
          </p>

          {/* KPI tiles */}
          <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Leads MTD', value: '133', delta: '+18%', tone: 'text-emerald-300' },
              { label: 'Conversion', value: '23%', delta: '+4pp', tone: 'text-emerald-300' },
              { label: 'Avg. Deal', value: 'AED 2.4M', delta: '+12%', tone: 'text-emerald-300' },
              { label: 'Revenue', value: 'AED 32M', delta: '+16%', tone: 'text-emerald-300' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">{kpi.label}</div>
                <div className="mt-3 text-[28px] font-semibold text-white">{kpi.value}</div>
                <div className={`mt-1 text-[12px] ${kpi.tone}`}>{kpi.delta} vs last month</div>
              </div>
            ))}
          </div>

          {/* Source breakdown */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-2">
              <Target className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-[18px] font-semibold text-white">Lead Sources</h2>
            </div>
            <div className="rounded-[24px] border border-white/[0.06] bg-[#0A0D10] p-6 sm:p-8">
              <div className="space-y-5">
                {SOURCE_BREAKDOWN.map((src) => (
                  <div key={src.source}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-white/80">{src.source}</span>
                      <span className="text-white/45">{src.leads} leads · <span className="text-emerald-300">{src.conversion}% conv.</span></span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className={`h-full ${src.color}`} style={{ width: `${(src.leads / MAX_LEADS) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Monthly trend */}
          <section className="mt-14">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#D4AF37]" />
              <h2 className="text-[18px] font-semibold text-white">Monthly Revenue</h2>
            </div>
            <div className="rounded-[24px] border border-white/[0.06] bg-[#0A0D10] p-6 sm:p-8">
              <div className="grid grid-cols-5 gap-3 sm:gap-5">
                {MONTHLY.map((m) => (
                  <div key={m.month} className="flex flex-col items-center gap-3">
                    <div className="flex h-32 w-full items-end overflow-hidden rounded-lg bg-white/[0.03]">
                      <div
                        className="w-full rounded-lg bg-gradient-to-t from-[#D4AF37]/70 to-[#D4AF37]/30"
                        style={{ height: `${(m.revenue / MAX_REV) * 100}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-[13px] font-semibold text-white">AED {m.revenue}M</div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">{m.month} · {m.deals}d</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-[20px] border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.06] to-transparent p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]">Top Channel</div>
              <div className="mt-3 text-[16px] font-semibold text-white">Referral</div>
              <div className="mt-1 text-[12px] text-white/55">41% conversion — 2× team average</div>
            </div>

            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <Users className="h-3 w-3" /> Cohort Watch
              </div>
              <div className="mt-3 text-[14px] font-semibold text-white">Golden Visa buyers</div>
              <div className="mt-2 text-[12px] leading-relaxed text-white/55">
                12 leads this month tagged &quot;GV-eligible&quot; — 4 already at Viewing stage.
              </div>
            </div>

            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Next Report</div>
              <div className="mt-3 text-[14px] text-white/80">Weekly · Mondays 09:00 GST</div>
              <div className="mt-1 text-[12px] text-white/45">Sent to owner + sales leads.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
