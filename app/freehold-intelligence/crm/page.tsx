import Link from 'next/link'
import { ArrowUpRight, PhoneCall, MessageCircle, Users } from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const PORTRAIT_TINTS = [
  'from-[#D4AF37]/35 via-[#D4AF37]/10 to-transparent',
  'from-emerald-500/30 via-emerald-500/10 to-transparent',
  'from-sky-500/30 via-sky-500/10 to-transparent',
  'from-rose-500/30 via-rose-500/10 to-transparent',
  'from-violet-500/30 via-violet-500/10 to-transparent',
]

function urgencyTone(urgency: string) {
  if (urgency === 'critical') return { label: 'Critical', dot: 'bg-red-400', text: 'text-red-300' }
  if (urgency === 'high')     return { label: 'High',     dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]' }
  if (urgency === 'medium')   return { label: 'Medium',   dot: 'bg-sky-400', text: 'text-sky-200' }
  return { label: 'Low', dot: 'bg-white/30', text: 'text-white/55' }
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function FreeholdCrmPage() {
  const hotLeads = crmLeads.filter((l) => l.urgency === 'critical' || l.urgency === 'high')
  const ranked = [...crmLeads].sort((a, b) => b.intentScore - a.intentScore)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">
      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Users className="h-3.5 w-3.5" /> CRM Intelligence
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          The people
          <br />
          <span className="text-white/40">waiting for you.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          {hotLeads.length} {hotLeads.length === 1 ? 'lead needs' : 'leads need'} action today. Quality matters more than volume — the AI ranks by intent, duplicate risk and response delay before suggesting the next move.
        </p>
      </section>

      {/* AI Prompt */}
      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about leads, agents, follow-ups…"
          suggestions={[
            'Which leads need urgent follow-up?',
            'Which agent is delayed on hot leads?',
            'Draft a follow-up for Rami.',
            'Compare lead quality by source.',
          ]}
        />
      </section>

      {/* Section title */}
      <section className="mt-20">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Today's queue</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Ranked by what matters now
        </h2>

        <div className="mt-8 grid gap-6">
          {ranked.map((lead, i) => {
            const tone = urgencyTone(lead.urgency)
            const tint = PORTRAIT_TINTS[i % PORTRAIT_TINTS.length]
            return (
              <article
                key={lead.id}
                className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0A0D10]"
              >
                {/* Top section: portrait + identity */}
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8">
                  <div className={`relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.06] bg-gradient-to-br ${tint}`}>
                    <span className="text-2xl font-semibold tracking-tight text-white">{initials(lead.name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{lead.name}</h3>
                      <span className={`flex items-center gap-1.5 text-[12px] font-medium ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {tone.label} intent · {lead.intentScore}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-white/45">
                      <span>{lead.stage}</span>
                      <span className="text-white/20">·</span>
                      <span>{lead.source}</span>
                      <span className="text-white/20">·</span>
                      <span>{lead.assignedAgent}</span>
                    </div>
                  </div>
                </div>

                {/* AI take */}
                <div className="border-t border-white/[0.06] px-6 py-5 sm:px-8 sm:py-6">
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">What the AI sees</div>
                  <p className="mt-2 text-[15px] leading-[1.65] text-white/80">
                    {lead.aiSummary}
                  </p>
                </div>

                {/* Suggested message */}
                <div className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-5 sm:px-8 sm:py-6">
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80">Suggested WhatsApp</div>
                  <p className="mt-2 text-[15px] italic leading-[1.6] text-white/75">
                    "{lead.suggestedMessage}"
                  </p>
                </div>

                {/* Next move */}
                <div className="flex flex-col gap-3 border-t border-white/[0.06] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">Next move</div>
                    <div className="mt-1 text-[14px] font-medium text-white/85">{lead.nextBestAction}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#06080A] transition hover:gap-2">
                      <PhoneCall className="h-3.5 w-3.5" /> Call now
                    </button>
                    <button className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[13px] text-white/75 transition hover:border-[#D4AF37]/30 hover:text-white">
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </button>
                  </div>
                </div>

                {/* Risk strip (only when present) */}
                {(lead.duplicateRisk || lead.wrongNumberRisk) && (
                  <div className="border-t border-white/[0.06] bg-orange-500/[0.04] px-6 py-3 text-[12px] text-orange-200/85 sm:px-8">
                    {lead.duplicateRisk && <span className="mr-4">⚠︎ Duplicate risk — review before assignment.</span>}
                    {lead.wrongNumberRisk && <span>⚠︎ Wrong number risk — verify contact.</span>}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <footer className="mt-20 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/[0.05] pt-8 text-[12px] text-white/35">
        <span>{crmLeads.length} {crmLeads.length === 1 ? 'lead' : 'leads'} today</span>
        <span className="text-red-300/70">{hotLeads.length} need action</span>
        <Link href="/freehold-intelligence/notebook" className="text-[#D4AF37] inline-flex items-center gap-1">
          Open Notebook <ArrowUpRight className="h-3 w-3" />
        </Link>
      </footer>
    </div>
  )
}
