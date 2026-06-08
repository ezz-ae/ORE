'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Minus, CheckCircle, Clock, Users, Zap, Coins, ArrowUpRight, Loader2 } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/freehold/ui'

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

const TIER_COLOR: Record<string, string> = {
  Bronze:   'text-orange-400   bg-orange-400/10   border-orange-400/25',
  Silver:   'text-slate-300    bg-surface-2    border-line-strong',
  Gold:     'text-gold    bg-gold/10    border-gold/25',
  Platinum: 'text-violet-300   bg-violet-400/10   border-violet-400/25',
}

const TIER_QUOTA: Record<string, number> = {
  Bronze: 12, Silver: 18, Gold: 25, Platinum: 40,
}

const NEXT_RESET = (() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10)
})()

export default function AgentCreditsPage() {
  const [agents, setAgents]           = useState<Agent[]>([])
  const [loading, setLoading]         = useState(true)
  const [saved, setSaved]             = useState<string[]>([])
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/freehold/team')
      .then((r) => r.json())
      .then((data) => {
        if (data.members) {
          const brokers = data.members
            .filter((m: any) => m.dbRole === 'broker')
            .map((m: any): Agent => ({
              id:      m.id,
              name:    m.name,
              initials: m.initials,
              tier:    'Bronze',
              quota:   TIER_QUOTA.Bronze,
              used:    0,
              pending: 0,
              resetAt: NEXT_RESET,
            }))
          setAgents(brokers)
        }
      })
      .finally(() => setLoading(false))
  }, [])

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
      <PageHeader
        eyebrow="Finance"
        Icon={Coins}
        title="Agent Lead Credits"
        subtitle="Control how many leads each agent receives per month. Credits reset on the 1st of each month."
        className="mb-8"
      />

      {/* Summary row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Total quota"    value={totalQuota}              Icon={Zap}         hint="credits allocated" />
        <StatCard label="Used this month" value={totalUsed}              Icon={Users}       hint="credits consumed"  />
        <StatCard label="Remaining"       value={totalQuota - totalUsed} Icon={CheckCircle} hint="available now"     />
      </div>

      {/* Agents */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading agents…</span>
        </div>
      )}
      <div className="space-y-3">
        {!loading && agents.map((agent) => {
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
