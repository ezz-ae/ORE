'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Coins, TrendingUp, Users, Target, Sparkles, ArrowUpRight, Wallet,
  Megaphone, MessageSquare, Zap, Plus, Check, DollarSign, Loader2,
  AlertTriangle, Briefcase, Phone, WifiOff,
} from 'lucide-react'
import {
  brokerMetrics, creditPortfolio, CREDIT_VALUE_AED,
  TIER_CREDIT, STATUS_CREDIT, computeMetrics,
  type BrokerCreditMetrics,
} from '@/src/features/freehold-intelligence/credits'

const aed = (n: number) =>
  n >= 1000 ? `AED ${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `AED ${Math.round(n)}`
const aedFull = (n: number) => `AED ${Math.round(n).toLocaleString('en-AE')}`

export default function CreditsPage() {
  const [brokers, setBrokers] = useState<BrokerCreditMetrics[]>(brokerMetrics)
  const [applied, setApplied] = useState<string[]>([])

  // AI financial analysis (real endpoint, graceful fallback)
  const [analysis, setAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const p = creditPortfolio(brokers)

  function applyRefill(id: string) {
    setBrokers(prev => prev.map(b => {
      if (b.id !== id) return b
      // start a fresh cycle with the AI-recommended allocation
      const next = computeMetrics({ ...b, allocated: b.recommendedRefill, spent: 0 })
      return next
    }))
    setApplied(a => [...a, id])
    setTimeout(() => setApplied(a => a.filter(x => x !== id)), 2000)
  }

  async function runAnalysis() {
    if (analyzing) return
    setAnalyzing(true)
    setAnalysis('')
    const context = {
      creditValueAed: CREDIT_VALUE_AED,
      portfolio: p,
      brokers: brokers.map(b => ({
        name: b.name, tier: b.tier, allocated: b.allocated, spent: b.spent,
        leads: b.leads, deals: b.deals, revenue: b.revenue,
        roi: Number(b.roi.toFixed(2)), closingRate: Number(b.closingRate.toFixed(1)),
        crmAttention: b.crmAttention, efficiency: b.efficiency, status: b.status,
        whatsappConnected: b.whatsappConnected,
      })),
    }
    const message =
      'You are the CFO-grade analyst for our broker ad-credit economy. Each credit = AED ' +
      CREDIT_VALUE_AED + ' of company-funded ad spend. Analyze credit usage, ROI, leads, deals ' +
      'and CRM attention from a financial point of view. Give: (1) where the money is working ' +
      'and where it is leaking, (2) who to fund more vs coach, (3) the single highest-ROI move ' +
      'for next cycle. Be concise and specific with numbers.'
    try {
      const res = await fetch('/api/freehold/server-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, role: 'owner', context }),
      })
      const data = await res.json()
      const answer = data?.data?.answer || data?.answer || data?.message || data?.reply
      setAnalysis(answer || fallbackAnalysis(p, brokers))
    } catch {
      setAnalysis(fallbackAnalysis(p, brokers))
    } finally {
      setAnalyzing(false)
    }
  }

  const ranked = [...brokers].sort((a, b) => b.efficiency - a.efficiency)

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#090C12]/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Coins className="h-5 w-5 text-[#D4AF37]" /> Broker Credit Economy
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Company-funded AI ad budgets · 1 credit = AED {CREDIT_VALUE_AED} · finance-linked
            </p>
          </div>
          <Link
            href="/management/finance"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <DollarSign className="h-4 w-4" /> Finance
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Portfolio stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat icon={Wallet}     label="Credits Funded"  value={p.allocated.toLocaleString()} sub={aed(p.allocated * CREDIT_VALUE_AED)} tone="gold" />
          <Stat icon={Zap}        label="Credits Spent"   value={p.spent.toLocaleString()}     sub={`${Math.round((p.spent / p.allocated) * 100)}% used`} />
          <Stat icon={Megaphone}  label="Ad Investment"   value={aed(p.investedAed)}           sub="company funded" />
          <Stat icon={Target}     label="Leads"           value={p.leads.toString()}           sub={`${aedFull(p.avgCostPerLead)}/lead`} tone="sky" />
          <Stat icon={Briefcase}  label="Deals Closed"    value={p.deals.toString()}           sub={aed(p.revenue)} tone="emerald" />
          <Stat icon={TrendingUp} label="Blended ROI"     value={`${p.blendedRoi.toFixed(1)}×`} sub={`+${Math.round(p.blendedRoiPct)}%`} tone="emerald" />
        </div>

        {/* Finance bridge banner */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <DollarSign className="h-4 w-4 text-[#D4AF37]" />
            <span className="font-semibold text-white">{aedFull(p.investedAed)}</span> invested
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-600" />
          <div className="text-sm text-slate-300">
            <span className="font-semibold text-emerald-400">{aedFull(p.revenue)}</span> revenue
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-600" />
          <div className="text-sm text-slate-300">
            net <span className="font-semibold text-emerald-400">{aedFull(p.revenue - p.investedAed)}</span> from broker self-served ads
          </div>
          <div className="ml-auto text-xs text-slate-500">
            AI suggests <span className="font-semibold text-[#D4AF37]">{p.recommendedNextCycle.toLocaleString()}</span> credits next cycle
          </div>
        </div>

        {/* AI Financial Analysis */}
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.03]">
          <div className="flex items-center gap-3 border-b border-[#D4AF37]/15 px-5 py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            </div>
            <span className="text-sm font-semibold text-white">AI Financial Analysis</span>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-semibold text-[#0D1117] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {analyzing ? 'Analyzing…' : analysis ? 'Re-analyze' : 'Analyze credits'}
            </button>
          </div>
          <div className="px-5 py-4">
            {analysis ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                {analysis.replace(/\*\*/g, '')}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Run a CFO-grade read of credit usage, ROI, cost-per-lead and CRM attention across every
                broker — then get who to fund more, who to coach, and the highest-ROI move for next cycle.
              </p>
            )}
          </div>
        </div>

        {/* Broker credit accounts */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Broker Accounts</h2>
            <span className="text-xs text-slate-500">{brokers.length} brokers · ranked by efficiency</span>
          </div>

          <div className="space-y-3">
            {ranked.map((b, i) => {
              const st = STATUS_CREDIT[b.status]
              const isApplied = applied.includes(b.id)
              return (
                <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  {/* identity row */}
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D4AF37]/15 text-sm font-bold text-[#D4AF37]">
                        {b.initials}
                      </div>
                      {i < 3 && (
                        <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#D4AF37] text-[10px] font-bold text-[#0D1117]">
                          {i + 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">{b.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TIER_CREDIT[b.tier]}`}>
                          {b.tier}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        {!b.whatsappConnected && (
                          <span className="flex items-center gap-1 rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            <WifiOff className="h-2.5 w-2.5" /> No WhatsApp
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</span>
                        <span className="flex items-center gap-1"><Megaphone className="h-3 w-3" />{b.focusProject}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{b.conversations} chats scanned</span>
                      </div>
                    </div>
                    {/* efficiency */}
                    <div className="text-right shrink-0">
                      <div className="text-xl font-semibold text-white tabular-nums">{b.efficiency}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">efficiency</div>
                    </div>
                  </div>

                  {/* credit usage bar */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {b.spent.toLocaleString()} / {b.allocated.toLocaleString()} credits
                        <span className="text-slate-600"> · {aed(b.investedAed)} spent</span>
                      </span>
                      <span className="text-slate-500">{b.remaining.toLocaleString()} left</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all ${b.spentPct > 90 ? 'bg-red-400' : b.spentPct > 70 ? 'bg-amber-400' : 'bg-[#D4AF37]'}`}
                        style={{ width: `${Math.min(b.spentPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* metrics grid */}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <Metric label="Leads"        value={b.leads.toString()} />
                    <Metric label="Deals"        value={b.deals.toString()} />
                    <Metric label="Closing"      value={`${b.closingRate.toFixed(1)}%`} />
                    <Metric label="Cost / lead"  value={aedFull(b.costPerLead)} />
                    <Metric label="ROI"          value={`${b.roi.toFixed(1)}×`} tone={b.roi >= 5 ? 'emerald' : b.roi >= 1 ? 'default' : 'red'} />
                  </div>

                  {/* AI recommendation + refill */}
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-800/30 p-3.5 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {b.status === 'at_risk'
                        ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        : <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />}
                      <p className="text-xs leading-relaxed text-slate-300">{b.recommendation}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">AI refill</div>
                        <div className="text-sm font-semibold text-[#D4AF37] tabular-nums">
                          {b.recommendedRefill.toLocaleString()} cr
                        </div>
                      </div>
                      <button
                        onClick={() => applyRefill(b.id)}
                        disabled={isApplied || b.recommendedRefill === 0}
                        className="flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-2 text-xs font-semibold text-[#0D1117] transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {isApplied ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {isApplied ? 'Funded' : b.recommendedRefill === 0 ? 'Hold' : 'Fund'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Users className="h-3.5 w-3.5" /> How the credit economy works
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: '1', t: 'Company funds credits', d: 'Each broker gets an ad budget in credits — no salary, no leads handed out. The AI builds the ads.' },
              { n: '2', t: 'Broker self-serves ads', d: 'Pick a studied project → next → next → live. Leads land in the broker’s own CRM; WhatsApp runs through the server.' },
              { n: '3', t: 'AI refills by performance', d: 'When credits run low, ROI is computed. Strong closers get bigger, better-targeted budgets; weak ones get coaching.' },
            ].map(s => (
              <div key={s.n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-xs font-bold text-[#D4AF37]">{s.n}</span>
                <div>
                  <div className="text-sm font-medium text-slate-200">{s.t}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub, tone = 'default' }: {
  icon: React.ElementType; label: string; value: string; sub?: string
  tone?: 'default' | 'gold' | 'emerald' | 'sky'
}) {
  const color = tone === 'gold' ? 'text-[#D4AF37]' : tone === 'emerald' ? 'text-emerald-400' : tone === 'sky' ? 'text-sky-400' : 'text-white'
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <Icon className="h-4 w-4 text-slate-500" />
      <p className={`mt-3 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-600">{sub}</p>}
    </div>
  )
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'emerald' | 'red' }) {
  const color = tone === 'emerald' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : 'text-slate-100'
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
      <div className={`text-sm font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}

function fallbackAnalysis(p: ReturnType<typeof creditPortfolio>, brokers: BrokerCreditMetrics[]): string {
  const top = [...brokers].sort((a, b) => b.roi - a.roi)[0]
  const worst = [...brokers].sort((a, b) => a.efficiency - b.efficiency)[0]
  const underfunded = brokers.filter(b => b.status === 'underfunded')
  return [
    `Portfolio: AED ${Math.round(p.investedAed).toLocaleString('en-AE')} of credits turned into AED ${Math.round(p.revenue).toLocaleString('en-AE')} revenue — a ${p.blendedRoi.toFixed(1)}× blended return (net +AED ${Math.round(p.revenue - p.investedAed).toLocaleString('en-AE')}).`,
    ``,
    `Money is working hardest with ${top.name} at ${top.roi.toFixed(1)}× ROI and a ${top.closingRate.toFixed(1)}% closing rate — fund more and clone the targeting.`,
    ``,
    `Money is leaking on ${worst.name}: efficiency ${worst.efficiency}/100${worst.whatsappConnected ? '' : ', WhatsApp not connected'}. ${worst.recommendation}`,
    ``,
    underfunded.length
      ? `Highest-ROI move: ${underfunded.map(b => b.name).join(', ')} ${underfunded.length > 1 ? 'are' : 'is'} thriving but nearly out of credits — refill now before momentum stalls.`
      : `Highest-ROI move: shift budget from watch/at-risk brokers into your top two closers for next cycle.`,
    ``,
    `Recommended next cycle: ${p.recommendedNextCycle.toLocaleString()} credits (AED ${Math.round(p.recommendedNextCycle * CREDIT_VALUE_AED).toLocaleString('en-AE')}).`,
  ].join('\n')
}
