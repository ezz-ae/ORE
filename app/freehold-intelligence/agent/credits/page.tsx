'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Coins, Sparkles, Plus, Pause, Play, MessageCircle,
  TrendingUp, Users, Trophy, Target, DollarSign, Gauge,
  ChevronRight, ArrowRight, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { brokerMetrics, CREDIT_VALUE_AED, STATUS_CREDIT } from '@/src/features/freehold-intelligence/credits'
import { useI18n } from '@/lib/i18n/provider'

const me = brokerMetrics.find((b) => b.id === 'bc_ahmed')!

const LOW_BALANCE = me.remaining <= me.allocated * 0.15

const cycleEndLabel = new Date(me.cycleEnd).toLocaleDateString('en-AE', { day: 'numeric', month: 'long' })

// ── Active ads (mock) — named after focus project + audience ──
type AdStatus = 'Active' | 'Paused'
interface BrokerAd {
  id: string
  name: string
  audience: string
  perDay: number   // credits / day
  leads: number
  status: AdStatus
}

const INITIAL_ADS: BrokerAd[] = [
  { id: 'ad1', name: `${me.focusProject} — Investors 35-55`, audience: 'High-intent investors', perDay: 24, leads: 18, status: 'Active' },
  { id: 'ad2', name: `${me.focusProject} — End-users Dubai`,  audience: 'Family end-users',       perDay: 16, leads: 14, status: 'Active' },
  { id: 'ad3', name: `${me.focusProject} — Expats GCC`,       audience: 'GCC relocators',         perDay: 12, leads: 9,  status: 'Paused' },
]

const PERF = [
  { Icon: Users,      labelKey: 'agent.perfLeads',       value: `${me.leads}`,                       color: 'text-teal-400'     },
  { Icon: Trophy,     labelKey: 'agent.perfDeals',       value: `${me.deals}`,                       color: 'text-gold'   },
  { Icon: Target,     labelKey: 'agent.perfClosingRate', value: `${me.closingRate.toFixed(1)}%`,     color: 'text-violet-400'  },
  { Icon: TrendingUp, labelKey: 'agent.perfRoi',         value: `${me.roi.toFixed(1)}×`,             color: me.roi >= 5 ? 'text-emerald-400' : 'text-amber-400' },
  { Icon: DollarSign, labelKey: 'agent.perfCostPerLead', value: `AED ${Math.round(me.costPerLead).toLocaleString()}`, color: 'text-slate-300' },
  { Icon: Coins,      labelKey: 'agent.perfRevenue',     value: `AED ${(me.revenue / 1000).toFixed(0)}K`, color: 'text-emerald-400' },
]

interface LiveBalance {
  allocated: number
  balance: number
  total_spent: number
  cycle_end: string
}

