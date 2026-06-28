'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CreditCard, CheckCircle, Clock, AlertCircle,
  Download, TrendingUp, Zap, Users,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

type InvoiceStatus = 'paid' | 'processing' | 'overdue'

type Invoice = {
  id: string
  descKey: string
  amount: number
  status: InvoiceStatus
  date: string
  period: string
}

const INVOICES: Invoice[] = [
  { id: 'INV-2026-06', descKey: 'settings.billing.inv.june',     amount: 4_900, status: 'processing', date: '2026-06-01', period: 'Jun 2026' },
  { id: 'INV-2026-05', descKey: 'settings.billing.inv.may',      amount: 4_900, status: 'paid',       date: '2026-05-01', period: 'May 2026' },
  { id: 'INV-2026-04', descKey: 'settings.billing.inv.april',    amount: 4_900, status: 'paid',       date: '2026-04-01', period: 'Apr 2026' },
  { id: 'INV-2026-03', descKey: 'settings.billing.inv.march',    amount: 4_200, status: 'paid',       date: '2026-03-01', period: 'Mar 2026' },
  { id: 'INV-2026-02', descKey: 'settings.billing.inv.february', amount: 4_200, status: 'paid',       date: '2026-02-01', period: 'Feb 2026' },
]

const STATUS_META: Record<InvoiceStatus, { Icon: React.ElementType; labelKey: string; color: string }> = {
  paid:       { Icon: CheckCircle,  labelKey: 'settings.billing.status.paid',       color: 'text-emerald-400' },
  processing: { Icon: Clock,        labelKey: 'settings.billing.status.processing', color: 'text-amber-400'   },
  overdue:    { Icon: AlertCircle,  labelKey: 'settings.billing.status.overdue',    color: 'text-red-400'     },
}

const PLAN_FEATURES = [
  { Icon: Users, labelKey: 'settings.billing.feature.agents' },
  { Icon: Zap,   labelKey: 'settings.billing.feature.campaigns' },
  { Icon: TrendingUp, labelKey: 'settings.billing.feature.analytics' },
  { Icon: CheckCircle, labelKey: 'settings.billing.feature.support' },
]

export default function BillingPage() {
  const { t, locale } = useI18n()
  const [showPayment, setShowPayment] = useState(false)

  const nextBilling = new Date('2026-07-01').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <h1 className="mb-8 text-xl font-semibold text-white">{t('settings.billing.title')}</h1>

      {/* Current plan */}
      <section className="mb-6 rounded-[20px] border border-gold/20 bg-gradient-to-br from-gold/[0.07] to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{t('settings.billing.planName')}</span>
              <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
                {t('settings.billing.active')}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-400">{t('settings.billing.billedMonthly', { date: nextBilling })}</div>
          </div>
          <div className="text-right">
            <div className="text-[28px] font-semibold text-white tabular-nums">AED 4,900</div>
            <div className="text-xs text-slate-500">{t('settings.billing.perMonth')}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLAN_FEATURES.map(({ Icon, labelKey }) => (
            <div key={labelKey} className="flex items-center gap-2 text-xs text-slate-400">
              <Icon className="h-3.5 w-3.5 shrink-0 text-gold/70" />
              {t(labelKey)}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => setShowPayment((v) => !v)}
            className="rounded-full border border-line-strong bg-surface-2 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-surface-2 hover:text-white"
          >
            {t('settings.billing.updatePayment')}
          </button>
          <a
            href="mailto:support@freeholdproperty.ae?subject=Plan cancellation request"
            className="rounded-full border border-line px-4 py-2 text-xs text-slate-500 transition hover:text-slate-300"
          >
            {t('settings.billing.cancelPlan')}
          </a>
        </div>
      </section>

      {/* Payment form */}
      {showPayment && (
        <div className="mb-6 rounded-[18px] border border-line bg-surface p-5 space-y-3">
          <div className="text-sm font-semibold text-white">{t('settings.billing.updatePayment')}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input placeholder={t('settings.billing.cardholderName')} className="col-span-2 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40" />
            <div className="col-span-2 flex items-center gap-2 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5">
              <CreditCard className="h-4 w-4 shrink-0 text-slate-500" />
              <input placeholder={t('settings.billing.cardNumber')} className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none" />
            </div>
            <input placeholder={t('settings.billing.expiry')} className="rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40" />
            <input placeholder={t('settings.billing.cvc')} className="rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40" />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowPayment(false); toast.success(t('settings.billing.paymentSaved')) }}
              className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/90"
            >
              <CheckCircle className="h-3.5 w-3.5" /> {t('settings.billing.saveCard')}
            </button>
            <button onClick={() => setShowPayment(false)} className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">
              {t('settings.billing.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Usage */}
      <section className="mb-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.billing.usageThisMonth')}</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { labelKey: 'settings.billing.activeAgents',   value: '6',       max: '10',    pct: 60 },
            { labelKey: 'settings.billing.leadsThisMonth', value: '415',     max: '500',   pct: 83 },
            { labelKey: 'settings.billing.apiCalls',       value: '12.4K',   max: '50K',   pct: 25 },
          ].map(({ labelKey, value, max, pct }) => (
            <div key={labelKey} className="rounded-[14px] border border-line bg-surface p-4">
              <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{t(labelKey)}</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${pct > 85 ? 'bg-amber-400' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-600">{t('settings.billing.ofMax', { max })}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Invoices */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.billing.invoiceHistory')}</div>
        <div className="rounded-[18px] border border-line bg-surface overflow-hidden">
          <div className="divide-y divide-line">
            {INVOICES.map((inv) => {
              const sm = STATUS_META[inv.status]
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{t(inv.descKey)}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {inv.id} · {new Date(inv.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${sm.color}`}>
                    <sm.Icon className="h-3.5 w-3.5" />
                    {t(sm.labelKey)}
                  </div>
                  <div className="text-sm font-semibold text-white tabular-nums">
                    AED {inv.amount.toLocaleString()}
                  </div>
                  {inv.status === 'paid' && (
                    <button
                      onClick={() => toast.promise(
                        new Promise(r => setTimeout(r, 1200)),
                        { loading: t('settings.billing.inv.preparing', { id: inv.id }), success: t('settings.billing.inv.downloaded', { id: inv.id }), error: t('settings.billing.inv.downloadFailed') }
                      )}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-line-strong text-slate-500 transition hover:border-line-strong hover:text-slate-300"
                    >
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
