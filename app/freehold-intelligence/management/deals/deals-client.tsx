'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Briefcase, TrendingUp, CheckCircle2, Clock, ShieldCheck, FileCheck2,
  XCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { StatCard, Panel, PanelHeader } from '@/components/freehold/ui'
import { useSession } from '@/lib/freehold/use-session'
import { DealForm, type DealFormValues } from '@/components/deals/deal-form'
import type { Deal, DealStatus, FinanceTotals, DealDocumentChecklist } from '@/lib/deals'

const DOC_FIELDS: { key: keyof DealDocumentChecklist; label: string }[] = [
  { key: 'signedBookingForm', label: 'Signed booking form' },
  { key: 'passport', label: 'Passport' },
  { key: 'emiratesId', label: 'Emirates ID' },
  { key: 'developerReceipts', label: 'Developer receipts' },
  { key: 'kyc', label: 'KYC' },
]

const STATUS_BADGE: Record<DealStatus, { label: string; cls: string }> = {
  pending_step1: { label: 'Awaiting docs/KYC', cls: 'bg-amber-500/15 text-amber-400' },
  pending_step2: { label: 'Awaiting final approval', cls: 'bg-violet-500/15 text-violet-400' },
  approved: { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15 text-red-400' },
  closed: { label: 'Closed · Paid', cls: 'bg-sky-500/15 text-sky-400' },
}

function fmtAED(n: number) {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

const norm = (r?: string | null) => String(r || '').trim().toLowerCase().replace(/\s+/g, '_')
const canVerifyDocs = (r?: string | null) => ['sales_manager', 'admin'].includes(norm(r))
const canFinalApprove = (r?: string | null) => ['ceo', 'director'].includes(norm(r))

export function DealsClient() {
  const { user } = useSession()
  const role = user?.role
  const [deals, setDeals] = useState<Deal[]>([])
  const [totals, setTotals] = useState<FinanceTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/deals?totals=1', { cache: 'no-store' })
      const data = await res.json()
      setDeals(Array.isArray(data.deals) ? data.deals : [])
      setTotals(data.totals || null)
    } catch {
      toast.error('Failed to load deals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pending = useMemo(() => deals.filter((d) => d.status === 'pending_step1' || d.status === 'pending_step2'), [deals])
  const active = useMemo(() => deals.filter((d) => d.status === 'approved' || d.status === 'closed'), [deals])
  const rejected = useMemo(() => deals.filter((d) => d.status === 'rejected'), [deals])

  async function createDeal(values: DealFormValues) {
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create deal')
      toast.success('Deal created')
      setShowNew(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create deal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink pb-16">
      <div className="sticky top-0 z-30 border-b border-line bg-app/80 px-6 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Deals Pipeline</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {loading ? 'Loading…' : `${deals.length} deals · ${pending.length} awaiting approval`}
            </p>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
          >
            {showNew ? 'Cancel' : '+ New Deal'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 pt-6">
        {showNew && (
          <Panel>
            <PanelHeader title="New Deal" action={<span className="text-xs text-slate-500">Type a client name to autofill from CRM</span>} />
            <div className="p-5">
              <DealForm submitLabel="Create deal" onSubmit={createDeal} onCancel={() => setShowNew(false)} busy={busy} />
            </div>
          </Panel>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Total Sales (approved)" value={fmtAED(totals?.totalSalesAed || 0)} Icon={TrendingUp} />
          <StatCard label="Gross Commission" value={fmtAED(totals?.totalCommissionAed || 0)} Icon={Briefcase} />
          <StatCard label="Approved Deals" value={String(totals?.approvedDeals || 0)} Icon={CheckCircle2} />
          <StatCard label="Awaiting Approval" value={String(totals?.pendingDeals || 0)} Icon={Clock} />
        </div>

        {/* Approval queue */}
        <Panel>
          <PanelHeader
            title="Approval Queue"
            action={<span className="text-xs text-slate-500">2-step: Sales Manager → CEO/Director</span>}
          />
          <div className="divide-y divide-line">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : pending.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No deals awaiting approval.</div>
            ) : (
              pending.map((deal) => (
                <ApprovalRow key={deal.id} deal={deal} role={role} onChanged={load} />
              ))
            )}
          </div>
        </Panel>

        {/* Active deals */}
        <Panel>
          <PanelHeader title="Active & Closed Deals" action={<span className="text-xs text-slate-500">{active.length} deals</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  {['Client', 'Project', 'Developer', 'Agent', 'Value', 'Commission', 'Paid', 'Status'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {active.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No approved deals yet.</td></tr>
                ) : active.map((deal) => (
                  <tr key={deal.id} className="hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-100">{deal.leadName}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-400">{deal.projectName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{deal.developerName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {deal.agentName || '—'}
                      {deal.coAgentName && <span className="text-slate-500"> + {deal.coAgentName} ({deal.agentSharePct}/{100 - deal.agentSharePct})</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-white">{fmtAED(deal.propertyValueAed)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gold">{fmtAED(deal.agencyCommissionAed)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-300">{fmtAED(deal.commissionReceivedAed)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[deal.status].cls}`}>{STATUS_BADGE[deal.status].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {rejected.length > 0 && (
          <Panel>
            <PanelHeader title="Rejected" action={<span className="text-xs text-slate-500">{rejected.length}</span>} />
            <div className="divide-y divide-line">
              {rejected.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm text-slate-200">{deal.leadName} · {deal.projectName || '—'}</div>
                    <div className="text-xs text-red-400">{deal.rejectionReason} {deal.rejectedBy ? `· by ${deal.rejectedBy}` : ''}</div>
                  </div>
                  <div className="text-sm tabular-nums text-slate-500">{fmtAED(deal.propertyValueAed)}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}

// ─── Approval row ──────────────────────────────────────────────────────────────

function ApprovalRow({ deal, role, onChanged }: { deal: Deal; role?: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<DealDocumentChecklist>(deal.documents)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Action failed')
      toast.success('Updated')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  function reject() {
    const reason = window.prompt('Reason for rejection?')
    if (reason === null) return
    act('reject', { reason })
  }

  const isStep1 = deal.status === 'pending_step1'
  const canActStep1 = isStep1 && canVerifyDocs(role)
  const canActStep2 = deal.status === 'pending_step2' && canFinalApprove(role)
  const allDocs = Object.values(docs).every(Boolean)

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-4">
        <button onClick={() => setOpen((o) => !o)} className="text-slate-500 hover:text-slate-300">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{deal.leadName}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[deal.status].cls}`}>{STATUS_BADGE[deal.status].label}</span>
          </div>
          <p className="truncate text-xs text-slate-500">
            {deal.projectName || '—'}{deal.developerName ? ` · ${deal.developerName}` : ''} · {deal.agentName}
            {deal.coAgentName ? ` + ${deal.coAgentName} (${deal.agentSharePct}/${100 - deal.agentSharePct})` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-white">{fmtAED(deal.propertyValueAed)}</div>
          <div className="text-xs tabular-nums text-gold">{fmtAED(deal.agencyCommissionAed)} comm.</div>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 rounded-lg border border-line bg-surface-2/40 p-4">
          {/* Commission breakdown */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Property value', deal.propertyValueAed],
              ['Agency comm.', deal.agencyCommissionAed],
              ['Referral', deal.referralCommissionAed],
              ['Net to agency', deal.netCommissionAed],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{label as string}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">{fmtAED(value as number)}</div>
              </div>
            ))}
          </div>

          {/* Step 1 — document checklist */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <FileCheck2 className="h-3.5 w-3.5 text-amber-400" /> Step 1 — Documents & KYC (Sales Manager / Admin)
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {DOC_FIELDS.map(({ key, label }) => (
                <label key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${docs[key] ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300' : 'border-line text-slate-400'} ${canActStep1 ? 'cursor-pointer' : 'cursor-default opacity-80'}`}>
                  <input
                    type="checkbox"
                    className="accent-emerald-500"
                    checked={docs[key]}
                    disabled={!canActStep1}
                    onChange={(e) => setDocs((d) => ({ ...d, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            {deal.step1By && (
              <p className="mt-2 text-xs text-emerald-400">Verified by {deal.step1By}{deal.step1Notes ? ` — ${deal.step1Notes}` : ''}</p>
            )}
          </div>

          {/* Actions */}
          {canActStep1 && (
            <div className="space-y-2">
              <input
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40"
                placeholder="Verification notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  disabled={busy || !allDocs}
                  onClick={() => act('verify_documents', { documents: docs, notes })}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                  title={allDocs ? '' : 'All documents must be checked'}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
                  Verify & send for final approval
                </button>
                <button disabled={busy} onClick={reject} className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {deal.status === 'pending_step2' && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-400" /> Step 2 — Final approval (CEO / Director)
              </div>
              {canActStep2 ? (
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => act('final_approve', { notes })} className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Give final approval
                  </button>
                  <button disabled={busy} onClick={reject} className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Awaiting CEO / Director sign-off.</p>
              )}
            </div>
          )}

          {isStep1 && !canActStep1 && (
            <p className="text-xs text-slate-500">Awaiting Sales Manager / Admin document verification.</p>
          )}
        </div>
      )}
    </div>
  )
}
