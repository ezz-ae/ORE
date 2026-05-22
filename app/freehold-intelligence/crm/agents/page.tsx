import { UserCheck, Phone, MessageSquare, TrendingUp } from 'lucide-react'

const AGENTS = [
  {
    name: 'Ahmad K.',
    role: 'Senior Advisor',
    initials: 'AK',
    leads: 12,
    hot: 3,
    won: 4,
    avgClose: '14d',
    revenue: 'AED 11.2M',
    status: 'Active',
    statusTone: 'emerald',
    specialty: 'Off-plan · Damac · Sobha',
  },
  {
    name: 'Sara M.',
    role: 'Investment Advisor',
    initials: 'SM',
    leads: 9,
    hot: 2,
    won: 3,
    avgClose: '17d',
    revenue: 'AED 8.5M',
    status: 'Active',
    statusTone: 'emerald',
    specialty: 'Beachfront · Golden Visa',
  },
  {
    name: 'Rami T.',
    role: 'Brokerage Associate',
    initials: 'RT',
    leads: 7,
    hot: 1,
    won: 2,
    avgClose: '22d',
    revenue: 'AED 4.8M',
    status: 'Follow-up delayed',
    statusTone: 'amber',
    specialty: 'Secondary · Marina · JVC',
  },
]

const TONE_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
  amber: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/25',
}

export default function CrmAgentsPage() {
  const totalLeads = AGENTS.reduce((s, a) => s + a.leads, 0)
  const totalWon = AGENTS.reduce((s, a) => s + a.won, 0)
  const totalRevenue = AGENTS.reduce((s, a) => s + parseFloat(a.revenue.replace(/[^0-9.]/g, '')), 0)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <UserCheck className="h-3.5 w-3.5" /> Agents
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
            Sales team<br/><span className="text-white/35">performance.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/55">
            {AGENTS.length} active advisors · {totalLeads} live leads · MTD revenue AED {totalRevenue.toFixed(1)}M. Watch follow-up cadence and time-to-close.
          </p>

          <div className="mt-12 space-y-4">
            {AGENTS.map((agent) => (
              <div key={agent.name} className="rounded-[24px] border border-white/[0.06] bg-[#0A0D10] p-5 transition hover:border-white/10 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 text-[15px] font-semibold text-[#D4AF37]">
                      {agent.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-[18px] font-semibold text-white">{agent.name}</h3>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${TONE_CLASSES[agent.statusTone]}`}>{agent.status}</span>
                      </div>
                      <div className="mt-1 text-[12px] text-white/45">{agent.role} · {agent.specialty}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-5 sm:gap-7">
                    <div>
                      <div className="text-[22px] font-semibold text-white">{agent.leads}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Leads</div>
                    </div>
                    <div>
                      <div className="text-[22px] font-semibold text-red-400">{agent.hot}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Hot</div>
                    </div>
                    <div>
                      <div className="text-[22px] font-semibold text-emerald-300">{agent.won}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Won</div>
                    </div>
                    <div>
                      <div className="text-[22px] font-semibold text-white">{agent.avgClose}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Avg.</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.05] pt-4">
                  <div className="text-[12px] text-white/55">MTD Revenue · <span className="font-semibold text-white/80">{agent.revenue}</span></div>
                  <div className="flex items-center gap-2">
                    <button className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.06]">
                      <Phone className="h-3 w-3" /> Call
                    </button>
                    <button className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.06]">
                      <MessageSquare className="h-3 w-3" /> Message
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-5">
            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <TrendingUp className="h-3 w-3" /> Team MTD
              </div>
              <div className="mt-3 text-[34px] font-semibold text-white">AED {totalRevenue.toFixed(1)}M</div>
              <div className="mt-1 text-[12px] text-emerald-300">{totalWon} closes this month</div>
            </div>

            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Top Performer</div>
              <div className="mt-3 text-[18px] font-semibold text-white">Ahmad K.</div>
              <div className="mt-1 text-[12px] text-white/50">AED 11.2M MTD · 4 closes</div>
            </div>

            <div className="rounded-[20px] border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.05] to-transparent p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]">Coaching Flag</div>
              <div className="mt-3 text-[14px] font-semibold text-white">Rami T. — 22d avg close</div>
              <div className="mt-2 text-[12px] leading-relaxed text-white/55">
                Above team target (21d). Pair on next 2 viewings with Ahmad K.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
