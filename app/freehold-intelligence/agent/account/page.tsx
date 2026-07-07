'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Star, Lock, TrendingUp, Zap, Users, MapPin, Wallet,
  AlertCircle, ArrowUpRight,
} from 'lucide-react'
import { useSession } from '@/lib/freehold/use-session'
import { useI18n } from '@/lib/i18n/provider'

interface LiveBalance {
  broker_id: string
  tier: string
  allocated: number
  balance: number
  total_spent: number
  cycle_start: string
  cycle_end: string
}

interface LiveLedgerEntry {
  id: string
  type: 'allocation' | 'spend' | 'refund' | 'adjustment' | 'earn'
  amount: number
  note: string | null
  created_at: string
}

interface AgentSummary {
  memberSince: string | null
  leads: {
    total: number
    open: number
    hot: number
    closed: number
    newThisMonth: number
    closingRate: number | null
  }
  avgFirstResponseHours: number | null
  deals: { closed: number; firstClosedAt: string | null }
  finance: {
    totalDeals: number
    approvedDeals: number
    totalSalesAed: number
    totalCommissionAed: number
    totalPaidAed: number
    totalOutstandingAed: number
  }
  focus: { slug: string; name: string; leads: number; closedDeals: number }[]
  achievements: {
    firstDealClosed: { earned: boolean; date: string | null }
    tenLeadsHandled: { earned: boolean; count: number }
    firstCampaignLaunched: { earned: boolean; date: string | null }
    hotStreak: { earned: boolean; count: number }
  }
}

// Real credit-tier vocabulary (broker_credit_accounts.tier).
const TIER_COLOR: Record<string, string> = {
  Starter: 'text-slate-300  border-line-strong      bg-surface-2',
  Growth:  'text-teal-400   border-teal-400/30      bg-teal-400/10',
  Pro:     'text-gold       border-gold/30          bg-gold/10',
  Elite:   'text-violet-300 border-violet-400/30    bg-violet-400/10',
}

const ACHIEVEMENT_TIER_COLOR: Record<string, string> = {
  bronze: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  silver: 'text-slate-300  border-line-strong   bg-surface-2',
  gold:   'text-gold       border-gold/30       bg-gold/10',
}

const LEDGER_TYPE_KEY: Record<LiveLedgerEntry['type'], string> = {
  allocation: 'agent.ledgerAllocation',
  spend:      'agent.ledgerSpend',
  refund:     'agent.ledgerRefund',
  adjustment: 'agent.ledgerAdjustment',
  earn:       'agent.ledgerEarn',
}

function fmtAED(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}AED ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}AED ${(abs / 1_000).toFixed(1)}K`
  return `${sign}AED ${abs.toLocaleString()}`
}

function LedgerRow({ entry }: { entry: LiveLedgerEntry }) {
  const { t } = useI18n()
  const isDebit = entry.type === 'spend'
  const signed = isDebit ? -entry.amount : entry.amount
  return (
    <div className="flex items-center gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-100 truncate">{entry.note || t(LEDGER_TYPE_KEY[entry.type])}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {t(LEDGER_TYPE_KEY[entry.type])} · {new Date(entry.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
        </div>
      </div>
      <div className={`min-w-[80px] text-end text-sm font-semibold tabular-nums ${signed < 0 ? 'text-red-400' : 'text-white'}`}>
        {t('agent.creditsAmount', { count: `${signed < 0 ? '' : '+'}${signed}` })}
      </div>
    </div>
  )
}

interface AchievementView {
  id: string
  icon: string
  titleKey: string
  descKey: string
  earned: boolean
  earnedAt: string | null
  tier: 'bronze' | 'silver' | 'gold'
}

function AchievementCard({ item }: { item: AchievementView }) {
  const { t } = useI18n()
  const tc = ACHIEVEMENT_TIER_COLOR[item.tier] ?? ACHIEVEMENT_TIER_COLOR.bronze
  return (
    <div className={`relative flex flex-col rounded-[18px] border p-4 transition ${item.earned ? 'border-line bg-surface' : 'border-line bg-transparent opacity-50'}`}>
      {!item.earned && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[18px] backdrop-blur-[1px]">
          <Lock className="h-5 w-5 text-slate-600" />
        </div>
      )}
      <div className="text-[24px]">{item.icon}</div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{t(item.titleKey)}</div>
      <div className="mt-0.5 text-xs text-slate-400 leading-relaxed">{t(item.descKey)}</div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${tc}`}>
          {item.tier}
        </span>
        {item.earned && item.earnedAt && (
          <span className="text-xs text-slate-500">{new Date(item.earnedAt).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' })}</span>
        )}
      </div>
    </div>
  )
}

