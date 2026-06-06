'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, ArrowUpRight, Zap, BookOpen, Loader2, X, Copy, CheckCircle2 } from 'lucide-react'
import { notebookConversations } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const QUICK_ACTIONS = [
  { label: 'Brief me on today', prompt: 'Give me a 60-second briefing on the most important things across CRM, Lead Machine, and approvals right now.' },
  { label: 'Draft WhatsApp for hot lead', prompt: 'Draft a follow-up WhatsApp message for the highest-intent lead in the CRM.' },
  { label: 'Which campaigns are ready?', prompt: 'Which listings in Lead Machine are ready for ad launch right now? List them with readiness status.' },
  { label: 'Summarise follow-up queue', prompt: 'Summarise the overdue follow-up queue — who needs action most urgently and why?' },
  { label: 'Best ad angle for Palm', prompt: 'What is the strongest campaign angle for Palm Jumeirah right now? Give me a headline, hook, and CTA.' },
  { label: 'Agent performance check', prompt: 'Which agent is behind on follow-ups and what is the recommended action?' },
]

const QUICK_RESPONSES: Record<string, string> = {
  'Brief me on today': `**Today's briefing — June 5, 2026**\n\n**CRM:** 3 high-intent leads need same-day follow-up. Ahmad K. is at 87% capacity. Noura has 2 leads stalled >48h.\n\n**Lead Machine:** Palm Jumeirah campaign is blocked on Meta billing — this is the single highest-impact action today. Dubai Hills is review-ready pending angle approval.\n\n**Approvals:** 2 critical items need your sign-off before any ads can launch — Palm landing page and Dubai Hills angle. Both are in Reviews.\n\n**Action priority:** (1) Confirm Meta billing owner → (2) Approve Palm landing → (3) Review overdue CRM leads.`,
  'Draft WhatsApp for hot lead': `Hi Tariq 👋\n\nThis is Ahmad from Freehold Property — following up on your enquiry about Palm Jumeirah investor units.\n\nWe currently have 2 exclusive beachfront units available with an 80/20 payment plan, starting from AED 4.2M. One was just released this week.\n\nWould you have 10 minutes for a quick call today or tomorrow? I can share floor plans, ROI projections, and current market comparisons.\n\nLooking forward to connecting!`,
  'Which campaigns are ready?': `**Campaign launch readiness — current snapshot:**\n\n🟡 **Palm Jumeirah Investor** — 84% ready. Blocked on Meta billing owner. Once billing is confirmed, this campaign can launch within 24h.\n\n🔴 **Business Bay Canal View** — 42% ready. Missing payment plan data, no hero image, audience not selected. Not ready for launch.\n\n🟢 **Dubai Hills Yield** — 92% ready. Awaiting angle approval only. Approve the investor yield corridor angle to proceed.\n\n**Recommendation:** Resolve Palm billing first — it unblocks the entire pipeline.`,
  'Summarise follow-up queue': `**Overdue follow-up queue — priority order:**\n\n1. **Tariq Al-Farsi** (Palm investor, intent 94) — 52h since intake, no first contact. Move to Hot, assign to Noura immediately.\n\n2. **James Chen** (Golden Visa, intent 88) — 38h, wrong number flag not resolved. Verify via WhatsApp or email before agent reassignment.\n\n3. **Aisha Mohammed** (Dubai Hills buyer, intent 76) — 29h, agent Sara M. at capacity. Reassign to Ahmad K. for same-day follow-up.\n\n**Total overdue:** 3 leads requiring action today.`,
  'Best ad angle for Palm': `**Strongest Palm Jumeirah angle — Q2 2026:**\n\n**Headline:** "The Last Beachfront at Palm Jumeirah — Starting AED 4.2M"\n\n**Hook:** Limited-edition investor units with an 80/20 payment plan. Own an iconic Palm address while the developer carries 80% of the cost to handover.\n\n**CTA:** "Get exclusive floor plans + ROI projection" → Lead form with WhatsApp confirmation.\n\n**Why this works:** The scarcity signal (limited units) + payment plan leverage + ROI framing targets GCC investors with capital to deploy. This angle has outperformed lifestyle creative by 34% in similar Dubai launches.`,
  'Agent performance check': `**Agent performance review — current week:**\n\n**Noura Al-Rashid** ✅ On track. 11 active leads, 89% response rate, 3 wins this month. Top performer.\n\n**Ahmad K.** ⚠️ At capacity (87%). 2 leads at >36h follow-up gap. Recommend pausing new assignments until queue clears.\n\n**Sara M.** ✅ Performing well on Golden Visa leads. 2 clients at negotiation stage.\n\n**Recommended action:** Temporarily route new Palm/Hills leads to Noura. Free up Ahmad K. by snoozing 2 low-intent leads until next week.`,
}

