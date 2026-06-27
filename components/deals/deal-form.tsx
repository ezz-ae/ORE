'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Calculator } from 'lucide-react'

export interface DealFormValues {
  leadId?: string | null
  leadName: string
  clientPhone: string
  clientEmail: string
  developerName: string
  projectName: string
  projectSlug?: string
  propertyValueAed: number
  agencyCommissionPct: number
  agencyCommissionAed: number
  referralCommissionPct: number
  referralCommissionAed: number
  cashbackPct: number
  cashbackAed: number
  notes: string
}

const EMPTY: DealFormValues = {
  leadId: null,
  leadName: '',
  clientPhone: '',
  clientEmail: '',
  developerName: '',
  projectName: '',
  projectSlug: '',
  propertyValueAed: 0,
  agencyCommissionPct: 2,
  agencyCommissionAed: 0,
  referralCommissionPct: 0,
  referralCommissionAed: 0,
  cashbackPct: 0,
  cashbackAed: 0,
  notes: '',
}

interface LeadOption {
  id: string
  name: string
  phone: string
  email: string
  projectInterest: string
  budgetAED: string
}

function fmtAED(n: number) {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

const resolveAmount = (pct: number, amount: number, base: number) =>
  amount > 0 ? amount : pct > 0 && base > 0 ? (pct / 100) * base : 0

interface DealFormProps {
  initial?: Partial<DealFormValues>
  submitLabel: string
  onSubmit: (values: DealFormValues) => Promise<void> | void
  onCancel?: () => void
  /** Enable CRM lead autocomplete (agent / manual add). */
  enableLeadLookup?: boolean
  busy?: boolean
}

export function DealForm({ initial, submitLabel, onSubmit, onCancel, enableLeadLookup = true, busy }: DealFormProps) {
  const [v, setV] = useState<DealFormValues>({ ...EMPTY, ...initial })
  const [leadResults, setLeadResults] = useState<LeadOption[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof DealFormValues>(key: K, value: DealFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }))

  // ── Live commission breakdown ──────────────────────────────────────────────
  const breakdown = useMemo(() => {
    const base = v.propertyValueAed
    const agency = resolveAmount(v.agencyCommissionPct, v.agencyCommissionAed, base)
    const referral = resolveAmount(v.referralCommissionPct, v.referralCommissionAed, agency)
    const cashback = resolveAmount(v.cashbackPct, v.cashbackAed, base)
    const net = Math.max(0, agency - referral - cashback)
    return { agency, referral, cashback, net }
  }, [v])

  // ── CRM lead autocomplete ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enableLeadLookup) return
    const q = v.leadName.trim()
    if (q.length < 2 || v.leadId) {
      setLeadResults([])
      return
    }
    let active = true
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/freehold/crm/leads', { cache: 'no-store' })
        const data = await res.json()
        const leads: LeadOption[] = (data.leads || data || [])
          .map((l: Record<string, unknown>) => ({
            id: String(l.id || ''),
            name: String(l.name || ''),
            phone: String(l.phone || ''),
            email: String(l.email || ''),
            projectInterest: String(l.projectInterest || l.project_slug || ''),
            budgetAED: String(l.budgetAED || l.budget_aed || ''),
          }))
          .filter((l: LeadOption) => l.name.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 6)
        if (active) {
          setLeadResults(leads)
          setShowResults(true)
        }
      } catch {
        if (active) setLeadResults([])
      } finally {
        if (active) setSearching(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [v.leadName, v.leadId, enableLeadLookup])

  function applyLead(lead: LeadOption) {
    const budget = Number(String(lead.budgetAED).replace(/[^0-9.]/g, '')) || 0
    setV((prev) => ({
      ...prev,
      leadId: lead.id,
      leadName: lead.name,
      clientPhone: lead.phone,
      clientEmail: lead.email,
      projectName: lead.projectInterest || prev.projectName,
      propertyValueAed: budget || prev.propertyValueAed,
    }))
    setShowResults(false)
    setLeadResults([])
  }

  async function handleSubmit() {
    setError('')
    if (!v.leadName.trim()) {
      setError('Client / lead name is required.')
      return
    }
    if (v.propertyValueAed <= 0) {
      setError('Property value must be greater than zero.')
      return
    }
    await onSubmit(v)
  }

  const inputCls =
    'w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40'
  const labelCls = 'mb-1 block text-xs font-medium text-slate-400'

  return (
    <div className="space-y-5">
      {/* Client / lead */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="relative">
          <label className={labelCls}>Client / Lead name *</label>
          <div className="relative">
            <input
              className={inputCls}
              placeholder="Start typing to search CRM…"
              value={v.leadName}
              onChange={(e) => { set('leadName', e.target.value); set('leadId', null) }}
              onFocus={() => leadResults.length && setShowResults(true)}
            />
            {enableLeadLookup && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </span>
            )}
          </div>
          {showResults && leadResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line-strong bg-surface shadow-xl">
              {leadResults.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => applyLead(lead)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{lead.name}</div>
                    <div className="truncate text-xs text-slate-500">{lead.phone || lead.email || '—'}</div>
                  </div>
                  {lead.projectInterest && (
                    <span className="shrink-0 text-xs text-slate-500">{lead.projectInterest}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {v.leadId && <p className="mt-1 text-xs text-emerald-400">Linked to CRM lead — details autofilled.</p>}
        </div>
        <div>
          <label className={labelCls}>Phone / WhatsApp</label>
          <input className={inputCls} value={v.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} placeholder="+971…" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className={labelCls}>Email</label>
          <input className={inputCls} value={v.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} placeholder="client@email.com" />
        </div>
        <div>
          <label className={labelCls}>Developer name</label>
          <input className={inputCls} value={v.developerName} onChange={(e) => set('developerName', e.target.value)} placeholder="e.g. Emaar" />
        </div>
        <div>
          <label className={labelCls}>Project name</label>
          <input className={inputCls} value={v.projectName} onChange={(e) => set('projectName', e.target.value)} placeholder="e.g. Dubai Hills Estate" />
        </div>
      </div>

      {/* Commercials */}
      <div className="rounded-xl border border-line-strong bg-surface-2/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Calculator className="h-3.5 w-3.5 text-gold" /> Commercials
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Total property value (AED) *</label>
            <input
              type="number" min={0} className={inputCls}
              value={v.propertyValueAed || ''}
              onChange={(e) => set('propertyValueAed', Number(e.target.value) || 0)}
              placeholder="e.g. 2500000"
            />
          </div>
          <div>
            <label className={labelCls}>Agency commission %</label>
            <input
              type="number" min={0} step={0.1} className={inputCls}
              value={v.agencyCommissionPct || ''}
              onChange={(e) => set('agencyCommissionPct', Number(e.target.value) || 0)}
              placeholder="e.g. 2"
            />
          </div>
          <div>
            <label className={labelCls}>Referral commission % <span className="text-slate-600">or amount</span></label>
            <div className="flex gap-2">
              <input type="number" min={0} step={0.1} className={inputCls} value={v.referralCommissionPct || ''} onChange={(e) => set('referralCommissionPct', Number(e.target.value) || 0)} placeholder="%" />
              <input type="number" min={0} className={inputCls} value={v.referralCommissionAed || ''} onChange={(e) => set('referralCommissionAed', Number(e.target.value) || 0)} placeholder="AED" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Cashback % <span className="text-slate-600">or amount</span></label>
            <div className="flex gap-2">
              <input type="number" min={0} step={0.1} className={inputCls} value={v.cashbackPct || ''} onChange={(e) => set('cashbackPct', Number(e.target.value) || 0)} placeholder="%" />
              <input type="number" min={0} className={inputCls} value={v.cashbackAed || ''} onChange={(e) => set('cashbackAed', Number(e.target.value) || 0)} placeholder="AED" />
            </div>
          </div>
        </div>

        {/* Live breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Agency commission', value: breakdown.agency, tone: 'text-white' },
            { label: 'Referral', value: breakdown.referral, tone: 'text-slate-300' },
            { label: 'Cashback', value: breakdown.cashback, tone: 'text-slate-300' },
            { label: 'Net to agency', value: breakdown.net, tone: 'text-gold' },
          ].map((b) => (
            <div key={b.label} className="rounded-lg border border-line bg-surface px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{b.label}</div>
              <div className={`mt-0.5 text-sm font-semibold tabular-nums ${b.tone}`}>{fmtAED(b.value)}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea className={`${inputCls} min-h-[70px]`} value={v.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything management should know…" />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
