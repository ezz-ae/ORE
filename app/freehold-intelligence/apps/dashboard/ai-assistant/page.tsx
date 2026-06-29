'use client'

import Link from 'next/link'
import { ArrowLeft, Bot, ArrowUpRight, Zap, BookOpen } from 'lucide-react'
import { notebookConversations } from '@/src/features/freehold-intelligence/server-session'
import { sendToExpert } from '@/lib/freehold/expert-bus'

// Quick prompts launch the SINGLE docked Expert conversation — there is no
// separate chat surface here. Clicking a card sends the prompt to the Expert.
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
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Bot className="h-3.5 w-3.5" /> AI Assistant
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Your command layer.<br /><span className="text-slate-500">Ask anything.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-[1.65] text-slate-400">
          Briefings, ad copy, follow-up scripts, comparisons, summaries. Every prompt opens your one Expert conversation — it follows context across CRM, Lead Machine, and Notebook.
        </p>
      </section>

      {/* Quick action prompts — all route into the single docked Expert */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">Quick actions</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Common command tasks</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => sendToExpert(action.prompt)}
              className="group flex items-start gap-3 rounded-[18px] border border-line bg-surface p-4 text-left transition hover:border-gold/25 hover:bg-gold/[0.03]"
            >
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gold/50 transition group-hover:text-gold" />
              <div>
                <div className="text-sm font-semibold text-slate-100 group-hover:text-white transition">{action.label}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500 group-hover:text-slate-400 transition">{action.prompt}</p>
              </div>
            </button>
          ))}
        </div>
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
            className="inline-flex items-center gap-1.5 text-xs text-gold/60 transition hover:text-gold"
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
                className="group flex items-start justify-between gap-4 rounded-[18px] border border-line bg-surface px-5 py-4 transition hover:border-gold/25"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold/60" />
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
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-4 py-2 text-sm text-slate-400 transition hover:border-gold/30 hover:text-white"
          >
            {link.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
      </section>

    </div>
  )
}
