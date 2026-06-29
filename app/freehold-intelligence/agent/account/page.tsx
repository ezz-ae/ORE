'use client'

import { useState, useEffect, type ReactNode } from 'react'
import {
  Star, Lock, TrendingUp, Zap, Users, MapPin, Wallet,
  CheckCircle, Clock, AlertCircle,
} from 'lucide-react'
import {
  agentProfile, agentWallet, agentAchievements, agentLeadPool, agentExpertise,
  type WalletEntry, type Achievement, type ExpertiseEntry,
} from '@/src/features/freehold-intelligence/agent'
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
  type: 'allocation' | 'spend' | 'refund' | 'adjustment'
  amount: number
  note: string | null
  created_at: string
}

const TIER_COLOR: Record<string, string> = {
  Bronze:   'text-orange-400   border-orange-400/30   bg-orange-400/10',
  Silver:   'text-slate-300    border-line-strong        bg-surface-2',
  Gold:     'text-gold    border-gold/30    bg-gold/10',
  Platinum: 'text-violet-300   border-violet-400/30   bg-violet-400/10',
}

const LEVEL_COLOR: Record<string, { text: string; bg: string }> = {
  Expert:   { text: 'text-gold',   bg: 'bg-gold/15'   },
  Strong:   { text: 'text-emerald-400', bg: 'bg-emerald-400/12'  },
  Learning: { text: 'text-teal-400',     bg: 'bg-teal-400/12'      },
  Untested: { text: 'text-slate-500',   bg: 'bg-surface-2'    },
}

const STATUS_META: Record<WalletEntry['status'], { icon: ReactNode; textKey: string; color: string }> = {
  paid:       { icon: <CheckCircle className="h-3.5 w-3.5" />, textKey: 'agent.statusPaid',       color: 'text-emerald-400' },
  processing: { icon: <Clock       className="h-3.5 w-3.5" />, textKey: 'agent.statusProcessing', color: 'text-amber-400'   },
  pending:    { icon: <AlertCircle className="h-3.5 w-3.5" />, textKey: 'agent.statusPending',    color: 'text-teal-400'     },
}

