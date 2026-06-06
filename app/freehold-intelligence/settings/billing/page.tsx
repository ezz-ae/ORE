'use client'

import { useState } from 'react'
import {
  CreditCard, CheckCircle, Clock, AlertCircle,
  Download, TrendingUp, Zap, Users,
} from 'lucide-react'

type InvoiceStatus = 'paid' | 'processing' | 'overdue'

type Invoice = {
  id: string
  description: string
  amount: number
  status: InvoiceStatus
  date: string
  period: string
}

const INVOICES: Invoice[] = [
  { id: 'INV-2026-06', description: 'Freehold Intelligence — June 2026',     amount: 4_900, status: 'processing', date: '2026-06-01', period: 'Jun 2026' },
  { id: 'INV-2026-05', description: 'Freehold Intelligence — May 2026',      amount: 4_900, status: 'paid',       date: '2026-05-01', period: 'May 2026' },
  { id: 'INV-2026-04', description: 'Freehold Intelligence — April 2026',    amount: 4_900, status: 'paid',       date: '2026-04-01', period: 'Apr 2026' },
  { id: 'INV-2026-03', description: 'Freehold Intelligence — March 2026',    amount: 4_200, status: 'paid',       date: '2026-03-01', period: 'Mar 2026' },
  { id: 'INV-2026-02', description: 'Freehold Intelligence — February 2026', amount: 4_200, status: 'paid',       date: '2026-02-01', period: 'Feb 2026' },
]

const STATUS_META: Record<InvoiceStatus, { Icon: React.ElementType; label: string; color: string }> = {
  paid:       { Icon: CheckCircle,  label: 'Paid',       color: 'text-emerald-400' },
  processing: { Icon: Clock,        label: 'Processing', color: 'text-amber-400'   },
  overdue:    { Icon: AlertCircle,  label: 'Overdue',    color: 'text-red-400'     },
}

const PLAN_FEATURES = [
  { Icon: Users, label: 'Up to 10 agents' },
  { Icon: Zap,   label: 'Unlimited campaigns' },
  { Icon: TrendingUp, label: 'Full analytics' },
  { Icon: CheckCircle, label: 'Priority support' },
]

export default function BillingPage() {
  const [showPayment, setShowPayment] = useState(false)

  const nextBilling = new Date('2026-07-01').toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <h1 className="mb-8 text-xl font-semibold text-white">Billing</h1>

      {/* Current plan */}
      <section className="mb-6 rounded-[20px] border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.07] to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">Professional</span>
              <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-xs font-semibold text-[#D4AF37]">
                Active
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-400">Billed monthly · Next charge {nextBilling}</div>
          </div>
          <div className="text-right">
            <div className="text-[28px] font-semibold text-white tabular-nums">AED 4,900</div>
            <div className="text-xs text-slate-500">per month</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLAN_FEATURES.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-slate-400">
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/70" />
              {label}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => setShowPayment((v) => !v)}
            className="rounded-full border border-slate-700 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800/60 hover:text-white"
          >
            Update payment method
          </button>
          <button className="rounded-full border border-slate-800 px-4 py-2 text-xs text-slate-500 transition hover:text-slate-300">
            Cancel plan
          </button>
        </div>
      </section>

      {/* Payment form */}
      {showPayment && (
        <div className="mb-6 rounded-[18px] border border-slate-800 bg-slate-900 p-5 space-y-3">
          <div className="text-sm font-semibold text-white">Update payment method</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input placeholder="Cardholder name" className="col-span-2 rounded-[10px] border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#D4AF37]/40" />
            <div className="col-span-2 flex items-center gap-2 rounded-[10px] border border-slate-700 bg-slate-800/50 px-3 py-2.5">
              <CreditCard className="h-4 w-4 shrink-0 text-slate-500" />
              <input placeholder="Card number" className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none" />
            </div>
            <input placeholder="MM / YY" className="rounded-[10px] border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#D4AF37]/40" />
            <input placeholder="CVC" className="rounded-[10px] border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#D4AF37]/40" />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowPayment(false)}
              className="flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black transition hover:bg-[#D4AF37]/90"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Save card
            </button>
            <button onClick={() => setShowPayment(false)} className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Usage */}
      <section className="mb-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Usage this month</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active agents',    value: '6',       max: '10',    pct: 60 },
            { label: 'Leads this month', value: '415',     max: '500',   pct: 83 },
            { label: 'API calls',        value: '12.4K',   max: '50K',   pct: 25 },
          ].map(({ label, value, max, pct }) => (
            <div key={label} className="rounded-[14px] border border-slate-800 bg-slate-900 p-4">
              <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{label}</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/60">
                <div className={`h-full rounded-full ${pct > 85 ? 'bg-amber-400' : 'bg-[#D4AF37]'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-600">of {max}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Invoices */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice history</div>
        <div className="rounded-[18px] border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="divide-y divide-slate-800">
            {INVOICES.map((inv) => {
              const sm = STATUS_META[inv.status]
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{inv.description}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {inv.id} · {new Date(inv.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${sm.color}`}>
                    <sm.Icon className="h-3.5 w-3.5" />
                    {sm.label}
                  </div>
                  <div className="text-sm font-semibold text-white tabular-nums">
                    AED {inv.amount.toLocaleString()}
                  </div>
                  {inv.status === 'paid' && (
                    <button className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-500 transition hover:border-slate-600 hover:text-slate-300">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
