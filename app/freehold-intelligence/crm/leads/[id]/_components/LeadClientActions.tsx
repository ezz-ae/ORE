'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, CheckCircle, MessageSquare, BookOpen, Zap, User, ArrowUpRight, Bell } from 'lucide-react'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-sm text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
    >
      {copied ? <CheckCircle className="h-3 w-3 text-[#D4AF37]" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

interface SuggestedMessageActionsProps {
  message: string
  phone: string
  leadId: string
}

export function SuggestedMessageActions({ message, phone, leadId }: SuggestedMessageActionsProps) {
  const [sent, setSent] = useState(false)

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {/* Full in-app WhatsApp chat */}
      <Link
        href={`/freehold-intelligence/crm/leads/${leadId}/whatsapp`}
        className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Open WhatsApp Chat
      </Link>
      {/* External wa.me fallback */}
      <a
        href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setSent(true)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-2 text-xs text-emerald-400 transition hover:bg-emerald-500/15"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {sent ? 'Opened' : 'wa.me'}
      </a>
      <Link
        href={`/freehold-intelligence/notebook?lead=${leadId}`}
        className="inline-flex items-center gap-2 rounded-[10px] border border-slate-800 bg-slate-800/50 px-4 py-2 text-xs text-slate-400 transition hover:border-[#D4AF37]/30 hover:text-white"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Notebook
      </Link>
    </div>
  )
}

interface QuickActionsProps {
  leadId: string
  leadName: string
  currentStage: string
}

type ActionKey = 'hot' | 'reassign' | 'snooze'

export function QuickActions({ leadId, leadName, currentStage }: QuickActionsProps) {
  const [applied, setApplied] = useState<Set<ActionKey>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)

  function handleAction(key: ActionKey, label: string) {
    if (applied.has(key)) return
    setApplied((prev) => new Set(prev).add(key))
    setFlash(label)
    setTimeout(() => setFlash(null), 2500)
  }

  const actions: { key: ActionKey; label: string; icon: typeof Zap; accent: string }[] = [
    { key: 'hot',      label: 'Moved to Hot',        icon: Zap,          accent: 'hover:border-[#D4AF37]/30 hover:text-[#F8E7AE]' },
    { key: 'reassign', label: 'Queued for reassign',  icon: User,         accent: 'hover:border-sky-400/30 hover:text-sky-200' },
    { key: 'snooze',   label: 'Snoozed 24h',          icon: Bell,         accent: 'hover:border-orange-400/30 hover:text-orange-200' },
  ]

  return (
    <>
      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon
          const done = applied.has(action.key)
          return (
            <button
              key={action.key}
              onClick={() => handleAction(action.key, action.label)}
              disabled={done}
              className={[
                'flex w-full items-center gap-2.5 rounded-[12px] border border-slate-800 bg-slate-800/50 px-4 py-2.5 text-sm transition',
                done
                  ? 'text-[#D4AF37]/60 border-emerald-400/15 cursor-default'
                  : `text-slate-400 ${action.accent}`,
              ].join(' ')}
            >
              {done ? <CheckCircle className="h-3.5 w-3.5 text-[#D4AF37]" /> : <Icon className="h-3.5 w-3.5" />}
              {done ? action.label : action.label.replace('Moved to', 'Move to').replace('Queued for', 'Reassign').replace('Snoozed', 'Snooze')}
            </button>
          )
        })}
        <Link
          href="/freehold-intelligence/crm/pipeline"
          className="flex w-full items-center gap-2.5 rounded-[12px] border border-slate-800 bg-slate-800/50 px-4 py-2.5 text-sm text-slate-400 transition hover:border-slate-600 hover:text-white"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          View in pipeline
        </Link>
      </div>

      {flash && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#D4AF37]/25 bg-slate-900 px-5 py-2.5 text-sm font-medium text-[#D4AF37] shadow-lg">
          {flash}
        </div>
      )}
    </>
  )
}
