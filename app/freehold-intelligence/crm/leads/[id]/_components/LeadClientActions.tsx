'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, CheckCircle, MessageSquare, BookOpen, Zap, User, ArrowUpRight, Bell, Briefcase, Trophy, X } from 'lucide-react'
import { DealForm, type DealFormValues } from '@/components/deals/deal-form'
import { useT } from '@/lib/i18n/provider'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const t = useT()
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
      {copied ? t('crm.copied') : t('crm.copy')}
    </button>
  )
}

interface SuggestedMessageActionsProps {
  message: string
  phone: string
  leadId: string
}

export function SuggestedMessageActions({ message, phone, leadId }: SuggestedMessageActionsProps) {
  const t = useT()
  const [sent, setSent] = useState(false)

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {/* Full in-app WhatsApp chat */}
      <Link
        href={`/freehold-intelligence/crm/leads/${leadId}/whatsapp`}
        className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {t('crm.openWhatsAppChat')}
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
        {sent ? t('crm.opened') : 'wa.me'}
      </a>
      <Link
        href={`/freehold-intelligence/notebook?lead=${leadId}`}
        className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-4 py-2 text-xs text-slate-400 transition hover:border-gold/30 hover:text-white"
      >
        <BookOpen className="h-3.5 w-3.5" />
        {t('crm.notebook')}
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

const DEAL_STATUS_LABEL_KEY: Record<string, string> = {
  pending_step1: 'crm.deal.pendingStep1',
  pending_step2: 'crm.deal.pendingStep2',
  approved: 'crm.deal.approved',
  rejected: 'crm.deal.rejected',
  closed: 'crm.deal.closedPaid',
}

export function QuickActions({ leadId, leadName, currentStage, lead, existingDeal }: QuickActionsProps) {
  const t = useT()
  const router = useRouter()
  const [applied, setApplied] = useState<Set<ActionKey>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)
  const [dealModal, setDealModal] = useState<null | { closeLead: boolean }>(null)

  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [showReassign, setShowReassign] = useState(false)
  const isClosed = currentStage.toLowerCase() === 'closed'

  function flashMsg(label: string) {
    setFlash(label)
    setTimeout(() => setFlash(null), 2500)
  }

  async function patchLead(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/freehold/crm/leads/${leadId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      return res.ok
    } catch { return false }
  }

  async function markHot() {
    if (applied.has('hot')) return
    const ok = await patchLead({ priority: 'hot' })
    if (ok) { setApplied((p) => new Set(p).add('hot')); flashMsg(t('crm.markedAsHot')); router.refresh() }
    else flashMsg(t('crm.couldNotUpdate'))
  }

  async function snooze24h() {
    if (applied.has('snooze')) return
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const ok = await patchLead({ snooze_until: until })
    if (ok) { setApplied((p) => new Set(p).add('snooze')); flashMsg(t('crm.snoozed24h')) }
    else flashMsg(t('crm.couldNotSnooze'))
  }

  async function toggleReassign() {
    setShowReassign((v) => !v)
    if (!agents.length) {
      try {
        const res = await fetch('/api/freehold/team', { cache: 'no-store' })
        const data = await res.json()
        const list = (data.members || []).filter((m: { dbRole?: string }) => m.dbRole === 'broker')
          .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))
        setAgents(list.length ? list : (data.members || []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })))
      } catch { /* keep empty */ }
    }
  }

  async function reassignTo(agentId: string, agentName: string) {
    const ok = await patchLead({ assigned_broker_id: agentId })
    setShowReassign(false)
    if (ok) { setApplied((p) => new Set(p).add('reassign')); flashMsg(t('crm.reassignedTo', { agent: agentName })); router.refresh() }
    else flashMsg(t('crm.couldNotReassign'))
  }

  const budgetNum = Number(String(lead?.budgetAED ?? '').replace(/[^0-9.]/g, '')) || 0

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
            {t('crm.dealCreated', { status: DEAL_STATUS_LABEL_KEY[existingDeal.status] ? t(DEAL_STATUS_LABEL_KEY[existingDeal.status]) : existingDeal.status })}
          </Link>
        ) : (
          <>
            <button
              onClick={() => setDealModal({ closeLead: false })}
              className="flex w-full items-center gap-2.5 rounded-[12px] border border-gold/25 bg-gold/[0.06] px-4 py-2.5 text-sm font-medium text-gold transition hover:bg-gold/15"
            >
              <Briefcase className="h-3.5 w-3.5" />
              {t('crm.convertToDeal')}
            </button>
            {!isClosed && (
              <button
                onClick={() => setDealModal({ closeLead: true })}
                className="flex w-full items-center gap-2.5 rounded-[12px] border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15"
              >
                <Trophy className="h-3.5 w-3.5" />
                {t('crm.markAsClosedWon')}
              </button>
            )}
          </>
        )}

        {/* Move to Hot */}
        <button
          onClick={markHot}
          disabled={applied.has('hot')}
          className={`flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-sm transition ${applied.has('hot') ? 'cursor-default border-emerald-400/15 text-gold/60' : 'text-slate-400 hover:border-gold/30 hover:text-[#F8E7AE]'}`}
        >
          {applied.has('hot') ? <CheckCircle className="h-3.5 w-3.5 text-gold" /> : <Zap className="h-3.5 w-3.5" />}
          {applied.has('hot') ? t('crm.markedAsHot') : t('crm.moveToHot')}
        </button>

        {/* Reassign */}
        <div className="relative">
          <button
            onClick={toggleReassign}
            className={`flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-sm transition ${applied.has('reassign') ? 'text-gold/60 border-emerald-400/15' : 'text-slate-400 hover:border-teal-400/30 hover:text-teal-200'}`}
          >
            {applied.has('reassign') ? <CheckCircle className="h-3.5 w-3.5 text-gold" /> : <User className="h-3.5 w-3.5" />}
            {t('crm.reassign')}
          </button>
          {showReassign && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[12px] border border-line-strong bg-surface shadow-xl">
              {agents.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">{t('crm.loadingAgents')}</div>
              ) : agents.map((a) => (
                <button key={a.id} onClick={() => reassignTo(a.id, a.name)} className="block w-full px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-surface-2 hover:text-white">
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Snooze */}
        <button
          onClick={snooze24h}
          disabled={applied.has('snooze')}
          className={`flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-sm transition ${applied.has('snooze') ? 'cursor-default border-emerald-400/15 text-gold/60' : 'text-slate-400 hover:border-orange-400/30 hover:text-orange-200'}`}
        >
          {applied.has('snooze') ? <CheckCircle className="h-3.5 w-3.5 text-gold" /> : <Bell className="h-3.5 w-3.5" />}
          {applied.has('snooze') ? t('crm.snoozed24h') : t('crm.snooze24h')}
        </button>

        <Link
          href="/freehold-intelligence/crm/pipeline"
          className="flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-surface-2 px-4 py-2.5 text-sm text-slate-400 transition hover:border-line-strong hover:text-white"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          {t('crm.viewInPipeline')}
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
  const t = useT()
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
      if (!res.ok) throw new Error(data?.error || t('crm.failedCreateDeal'))

      if (closeLead) {
        await fetch(`/api/freehold/crm/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed', last_contact_at: new Date().toISOString() }),
        }).catch(() => null)
      }

      toast.success(closeLead ? t('crm.dealCreatedLeadClosed') : t('crm.dealCreatedSentApproval'))
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('crm.failedCreateDeal'))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-line-strong bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              {closeLead ? t('crm.closeDealWon') : t('crm.convertLeadToDeal')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {closeLead
                ? t('crm.closeDealDesc')
                : t('crm.convertDealDesc')}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-surface-2 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">
          <DealForm
            submitLabel={closeLead ? t('crm.createDealCloseLead') : t('crm.createDeal')}
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
