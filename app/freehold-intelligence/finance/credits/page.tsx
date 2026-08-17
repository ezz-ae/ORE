'use client'

import { useCallback, useState, useEffect } from 'react'
import { formatInstant } from '@/lib/freehold/clock'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Minus, CheckCircle, Trophy, Users, Zap, Coins, ArrowUpRight, Loader2,
  History, ChevronDown, ChevronRight,
} from 'lucide-react'
import { PageHeader, StatCard } from '@/components/freehold/ui'
import {
  CREDIT_TIERS, TIER_MONTHLY_QUOTA, isCycleGrantReference, type CreditTier,
} from '@/lib/freehold/credits-shared'
import { useT } from '@/lib/i18n/provider'
import { Monogram } from '@/components/freehold/monogram'

type BrokerBalance = {
  id: string
  name: string
  email: string
  tier: string
  allocated: number
  total_spent: number
  balance: number
  earned: number
  cycle_end: string | null
}

type LedgerEntry = {
  id: string
  type: 'allocation' | 'spend' | 'refund' | 'adjustment' | 'earn'
  amount: number
  note: string | null
  reference: string | null
  created_by: string | null
  created_at: string
}

const LEDGER_LABEL_KEY: Record<LedgerEntry['type'], string> = {
  allocation: 'finance.credits.ledgerAllocation',
  spend: 'finance.credits.ledgerSpend',
  refund: 'finance.credits.ledgerRefund',
  adjustment: 'finance.credits.ledgerAdjustment',
  earn: 'finance.credits.ledgerEarn',
}

const TIER_COLOR: Record<CreditTier, string> = {
  Starter: 'text-slate-300  bg-surface-2      border-line-strong',
  Growth:  'text-teal-300   bg-teal-400/10    border-teal-400/25',
  Pro:     'text-gold       bg-gold/10        border-gold/25',
  Elite:   'text-violet-300 bg-violet-400/10  border-violet-400/25',
}

const initialsOf = (name: string) =>
  name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

