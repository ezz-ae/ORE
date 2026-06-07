'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Minus, CheckCircle, Clock, Users, Zap, Coins, ArrowUpRight } from 'lucide-react'

type Agent = {
  id: string
  name: string
  initials: string
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  quota: number
  used: number
  pending: number
  resetAt: string
}

const INITIAL_AGENTS: Agent[] = [
  { id: 'a1', name: 'Noura Al Hassan',   initials: 'NA', tier: 'Gold',   quota: 25, used: 18, pending: 0, resetAt: '2026-07-01' },
  { id: 'a2', name: 'James Cooper',      initials: 'JC', tier: 'Silver', quota: 18, used: 12, pending: 2, resetAt: '2026-07-01' },
  { id: 'a3', name: 'Priya Sharma',      initials: 'PS', tier: 'Bronze', quota: 12, used: 5,  pending: 1, resetAt: '2026-07-01' },
  { id: 'a4', name: 'Omar Khalil',       initials: 'OK', tier: 'Silver', quota: 18, used: 15, pending: 0, resetAt: '2026-07-01' },
]

const TIER_COLOR: Record<string, string> = {
  Bronze:   'text-orange-400   bg-orange-400/10   border-orange-400/25',
  Silver:   'text-slate-300    bg-surface-2    border-line-strong',
  Gold:     'text-gold    bg-gold/10    border-gold/25',
  Platinum: 'text-violet-300   bg-violet-400/10   border-violet-400/25',
}

const TIER_QUOTA: Record<string, number> = {
  Bronze: 12, Silver: 18, Gold: 25, Platinum: 40,
}

export default function AgentCreditsPage() {
  const [agents, setAgents]           = useState<Agent[]>(INITIAL_AGENTS)
  const [saved, setSaved]             = useState<string[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})

  function adjust(id: string, delta: number) {
    setAdjustments((prev) => {
      const current = prev[id] ?? 0
      const agent   = agents.find((a) => a.id === id)!
      const newVal  = Math.max(0, Math.min(50, current + delta))
      return { ...prev, [id]: newVal }
    })
  }

  function applyAdjustment(id: string) {
    const delta = adjustments[id] ?? 0
    if (delta === 0) return
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, quota: a.quota + delta } : a,
      ),
    )
    setAdjustments((prev) => ({ ...prev, [id]: 0 }))
    setSaved((prev) => [...prev, id])
    setTimeout(() => setSaved((prev) => prev.filter((x) => x !== id)), 2000)
  }

  function setTier(id: string, tier: Agent['tier']) {
    const newQuota = TIER_QUOTA[tier]
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, tier, quota: newQuota } : a))
    setSaved((prev) => [...prev, id])
    setTimeout(() => setSaved((prev) => prev.filter((x) => x !== id)), 2000)
  }

  const totalQuota = agents.reduce((s, a) => s + a.quota, 0)
  const totalUsed  = agents.reduce((s, a) => s + a.used, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Credit Economy banner */}
      <Link
        href="/freehold-intelligence/management/credits"
        className="group mb-6 flex items-center gap-4 rounded-xl border border-gold/25 bg-gold/[0.06] px-5 py-4 transition hover:border-gold/40 hover:bg-gold/10"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
          <Coins className="h-5 w-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Ad-credit economy &amp; AI financial analysis now live in the Admin panel</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Broker ad budgets, blended ROI, and AI-recommended refills — the full Credit Economy dashboard.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-gold">
          Open <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[20px] font-semibold text-white">Agent Lead Credits</h1>
        <p className="mt-1 text-sm text-slate-400">
          Control how many leads each agent receives per month. Credits reset on the 1st of each month.
        </p>
      </div>

      {/* Summary row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Total quota',    value: totalQuota,                       Icon: Zap,   color: 'text-gold'  },
          { label: 'Used this month', value: totalUsed,                        Icon: Users, color: 'text-sky-400'    },
          { label: 'Remaining',       value: totalQuota - totalUsed,           Icon: CheckCircle, color: 'text-emerald-400' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface px-4 py-3.5">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className={`mt-2 text-[20px] font-semibold tabular-nums ${color}`}>{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Agents */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const tc     = TIER_COLOR[agent.tier]
          const pct    = agent.quota > 0 ? (agent.used / agent.quota) * 100 : 0
          const adj    = adjustments[agent.id] ?? 0
          const isSaved = saved.includes(agent.id)

          return (
            <div key={agent.id} className="rounded-xl border border-line bg-surface p-5">

              {/* Agent identity */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">
                  {agent.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-white">{agent.name}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tc}`}>
                      {agent.tier}
                    </span>
                    <span className="text-xs text-slate-500">Resets {new Date(agent.resetAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                {isSaved && (
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" /> Saved
                  </div>
                )}
              </div>

              {/* Usage bar */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{agent.used} of {agent.quota} leads used</span>
                  {agent.pending > 0 && (
                    <span className="flex items-center gap-1 text-amber-400/70">
                      <Clock className="h-3 w-3" /> {agent.pending} pending
                    </span>
                  )}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-gold'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 flex-wrap">

                {/* Tier selector */}
                <div>
                  <div className="mb-1.5 text-[10px] text-slate-500 uppercase tracking-wider">Tier</div>
                  <div className="flex gap-1.5">
                    {(['Bronze', 'Silver', 'Gold', 'Platinum'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTier(agent.id, t)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                          agent.tier === t ? TIER_COLOR[t] : 'border-line-strong text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual quota adjustment */}
                <div className="ml-auto flex items-center gap-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Bonus credits</div>
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
                      className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-gold/90"
                    >
                      Apply
                    </button>
                  )}
                </div>

              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