function FocusRow({ entry, maxLeads }: { entry: AgentSummary['focus'][number]; maxLeads: number }) {
  const { t } = useI18n()
  const barW = maxLeads > 0 ? Math.max(5, Math.round((entry.leads / maxLeads) * 100)) : 5
  const hasDeals = entry.closedDeals > 0
  return (
    <div className="flex items-center gap-4">
      <div className="w-[140px] shrink-0">
        <div className="text-sm font-medium text-slate-300 truncate">{entry.name}</div>
        <div className="mt-0.5 text-xs text-slate-500">{t('agent.focusLeadsCount', { count: entry.leads })}</div>
      </div>
      <div className="flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full transition-all ${hasDeals ? 'bg-gold' : 'bg-teal-400'}`} style={{ width: `${barW}%` }} />
        </div>
      </div>
      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${hasDeals ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-slate-500'}`}>
        {t('agent.focusDealsCount', { count: entry.closedDeals })}
      </div>
    </div>
  )
}

export default function AgentAccountPage() {
  const { t } = useI18n()
  const { user } = useSession()
  const [liveBalance, setLiveBalance] = useState<LiveBalance | null>(null)
  const [liveLedger, setLiveLedger] = useState<LiveLedgerEntry[] | null>(null)
  // Real commission earned from this broker's own approved/closed deals — the
  // finance → agent edge. The deals API scopes totals to the broker server-side.
  const [commission, setCommission] = useState<{ gross: number; received: number; outstanding: number } | null>(null)
  const [summary, setSummary] = useState<AgentSummary | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fail = () => { if (!cancelled) setLoadFailed(true) }
    const asJson = (r: Response) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }
    fetch('/api/freehold/credits/balance')
      .then(asJson)
      .then(d => { if (!cancelled && d?.balance) setLiveBalance(d.balance) })
      .catch(fail)
    fetch('/api/freehold/credits/ledger')
      .then(asJson)
      .then(d => { if (!cancelled && Array.isArray(d?.ledger)) setLiveLedger(d.ledger) })
      .catch(fail)
    fetch('/api/freehold/deals?totals=1')
      .then(asJson)
      .then(d => {
        if (!cancelled && d?.totals) {
          setCommission({
            gross: d.totals.totalCommissionAed ?? 0,
            received: d.totals.totalPaidAed ?? 0,
            outstanding: d.totals.totalOutstandingAed ?? 0,
          })
        }
      })
      .catch(fail)
    fetch('/api/freehold/agent/summary')
      .then(asJson)
      .then(d => { if (!cancelled && d?.leads) setSummary(d) })
      .catch(fail)
    return () => { cancelled = true }
  }, [])

  const displayName     = user?.name     ?? ''
  const displayInitials = user?.initials ?? '·'
  const tierClass = liveBalance ? (TIER_COLOR[liveBalance.tier] ?? TIER_COLOR.Starter) : null
  const memberSince = summary?.memberSince
    ? new Date(summary.memberSince).toLocaleDateString('en-AE', { month: 'long', year: 'numeric' })
    : null

  const achievements: AchievementView[] | null = summary
    ? [
        { id: 'firstDeal',     icon: '🏆', titleKey: 'agent.achFirstDealTitle',     descKey: 'agent.achFirstDealDesc',     earned: summary.achievements.firstDealClosed.earned,       earnedAt: summary.achievements.firstDealClosed.date,       tier: 'gold'   },
        { id: 'tenLeads',      icon: '👥', titleKey: 'agent.achTenLeadsTitle',      descKey: 'agent.achTenLeadsDesc',      earned: summary.achievements.tenLeadsHandled.earned,       earnedAt: null,                                            tier: 'silver' },
        { id: 'firstCampaign', icon: '🚀', titleKey: 'agent.achFirstCampaignTitle', descKey: 'agent.achFirstCampaignDesc', earned: summary.achievements.firstCampaignLaunched.earned, earnedAt: summary.achievements.firstCampaignLaunched.date, tier: 'bronze' },
        { id: 'hotStreak',     icon: '🔥', titleKey: 'agent.achHotStreakTitle',     descKey: 'agent.achHotStreakDesc',     earned: summary.achievements.hotStreak.earned,             earnedAt: null,                                            tier: 'gold'   },
      ]
    : null

  const maxFocusLeads = summary?.focus.length ? Math.max(...summary.focus.map(f => f.leads)) : 0

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {loadFailed && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t('agent.summaryLoadFailed')}
        </div>
      )}

      {/* Profile header */}
      <section className="flex items-center gap-5 rounded-[24px] border border-line bg-surface p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[22px] font-bold text-gold">
          {displayInitials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-white">{displayName || '—'}</h1>
          {user?.email && <div className="mt-0.5 text-sm text-slate-400 truncate">{user.email}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {liveBalance && tierClass && (
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${tierClass}`}>
                {t('agent.tierLabel', { tier: liveBalance.tier })}
              </span>
            )}
            {memberSince && <span className="text-xs text-slate-500">{t('agent.since', { date: memberSince })}</span>}
          </div>
        </div>
        <div className="hidden sm:block text-end">
          <div className="text-[22px] font-semibold text-emerald-400 tabular-nums">
            {summary ? fmtAED(summary.finance.totalSalesAed) : '—'}
          </div>
          <div className="text-xs text-slate-500">{t('agent.salesVolume')}</div>
        </div>
      </section>

      {/* Quick stats — all real, from the session-scoped summary */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            Icon: Zap, label: t('agent.responseTime'), color: 'text-gold',
            value: summary?.avgFirstResponseHours != null ? t('agent.responseTimeValue', { hours: summary.avgFirstResponseHours }) : '—',
          },
          {
            Icon: TrendingUp, label: t('agent.perfClosingRate'), color: 'text-violet-400',
            value: summary?.leads.closingRate != null ? `${summary.leads.closingRate}%` : '—',
          },
          {
            Icon: Star, label: t('agent.dealsWon'), color: 'text-gold',
            value: summary ? t('agent.winsValue', { count: summary.deals.closed }) : '—',
          },
          {
            Icon: Users, label: t('agent.activeLeads'), color: 'text-teal-400',
            value: summary ? `${summary.leads.open}` : '—',
          },
        ].map(({ Icon, label, value, color }) => (
          <div key={label} className="rounded-[16px] border border-line bg-surface p-4">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className={`mt-2 text-base font-semibold ${color}`}>{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </section>

      {/* Commissions from deals — real, scoped to this broker */}
      {commission && commission.gross > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.commissions.title')}</div>
            <Link href="/freehold-intelligence/crm?stage=closed" className="group flex items-center gap-1 text-xs text-gold/70 transition-colors hover:text-gold">
              {t('agent.commissions.viewClosed')}<ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('agent.commissions.gross'), value: fmtAED(commission.gross), color: 'text-white' },
              { label: t('agent.commissions.received'), value: fmtAED(commission.received), color: 'text-emerald-400' },
              { label: t('agent.commissions.outstanding'), value: fmtAED(commission.outstanding), color: 'text-gold' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-[16px] border border-line bg-surface p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">{t('agent.commissions.sub')}</div>
        </section>
      )}

      {/* Credits wallet — real ledger only; amounts are credits, not AED */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.wallet')}</div>
          {liveBalance && (
            <div className="flex items-center gap-1 text-sm text-gold">
              <Wallet className="h-3.5 w-3.5" />
              {t('agent.creditsAmount', { count: liveBalance.balance })}
            </div>
          )}
        </div>
        {liveBalance && (
          <div className="mb-3 flex gap-4 rounded-[16px] border border-line bg-surface p-4">
            <div>
              <div className="text-xs text-slate-500">{t('agent.creditBalance')}</div>
              <div className="mt-0.5 text-lg font-semibold text-white tabular-nums">{liveBalance.balance}</div>
            </div>
            <div className="ms-auto text-end">
              <div className="text-xs text-slate-500">{t('agent.creditsSpentLabel')}</div>
              <div className="mt-0.5 text-lg font-semibold text-red-400 tabular-nums">-{liveBalance.total_spent}</div>
            </div>
          </div>
        )}
        {liveBalance && (
          <div className="mb-3 rounded-[14px] border border-gold/20 bg-gold/[0.04] px-4 py-3 text-xs text-slate-400">
            <span className="font-medium text-gold">{t('agent.creditsRemainingCycle', { balance: liveBalance.balance })}</span>{t('agent.remainingSpentCycle', { spent: liveBalance.total_spent })}
            {liveBalance.cycle_end && t('agent.resetsOn', { date: new Date(liveBalance.cycle_end).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) })}
          </div>
        )}
        {liveLedger && liveLedger.length > 0 ? (
          <div className="space-y-2">
            {liveLedger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
          </div>
        ) : (
          <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-6 text-center text-sm text-slate-500">
            {t('agent.creditHistoryEmpty')}
          </div>
        )}
      </section>

      {/* My leads — real session-scoped counts */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.myLeads')}</div>
          <Link href="/freehold-intelligence/crm" className="group flex items-center gap-1 text-xs text-gold/70 transition-colors hover:text-gold">
            {t('agent.viewCrm')}<ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('agent.openLeads'),    value: summary ? `${summary.leads.open}` : '—',         color: 'text-white'   },
              { label: t('agent.hotLeads'),     value: summary ? `${summary.leads.hot}` : '—',          color: 'text-gold'    },
              { label: t('agent.newThisMonth'), value: summary ? `${summary.leads.newThisMonth}` : '—', color: 'text-teal-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className={`text-[26px] font-semibold tabular-nums ${color}`}>{value}</div>
                <div className="mt-0.5 text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Focus areas — real top project interests among my leads */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.focusAreas')}</div>
          <MapPin className="h-3 w-3 text-slate-600" />
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-5 space-y-4">
          {summary && summary.focus.length > 0 ? (
            summary.focus.map((entry) => <FocusRow key={entry.slug} entry={entry} maxLeads={maxFocusLeads} />)
          ) : (
            <div className="py-4 text-center text-sm text-slate-500">{t('agent.focusEmpty')}</div>
          )}
        </div>
      </section>

      {/* Achievements — facts computed from real deals, leads, and ad spend */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.achievements')}</div>
        {achievements ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {achievements.map((item) => <AchievementCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-6 text-center text-sm text-slate-500">
            {t('agent.achievementsEmpty')}
          </div>
        )}
      </section>

    </div>
  )
}