export default function AgentCreditsPage() {
  const { t } = useI18n()
  const [ads, setAds] = useState<BrokerAd[]>(INITIAL_ADS)
  const status = STATUS_CREDIT[me.status]

  // ── Live credit balance from Neon (falls back to mock `me` when empty) ──
  const [live, setLive] = useState<LiveBalance | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/credits/balance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.balance) setLive(d.balance as LiveBalance)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Display values: prefer live DB data, fall back to mock metrics.
  const allocated = live?.allocated ?? me.allocated
  const spent     = live?.total_spent ?? me.spent
  const remaining = live ? live.balance : me.remaining
  const spentPct  = allocated > 0 ? (spent / allocated) * 100 : me.spentPct
  const liveCycleEndLabel = live?.cycle_end
    ? new Date(live.cycle_end).toLocaleDateString('en-AE', { day: 'numeric', month: 'long' })
    : cycleEndLabel

  function toggleAd(id: string) {
    setAds((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === 'Active' ? 'Paused' : 'Active' } : a,
      ),
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6">

      {/* 1 — Balance hero */}
      <section className="rounded-xl border border-line bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              <Coins className="h-3.5 w-3.5 text-gold" />
              {t('agent.creditBalanceUpper')}
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[44px] font-semibold leading-none tracking-tight text-gold tabular-nums">{remaining.toLocaleString()}</span>
              <span className="pb-1 text-base text-slate-500">{t('agent.ofCredits', { allocated: allocated.toLocaleString() })}</span>
            </div>
            <div className="mt-1.5 text-sm text-slate-400">
              {t('agent.fundedAdSpendRemaining', { amount: `AED ${(remaining * CREDIT_VALUE_AED).toLocaleString()}` })}
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
        </div>

        {/* usage bar */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-400">{t('agent.creditsUsed', { used: spent.toLocaleString() })}</span>
            <span className="text-slate-500">{Math.round(spentPct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-all ${spentPct > 90 ? 'bg-red-400' : spentPct > 70 ? 'bg-amber-400' : 'bg-gold'}`}
              style={{ width: `${Math.min(spentPct, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-slate-500">{t('agent.cycleResets', { date: liveCycleEndLabel })}</div>
        </div>
      </section>

      {/* 2 — Create Ad CTA */}
      <section className="mt-4">
        <div className={`rounded-xl border p-6 ${LOW_BALANCE ? 'border-amber-400/25 bg-amber-400/[0.04]' : 'border-gold/25 bg-gold/[0.05]'}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-gold/25 bg-gold/10 text-gold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-white">{t('agent.launchNewAd')}</div>
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                {t('agent.launchAdDesc')}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs font-medium text-slate-300">
                <Target className="h-3 w-3 text-gold" />
                {t('agent.focusProject', { project: me.focusProject })}
              </div>

              {LOW_BALANCE && (
                <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('agent.lowBalanceWarning', { balance: me.remaining })}
                </div>
              )}

              <div className="mt-4">
                {LOW_BALANCE ? (
                  <span
                    aria-disabled
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-surface-3 px-4 py-2 text-xs font-semibold text-slate-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('agent.lowBalanceRefill')}
                  </span>
                ) : (
                  <Link
                    href="/freehold-intelligence/agent/campaigns"
                    className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('agent.createAd')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 — My performance */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('agent.myPerformance')}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PERF.map(({ Icon, labelKey, value, color }) => (
            <div key={labelKey} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                {t(labelKey)}
              </div>
              <div className={`mt-1.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — Active ads */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('agent.activeAds')}</div>
          <Link
            href="/freehold-intelligence/agent/campaigns"
            className="flex items-center gap-1 text-xs font-medium text-gold transition hover:text-gold/80"
          >
            {t('agent.optimize')} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-3">
          {ads.map((ad) => {
            const isActive = ad.status === 'Active'
            return (
              <div key={ad.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{ad.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{ad.audience}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-medium ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      {isActive ? t('agent.statusActive') : t('agent.statusPaused')}
                    </span>
                    <button
                      onClick={() => toggleAd(ad.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-slate-400 transition hover:border-line-strong hover:text-slate-300"
                      aria-label={isActive ? t('agent.pauseAd') : t('agent.resumeAd')}
                    >
                      {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div>
                    <div className="text-xs text-slate-500">{t('agent.spendPerDay')}</div>
                    <div className="mt-0.5 text-sm font-semibold text-gold tabular-nums">{t('agent.creditsPerDay', { credits: ad.perDay })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{t('agent.adLeads')}</div>
                    <div className="mt-0.5 text-sm font-semibold text-white tabular-nums">{ad.leads}</div>
                  </div>
                  <Link
                    href="/freehold-intelligence/agent/campaigns"
                    className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-slate-200"
                  >
                    {t('agent.optimize')} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 5 — WhatsApp connector */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('agent.whatsapp')}</div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border ${me.whatsappConnected ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400' : 'border-line-strong bg-surface-2 text-slate-400'}`}>
              <MessageCircle className="h-5 w-5" />
            </div>
            {me.whatsappConnected ? (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t('agent.connected')}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">{t('agent.aiScanning', { count: me.conversations })}</div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{t('agent.connectWhatsapp')}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{t('agent.connectWhatsappDesc')}</div>
                </div>
                <Link href="/freehold-intelligence/agent/leads" className="shrink-0 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/90">
                  {t('agent.connect')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 6 — Earn more credits */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('agent.earnMoreCredits')}</div>
        <div className="rounded-xl border border-gold/25 bg-gold/[0.05] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-gold/25 bg-gold/10 text-gold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-white">{t('agent.nextAiRefill')}</div>
                <div className="text-right">
                  <div className="text-xl font-semibold text-gold tabular-nums">+{me.recommendedRefill.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{t('agent.creditsLabel')}</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{me.recommendation}</p>

              {/* efficiency bar */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Gauge className="h-3.5 w-3.5 text-gold" /> {t('agent.efficiencyScore')}
                  </span>
                  <span className="font-medium text-slate-200 tabular-nums">{t('agent.efficiencyValue', { score: me.efficiency })}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gold transition-all"
                    style={{ width: `${me.efficiency}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-slate-500">
                  {t('agent.efficiencyDesc')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
