import {
  ArrowRight,
  Bot,
  MessageSquareText,
  PhoneCall,
  Send,
  ShieldAlert,
  TimerReset,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { getMilestones } from '@/src/features/freehold-intelligence/data-access'
import { ProgressFooter } from '@/src/features/freehold-intelligence/components/progress-footer'

const tabs = ['Today', 'Leads', 'Pipeline', 'Agents', 'Sources', 'Follow-ups', 'AI Summary', 'Tasks']

function urgencyBadge(urgency: string) {
  switch (urgency) {
    case 'critical': return 'border-red-300/30 bg-red-500/10 text-red-200'
    case 'high':     return 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F8E7AE]'
    case 'medium':   return 'border-sky-300/25 bg-sky-400/10 text-sky-200'
    default:         return 'border-white/10 bg-white/[0.04] text-white/55'
  }
}

function IntentBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-[#D4AF37]' : 'bg-sky-400'
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/35">
        <span>Intent score</span>
        <span className="tabular-nums font-semibold text-white/60">{score}</span>
      </div>
      <div className="h-1.5 bg-white/[0.07]">
        <div className={`h-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export default async function FreeholdCrmPage() {
  const milestones = await getMilestones()
  const m4 = milestones.find((m) => m.code === 'M4') ?? milestones[0]

  const hotLeads = crmLeads.filter((l) => l.urgency === 'critical' || l.urgency === 'high')
  const avgIntent = Math.round(crmLeads.reduce((s, l) => s + l.intentScore, 0) / crmLeads.length)

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">CRM Intelligence</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">HubSpot-refined sales workspace</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
              Lead quality, urgency, duplicate risk, agent delays and next-best-action — shaped from HubSpot data. Prioritises signals over raw CRM tables.
            </p>
          </div>
        </div>
      </section>

      {/* ── Summary stats ──────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Total leads</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-white">{crmLeads.length}</span>
            <span className="text-xs text-white/35">today</span>
          </div>
        </div>
        <div className="border border-red-300/20 bg-red-500/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Needs action</div>
          <div className="mt-2 text-3xl font-semibold text-red-300">{hotLeads.length}</div>
        </div>
        <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Avg intent</div>
          <div className="mt-2 text-3xl font-semibold text-[#D4AF37]">{avgIntent}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Duplicate risk</div>
          <div className="mt-2 text-3xl font-semibold text-[#F8E7AE]">
            {crmLeads.filter((l) => l.duplicateRisk).length}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-white/10 pb-0">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
              i === 0
                ? 'border-b-[#D4AF37] text-white'
                : 'border-b-transparent text-white/45 hover:border-b-white/20 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">

        {/* ── Lead cards ─────────────────────────────────────────── */}
        <section className="grid gap-4">
          {crmLeads.map((lead) => (
            <article key={lead.id} className="border border-white/10 bg-white/[0.03]">
              {/* Lead header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{lead.name}</h2>
                    <span className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${urgencyBadge(lead.urgency)}`}>
                      {lead.stage}
                    </span>
                    {lead.duplicateRisk && (
                      <span className="border border-orange-300/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-200">
                        Dup risk
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-5 text-white/55">{lead.aiSummary}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-white/40">
                  <div className="font-medium text-white/60">{lead.assignedAgent}</div>
                  <div>{lead.source}</div>
                  <div className="mt-0.5 text-white/30">{lead.phone}</div>
                </div>
              </div>

              {/* Intent bar */}
              <div className="border-b border-white/[0.07] px-4 py-3">
                <IntentBar score={lead.intentScore} />
              </div>

              {/* Three panels */}
              <div className="grid gap-0 md:grid-cols-3">
                <div className="border-r border-white/[0.07] p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    <TimerReset className="h-3.5 w-3.5 text-[#D4AF37]" />
                    Next best action
                  </div>
                  <p className="mt-2 text-sm leading-5 text-white/70">{lead.nextBestAction}</p>
                </div>
                <div className="border-r border-white/[0.07] p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    <MessageSquareText className="h-3.5 w-3.5 text-[#D4AF37]" />
                    Suggested WhatsApp
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/60 italic">"{lead.suggestedMessage}"</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#D4AF37]" />
                    Risk signals
                  </div>
                  <div className="mt-2 grid gap-1.5 text-xs">
                    <div className={`flex items-center gap-1.5 ${lead.duplicateRisk ? 'text-orange-200' : 'text-white/40'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${lead.duplicateRisk ? 'bg-orange-400' : 'bg-white/20'}`} />
                      Duplicate: {lead.duplicateRisk ? 'Review required' : 'Clear'}
                    </div>
                    <div className={`flex items-center gap-1.5 ${lead.wrongNumberRisk ? 'text-red-200' : 'text-white/40'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${lead.wrongNumberRisk ? 'bg-red-400' : 'bg-white/20'}`} />
                      Wrong number: {lead.wrongNumberRisk ? 'Risk' : 'Clear'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button className="border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] px-3 py-1.5 text-xs font-semibold text-[#F8E7AE] transition hover:bg-[#D4AF37]/15">
                    <PhoneCall className="mr-1.5 inline h-3 w-3" />Call now
                  </button>
                  <button className="border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-[#D4AF37]/25 hover:text-white">
                    Send WhatsApp
                  </button>
                  <button className="border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-[#D4AF37]/25 hover:text-white">
                    Open in CRM
                  </button>
                  <button className="border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-[#D4AF37]/25 hover:text-white">
                    Create task
                  </button>
                </div>
                <div className="text-xs text-white/30">
                  Last contact: {new Date(lead.lastContactAt).toLocaleDateString()}
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* ── AI sidebar ─────────────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bot className="h-4 w-4 text-[#D4AF37]" />
              CRM AI summary
            </div>
            <div className="mt-3 border border-[#D4AF37]/15 bg-black/20 p-3">
              <p className="text-sm leading-6 text-white/70">
                Three leads need attention today. Rami should be called first (critical intent, waiting for comparison). Sara needs duplicate review before assignment. Michael needs a two-project comparison sent before the session ends.
              </p>
            </div>
            <div className="mt-4 grid gap-1.5">
              {[
                'Which leads need urgent follow-up?',
                'Which agent is delayed on hot leads?',
                'Draft a follow-up message for Rami.',
                'Compare lead quality by source.',
                'Show me today\'s sales queue.',
              ].map((prompt) => (
                <button key={prompt} className="border border-white/10 bg-black/20 px-3 py-2.5 text-left text-xs leading-5 text-white/55 transition hover:border-[#D4AF37]/30 hover:text-white">
                  {prompt}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2 border border-white/10 bg-black/20 p-2">
              <input
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/25"
                placeholder="Ask about leads, agents, follow-ups..."
              />
              <button className="grid h-9 w-9 shrink-0 place-items-center bg-[#D4AF37] text-[#07110D]">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <button className="mt-3 flex w-full items-center justify-center gap-2 bg-[#D4AF37] px-4 py-3 text-sm font-semibold text-[#07110D] transition hover:bg-[#D4AF37]/90">
              <PhoneCall className="h-4 w-4" />
              Build today's sales queue
            </button>
          </div>

          {/* Agent summary */}
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="h-4 w-4 text-[#D4AF37]" />
              Agent load today
            </div>
            <div className="mt-3 grid gap-2">
              {[
                { name: 'Noura', leads: 1, delayed: false },
                { name: 'Omar', leads: 1, delayed: false },
                { name: 'Layla', leads: 1, delayed: true },
              ].map(({ name, leads, delayed }) => (
                <div key={name} className="flex items-center justify-between border border-white/10 bg-black/15 px-3 py-2.5">
                  <span className="text-sm text-white">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">{leads} lead{leads !== 1 ? 's' : ''}</span>
                    {delayed && (
                      <span className="border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[10px] text-[#F8E7AE]">delayed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lead sources */}
          <div className="border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
              Lead sources
            </div>
            <div className="mt-3 grid gap-2">
              {[
                { source: 'Palm investor landing', count: 1, quality: 92 },
                { source: 'Market tracker', count: 1, quality: 78 },
                { source: 'WhatsApp organic', count: 1, quality: 84 },
              ].map(({ source, count, quality }) => (
                <div key={source} className="border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/70">{source}</span>
                    <span className="tabular-nums font-semibold text-[#D4AF37]">{quality}</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-white/[0.07]">
                    <div className="h-full bg-[#D4AF37]" style={{ width: `${quality}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-4">
            <Link href="/freehold-intelligence/notebook" className="flex items-center justify-between text-sm text-[#D4AF37]">
              Open Notebook to draft messages <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </div>

      <div className="mt-6">
        <ProgressFooter milestone={m4} />
      </div>
    </div>
  )
}
