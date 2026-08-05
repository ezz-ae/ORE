'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Coins, Sparkles, Plus, History,
  Users, Trophy, Target, ChevronRight,
  AlertTriangle, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'
import {
  CREDIT_VALUE_AED, EARN_AED_PER_CREDIT, TIER_MONTHLY_QUOTA,
  isCreditTier, isCycleGrantReference,
} from '@/lib/freehold/credits-shared'
import { useI18n } from '@/lib/i18n/provider'

interface LiveBalance {
  tier: string
  allocated: number
  balance: number
  total_spent: number
  cycle_end: string | null
}

interface LedgerEntry {
  id: string
  type: 'allocation' | 'spend' | 'refund' | 'adjustment' | 'earn'
  amount: number
  note: string | null
  reference: string | null
  created_at: string
}

const LEDGER_LABEL_KEY: Record<LedgerEntry['type'], string> = {
  allocation: 'agent.ledgerAllocation',
  spend: 'agent.ledgerSpend',
  refund: 'agent.ledgerRefund',
  adjustment: 'agent.ledgerAdjustment',
  earn: 'agent.ledgerEarn',
}

export default function AgentCreditsPage() {
  const { t } = useI18n()

  const [balance, setBalance] = useState<LiveBalance | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [leadsCount, setLeadsCount] = useState<number | null>(null)
  const [wins, setWins] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [balRes, ledgerRes, leadsRes, dealsRes] = await Promise.all([
        fetch('/api/freehold/credits/balance').catch(() => null),
        fetch('/api/freehold/credits/ledger').catch(() => null),
        fetch('/api/freehold/crm/leads').catch(() => null),
        fetch('/api/freehold/deals?totals=1').catch(() => null),
      ])
      if (cancelled) return
      let failed = false

      if (balRes?.ok) {
        const d = await balRes.json().catch(() => null)
        if (!cancelled && d?.balance) setBalance(d.balance as LiveBalance)
      } else failed = true

      if (ledgerRes?.ok) {
        const d = await ledgerRes.json().catch(() => null)
        if (!cancelled && Array.isArray(d?.ledger)) setLedger(d.ledger as LedgerEntry[])
      } else failed = true

      if (leadsRes?.ok) {
        const d = await leadsRes.json().catch(() => null)
        if (!cancelled && Array.isArray(d?.leads)) setLeadsCount(d.leads.length)
      } else failed = true

      if (dealsRes?.ok) {
        const d = await dealsRes.json().catch(() => null)
        const approved = d?.totals?.approvedDeals
        if (!cancelled && typeof approved === 'number') setWins(approved)
      } else failed = true

      if (!cancelled) {
        setLoading(false)
        if (failed) toast.error(t('agent.creditsLoadFailed'))
      }
    }
    load()
    return () => { cancelled = true }
  }, [t])

  // ── Real numbers only — honest zeros when no account exists yet ──
  const hasAccount = balance !== null
  const allocated = balance?.allocated ?? 0
  const spent = balance?.total_spent ?? 0
  const remaining = balance?.balance ?? 0
  const spentPct = allocated > 0 ? (spent / allocated) * 100 : 0
  const cycleEndLabel = balance?.cycle_end
    ? new Date(balance.cycle_end).toLocaleDateString('en-AE', { day: 'numeric', month: 'long' })
    : null
  const tierName = balance?.tier
  const monthlyQuota = TIER_MONTHLY_QUOTA[isCreditTier(tierName) ? tierName : 'Starter']

  const lowBalance = hasAccount && allocated > 0 && remaining <= allocated * 0.15
  const statusBadge = !hasAccount
    ? { label: t('agent.statusNoCredits'), cls: 'text-slate-400 bg-surface-2 border-line-strong' }
    : lowBalance
      ? { label: t('agent.statusLow'), cls: 'text-amber-400 bg-amber-400/10 border-amber-400/25' }
      : { label: t('agent.statusHealthy'), cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25' }

  // Closing rate is only computable once there is at least one lead.
  const closingRate = leadsCount != null && wins != null && leadsCount > 0
    ? (wins / leadsCount) * 100
    : null

  const earnedLifetime = ledger
    .filter((e) => e.type === 'earn')
    .reduce((s, e) => s + e.amount, 0)

  const perf = [
    { Icon: Users, labelKey: 'agent.perfLeads', value: leadsCount != null ? `${leadsCount}` : '—', color: 'text-teal-400' },
    { Icon: Trophy, labelKey: 'agent.perfDeals', value: wins != null ? `${wins}` : '—', color: 'text-gold' },
    { Icon: Target, labelKey: 'agent.perfClosingRate', value: closingRate != null ? `${closingRate.toFixed(1)}%` : '—', color: 'text-violet-400' },
  ]

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
          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
        </div>

        {!loading && !hasAccount ? (
          <div className="mt-5 rounded-[10px] border border-line-strong bg-surface-2 px-4 py-3 text-sm text-slate-400">
            {t('agent.noCreditsYetDesc')}
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('agent.creditsUsed', { used: spent.toLocaleString() })}</span>
              <span className="text-slate-500">{Math.round(spentPct)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-all ${spentPct > 90 ? 'bg-red-400' : spentPct > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(spentPct, 100)}%` }}
              />
            </div>
            {cycleEndLabel && (
              <div className="mt-1.5 text-xs text-slate-500">
                {/* The real mechanic, in the broker's words: on that date the
                    balance is topped back up TO the tier quota — a balance
                    already above it (earned credits) is never reduced. */}
                {t('agent.cycleTopUp', { quota: monthlyQuota, date: cycleEndLabel })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2 — Create Ad CTA */}
      <section className="mt-4">
        <div className={`rounded-xl border p-6 ${lowBalance ? 'border-amber-400/25 bg-amber-400/[0.04]' : 'border-gold/25 bg-gold/[0.05]'}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-gold/25 bg-gold/10 text-gold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-white">{t('agent.launchNewAd')}</div>
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                {t('agent.launchAdDesc')}
              </p>

              {lowBalance && (
                <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t('agent.lowBalanceWarning', { balance: remaining })}
                </div>
              )}

              <div className="mt-4">
                {lowBalance ? (
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
                    className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright"
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

      {/* 3 — My performance (only genuinely computable metrics) */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('agent.myPerformance')}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {perf.map(({ Icon, labelKey, value, color }) => (
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

      {/* 4 — Credit history (real ledger) */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            <History className="h-3.5 w-3.5" />
            {t('agent.creditHistory')}
          </div>
        </div>
        {ledger.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-sm text-slate-500">
            {t('agent.creditHistoryEmpty')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {ledger.map((entry, i) => {
              const isDebit = entry.type === 'spend' || entry.amount < 0
              const signed = entry.type === 'spend' ? -Math.abs(entry.amount) : entry.amount
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isDebit ? 'border-red-400/25 bg-red-400/10 text-red-400' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-400'}`}>
                    {isDebit ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">
                      {/* Monthly tier grants are allocations on the ledger, but the
                          broker should read them as what they are: the cycle top-up. */}
                      {isCycleGrantReference(entry.reference)
                        ? t('agent.ledgerMonthlyGrant')
                        : t(LEDGER_LABEL_KEY[entry.type] ?? 'agent.ledgerAdjustment')}
                    </div>
                    {entry.note && <div className="mt-0.5 truncate text-xs text-slate-500">{entry.note}</div>}
                  </div>
                  <div className="shrink-0 text-end">
                    <div className={`text-sm font-semibold tabular-nums ${isDebit ? 'text-red-400' : 'text-emerald-400'}`}>
                      {signed > 0 ? `+${signed.toLocaleString()}` : signed.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {new Date(entry.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 5 — How credits are earned (real rule, real total) */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('agent.earnMoreCredits')}</div>
        <div className="rounded-xl border border-gold/25 bg-gold/[0.05] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-gold/25 bg-gold/10 text-gold">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-white">{t('agent.earnRuleTitle')}</div>
                <div className="text-end">
                  <div className="text-xl font-semibold text-gold tabular-nums">+{earnedLifetime.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{t('agent.earnedFromDeals')}</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {t('agent.earnRuleDesc', { amount: `AED ${EARN_AED_PER_CREDIT.toLocaleString()}` })}
              </p>
              <div className="mt-3">
                <Link
                  href="/freehold-intelligence/agent/leads"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold transition hover:text-gold/80"
                >
                  {t('agent.viewMyPipeline')} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
