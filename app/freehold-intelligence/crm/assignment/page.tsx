import Link from 'next/link'
import { UserCog, ArrowUpRight } from 'lucide-react'
import { crmLeads, crmAgentRoster, crmInboxLeads } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function capacityTone(s: string) {
  if (s === 'available')   return { label: 'Available',   badge: 'bg-emerald-400/10 border-emerald-400/25 text-emerald-300', bar: 'bg-emerald-400' }
  if (s === 'at_capacity') return { label: 'At capacity', badge: 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#F8E7AE]',       bar: 'bg-[#D4AF37]' }
  return                          { label: 'Overloaded',  badge: 'bg-red-400/10 border-red-400/25 text-red-300',             bar: 'bg-red-400' }
}

function urgencyBadge(u: string) {
  if (u === 'critical') return 'bg-red-400/10 border-red-400/25 text-red-300'
  if (u === 'high')     return 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#F8E7AE]'
  if (u === 'medium')   return 'bg-sky-500/10 border-sky-400/25 text-sky-200'
  return 'bg-white/[0.04] border-white/10 text-white/55'
}

export default function AssignmentPage() {
  const unassigned = crmInboxLeads.filter((l) => l.status === 'unassigned')
  const available = crmAgentRoster.filter((a) => a.status !== 'overloaded')
  const totalLeads = crmAgentRoster.reduce((s, a) => s + a.totalLeads, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">

      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
        <UserCog className="h-3.5 w-3.5" /> Assignment
      </div>
      <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
        Lead assignment<br /><span className="text-white/35">and workload.</span>
      </h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/55">
        {unassigned.length} unassigned leads waiting. {crmAgentRoster.length} agents — {available.length} with available capacity. {totalLeads} active leads across team.
      </p>

      <section className="mt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Capacity snapshot</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Agent workload</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {crmAgentRoster.map((agent) => {
            const tone = capacityTone(agent.status)
            return (
              <div key={agent.id} className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 text-[13px] font-semibold text-[#D4AF37]">
                      {agent.initials}
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold text-white">{agent.name}</div>
                      <div className="text-[11px] text-white/40">{agent.role}</div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${tone.badge}`}>
                    {tone.label}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/40">
                    <span>Utilization</span>
                    <span className="font-medium text-white/70">{agent.utilization}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full ${tone.bar}`} style={{ width: `${agent.utilization}%` }} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-3">
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-white">{agent.totalLeads}</div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-white/35">Leads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] font-semibold text-red-400">{agent.hotLeads}</div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-white/35">Hot</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-[18px] font-semibold ${agent.overdueFollowUps > 0 ? 'text-orange-300' : 'text-white'}`}>
                      {agent.overdueFollowUps}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-white/35">Overdue</div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-white/35">{agent.specialty}</div>
              </div>
            )
          })}
        </div>
      </section>

      {unassigned.length > 0 && (
        <section className="mt-14">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-red-300/70">Action required</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Unassigned leads</h2>
          <p className="mt-2 text-[13px] text-white/45">{unassigned.length} leads need an agent before outreach can begin.</p>
          <div className="mt-5 space-y-3">
            {unassigned.map((lead) => (
              <div key={lead.id} className="rounded-[20px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-semibold text-white">{lead.name}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${urgencyBadge(lead.urgency)}`}>
                        {lead.urgency.charAt(0).toUpperCase() + lead.urgency.slice(1)}
                      </span>
                      <span className="text-[11px] text-white/35">Intent {lead.intentScore}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-white/40">{lead.source}</div>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/65">{lead.aiNote}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    {available.slice(0, 3).map((agent) => (
                      <button
                        key={agent.id}
                        className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[12px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white"
                      >
                        → {agent.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Current distribution</div>
        <h2 className="mt-2 text-xl font-semibold text-white">All leads by agent</h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Lead</th>
                <th className="hidden px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 sm:table-cell">Stage</th>
                <th className="hidden px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 md:table-cell">Intent</th>
                <th className="px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Agent</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {crmLeads.map((lead) => (
                <tr key={lead.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white/90">{lead.name}</div>
                    <div className="text-[11px] text-white/35">{lead.source}</div>
                  </td>
                  <td className="hidden px-6 py-4 text-white/55 sm:table-cell">{lead.stage}</td>
                  <td className="hidden px-6 py-4 md:table-cell">
                    <span className="font-medium tabular-nums text-[#D4AF37]">{lead.intentScore}</span>
                  </td>
                  <td className="px-6 py-4 text-white/70">{lead.assignedAgent}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/freehold-intelligence/crm/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-white/30 transition hover:text-[#D4AF37]"
                    >
                      View <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about agent load, reassignment…"
          suggestions={[
            'Which agent has the most capacity right now?',
            'Suggest reassignments for overloaded agents.',
            'Who should take the new critical lead?',
          ]}
        />
      </section>

    </div>
  )
}