function fmtAED(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}AED ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}AED ${(abs / 1_000).toFixed(1)}K`
  return `${sign}AED ${abs.toLocaleString()}`
}

function WalletRow({ entry }: { entry: WalletEntry }) {
  const { t } = useI18n()
  const meta = STATUS_META[entry.status]
  return (
    <div className="flex items-center gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-100 truncate">{entry.description}</div>
        {entry.project && (
          <div className="mt-0.5 text-xs text-slate-500">{entry.project} · {new Date(entry.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</div>
        )}
      </div>
      <div className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}>
        {meta.icon}
        {t(meta.textKey)}
      </div>
      <div className={`min-w-[80px] text-right text-sm font-semibold tabular-nums ${entry.amount < 0 ? 'text-red-400' : 'text-white'}`}>
        {fmtAED(entry.amount)}
      </div>
    </div>
  )
}

function AchievementCard({ item }: { item: Achievement }) {
  const tc = TIER_COLOR[item.tier.charAt(0).toUpperCase() + item.tier.slice(1)] ?? TIER_COLOR.Bronze
  return (
    <div className={`relative flex flex-col rounded-[18px] border p-4 transition ${item.earned ? 'border-line bg-surface' : 'border-line bg-transparent opacity-50'}`}>
      {!item.earned && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[18px] backdrop-blur-[1px]">
          <Lock className="h-5 w-5 text-slate-600" />
        </div>
      )}
      <div className="text-[24px]">{item.icon}</div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{item.title}</div>
      <div className="mt-0.5 text-xs text-slate-400 leading-relaxed">{item.description}</div>
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

function ExpertiseRow({ entry }: { entry: ExpertiseEntry }) {
  const { t } = useI18n()
  const lc = LEVEL_COLOR[entry.level]
  const barW = entry.level === 'Expert' ? 100 : entry.level === 'Strong' ? 65 : entry.level === 'Learning' ? 30 : 5
  const barColor = entry.level === 'Expert' ? 'bg-gold' : entry.level === 'Strong' ? 'bg-emerald-400' : entry.level === 'Learning' ? 'bg-teal-400' : 'bg-surface-3'

  return (
    <div className="flex items-center gap-4">
      <div className="w-[140px] shrink-0">
        <div className="text-sm font-medium text-slate-300">{entry.area}</div>
        {entry.lastDeal && (
          <div className="mt-0.5 text-xs text-slate-500">{t('agent.lastDeal', { date: new Date(entry.lastDeal).toLocaleDateString('en-AE', { month: 'short', year: '2-digit' }) })}</div>
        )}
      </div>
      <div className="flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barW}%` }} />
        </div>
      </div>
      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${lc.bg} ${lc.text}`}>
        {entry.level}
        {entry.deals > 0 && <span className="opacity-70">· {entry.deals}</span>}
      </div>
    </div>
  )
}

export default function AgentAccountPage() {
  const { t } = useI18n()
  const { user } = useSession()
  const [liveBalance, setLiveBalance] = useState<LiveBalance | null>(null)
  const [liveLedger, setLiveLedger] = useState<LiveLedgerEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/credits/balance')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.balance) setLiveBalance(d.balance) })
      .catch(() => {})
    fetch('/api/freehold/credits/ledger')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && Array.isArray(d?.ledger)) setLiveLedger(d.ledger) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Map live ledger entries → WalletEntry shape; fall back to mock
  const walletEntries: WalletEntry[] = liveLedger && liveLedger.length > 0
    ? liveLedger.map(e => ({
        id: e.id,
        description: e.note ?? (e.type === 'spend' ? t('agent.campaignSpend') : e.type === 'allocation' ? t('agent.creditsAllocated') : t('agent.creditAdjustment')),
        amount: e.type === 'spend' ? -(e.amount * 10) : e.amount * 10,
        type: (e.type === 'spend' ? 'campaign_debit' : 'bonus') as WalletEntry['type'],
        status: 'paid' as const,
        date: e.created_at,
      }))
    : agentWallet

  const pendingBalance = walletEntries
    .filter(w => w.status !== 'paid' && w.amount > 0)
    .reduce((s, w) => s + w.amount, 0)

  const totalEarned = walletEntries
    .filter(w => w.type !== 'campaign_debit' && w.amount > 0)
    .reduce((s, w) => s + w.amount, 0)

  const adSpend = liveBalance ? liveBalance.total_spent * 10 : agentProfile.adSpendOnLeads

  const poolPct = (agentLeadPool.used / agentLeadPool.monthlyQuota) * 100

  const displayName     = user?.name     ?? agentProfile.name
  const displayInitials = user?.initials ?? agentProfile.initials
  const tierClass = TIER_COLOR[agentProfile.tier] ?? TIER_COLOR.Gold
  const joinedSince = new Date(agentProfile.joinedAt).toLocaleDateString('en-AE', { month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {/* Profile header */}
      <section className="flex items-center gap-5 rounded-[24px] border border-line bg-surface p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[22px] font-bold text-gold">
          {displayInitials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-white">{displayName}</h1>
          <div className="mt-0.5 text-sm text-slate-400">{agentProfile.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${tierClass}`}>
              {t('agent.tierLabel', { tier: agentProfile.tier })}
            </span>
            <span className="text-xs text-slate-500">{t('agent.since', { date: joinedSince })}</span>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-[22px] font-semibold text-emerald-400 tabular-nums">
            AED {(agentProfile.revMTD / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-xs text-slate-500">{t('agent.mtdRevenue')}</div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { Icon: Zap,       label: t('agent.responseTime'),  value: t('agent.responseTimeValue', { hours: agentProfile.avgResponseH }), color: 'text-gold'  },
          { Icon: Users,     label: t('agent.viewingRate'),   value: `${agentProfile.leadToViewingPct}%`,   color: 'text-teal-400'    },
          { Icon: TrendingUp,label: t('agent.offerRate'),     value: `${agentProfile.viewingToOfferPct}%`,  color: 'text-violet-400' },
          { Icon: Star,      label: t('agent.winsThisMonth'), value: t('agent.winsValue', { count: agentProfile.wins }),         color: 'text-gold'  },
        ].map(({ Icon, label, value, color }) => (
          <div key={label} className="rounded-[16px] border border-line bg-surface p-4">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className={`mt-2 text-base font-semibold ${color}`}>{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </section>

      {/* Wallet */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.wallet')}</div>
          <div className="flex items-center gap-1 text-sm text-gold">
            <Wallet className="h-3.5 w-3.5" />
            {t('agent.pendingAmount', { amount: fmtAED(pendingBalance) })}
          </div>
        </div>
        <div className="mb-3 flex gap-4 rounded-[16px] border border-line bg-surface p-4">
          <div>
            <div className="text-xs text-slate-500">{t('agent.totalEarned')}</div>
            <div className="mt-0.5 text-lg font-semibold text-white tabular-nums">{fmtAED(totalEarned)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-500">{t('agent.adSpendPersonal')}</div>
            <div className="mt-0.5 text-lg font-semibold text-red-400 tabular-nums">-AED {adSpend.toLocaleString()}</div>
          </div>
        </div>
        {liveBalance && (
          <div className="mb-3 rounded-[14px] border border-gold/20 bg-gold/[0.04] px-4 py-3 text-xs text-slate-400">
            <span className="font-medium text-gold">{t('agent.creditsRemainingCycle', { balance: liveBalance.balance })}</span>{t('agent.remainingSpentCycle', { spent: liveBalance.total_spent })}
            {liveBalance.cycle_end && t('agent.resetsOn', { date: new Date(liveBalance.cycle_end).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) })}
          </div>
        )}
        <div className="space-y-2">
          {walletEntries.map((entry) => <WalletRow key={entry.id} entry={entry} />)}
        </div>
      </section>

      {/* Lead pool */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.leadPool')}</div>
        <div className="rounded-[18px] border border-line bg-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-300">{t('agent.tierQuota', { tier: agentLeadPool.tier, quota: agentLeadPool.monthlyQuota })}</div>
              <div className="mt-1 text-xs text-slate-400 leading-relaxed max-w-sm">{agentLeadPool.tierCriteria}</div>
            </div>
            <div className="text-right ml-4">
              <div className="text-[26px] font-semibold text-gold tabular-nums">{agentLeadPool.monthlyQuota - agentLeadPool.used}</div>
              <div className="text-xs text-slate-500">{t('agent.remaining')}</div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${poolPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{t('agent.usedOf', { used: agentLeadPool.used, quota: agentLeadPool.monthlyQuota })}</span>
            <span>{t('agent.resetsLabel', { date: new Date(agentLeadPool.resetAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'long' }) })}</span>
          </div>
        </div>
      </section>

      {/* Expertise map */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.expertiseMap')}</div>
          <MapPin className="h-3 w-3 text-slate-600" />
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-5 space-y-4">
          {agentExpertise.map((entry) => <ExpertiseRow key={entry.area} entry={entry} />)}
        </div>
      </section>

      {/* Achievements */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.achievements')}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {agentAchievements.map((item) => <AchievementCard key={item.id} item={item} />)}
        </div>
      </section>

    </div>
  )
}