export default function AgentCreditsPage() {
  const t = useT()
  const [brokers, setBrokers]         = useState<BrokerBalance[]>([])
  const [loading, setLoading]         = useState(true)
  const [saved, setSaved]             = useState<string[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})
  const [openLedger, setOpenLedger]   = useState<string | null>(null)
  const [ledgers, setLedgers]         = useState<Record<string, LedgerEntry[]>>({})
  const [ledgerLoading, setLedgerLoading] = useState<string | null>(null)

  const loadBalances = useCallback(async () => {
    const res = await fetch('/api/freehold/credits/admin/balances').catch(() => null)
    if (!res || !res.ok) {
      toast.error(t('finance.credits.loadFailed'))
      return false
    }
    const data = await res.json().catch(() => null)
    if (!Array.isArray(data?.balances)) {
      toast.error(t('finance.credits.loadFailed'))
      return false
    }
    setBrokers(data.balances as BrokerBalance[])
    return true
  }, [t])

  useEffect(() => {
    loadBalances().finally(() => setLoading(false))
  }, [loadBalances])

  // Drill-down: the real ledger behind a broker's balance. Fetched on demand and
  // re-fetched after every allocation, so what Finance reads is what the ledger
  // says — never a locally patched number.
  const loadLedger = useCallback(async (id: string) => {
    setLedgerLoading(id)
    const res = await fetch(`/api/freehold/credits/admin/ledger?brokerId=${encodeURIComponent(id)}`, { cache: 'no-store' }).catch(() => null)
    const data = res?.ok ? await res.json().catch(() => null) : null
    if (!data || !Array.isArray(data.ledger)) {
      toast.error(t('finance.credits.ledgerLoadFailed'))
      setLedgerLoading(null)
      return
    }
    setLedgers((prev) => ({ ...prev, [id]: data.ledger as LedgerEntry[] }))
    setLedgerLoading(null)
  }, [t])

  function toggleLedger(id: string) {
    if (openLedger === id) { setOpenLedger(null); return }
    setOpenLedger(id)
    if (!ledgers[id]) loadLedger(id)
  }

  function markSaved(id: string) {
    setSaved((prev) => [...prev, id])
    setTimeout(() => setSaved((prev) => prev.filter((x) => x !== id)), 2000)
  }

  function adjust(id: string, delta: number) {
    setAdjustments((prev) => {
      const current = prev[id] ?? 0
      const newVal  = Math.max(0, Math.min(50, current + delta))
      return { ...prev, [id]: newVal }
    })
  }

  async function applyAdjustment(id: string) {
    const delta = adjustments[id] ?? 0
    if (delta <= 0) return
    // Persist a real credit allocation to the ledger; only reflect it in the
    // UI once the server confirms — never fake success.
    const res = await fetch('/api/freehold/credits/admin/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerId: id, amount: delta, note: 'Bonus credits (Finance)' }),
    }).catch(() => null)
    if (!res || !res.ok) {
      toast.error(t('finance.credits.allocateFailed'))
      return
    }
    setAdjustments((prev) => ({ ...prev, [id]: 0 }))
    await loadBalances()
    if (openLedger === id) await loadLedger(id)
    markSaved(id)
  }

  async function setTier(id: string, tier: CreditTier) {
    const res = await fetch('/api/freehold/credits/admin/tier', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerId: id, tier }),
    }).catch(() => null)
    if (!res || !res.ok) {
      toast.error(t('finance.credits.tierSaveFailed'))
      return
    }
    setBrokers((prev) => prev.map((a) => (a.id === id ? { ...a, tier } : a)))
    markSaved(id)
  }

  const totalAllocated = brokers.reduce((s, a) => s + a.allocated, 0)
  const totalSpent     = brokers.reduce((s, a) => s + a.total_spent, 0)
  const totalBalance   = brokers.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Credit Economy banner */}
      <Link
        href="/freehold-intelligence/management"
        className="group mb-6 flex items-center gap-4 rounded-xl border border-gold/25 bg-gold/[0.06] px-5 py-4 transition hover:border-gold/40 hover:bg-gold/10"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
          <Coins className="h-5 w-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{t('finance.credits.bannerTitle')}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {t('finance.credits.bannerDesc')}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-gold">
          {t('finance.credits.open')} <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>

      {/* Header */}
      <PageHeader
        eyebrow={t('finance.eyebrow')}
        Icon={Coins}
        title={t('finance.credits.title')}
        subtitle={t('finance.credits.subtitle')}
        className="mb-8"
      />

      {/* Summary row — computed from the real ledger balances */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label={t('finance.credits.totalAllocated')} value={totalAllocated} Icon={Zap}         hint={t('finance.credits.creditsAllocated')} />
        <StatCard label={t('finance.credits.totalSpent')}     value={totalSpent}     Icon={Users}       hint={t('finance.credits.creditsConsumed')}  />
        <StatCard label={t('finance.credits.remaining')}      value={totalBalance}   Icon={CheckCircle} hint={t('finance.credits.availableNow')}     />
      </div>

      {/* Agents */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin me-2" />
          <span className="text-sm">{t('finance.credits.loadingAgents')}</span>
        </div>
      )}
      {!loading && brokers.length === 0 && (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-slate-500">
          {t('finance.credits.noBrokers')}
        </div>
      )}
      <div className="space-y-3">
        {!loading && brokers.map((agent) => {
          const tierKey = (CREDIT_TIERS as readonly string[]).includes(agent.tier) ? (agent.tier as CreditTier) : 'Starter'
          const tc      = TIER_COLOR[tierKey]
          const pct     = agent.allocated > 0 ? (agent.total_spent / agent.allocated) * 100 : 0
          const adj     = adjustments[agent.id] ?? 0
          const isSaved = saved.includes(agent.id)

          return (
            <div key={agent.id} className="rounded-xl border border-line bg-surface p-5">

              {/* Agent identity */}
              <div className="flex items-center gap-3 mb-4">
                <Monogram name={agent.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-white">{agent.name}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tc}`}>
                      {agent.tier}
                    </span>
                    <span className="text-xs text-slate-500">
                      {t('finance.credits.quotaPerMonth', { quota: TIER_MONTHLY_QUOTA[tierKey] })}
                    </span>
                    <span className="text-xs text-slate-500">
                      {agent.cycle_end
                        ? t('finance.credits.resets', { date: formatInstant(agent.cycle_end, 'en-AE', { day: 'numeric', month: 'short' }) })
                        : '—'}
                    </span>
                  </div>
                </div>
                {isSaved && (
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" /> {t('finance.credits.saved')}
                  </div>
                )}
              </div>

              {/* Usage bar — real spend vs. real allocation */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t('finance.credits.creditsUsedOf', { used: agent.total_spent, allocated: agent.allocated })}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-slate-400">{t('finance.credits.balanceCount', { count: agent.balance })}</span>
                    {agent.earned > 0 && (
                      <span className="flex items-center gap-1 text-gold">
                        <Trophy className="h-3 w-3" /> {t('finance.credits.earnedCount', { count: agent.earned })}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 flex-wrap">

                {/* Tier selector — persists via the admin tier API */}
                <div>
                  <div className="mb-1.5 text-[10px] text-slate-500 uppercase tracking-wider">{t('finance.credits.tier')}</div>
                  <div className="flex gap-1.5">
                    {CREDIT_TIERS.map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setTier(agent.id, tier)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                          agent.tier === tier ? TIER_COLOR[tier] : 'border-line-strong text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual quota adjustment */}
                <div className="ms-auto flex items-center gap-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t('finance.credits.bonusCredits')}</div>
                  <div className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-1 py-1">
                    <button
                      onClick={() => adjust(agent.id, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-surface-2 hover:text-slate-200"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[28px] text-center text-sm font-semibold text-white tabular-nums">
                      {adj > 0 ? `+${adj}` : adj}
                    </span>
                    <button
                      onClick={() => adjust(agent.id, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-surface-2 hover:text-slate-200"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {adj !== 0 && (
                    <button
                      onClick={() => applyAdjustment(agent.id)}
                      className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-bright"
                    >
                      {t('finance.credits.apply')}
                    </button>
                  )}
                </div>

              </div>

              {/* Ledger drill-down — the real movements behind the balance */}
              <button
                type="button"
                onClick={() => toggleLedger(agent.id)}
                aria-expanded={openLedger === agent.id}
                className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-200"
              >
                {openLedger === agent.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <History className="h-3.5 w-3.5" />
                {openLedger === agent.id ? t('finance.credits.hideLedger') : t('finance.credits.viewLedger')}
              </button>

              {openLedger === agent.id && (
                <div className="mt-2 rounded-[10px] border border-line bg-surface-2/50">
                  {ledgerLoading === agent.id ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-5 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('finance.credits.ledgerLoading')}
                    </div>
                  ) : (ledgers[agent.id]?.length ?? 0) === 0 ? (
                    <div className="px-4 py-5 text-center text-xs text-slate-500">{t('finance.credits.ledgerEmpty')}</div>
                  ) : (
                    <>
                      {(ledgers[agent.id] ?? []).map((entry, i) => {
                        const isDebit = entry.type === 'spend'
                        const signed  = isDebit ? -Math.abs(entry.amount) : entry.amount
                        return (
                          <div key={entry.id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-slate-200">
                                {/* The monthly tier grant is an allocation, but calling it
                                    one hides WHY the credits appeared — it is the automatic
                                    cycle top-up, not a Finance decision. */}
                                {isCycleGrantReference(entry.reference)
                                  ? t('finance.credits.ledgerMonthlyGrant')
                                  : t(LEDGER_LABEL_KEY[entry.type] ?? 'finance.credits.ledgerAdjustment')}
                              </div>
                              {entry.note && <div className="mt-0.5 truncate text-[11px] text-slate-500">{entry.note}</div>}
                            </div>
                            <div className="shrink-0 text-end">
                              <div className={`text-xs font-semibold tabular-nums ${isDebit ? 'text-red-400' : 'text-emerald-400'}`}>
                                {signed > 0 ? `+${signed.toLocaleString()}` : signed.toLocaleString()}
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                {formatInstant(entry.created_at, 'en-AE', { day: 'numeric', month: 'short' })}
                                {entry.created_by ? ` · ${entry.created_by}` : ''}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div className="border-t border-line px-4 py-2 text-[10px] text-slate-500">
                        {t('finance.credits.ledgerFooter', { count: (ledgers[agent.id] ?? []).length })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
