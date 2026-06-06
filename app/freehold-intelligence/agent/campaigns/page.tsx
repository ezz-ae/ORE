'use client'

import { useState } from 'react'
import {
  Megaphone, Plus, TrendingUp, TrendingDown, Pause, Play,
  Wallet, AlertCircle, ChevronRight, Zap,
} from 'lucide-react'
import { agentProfile, agentWallet } from '@/src/features/freehold-intelligence/agent'

type CampaignStatus = 'running' | 'paused' | 'pending_approval'

type AgentCampaign = {
  id: string
  name: string
  platform: 'meta' | 'google' | 'property_finder' | 'bayut'
  status: CampaignStatus
  budget: number       // AED / month
  spent: number        // AED so far
  leads: number
  cpl: number
  targetCpl: number
  startDate: string
  property: string
  note?: string
}

const INITIAL_CAMPAIGNS: AgentCampaign[] = [
  {
    id: 'ac1',
    name: 'Palm Q2 — Investor Leads',
    platform: 'meta',
    status: 'running',
    budget: 2_000,
    spent: 1_450,
    leads: 9,
    cpl: 161,
    targetCpl: 180,
    startDate: '2026-05-01',
    property: 'Palm Jumeirah',
    note: 'Running well. Scale by 20% next week if pace holds.',
  },
  {
    id: 'ac2',
    name: 'Dubai Hills — Family Villa',
    platform: 'meta',
    status: 'paused',
    budget: 1_500,
    spent: 750,
    leads: 3,
    cpl: 250,
    targetCpl: 180,
    startDate: '2026-05-15',
    property: 'Dubai Hills Estate',
    note: 'CPL too high. Pause while refreshing creatives.',
  },
  {
    id: 'ac3',
    name: 'Signature Villa — Search',
    platform: 'google',
    status: 'running',
    budget: 1_000,
    spent: 320,
    leads: 2,
    cpl: 160,
    targetCpl: 200,
    startDate: '2026-06-01',
    property: 'Palm Jumeirah',
  },
]

const PLATFORM_META: Record<string, { label: string; icon: string; color: string }> = {
  meta:            { label: 'Meta',            icon: '🔵', color: 'text-blue-400'   },
  google:          { label: 'Google',          icon: '🔴', color: 'text-red-400'    },
  property_finder: { label: 'PropertyFinder',  icon: '🏠', color: 'text-sky-400'    },
  bayut:           { label: 'Bayut',           icon: '🏡', color: 'text-amber-400'  },
}

const STATUS_META: Record<CampaignStatus, { label: string; color: string; dot: string }> = {
  running:          { label: 'Running',          color: 'text-emerald-400', dot: 'bg-emerald-400' },
  paused:           { label: 'Paused',           color: 'text-amber-400',   dot: 'bg-amber-400'   },
  pending_approval: { label: 'Pending',          color: 'text-sky-400',     dot: 'bg-sky-400'     },
}

const totalSpent = INITIAL_CAMPAIGNS.reduce((s, c) => s + c.spent, 0)
const totalLeads = INITIAL_CAMPAIGNS.reduce((s, c) => s + c.leads, 0)
const walletBalance = agentWallet.filter((w) => w.amount > 0 && w.status !== 'paid').reduce((s, w) => s + w.amount, 0)

