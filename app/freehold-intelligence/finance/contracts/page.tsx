'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { FileCheck, Calendar, RefreshCw, CheckCircle2, AlertCircle, Clock, ExternalLink, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/freehold/ui'

type ContractStatus = 'active' | 'expiring' | 'expired' | 'draft'
type ContractType   = 'platform' | 'data' | 'agency' | 'legal' | 'service'

interface Contract {
  id: string
  name: string
  type: ContractType
  counterparty: string
  value: string
  startDate: string
  endDate: string
  status: ContractStatus
  autoRenew: boolean
  notes?: string
  daysLeft?: number
}

const TYPE_COLORS: Record<ContractType, string> = {
  platform: 'text-blue-400   bg-blue-400/10   border-blue-400/20',
  data:     'text-violet-400 bg-violet-400/10 border-violet-400/20',
  agency:   'text-amber-400  bg-amber-400/10  border-amber-400/20',
  legal:    'text-sky-400    bg-sky-400/10    border-sky-400/20',
  service:  'text-slate-400   bg-surface-2  border-white/10',
}

const STATUS_COLORS: Record<ContractStatus, string> = {
  active:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  expiring: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  expired:  'text-red-400     bg-red-400/10     border-red-400/20',
  draft:    'text-slate-500    bg-surface-2   border-white/10',
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [renewing, setRenewing] = useState<string | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newParty, setNewParty] = useState('')
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch('/api/freehold/contracts', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.contracts) setContracts(d.contracts) })
      .catch(() => {})
  }
  useEffect(() => { load() }, [])

  const expiring = contracts.filter((c) => c.status === 'expiring')
  const active   = contracts.filter((c) => c.status === 'active').length
  const autoRenewCount = contracts.filter((c) => c.autoRenew).length

  async function startRenewal(id: string) {
    setRenewing(id)
    try {
      const res = await fetch(`/api/freehold/contracts/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renew' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Contract renewed — extended 1 year')
      load()
    } catch { toast.error('Renewal failed') } finally { setRenewing(null) }
  }

  async function saveContract() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/contracts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), counterparty: newParty.trim(), value: newValue.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Contract added')
      setShowNew(false); setNewName(''); setNewParty(''); setNewValue('')
      load()
    } catch { toast.error('Could not add contract') } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <PageHeader
        eyebrow="Finance"
        Icon={FileCheck}
        title="Contracts"
        subtitle="Active agreements, renewals, and platform terms"
        actions={
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-400/15">
            <Plus className="h-3.5 w-3.5" /> {showNew ? 'Cancel' : 'Add contract'}
          </button>
        }
        className="mb-7"
      />

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <StatCard label="Total"      value={contracts.length} Icon={FileCheck}   />
        <StatCard label="Active"     value={active}           Icon={CheckCircle2} />
        <StatCard label="Expiring"   value={expiring.length}  Icon={AlertCircle}  />
        <StatCard label="Auto-renew" value={autoRenewCount}   Icon={RefreshCw}    />
      </div>

      {/* Expiring alert */}
      {expiring.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <div className="text-sm font-medium text-amber-300">Renewal action required</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {expiring.map((c) => `${c.name} (${c.daysLeft}d)`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* New contract form */}
      {showNew && (
        <div className="mb-5 rounded-[16px] border border-emerald-400/20 bg-emerald-400/[0.03] p-5 space-y-3">
          <div className="text-sm font-semibold text-white">New contract</div>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Contract name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="col-span-2 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/40"
            />
            <input
              placeholder="Counterparty"
              value={newParty}
              onChange={(e) => setNewParty(e.target.value)}
              className="rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/40"
            />
            <input
              placeholder="Value (e.g. AED 10,000 / mo)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/40"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveContract}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Save contract
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contract list */}
      <div className="space-y-2">
        {contracts.length === 0 && (
          <div className="rounded-[16px] border border-line bg-surface px-5 py-10 text-center text-sm text-slate-500">No contracts yet — add one above.</div>
        )}
        {contracts.map((c) => {
          const isExpanded = expanded === c.id
          const isRenewing = renewing === c.id
          return (
            <div key={c.id} className={`rounded-[16px] border bg-surface overflow-hidden transition ${
              c.status === 'expiring' ? 'border-amber-400/20' : 'border-line'
            }`}>
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpanded(isExpanded ? null : c.id)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2">
                  <FileCheck className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[c.type]}`}>
                      {c.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span>{c.counterparty}</span>
                    <span>·</span>
                    <span>{c.value}</span>
                    {c.daysLeft != null && c.status !== 'expired' && (
                      <>
                        <span>·</span>
                        <span className={c.status === 'expiring' ? 'text-amber-400' : ''}>
                          {c.daysLeft}d left
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[c.status]}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-600" /> : <ChevronRight className="h-4 w-4 text-slate-600" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-line px-5 py-4 space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider">Term</div>
                      <div className="mt-1 text-xs text-slate-300">{c.startDate} → {c.endDate}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider">Auto-renew</div>
                      <div className={`mt-1 text-xs font-medium ${c.autoRenew ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {c.autoRenew ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider">Contract ID</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{c.id}</div>
                    </div>
                  </div>
                  {c.notes && (
                    <p className="text-xs text-slate-500 leading-relaxed border-t border-line pt-3">{c.notes}</p>
                  )}
                  <div className="flex items-center gap-2 border-t border-line pt-3">
                    {(c.status === 'expiring' || c.status === 'expired') && (
                      <button onClick={() => startRenewal(c.id)} disabled={isRenewing}
                        className="flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 px-4 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/30 disabled:opacity-50">
                        {isRenewing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Calendar className="h-3 w-3" />}
                        {isRenewing ? 'Renewing…' : 'Renew 1 year'}
                      </button>
                    )}
                    <a
                      href={`mailto:legal@freeholdproperty.ae?subject=Contract document request — ${c.id}`}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition ml-auto">
                      <ExternalLink className="h-3.5 w-3.5" /> Request document
                    </a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
