import { Inbox, Clock, AlertCircle, ArrowUpRight } from 'lucide-react'
import { crmInboxLeads, crmAgentRoster } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function urgencyTone(u: string) {
  if (u === 'critical') return { label: 'Critical', badge: 'bg-red-400/10 border-red-400/25 text-red-300', dot: 'bg-red-400' }
  if (u === 'high')     return { label: 'High',     badge: 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#F8E7AE]', dot: 'bg-[#D4AF37]' }
  if (u === 'medium')   return { label: 'Medium',   badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200', dot: 'bg-sky-400' }
  return { label: 'Low', badge: 'bg-white/[0.04] border-white/10 text-white/55', dot: 'bg-white/30' }
}

function timeAgo(iso: string) {
  const now = new Date('2026-06-04T12:00:00+04:00').getTime()
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function CrmInboxPage() {
  const unassigned = crmInboxLeads.filter((l) => l.status === 'unassigned')
  const assigned   = crmInboxLeads.filter((l) => l.status === 'assigned')
  const contacted  = crmInboxLeads.filter((l) => l.status === 'contacted')
  const available  = crmAgentRoster.filter((a) => a.status === 'available')

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="min-w-0">

          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Inbox className="h-3.5 w-3.5" /> Inbox
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            New leads<br /><span className="text-white/35">arriving.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/55">
            {crmInboxLeads.length} leads in the last 48 hours.{' '}
            {unassigned.length > 0 && <span className="text-[#D4AF37]">{unassigned.length} still unassigned.</span>}
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-[18px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-5">
              <div className="text-[28px] font-semibold text-[#D4AF37]">{unassigned.length}</div>
              <div className="mt-0.5 text-[11px] text-white/40">Unassigned</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="text-[28px] font-semibold text-white">{assigned.length}</div>
              <div className="mt-0.5 text-[11px] text-white/40">Assigned</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="text-[28px] font-semibold text-emerald-300">{contacted.length}</div>
              <div className="mt-0.5 text-[11px] text-white/40">Contacted</div>
            </div>
          </div>

          {unassigned.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-red-300/70">
                <AlertCircle className="h-3.5 w-3.5" /> Needs assignment
              </div>
              <div className="mt-4 space-y-3">
                {unassigned.map((lead) => {
                  const tone = urgencyTone(lead.urgency)
                  return (
                    <div key={lead.id} className="rounded-[22px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[18px] font-semibold text-white">{lead.name}</span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                              {tone.label}
                            </span>
                            <span className="text-[11px] text-white/35">Intent {lead.intentScore}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-white/40">
                            <span>{lead.source}</span>
                            <span className="text-white/20">·</span>
                            <Clock className="h-3 w-3" />
                            <span>{timeAgo(lead.arrivedAt)}</span>
                          </div>
                          <p className="mt-2.5 text-[13px] leading-relaxed text-white/65">{lead.aiNote}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:shrink-0">
                          {available.slice(0, 2).map((agent) => (
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
                  )
                })}
              </div>
            </section>
          )}

          <section className="mt-12">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">All leads · last 48h</div>
            <div className="mt-4 space-y-2">
              {[...assigned, ...contacted].map((lead) => {
                const tone = urgencyTone(lead.urgency)
                return (
                  <div key={lead.id} className="flex items-center justify-between gap-4 rounded-[18px] border border-white/[0.05] bg-[#0A0D10] px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-white">{lead.name}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {tone.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-white/40">
                        {lead.source} · {lead.assignedAgent ?? 'Unassigned'} · {timeAgo(lead.arrivedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[12px] font-medium ${lead.status === 'contacted' ? 'text-emerald-300' : 'text-white/50'}`}>
                        {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-white/20" />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-4">

            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Available agents</div>
              <div className="space-y-3">
                {available.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 text-[11px] font-semibold text-[#D4AF37]">
                        {agent.initials}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-white">{agent.name}</div>
                        <div className="text-[10px] text-white/35">{agent.totalLeads} leads</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-emerald-300">{agent.utilization}%</span>
                  </div>
                ))}
              </div>
            </div>

            <AiPrompt
              placeholder="Ask about new leads…"
              suggestions={[
                'Who should handle the critical referral?',
                'Which source sent the highest-intent lead today?',
                'Assign all unassigned leads to best-fit agents.',
              ]}
            />

          </div>
        </aside>

      </div>
    </div>
  )
}
