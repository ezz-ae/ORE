import Link from 'next/link'
import { ArrowUpRight, PhoneCall, MessageCircle, Users, TrendingUp, AlertCircle } from 'lucide-react'
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
  if (urgency === 'critical') return { label: 'Critical', dot: 'bg-red-400', text: 'text-red-300', badge: 'bg-red-400/10 border-red-400/25 text-red-300' }
  if (urgency === 'high')     return { label: 'High',     dot: 'bg-[#D4AF37]', text: 'text-[#F8E7AE]', badge: 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#F8E7AE]' }
  if (urgency === 'medium')   return { label: 'Medium',   dot: 'bg-sky-400', text: 'text-sky-200', badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200' }
  return { label: 'Low', dot: 'bg-white/30', text: 'text-white/55', badge: 'bg-white/[0.04] border-white/10 text-white/55' }
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default async function FreeholdCrmPage() {
  const hotLeads = crmLeads.filter((l) => l.urgency === 'critical' || l.urgency === 'high')
  const ranked = [...crmLeads].sort((a, b) => b.intentScore - a.intentScore)
  const avgIntent = Math.round(crmLeads.reduce((s, l) => s + l.intentScore, 0) / crmLeads.length)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-12">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">

        {/* ══════════════════ MAIN ══════════════════ */}
        <div className="min-w-0">

          {/* Header */}
          <section>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
              <Users className="h-3.5 w-3.5" /> CRM Intelligence
            </div>
            <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px] lg:text-[56px]">
              The people
              <br />
              <span className="text-white/35">waiting for you.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.6] text-white/60 sm:text-[18px]">
              {hotLeads.length} {hotLeads.length === 1 ? 'lead needs' : 'leads need'} action today. Ranked by intent, duplicate risk, and response delay.
            </p>
          </section>

          {/* Mobile stats */}
          <div className="mt-8 grid grid-cols-3 gap-3 lg:hidden">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
              <div className="text-[22px] font-semibold text-white">{crmLeads.length}</div>
              <div className="text-[10px] text-white/40">Total</div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
              <div className="text-[22px] font-semibold text-red-400">{hotLeads.length}</div>
              <div className="text-[10px] text-white/40">Hot</div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#0A0D10] p-4 text-center">
              <div className="text-[22px] font-semibold text-[#D4AF37]">{avgIntent}</div>
              <div className="text-[10px] text-white/40">Avg intent</div>
            </div>
          </div>

          {/* Mobile AI prompt */}
          <section className="mt-8 lg:hidden">
            <AiPrompt
              placeholder="Ask about leads, agents, follow-ups…"
              suggestions={['Which leads need urgent follow-up?', 'Draft a follow-up for Rami.', 'Compare lead quality by source.']}
            />
          </section>

          {/* Section title */}
          <section className="mt-12">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Today's queue</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">Ranked by what matters now</h2>

            <div className="mt-7 grid gap-5">
              {ranked.map((lead, i) => {
                const tone = urgencyTone(lead.urgency)
                const tint = PORTRAIT_TINTS[i % PORTRAIT_TINTS.length]
                return (
                  <article
                    key={lead.id}
                    className="overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0A0D10] transition hover:border-white/10 lg:rounded-[28px]"
                  >
                    {/* Top: avatar + identity */}
                    <div className="flex gap-5 p-5 sm:gap-6 sm:p-6 lg:gap-8 lg:p-8">
                      <div className={`relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br lg:h-20 lg:w-20 lg:rounded-3xl ${tint}`}>
                        <span className="text-xl font-semibold text-white lg:text-2xl">{initials(lead.name)}</span>
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl lg:text-[26px]">{lead.name}</h3>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                            {tone.label} · {lead.intentScore}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-white/40">
                          <span>{lead.stage}</span>
                          <span className="text-white/20">·</span>
                          <span>{lead.source}</span>
                          <span className="text-white/20">·</span>
                          <span>{lead.assignedAgent}</span>
                        </div>
                      </div>
                    </div>

                    {/* AI take */}
                    <div className="border-t border-white/[0.05] px-5 py-5 sm:px-6 lg:px-8">
                      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/30">What the AI sees</div>
                      <p className="mt-2 text-[14px] leading-[1.65] text-white/75 lg:text-[15px]">
                        {lead.aiSummary}
                      </p>
                    </div>

                    {/* Suggested message */}
                    <div className="border-t border-white/[0.05] bg-[#D4AF37]/[0.025] px-5 py-5 sm:px-6 lg:px-8">
                      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/70">Suggested WhatsApp</div>
                      <p className="mt-2 text-[14px] italic leading-[1.6] text-white/70 lg:text-[15px]">
                        &ldquo;{lead.suggestedMessage}&rdquo;
                      </p>
                    </div>

                    {/* Next move + actions */}
                    <div className="flex flex-col gap-3 border-t border-white/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-5">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/30">Next move</div>
                        <div className="mt-1 text-[13px] font-medium text-white/80 lg:text-[14px]">{lead.nextBestAction}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#06080A] transition hover:bg-white/90">
                          <PhoneCall className="h-3.5 w-3.5" /> Call
                        </button>
                        <button className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </button>
                      </div>
                    </div>

                    {/* Risk strip */}
                    {(lead.duplicateRisk || lead.wrongNumberRisk) && (
                      <div className="flex items-start gap-2 border-t border-orange-500/15 bg-orange-500/[0.05] px-5 py-3 text-[12px] text-orange-200/80 sm:px-6 lg:px-8">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {lead.duplicateRisk && 'Duplicate risk — review before assignment. '}
                          {lead.wrongNumberRisk && 'Wrong number risk — verify contact.'}
                        </span>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>

          <footer className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.05] pt-6 text-[11px] text-white/30">
            <span>{crmLeads.length} {crmLeads.length === 1 ? 'lead' : 'leads'} today</span>
            <span className="text-red-300/60">{hotLeads.length} need action</span>
            <Link href="/freehold-intelligence/notebook" className="inline-flex items-center gap-1 text-[#D4AF37]/70 hover:text-[#D4AF37]">
              Open Notebook <ArrowUpRight className="h-2.5 w-2.5" />
            </Link>
          </footer>
        </div>

        {/* ══════════════════ SIDEBAR ══════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">

            {/* Stats panel */}
            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Pipeline today</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-[28px] font-semibold text-white">{crmLeads.length}</div>
                  <div className="text-[10px] text-white/35">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-[28px] font-semibold text-red-400">{hotLeads.length}</div>
                  <div className="text-[10px] text-white/35">Hot</div>
                </div>
                <div className="text-center">
                  <div className="text-[28px] font-semibold text-[#D4AF37]">{avgIntent}</div>
                  <div className="text-[10px] text-white/35">Avg intent</div>
                </div>
              </div>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full bg-[#D4AF37]" style={{ width: `${Math.round((hotLeads.length / crmLeads.length) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-white/35">{Math.round((hotLeads.length / crmLeads.length) * 100)}% need action today</p>
            </div>

            {/* Intent score bars */}
            <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <TrendingUp className="h-3 w-3" /> Intent ranking
              </div>
              <div className="space-y-2.5">
                {ranked.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center gap-3">
                    <div className="w-[80px] shrink-0 truncate text-[12px] text-white/70">{lead.name.split(' ')[0]}</div>
                    <div className="flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-1.5 rounded-full bg-[#D4AF37]"
                        style={{ width: `${lead.intentScore}%` }}
                      />
                    </div>
                    <div className="w-6 text-right text-[11px] font-medium tabular-nums text-white/55">{lead.intentScore}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Prompt */}
            <AiPrompt
              placeholder="Ask about leads, agents, follow-ups…"
              suggestions={[
                'Which leads need urgent follow-up?',
                'Which agent is delayed on hot leads?',
                'Draft a follow-up for Rami.',
                'Compare lead quality by source.',
              ]}
            />

          </div>
        </aside>

      </div>
    </div>
  )
}
