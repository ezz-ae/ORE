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
      <h1 className="mb-8 text-[20px] font-semibold text-white">Billing</h1>

      {/* Current plan */}
      <section className="mb-6 rounded-[20px] border border-[#D4AF37]/20 bg-gradient-to-br from-[#D4AF37]/[0.07] to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-bold text-white">Professional</span>
              <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[11px] font-semibold text-[#D4AF37]">
                Active
              </span>
            </div>
            <div className="mt-1 text-[13px] text-white/40">Billed monthly · Next charge {nextBilling}</div>
          </div>
          <div className="text-right">
            <div className="text-[28px] font-semibold text-white tabular-nums">AED 4,900</div>
            <div className="text-[12px] text-white/30">per month</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLAN_FEATURES.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-[12px] text-white/55">
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/70" />
              {label}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => setShowPayment((v) => !v)}
            className="rounded-full border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          >
            Update payment method
          </button>
          <button className="rounded-full border border-white/[0.07] px-4 py-2 text-[12px] text-white/30 transition hover:text-white/55">
            Cancel plan
          </button>
        </div>
      </section>

      {/* Payment form */}
      {showPayment && (
        <div className="mb-6 rounded-[18px] border border-white/[0.10] bg-[#131B2B] p-5 space-y-3">
          <div className="text-[13px] font-semibold text-white">Update payment method</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input placeholder="Cardholder name" className="col-span-2 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/40" />
            <div className="col-span-2 flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
              <CreditCard className="h-4 w-4 shrink-0 text-white/25" />
              <input placeholder="Card number" className="flex-1 bg-transparent text-[13px] text-white placeholder-white/25 outline-none" />
            </div>
            <input placeholder="MM / YY" className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/40" />
            <input placeholder="CVC" className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/40" />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowPayment(false)}
              className="flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-[#D4AF37]/90"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Save card
            </button>
            <button onClick={() => setShowPayment(false)} className="rounded-full border border-white/[0.08] px-4 py-2 text-[12px] text-white/35 transition hover:text-white/60">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Usage */}
      <section className="mb-6">
        <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/25">Usage this month</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active agents',    value: '6',       max: '10',    pct: 60 },
            { label: 'Leads this month', value: '415',     max: '500',   pct: 83 },
            { label: 'API calls',        value: '12.4K',   max: '50K',   pct: 25 },
          ].map(({ label, value, max, pct }) => (
            <div key={label} className="rounded-[14px] border border-white/[0.06] bg-[#131B2B] p-4">
              <div className="text-[16px] font-semibold text-white tabular-nums">{value}</div>
              <div className="mt-0.5 text-[11px] text-white/30">{label}</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div className={`h-full rounded-full ${pct > 85 ? 'bg-amber-400' : 'bg-[#D4AF37]'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-white/20">of {max}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Invoices */}
      <section>
        <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/25">Invoice history</div>
        <div className="rounded-[18px] border border-white/[0.07] bg-[#131B2B] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {INVOICES.map((inv) => {
              const sm = STATUS_META[inv.status]
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white/80 truncate">{inv.description}</div>
                    <div className="mt-0.5 text-[11px] text-white/30">
                      {inv.id} · {new Date(inv.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] font-medium ${sm.color}`}>
                    <sm.Icon className="h-3.5 w-3.5" />
                    {sm.label}
                  </div>
                  <div className="text-[14px] font-semibold text-white tabular-nums">
                    AED {inv.amount.toLocaleString()}
                  </div>
                  {inv.status === 'paid' && (
                    <button className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] text-white/25 transition hover:border-white/20 hover:text-white/60">
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
