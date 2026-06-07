'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileCheck, Calendar, RefreshCw, CheckCircle2, AlertCircle, Clock, ExternalLink, Plus, ChevronDown, ChevronRight } from 'lucide-react'

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

const CONTRACTS: Contract[] = [
  {
    id: 'CTR-001', name: 'Meta Business Agreement',
    type: 'platform', counterparty: 'Meta Platforms Inc.',
    value: 'AED 25,000 / mo', startDate: 'Jan 2025', endDate: 'Dec 2026',
    status: 'active', autoRenew: true, daysLeft: 213,
    notes: 'Covers all Meta ad products. Includes monthly invoicing through Business Manager.',
  },
  {
    id: 'CTR-002', name: 'Google Ads Terms of Service',
    type: 'platform', counterparty: 'Google LLC',
    value: 'AED 18,000 / mo', startDate: 'Jan 2025', endDate: 'Dec 2026',
    status: 'active', autoRenew: true, daysLeft: 213,
    notes: 'Performance Max + Search campaigns. Developer token approved under Standard Access.',
  },
  {
    id: 'CTR-003', name: 'DLD Data Feed License',
    type: 'data', counterparty: 'Dubai Land Department',
    value: 'AED 12,000 / yr', startDate: 'Mar 2025', endDate: 'Feb 2027',
    status: 'active', autoRenew: false, daysLeft: 270,
    notes: 'Property transaction data. Annual renewal required — no auto-renew available.',
  },
  {
    id: 'CTR-004', name: 'PropTrack Data API',
    type: 'data', counterparty: 'PropTrack DMCC',
    value: 'AED 8,400 / yr', startDate: 'Jun 2025', endDate: 'May 2026',
    status: 'expiring', autoRenew: false, daysLeft: 18,
    notes: 'Market data and price index API. Quote requested for renewal — awaiting response.',
  },
  {
    id: 'CTR-005', name: 'Agency Retainer — Digital Media',
    type: 'agency', counterparty: 'Pixel House Agency LLC',
    value: 'AED 15,000 / mo', startDate: 'Oct 2025', endDate: 'Sep 2026',
    status: 'active', autoRenew: false, daysLeft: 120,
    notes: 'Creative production, social media management, monthly strategy sessions.',
  },
  {
    id: 'CTR-006', name: 'Legal Advisory — Real Estate',
    type: 'legal', counterparty: 'Al Tamimi & Company',
    value: 'AED 5,000 / mo', startDate: 'Jan 2026', endDate: 'Dec 2026',
    status: 'active', autoRenew: true, daysLeft: 213,
  },
  {
    id: 'CTR-007', name: 'Cloud Infrastructure (Vercel Pro)',
    type: 'service', counterparty: 'Vercel Inc.',
    value: 'USD 150 / mo', startDate: 'Mar 2026', endDate: 'Mar 2027',
    status: 'active', autoRenew: true, daysLeft: 303,
  },
]

const TYPE_COLORS: Record<ContractType, string> = {
  platform: 'text-blue-400   bg-blue-400/10   border-blue-400/20',
  data:     'text-violet-400 bg-violet-400/10 border-violet-400/20',
  agency:   'text-amber-400  bg-amber-400/10  border-amber-400/20',
  legal:    'text-sky-400    bg-sky-400/10    border-sky-400/20',
  service:  'text-slate-400   bg-slate-800/50  border-white/10',
}

const STATUS_COLORS: Record<ContractStatus, string> = {
  active:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  expiring: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  expired:  'text-red-400     bg-red-400/10     border-red-400/20',
  draft:    'text-slate-500    bg-slate-800/40   border-white/10',
}

export default function ContractsPage() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [renewing, setRenewing] = useState<string | null>(null)
  const [renewed,  setRenewed]  = useState<string[]>([])

  const expiring = CONTRACTS.filter((c) => c.status === 'expiring')
  const active   = CONTRACTS.filter((c) => c.status === 'active').length
  const autoRenewCount = CONTRACTS.filter((c) => c.autoRenew).length

  function startRenewal(id: string) {
    setRenewing(id)
    setTimeout(() => {
      setRenewing(null)
      setRenewed((prev) => [...prev, id])
    }, 2000)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-white">Contracts</h1>
          <p className="mt-1 text-xs text-slate-500">Active agreements, renewals, and platform terms</p>
        </div>
        <button
          onClick={() => toast.success('New contract — opening form')}
          className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-400/15">
          <Plus className="h-3.5 w-3.5" /> Add contract
        </button>
      </div>

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: CONTRACTS.length,    color: 'text-slate-200'   },
          { label: 'Active',      value: active,              color: 'text-emerald-400' },
          { label: 'Expiring',    value: expiring.length,     color: expiring.length > 0 ? 'text-amber-400' : 'text-slate-200' },
          { label: 'Auto-renew',  value: autoRenewCount,      color: 'text-sky-400'     },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-[14px] border border-slate-800 bg-slate-900 p-3.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</div>
            <div className={`mt-1.5 text-[20px] font-semibold ${color}`}>{value}</div>
          </div>
        ))}
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

      {/* Contract list */}
      <div className="space-y-2">
        {CONTRACTS.map((c) => {
          const isExpanded = expanded === c.id
          const isRenewing = renewing === c.id
          const isRenewed  = renewed.includes(c.id)
          return (
            <div key={c.id} className={`rounded-[16px] border bg-slate-900 overflow-hidden transition ${
              c.status === 'expiring' ? 'border-amber-400/20' : 'border-slate-800'
            }`}>
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpanded(isExpanded ? null : c.id)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-800/40">
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
                    {c.daysLeft !== undefined && c.status !== 'expired' && (
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
                <div className="border-t border-slate-800 px-5 py-4 space-y-3">
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
                    <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-800 pt-3">{c.notes}</p>
                  )}
                  <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                    {c.status === 'expiring' && !isRenewed && (
                      <button onClick={() => startRenewal(c.id)} disabled={isRenewing}
                        className="flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 px-4 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/30 disabled:opacity-50">
                        {isRenewing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Calendar className="h-3 w-3" />}
                        {isRenewing ? 'Sending renewal…' : 'Request renewal'}
                      </button>
                    )}
                    {isRenewed && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Renewal requested
                      </span>
                    )}
                    <button
                      onClick={() => toast.info('Opening contract document')}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition ml-auto">
                      <ExternalLink className="h-3.5 w-3.5" /> View document
                    </button>
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
