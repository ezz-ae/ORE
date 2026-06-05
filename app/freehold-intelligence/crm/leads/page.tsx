import Link from 'next/link'
import { ArrowUpRight, Filter, Target } from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function urgencyConfig(u: string) {
  if (u === 'critical') return { dot: 'bg-red-400',     text: 'text-red-300',     badge: 'border-red-400/20 bg-red-400/10',       label: 'Critical' }
  if (u === 'high')     return { dot: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]',  badge: 'border-[#D4AF37]/20 bg-[#D4AF37]/10',  label: 'High'     }
  if (u === 'medium')   return { dot: 'bg-sky-400',     text: 'text-sky-200',    badge: 'border-sky-400/20 bg-sky-400/10',       label: 'Medium'   }
  return                       { dot: 'bg-white/30',    text: 'text-white/45',   badge: 'border-white/10 bg-white/[0.04]',       label: 'Low'      }
}

function scoreColor(n: number) {
  if (n >= 85) return 'text-emerald-300'
  if (n >= 65) return 'text-[#D4AF37]'
  return 'text-red-300'
}

function stageColor(stage: string) {
  if (stage === 'Hot')       return 'text-red-300 border-red-400/20 bg-red-400/10'
  if (stage === 'Qualified') return 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10'
  if (stage === 'Follow-up') return 'text-[#F8E7AE] border-[#D4AF37]/20 bg-[#D4AF37]/10'
  return 'text-white/50 border-white/10 bg-white/[0.04]'
}

export async function generateStaticParams() {
  return []
}

export default function CrmLeadsPage() {
  const sorted = [...crmLeads].sort((a, b) => b.intentScore - a.intentScore)

  const stages  = [...new Set(crmLeads.map((l) => l.stage))]
  const agents  = [...new Set(crmLeads.map((l) => l.assignedAgent))]

  const hot       = crmLeads.filter((l) => l.urgency === 'critical' || l.urgency === 'high').length
  const avgIntent = Math.round(crmLeads.reduce((s, l) => s + l.intentScore, 0) / crmLeads.length)
  const withRisk  = crmLeads.filter((l) => l.duplicateRisk || l.wrongNumberRisk).length

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Target className="h-3.5 w-3.5" /> CRM · All Leads
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          {crmLeads.length} leads tracked.<br />
          <span className="text-white/35">{hot} need action now.</span>
        </h1>
      </section>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',       value: crmLeads.length, color: 'text-white'       },
          { label: 'Hot / urgent', value: hot,             color: 'text-red-300'     },
          { label: 'Avg intent',  value: avgIntent,        color: 'text-[#D4AF37]'   },
          { label: 'Risk flags',  value: withRisk,         color: withRisk > 0 ? 'text-orange-300' : 'text-white' },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
            <div className={`text-[26px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-[10px] text-white/35">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-white/35">
          <Filter className="h-3 w-3" /> Filter by stage:
        </div>
        {stages.map((stage) => (
          <span
            key={stage}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${stageColor(stage)}`}
          >
            {stage}
          </span>
        ))}
        <span className="mx-2 text-white/15">·</span>
        <div className="flex items-center gap-1.5 text-[11px] text-white/35">Agents:</div>
        {agents.map((a) => (
          <span key={a} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/50">
            {a}
          </span>
        ))}
      </div>

      {/* Compact lead table */}
      <section className="mt-6">
        <div className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          {/* Table header */}
          <div className="hidden grid-cols-[2fr_1fr_80px_100px_120px_40px] items-center gap-4 border-b border-white/[0.05] px-6 py-3 sm:grid">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Lead</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Stage</div>
            <div className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Score</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Agent</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Source</div>
            <div />
          </div>

          <div className="divide-y divide-white/[0.04]">
            {sorted.map((lead) => {
              const ug  = urgencyConfig(lead.urgency)
              const hasRisk = lead.duplicateRisk || lead.wrongNumberRisk

              return (
                <Link
                  key={lead.id}
                  href={`/freehold-intelligence/crm/leads/${lead.id}`}
                  className="group flex items-center gap-4 px-6 py-4 transition hover:bg-white/[0.025]"
                >
                  {/* Name + urgency */}
                  <div className="min-w-0 flex-[2] flex items-center gap-2.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ug.dot}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-white/90 group-hover:text-white truncate">
                          {lead.name}
                        </span>
                        {hasRisk && (
                          <span className="shrink-0 rounded-full border border-orange-400/20 bg-orange-400/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-300">
                            ⚠ risk
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/35 truncate sm:hidden">
                        {lead.stage} · {lead.assignedAgent} · score {lead.intentScore}
                      </div>
                    </div>
                  </div>

                  {/* Stage */}
                  <div className="hidden flex-1 sm:flex">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${stageColor(lead.stage)}`}>
                      {lead.stage}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="hidden w-20 text-center sm:block">
                    <span className={`text-[15px] font-semibold tabular-nums ${scoreColor(lead.intentScore)}`}>
                      {lead.intentScore}
                    </span>
                    <div className="mx-auto mt-1 h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full ${scoreColor(lead.intentScore).replace('text-', 'bg-').replace('/30', '').replace('/300', '')}`}
                        style={{ width: `${lead.intentScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Agent */}
                  <div className="hidden w-28 sm:block">
                    <span className="text-[12px] text-white/55 truncate block">{lead.assignedAgent}</span>
                  </div>

                  {/* Source */}
                  <div className="hidden flex-1 sm:block">
                    <span className="line-clamp-1 text-[11px] text-white/35">{lead.source}</span>
                  </div>

                  {/* Arrow */}
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-white/15 transition group-hover:text-[#D4AF37]" />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Summary footer */}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/30">
        <span>{crmLeads.length} leads · sorted by intent score</span>
        <Link href="/freehold-intelligence/crm" className="text-[#D4AF37]/60 transition hover:text-[#D4AF37]">
          → Full intelligence view
        </Link>
        <Link href="/freehold-intelligence/crm/inbox" className="text-[#D4AF37]/60 transition hover:text-[#D4AF37]">
          → Unassigned inbox
        </Link>
      </div>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about leads, scores, stages, agents…"
          suggestions={[
            'Which leads have the highest intent score today?',
            'Show all Hot stage leads with no follow-up.',
            'Who should be called first?',
            'Group leads by assigned agent.',
          ]}
        />
      </section>

    </div>
  )
}