export default function AgentCampaignsPage() {
  const [campaigns, setCampaigns] = useState<AgentCampaign[]>(INITIAL_CAMPAIGNS)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBudget, setNewBudget] = useState('')
  const [newPlatform, setNewPlatform] = useState<AgentCampaign['platform']>('meta')
  const [newProperty, setNewProperty] = useState('')

  function toggleStatus(id: string) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: c.status === 'running' ? 'paused' : 'running' }
          : c,
      ),
    )
  }

  function launchCampaign() {
    if (!newName.trim() || !newBudget || !newProperty.trim()) return
    const budget = parseInt(newBudget, 10)
    if (isNaN(budget) || budget < 100) return
    setCampaigns((prev) => [
      ...prev,
      {
        id: `ac${Date.now()}`,
        name: newName.trim(),
        platform: newPlatform,
        status: 'pending_approval',
        budget,
        spent: 0,
        leads: 0,
        cpl: 0,
        targetCpl: 180,
        startDate: new Date().toISOString().slice(0, 10),
        property: newProperty.trim(),
      },
    ])
    setNewName('')
    setNewBudget('')
    setNewProperty('')
    setShowNew(false)
  }

  const overallCpl = totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {/* Header stats */}
      <section className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total spend',       value: `AED ${(totalSpent / 1_000).toFixed(1)}K`,   color: 'text-white/80'    },
          { label: 'Total leads',       value: `${totalLeads}`,                              color: 'text-sky-400'     },
          { label: 'Avg CPL',           value: `AED ${overallCpl}`,                          color: overallCpl < 180 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Wallet (pending)',  value: `AED ${(walletBalance / 1_000).toFixed(1)}K`, color: 'text-[#D4AF37]',  hideMobile: true },
        ].map((s) => (
          <div key={s.label} className={`rounded-[16px] border border-white/[0.06] bg-[#131B2B] p-4 ${(s as any).hideMobile ? 'hidden sm:block' : ''}`}>
            <div className={`text-[16px] font-semibold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="mt-0.5 text-[11px] text-white/30">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Wallet notice */}
      <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] px-4 py-3">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
        <p className="text-[12px] text-white/55 leading-relaxed">
          Campaign spend is charged to your wallet. Deductions appear as credits against your commission balance. Your current pending earnings cover up to{' '}
          <span className="text-[#D4AF37] font-medium">AED {((walletBalance + agentProfile.adSpendOnLeads) / 1_000).toFixed(1)}K</span> in campaigns.
        </p>
      </div>

      {/* Campaign list */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">My campaigns</div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 text-[12px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
          >
            <Plus className="h-3.5 w-3.5" />
            New campaign
          </button>
        </div>

        {/* New campaign form */}
        {showNew && (
          <div className="mb-4 rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-5 space-y-3">
            <div className="text-[13px] font-semibold text-white">New campaign</div>
            <input
              type="text"
              placeholder="Campaign name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/40"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Property / area"
                value={newProperty}
                onChange={(e) => setNewProperty(e.target.value)}
                className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/40"
              />
              <input
                type="number"
                placeholder="Budget (AED)"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/40"
              />
            </div>
            <div className="flex gap-2">
              {(['meta', 'google', 'property_finder', 'bayut'] as const).map((p) => {
                const pm = PLATFORM_META[p]
                return (
                  <button
                    key={p}
                    onClick={() => setNewPlatform(p)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                      newPlatform === p
                        ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]'
                        : 'border-white/[0.08] text-white/40 hover:text-white/70'
                    }`}
                  >
                    {pm.icon} {pm.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={launchCampaign}
                className="flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-[#D4AF37]/90"
              >
                <Zap className="h-3.5 w-3.5" />
                Launch — charge wallet
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="rounded-full border border-white/[0.08] px-4 py-2 text-[12px] text-white/40 transition hover:text-white/70"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {campaigns.map((c) => {
            const pm = PLATFORM_META[c.platform]
            const sm = STATUS_META[c.status]
            const efficiency = c.cpl > 0 && c.cpl <= c.targetCpl
            const spentPct = Math.min((c.spent / c.budget) * 100, 100)

            return (
              <div key={c.id} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-white">{c.name}</span>
                      <span className={`flex items-center gap-1 text-[11px] font-medium ${pm.color}`}>
                        {pm.icon} {pm.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/30">{c.property} · started {new Date(c.startDate).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`flex items-center gap-1 text-[11px] font-medium ${sm.color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sm.dot} ${c.status === 'running' ? 'animate-pulse' : ''}`} />
                      {sm.label}
                    </div>
                    {c.status !== 'pending_approval' && (
                      <button
                        onClick={() => toggleStatus(c.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40 transition hover:border-white/20 hover:text-white/70"
                      >
                        {c.status === 'running' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Budget bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-white/35">AED {c.spent.toLocaleString()} spent of AED {c.budget.toLocaleString()}</span>
                    <span className="text-white/25">{Math.round(spentPct)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className={`h-full rounded-full transition-all ${spentPct > 90 ? 'bg-red-400' : spentPct > 70 ? 'bg-amber-400' : 'bg-[#D4AF37]'}`}
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-3 flex flex-wrap gap-4">
                  <div>
                    <div className="text-[11px] text-white/30">Leads</div>
                    <div className="mt-0.5 text-[14px] font-semibold text-white tabular-nums">{c.leads}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/30">CPL</div>
                    <div className={`mt-0.5 flex items-center gap-1 text-[14px] font-semibold tabular-nums ${c.cpl === 0 ? 'text-white/30' : efficiency ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {c.cpl === 0 ? '—' : `AED ${c.cpl}`}
                      {c.cpl > 0 && (efficiency ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/30">Target CPL</div>
                    <div className="mt-0.5 text-[14px] font-semibold text-white/50 tabular-nums">AED {c.targetCpl}</div>
                  </div>
                </div>

                {c.note && (
                  <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-white/20" />
                    <div className="text-[11px] text-white/40 leading-relaxed">{c.note}</div>
                  </div>
                )}

                {c.status === 'pending_approval' && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-sky-400">
                    <Megaphone className="h-3 w-3" />
                    Pending approval — your wallet will be charged once live
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Spend on company-assigned leads */}
      <section className="mt-8">
        <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">Company lead spend</div>
        <div className="flex items-center gap-4 rounded-[18px] border border-white/[0.06] bg-[#131B2B] p-5">
          <Megaphone className="h-8 w-8 shrink-0 text-[#D4AF37]/60" />
          <div>
            <div className="text-[13px] text-white/70">
              The company has spent <span className="font-semibold text-[#D4AF37]">AED {agentProfile.adSpendOnLeads.toLocaleString()}</span> this month on campaigns that generated leads assigned to you.
            </div>
            <div className="mt-0.5 text-[11px] text-white/30">
              Your cost per lead: AED {agentProfile.cplForLeads} · {Math.round(agentProfile.adSpendOnLeads / agentProfile.cplForLeads)} leads from company campaigns
            </div>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-white/20" />
        </div>
      </section>

    </div>
  )
}
