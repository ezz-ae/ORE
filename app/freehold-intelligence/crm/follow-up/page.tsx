import Link from 'next/link'
import { Clock, PhoneCall, MessageCircle, AlertCircle } from 'lucide-react'
import { crmFollowUpQueue } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function urgencyTone(u: string) {
  if (u === 'critical') return { label: 'Critical', badge: 'bg-red-400/10 border-red-400/25 text-red-300', dot: 'bg-red-400' }
  if (u === 'high')     return { label: 'High',     badge: 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#F8E7AE]', dot: 'bg-[#D4AF37]' }
  if (u === 'medium')   return { label: 'Medium',   badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200', dot: 'bg-sky-400' }
  return { label: 'Low', badge: 'bg-white/[0.04] border-white/10 text-white/55', dot: 'bg-white/30' }
}

function overdueLabel(hours: number) {
  if (hours < 24) return `${hours}h overdue`
  return `${Math.floor(hours / 24)}d overdue`
}

export default function FollowUpQueuePage() {
  const queue = [...crmFollowUpQueue].sort((a, b) => b.overdueHours - a.overdueHours)
  const critical = queue.filter((l) => l.urgency === 'critical').length
  const riskLeads = queue.filter((l) => l.duplicateRisk || l.wrongNumberRisk).length
  const avgOverdue = Math.round(queue.reduce((s, l) => s + l.overdueHours, 0) / queue.length)

  const byAgent = queue.reduce<Record<string, number>>((acc, l) => {
    acc[l.assignedAgent] = (acc[l.assignedAgent] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="min-w-0">

          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Clock className="h-3.5 w-3.5" /> Follow-up Queue
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Overdue<br /><span className="text-white/35">right now.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/55">
            {queue.length} leads past their follow-up window. Sorted by delay — longest first.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="text-[28px] font-semibold text-white">{queue.length}</div>
              <div className="mt-0.5 text-[11px] text-white/40">Overdue</div>
            </div>
            <div className="rounded-[18px] border border-red-400/15 bg-red-400/[0.04] p-5">
              <div className="text-[28px] font-semibold text-red-400">{critical}</div>
              <div className="mt-0.5 text-[11px] text-white/40">Critical</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="text-[28px] font-semibold text-white">{avgOverdue}<span className="text-[16px] font-normal text-white/40">h</span></div>
              <div className="mt-0.5 text-[11px] text-white/40">Avg delay</div>
            </div>
          </div>

          <div className="mt-10 space-y-3">
            {queue.map((item) => {
              const tone = urgencyTone(item.urgency)
              return (
                <div key={item.leadId} className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                          className="text-[18px] font-semibold tracking-tight text-white transition hover:text-[#D4AF37]"
                        >
                          {item.leadName}
                        </Link>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {tone.label}
                        </span>
                        <span className="text-[11px] font-medium text-red-300/70">{overdueLabel(item.overdueHours)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-white/40">
                        <span>{item.stage}</span>
                        <span className="text-white/20">·</span>
                        <span>{item.source}</span>
                        <span className="text-white/20">·</span>
                        <span>Intent {item.intentScore}</span>
                        <span className="text-white/20">·</span>
                        <span>{item.assignedAgent}</span>
                      </div>
                      <p className="mt-3 text-[13px] leading-relaxed text-white/65">{item.nextBestAction}</p>
                      {(item.duplicateRisk || item.wrongNumberRisk) && (
                        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-orange-200/70">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {item.duplicateRisk && 'Duplicate risk — resolve before contacting. '}
                            {item.wrongNumberRisk && 'Wrong number risk — verify first.'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 sm:shrink-0">
                      <Link
                        href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#06080A] transition hover:bg-white/90"
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> Call
                      </Link>
                      <Link
                        href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-4">

            {riskLeads > 0 && (
              <div className="rounded-[20px] border border-orange-500/20 bg-orange-500/[0.04] p-5">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-orange-300/70">Risk alerts</div>
                <div className="mt-2 text-[28px] font-semibold text-orange-300">{riskLeads}</div>
                <div className="mt-1 text-[12px] text-white/50">leads flagged for duplicate or wrong number — resolve before outreach.</div>
              </div>
            )}

            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Overdue by agent</div>
              <div className="space-y-2">
                {Object.entries(byAgent).sort((a, b) => b[1] - a[1]).map(([agent, count]) => (
                  <div key={agent} className="flex items-center justify-between text-[13px]">
                    <span className="text-white/65">{agent}</span>
                    <span className="font-medium tabular-nums text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <AiPrompt
              placeholder="Ask about follow-ups…"
              suggestions={[
                'Which leads are most overdue?',
                'Draft a follow-up for the most critical lead.',
                'Which agent has the most overdue follow-ups?',
              ]}
            />

          </div>
        </aside>
      </div>
    </div>
  )
}