function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardAiAssistantPage() {
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [response,     setResponse]     = useState<string | null>(null)
  const [copied,       setCopied]       = useState(false)

  function handleAction(label: string) {
    setActiveAction(label)
    setLoading(true)
    setResponse(null)
    setCopied(false)
    setTimeout(() => {
      setResponse(QUICK_RESPONSES[label] ?? 'No response available.')
      setLoading(false)
    }, 1400)
  }

  function handleCopy() {
    if (!response) return
    navigator.clipboard.writeText(response.replace(/\*\*/g, '').replace(/\*/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const recentConvs = [...notebookConversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <Bot className="h-3.5 w-3.5" /> AI Assistant
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Your command layer.<br /><span className="text-slate-500">Ask anything.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-[1.65] text-slate-400">
          Briefings, ad copy, follow-up scripts, comparisons, summaries. The AI follows context across CRM, Lead Machine, and Notebook.
        </p>
      </section>

      {/* Main prompt */}
      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about leads, campaigns, performance, copy…"
          suggestions={[
            'Brief me on today across all surfaces.',
            'Draft a WhatsApp for the hottest lead.',
            'Which listings are ready for Meta ads?',
            'Give me the top 3 investor angles for Palm Jumeirah.',
          ]}
        />
      </section>

      {/* Quick action prompts */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">Quick actions</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Common command tasks</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleAction(action.label)}
              className={`group flex items-start gap-3 rounded-[18px] border p-4 text-left transition ${
                activeAction === action.label
                  ? 'border-[#D4AF37]/25 bg-[#D4AF37]/[0.04]'
                  : 'border-slate-800 bg-slate-900 hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.03]'
              }`}
            >
              {loading && activeAction === action.label
                ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37] animate-spin" />
                : <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/50 transition group-hover:text-[#D4AF37]" />
              }
              <div>
                <div className="text-sm font-semibold text-slate-100 group-hover:text-white transition">{action.label}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500 group-hover:text-slate-400 transition">{action.prompt}</p>
              </div>
            </button>
          ))}
        </div>

        {(loading || response) && activeAction && (
          <div className="mt-5 rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.03] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-[#D4AF37]/70">
                <Loader2 className={`h-3 w-3 ${loading ? 'animate-spin' : 'hidden'}`} />
                {loading ? 'Thinking…' : activeAction}
              </div>
              <div className="flex items-center gap-2">
                {!loading && response && (
                  <button onClick={handleCopy} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition">
                    {copied ? <CheckCircle2 className="h-3 w-3 text-[#D4AF37]" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
                <button onClick={() => { setActiveAction(null); setResponse(null) }} className="text-slate-600 hover:text-slate-400 transition">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded-full bg-slate-800/50 animate-pulse" />
                <div className="h-3 w-1/2 rounded-full bg-slate-800/50 animate-pulse" />
                <div className="h-3 w-2/3 rounded-full bg-slate-800/50 animate-pulse" />
              </div>
            ) : (
              <p className="whitespace-pre-line text-sm leading-[1.75] text-slate-200">
                {response?.replace(/\*\*/g, '').replace(/\*/g, '')}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Recent conversations */}
      <section className="mt-14">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-wider text-slate-500">Recent</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Notebook conversations</h2>
          </div>
          <Link
            href="/freehold-intelligence/notebook"
            className="inline-flex items-center gap-1.5 text-xs text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
          >
            All conversations <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-5 space-y-2">
          {recentConvs.map((conv) => {
            const lastMsg = conv.messages[conv.messages.length - 1]
            return (
              <Link
                key={conv.id}
                href={`/freehold-intelligence/notebook/${conv.id}`}
                className="group flex items-start justify-between gap-4 rounded-[18px] border border-slate-800 bg-slate-900 px-5 py-4 transition hover:border-[#D4AF37]/25"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-[#D4AF37]/60" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-white transition group-hover:text-white">{conv.title}</div>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">{lastMsg?.content.slice(0, 80)}…</p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <span>{conv.messages.length} messages</span>
                      <span>·</span>
                      <span>{conv.savedOutputs.length} saved outputs</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-sm text-slate-500">{relativeTime(conv.updatedAt)}</div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-10 flex flex-wrap gap-3">
        {[
          { label: 'Notebook', href: '/freehold-intelligence/notebook' },
          { label: 'CRM Intelligence', href: '/freehold-intelligence/crm' },
          { label: 'Lead Machine', href: '/freehold-intelligence/lead-machine' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-800 bg-slate-800/40 px-4 py-2 text-sm text-slate-400 transition hover:border-[#D4AF37]/30 hover:text-white"
          >
            {link.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
      </section>

    </div>
  )
}
