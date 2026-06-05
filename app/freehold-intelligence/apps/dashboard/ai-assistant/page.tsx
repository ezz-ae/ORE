import Link from 'next/link'
import { ArrowLeft, Bot, ArrowUpRight, Zap, BookOpen } from 'lucide-react'
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

function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardAiAssistantPage() {
  const recentConvs = [...notebookConversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Bot className="h-3.5 w-3.5" /> AI Assistant
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          Your command layer.<br /><span className="text-white/35">Ask anything.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-[1.65] text-white/60">
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
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Quick actions</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Common command tasks</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              className="group flex items-start gap-3 rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 text-left transition hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.03]"
            >
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/50 transition group-hover:text-[#D4AF37]" />
              <div>
                <div className="text-[13px] font-semibold text-white/80 group-hover:text-white transition">{action.label}</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/35 group-hover:text-white/50 transition">{action.prompt}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recent conversations */}
      <section className="mt-14">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Recent</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Notebook conversations</h2>
          </div>
          <Link
            href="/freehold-intelligence/notebook"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
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
                className="group flex items-start justify-between gap-4 rounded-[18px] border border-white/[0.05] bg-[#0A0D10] px-5 py-4 transition hover:border-[#D4AF37]/25"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-white/25 transition group-hover:text-[#D4AF37]/60" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-white/85 transition group-hover:text-white">{conv.title}</div>
                    <p className="mt-0.5 text-[12px] text-white/40 truncate">{lastMsg?.content.slice(0, 80)}…</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/30">
                      <span>{conv.messages.length} messages</span>
                      <span>·</span>
                      <span>{conv.savedOutputs.length} saved outputs</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-[11px] text-white/30">{relativeTime(conv.updatedAt)}</div>
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
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[13px] text-white/60 transition hover:border-[#D4AF37]/30 hover:text-white"
          >
            {link.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
      </section>

    </div>
  )
}
