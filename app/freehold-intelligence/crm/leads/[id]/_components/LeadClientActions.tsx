'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, CheckCircle, MessageSquare, BookOpen, Zap, User, ArrowUpRight, Bell, Briefcase, Trophy, X } from 'lucide-react'
import { DealForm, type DealFormValues } from '@/components/deals/deal-form'

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
      className="flex items-center gap-1 text-sm text-gold/60 transition hover:text-gold"
    >
      {copied ? <CheckCircle className="h-3 w-3 text-gold" /> : <Copy className="h-3 w-3" />}
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
        className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-4 py-2 text-xs text-slate-400 transition hover:border-gold/30 hover:text-white"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Notebook
      </Link>
    </div>
  )
}

interface LeadSnapshot {
  phone?: string
  email?: string
  projectInterest?: string
  budgetAED?: string
}

interface QuickActionsProps {
  leadId: string
  leadName: string
  currentStage: string
  lead?: LeadSnapshot
  existingDeal?: { id: string; status: string } | null
}

type ActionKey = 'hot' | 'reassign' | 'snooze'

const DEAL_STATUS_LABEL: Record<string, string> = {
  pending_step1: 'Awaiting docs/KYC',
  pending_step2: 'Awaiting final approval',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed · Paid',
}

export function QuickActions({ leadId, leadName, currentStage, lead, existingDeal }: QuickActionsProps) {
  const router = useRouter()
  const [applied, setApplied] = useState<Set<ActionKey>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)
  const [dealModal, setDealModal] = useState<null | { closeLead: boolean }>(null)

  const isClosed = currentStage.toLowerCase() === 'closed'

  function handleAction(key: ActionKey, label: string) {
    if (applied.has(key)) return
    setApplied((prev) => new Set(prev).add(key))
    setFlash(label)
    setTimeout(() => setFlash(null), 2500)
  }

  const budgetNum = Number(String(lead?.budgetAED ?? '').replace(/[^0-9.]/g, '')) || 0

  const actions: { key: ActionKey; label: string; icon: typeof Zap; accent: string }[] = [
    { key: 'hot',      label: 'Moved to Hot',        icon: Zap,          accent: 'hover:border-gold/30 hover:text-[#F8E7AE]' },
    { key: 'reassign', label: 'Queued for reassign',  icon: User,         accent: 'hover:border-sky-400/30 hover:text-sky-200' },
    { key: 'snooze',   label: 'Snoozed 24h',          icon: Bell,         accent: 'hover:border-orange-400/30 hover:text-orange-200' },
  ]

  return (
    <>
      <div className="space-y-2">
        {/* Deal: convert once, then show its status */}
        {existingDeal ? (
          <Link
            href="/freehold-intelligence/management/deals"
            className="flex w-full items-center gap-2.5 rounded-[12px] border border-gold/25 bg-gold/[0.06] px-4 py-2.5 text-sm font-medium text-gold transition hover:bg-gold/15"
          >
            <Briefcase className="h-3.5 w-3.5" />
            Deal created · {DEAL_STATUS_LABEL[existingDeal.status] || existingDeal.status}
          </Link>
        ) : (
          <>
            <button
              onClick={() => setDealModal({ closeLead: false })}
              className="flex w-full items-center gap-2.5 rounded-[12px] border border-gold/25 bg-gold/[0.06] px-4 py-2.5 text-sm font-medium text-gold transition hover:bg-gold/15"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Convert to Deal
            </button>
            {!isClosed && (
              <button
                onClick={() => setDealModal({ closeLead: true })}
                className="flex w-full items-center gap-2.5 rounded-[12px] border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15"
              >
                <Trophy className="h-3.5 w-3.5" />
                Mark as Closed (Won)
              </button>
            )}
          </>
        )}

        {actions.map((action) => {
          const Icon = action.icon
          const done = applied.has(action.key)
          return (
            <button
              key={action.key}
              onClick={() => handleAction(action.key, action.label)}
              disabled={done}
              className={[
                'flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-sm transition',
                done
                  ? 'text-gold/60 border-emerald-400/15 cursor-default'
                  : `text-slate-400 ${action.accent}`,
              ].join(' ')}
            >
              {done ? <CheckCircle className="h-3.5 w-3.5 text-gold" /> : <Icon className="h-3.5 w-3.5" />}
              {done ? action.label : action.label.replace('Moved to', 'Move to').replace('Queued for', 'Reassign').replace('Snoozed', 'Snooze')}
            </button>
          )
        })}
        <Link
          href="/freehold-intelligence/crm/pipeline"
          className="flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-sm text-slate-400 transition hover:border-line-strong hover:text-white"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          View in pipeline
        </Link>
      </div>

      {dealModal && (
        <ConvertToDealModal
          leadId={leadId}
          leadName={leadName}
          lead={lead}
          budgetNum={budgetNum}
          closeLead={dealModal.closeLead}
          onClose={() => setDealModal(null)}
          onDone={() => { setDealModal(null); router.refresh() }}
        />
      )}

      {flash && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gold/25 bg-surface px-5 py-2.5 text-sm font-medium text-gold shadow-lg">
          {flash}
        </div>
      )}
    </>
  )
}

function ConvertToDealModal({
  leadId, leadName, lead, budgetNum, closeLead, onClose, onDone,
}: {
  leadId: string
  leadName: string
  lead?: LeadSnapshot
  budgetNum: number
  closeLead: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function submit(values: DealFormValues) {
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, leadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create deal')

      if (closeLead) {
        await fetch(`/api/freehold/crm/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed', last_contact_at: new Date().toISOString() }),
        }).catch(() => null)
      }

      toast.success(closeLead ? 'Deal created · lead closed (won)' : 'Deal created — sent for approval')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create deal')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-line-strong bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              {closeLead ? 'Close Deal (Won)' : 'Convert Lead to Deal'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {closeLead
                ? 'Capture the deal — it will be sent to management for approval and the lead marked closed.'
                : 'Capture the deal commercials. Agent deals route through 2-step approval.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-surface-2 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">
          <DealForm
            submitLabel={closeLead ? 'Create deal & close lead' : 'Create deal'}
            busy={busy}
            onCancel={onClose}
            enableLeadLookup={false}
            initial={{
              leadId,
              leadName,
              clientPhone: lead?.phone || '',
              clientEmail: lead?.email || '',
              projectName: lead?.projectInterest || '',
              propertyValueAed: budgetNum,
            }}
            onSubmit={submit}
          />
        </div>
      </div>
    </div>
  )
}
