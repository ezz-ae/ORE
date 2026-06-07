'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DollarSign, TrendingUp, FileText, CreditCard,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, Calendar, Users, Coins,
} from 'lucide-react'
import { creditPortfolio, CREDIT_VALUE_AED } from '@/src/features/freehold-intelligence/credits'

const STATS = [
  { label: 'Revenue MTD',        value: 'AED 320,000', delta: '+18%',  positive: true,  icon: DollarSign,  sub: 'vs last month AED 310K' },
  { label: 'Commission Earned',  value: 'AED 48,000',  delta: '+12%',  positive: true,  icon: TrendingUp,  sub: '15% avg commission rate' },
  { label: 'Pending Invoices',   value: 'AED 89,000',  delta: '6 open', positive: false, icon: Clock,       sub: '3 overdue by 7+ days' },
  { label: 'Expenses MTD',       value: 'AED 31,000',  delta: '-8%',   positive: true,  icon: CreditCard,  sub: 'vs AED 33.7K last month' },
]

const REVENUE_TREND = [
  { month: 'January 2026',  revenue: 240000, deals: 5,  mom: null },
  { month: 'February 2026', revenue: 265000, deals: 6,  mom: '+10.4%' },
  { month: 'March 2026',    revenue: 298000, deals: 7,  mom: '+12.5%' },
  { month: 'April 2026',    revenue: 275000, deals: 6,  mom: '-7.7%' },
  { month: 'May 2026',      revenue: 310000, deals: 8,  mom: '+12.7%' },
  { month: 'June 2026',     revenue: 320000, deals: 8,  mom: '+3.2%' },
]

type InvoiceStatus = 'paid' | 'pending' | 'overdue'

const INVOICES: {
  id: string; client: string; property: string; amount: number; status: InvoiceStatus; date: string; agent: string
}[] = [
  { id: 'INV-2026-041', client: 'Ahmed Hassan',    property: 'Palm Jumeirah Villa, 4BR',        amount: 18500, status: 'paid',    date: '02 Jun 2026', agent: 'Sara Al Mansoori' },
  { id: 'INV-2026-040', client: 'Priya Nair',      property: 'Downtown Dubai, 2BR Apt',         amount: 9200,  status: 'paid',    date: '01 Jun 2026', agent: 'Khalid Rashid' },
  { id: 'INV-2026-039', client: 'James O\'Brien',  property: 'Dubai Hills Estate, 3BR',         amount: 14800, status: 'pending', date: '30 May 2026', agent: 'Sara Al Mansoori' },
  { id: 'INV-2026-038', client: 'Liu Wei',         property: 'Business Bay Tower, Studio',      amount: 6500,  status: 'pending', date: '29 May 2026', agent: 'Omar Farouq' },
  { id: 'INV-2026-037', client: 'Maria Santos',    property: 'JBR Beachfront, 1BR',             amount: 7800,  status: 'paid',    date: '28 May 2026', agent: 'Aisha Kamal' },
  { id: 'INV-2026-036', client: 'Rashid Al Maktoum', property: 'Emirates Hills Mansion, 6BR',  amount: 42000, status: 'overdue', date: '20 May 2026', agent: 'Khalid Rashid' },
  { id: 'INV-2026-035', client: 'Elena Petrova',   property: 'DIFC Penthouse, 3BR',             amount: 22500, status: 'overdue', date: '15 May 2026', agent: 'Omar Farouq' },
  { id: 'INV-2026-034', client: 'Tariq Bin Zayed', property: 'Jumeirah Golf Estates, 4BR',      amount: 16200, status: 'pending', date: '12 May 2026', agent: 'Sara Al Mansoori' },
  { id: 'INV-2026-033', client: 'Nadia Kowalski',  property: 'Meydan One, 2BR Apt',             amount: 8900,  status: 'paid',    date: '10 May 2026', agent: 'Aisha Kamal' },
  { id: 'INV-2026-032', client: 'Faisal Al Qasim', property: 'Damac Hills Villa, 5BR',          amount: 31000, status: 'paid',    date: '08 May 2026', agent: 'Khalid Rashid' },
]

const COMMISSIONS = [
  { agent: 'Sara Al Mansoori',    deals: 3, revenue: 118500, commission: 17775, rate: '15%', ytd: 89200 },
  { agent: 'Khalid Rashid',       deals: 3, revenue: 89200,  commission: 13380, rate: '15%', ytd: 72400 },
  { agent: 'Omar Farouq',         deals: 2, revenue: 74500,  commission: 11175, rate: '15%', ytd: 56800 },
  { agent: 'Aisha Kamal',         deals: 2, revenue: 52500,  commission: 6300,  rate: '12%', ytd: 41200 },
  { agent: 'Mohammed Al Rashed',  deals: 1, revenue: 31000,  commission: 4650,  rate: '15%', ytd: 38900 },
]

const PIPELINE = [
  { deal: 'Atlantis The Royal Penthouse', client: 'David Chen',      agent: 'Sara Al Mansoori',  value: 520000, expected: '10 Jun 2026', stage: 'Contract Review' },
  { deal: 'Palm Jumeirah Signature Villa', client: 'Omar Bin Laden',  agent: 'Khalid Rashid',    value: 380000, expected: '12 Jun 2026', stage: 'Contract Review' },
  { deal: 'Downtown Dubai 3BR Apt',       client: 'Yuki Tanaka',     agent: 'Omar Farouq',       value: 95000,  expected: '14 Jun 2026', stage: 'Proposal' },
  { deal: 'Dubai Creek Harbour Studio',   client: 'Anna Volkova',    agent: 'Aisha Kamal',       value: 72000,  expected: '18 Jun 2026', stage: 'Proposal' },
  { deal: 'Jumeirah Bay Island Villa',    client: 'Sheikh Hamdan',   agent: 'Sara Al Mansoori',  value: 890000, expected: '25 Jun 2026', stage: 'Qualified' },
]

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid:    'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  overdue: 'bg-red-500/15 text-red-400',
}

const STATUS_ICONS: Record<InvoiceStatus, React.FC<{ className?: string }>> = {
  paid:    CheckCircle2,
  pending: Clock,
  overdue: AlertCircle,
}

function fmtAED(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(2)}M`
  if (n >= 1000)    return `AED ${(n / 1000).toFixed(0)}K`
  return `AED ${n.toLocaleString()}`
}

export default function FinancePage() {
  const [sortCol, setSortCol] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const maxRev = Math.max(...REVENUE_TREND.map(r => r.revenue))

  return (
    <div className="min-h-screen pb-16 bg-[#0D1117]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#090C12]/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Finance Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-500">June 2026 · Revenue, Commissions & Invoices</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">June 2026</span>
            </div>
            <button className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-sm font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors">
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
                  <stat.icon className="h-4 w-4 text-slate-400" />
                </div>
                <span className={[
                  'flex items-center gap-0.5 text-xs font-semibold',
                  stat.positive ? 'text-emerald-400' : 'text-amber-400',
                ].join(' ')}>
                  {stat.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.delta}
                </span>
              </div>
              <p className="text-2xl font-semibold text-white tabular-nums tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-400">{stat.label}</p>
              <p className="mt-0.5 text-xs text-slate-600">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Broker Ad-Credit Investment */}
        {(() => {
          const cp = creditPortfolio()
          const netReturn = cp.revenue - cp.investedAed
          return (
            <div className="rounded-xl border border-[#D4AF37]/20 bg-slate-900">
              <div className="flex items-center justify-between border-b border-[#D4AF37]/15 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                    <Coins className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Broker Ad-Credit Investment</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{cp.brokers} brokers · self-served AI ads · 1 credit = AED {CREDIT_VALUE_AED}</p>
                  </div>
                </div>
                <Link href="/freehold-intelligence/management/credits" className="flex items-center gap-1 text-xs font-medium text-[#D4AF37] hover:opacity-80 transition-opacity">
                  Manage credits <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 xl:grid-cols-5">
                <div>
                  <p className="text-xs text-slate-500">Credits funded</p>
                  <p className="mt-1 text-xl font-semibold text-white tabular-nums">{cp.allocated.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-slate-600">AED {(cp.allocated * CREDIT_VALUE_AED).toLocaleString()} equiv.</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ad investment to date</p>
                  <p className="mt-1 text-xl font-semibold text-white tabular-nums">AED {cp.investedAed.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{cp.spent.toLocaleString()} credits spent</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Revenue attributed</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-400 tabular-nums">AED {cp.revenue.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{cp.deals} deals · {cp.leads} leads</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Blended ROI</p>
                  <p className="mt-1 text-xl font-semibold text-[#D4AF37] tabular-nums">{cp.blendedRoi.toFixed(1)}×</p>
                  <p className="mt-0.5 text-xs text-slate-600">{cp.blendedRoiPct.toFixed(0)}% return</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Net return</p>
                  <p className={[
                    'mt-1 text-xl font-semibold tabular-nums',
                    netReturn >= 0 ? 'text-emerald-400' : 'text-red-400',
                  ].join(' ')}>
                    {netReturn >= 0 ? '+' : '−'}AED {Math.abs(netReturn).toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">revenue − investment</p>
                </div>
              </div>
              <div className="border-t border-slate-800 px-5 py-3">
                <p className="text-xs text-slate-400">
                  <span className="text-[#D4AF37]">AI recommends</span> {cp.recommendedNextCycle.toLocaleString()} credits next cycle
                  <span className="text-slate-600"> · AED {(cp.recommendedNextCycle * CREDIT_VALUE_AED).toLocaleString()}</span>
                </p>
              </div>
            </div>
          )
        })()}

        <div className="grid gap-6 xl:grid-cols-5">

          {/* Revenue Trend */}
          <div className="xl:col-span-3 rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Revenue Trend</h2>
                <p className="text-xs text-slate-500 mt-0.5">Last 6 months — AED</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">6-Month Total</p>
                <p className="text-sm font-semibold text-white">AED 1.708M</p>
              </div>
            </div>
            <div className="p-5">
              {/* Bar chart representation */}
              <div className="space-y-3 mb-5">
                {REVENUE_TREND.map((row) => (
                  <div key={row.month} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-slate-400">{row.month.split(' ')[0]}</span>
                    <div className="flex-1 h-6 bg-slate-800 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${(row.revenue / maxRev) * 100}%`,
                          background: row.month.startsWith('June')
                            ? 'linear-gradient(90deg, #D4AF37 0%, #f0c94a 100%)'
                            : 'linear-gradient(90deg, #1e3a5f 0%, #2563eb40 100%)',
                        }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs font-semibold text-white tabular-nums">
                      {fmtAED(row.revenue)}
                    </span>
                    <span className={[
                      'w-14 text-right text-xs font-medium',
                      row.mom === null ? 'text-slate-600' :
                      row.mom?.startsWith('-') ? 'text-red-400' : 'text-emerald-400',
                    ].join(' ')}>
                      {row.mom ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
              {/* Table */}
              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/40">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Month</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Deals</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">MoM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {REVENUE_TREND.map((row) => (
                      <tr key={row.month} className={row.month.startsWith('June') ? 'bg-[#D4AF37]/5' : 'hover:bg-slate-800/30'}>
                        <td className="px-4 py-2.5 text-sm text-slate-300 font-medium">
                          {row.month}
                          {row.month.startsWith('June') && (
                            <span className="ml-2 text-xs text-[#D4AF37] font-semibold">Current</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-white tabular-nums">
                          {fmtAED(row.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-slate-400 tabular-nums">{row.deals}</td>
                        <td className={[
                          'px-4 py-2.5 text-right text-xs font-medium tabular-nums',
                          row.mom === null ? 'text-slate-600' :
                          row.mom.startsWith('-') ? 'text-red-400' : 'text-emerald-400',
                        ].join(' ')}>
                          {row.mom ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Month-over-Month Comparison + Payment Pipeline */}
          <div className="xl:col-span-2 space-y-6">

            {/* MoM Comparison Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-white">Month-over-Month</h2>
                <p className="text-xs text-slate-500 mt-0.5">June vs May 2026</p>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { label: 'Revenue',         jun: 320000, may: 310000 },
                  { label: 'Commission',      jun: 48000,  may: 43000 },
                  { label: 'Expenses',        jun: 31000,  may: 33700 },
                  { label: 'Net Income',      jun: 289000, may: 276300 },
                ].map((row) => {
                  const change = ((row.jun - row.may) / row.may * 100).toFixed(1)
                  const positive = row.jun >= row.may
                  const isExpense = row.label === 'Expenses'
                  const good = isExpense ? !positive : positive
                  return (
                    <div key={row.label} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-400 w-24">{row.label}</span>
                      <div className="flex-1 text-right">
                        <span className="text-sm font-semibold text-white tabular-nums">{fmtAED(row.jun)}</span>
                      </div>
                      <div className="flex items-center gap-1 w-16 justify-end">
                        {good
                          ? <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                          : <ArrowDownRight className="h-3 w-3 text-red-400" />}
                        <span className={['text-xs font-semibold tabular-nums', good ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
                          {good ? '+' : ''}{change}%
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <p className="text-xs text-emerald-400 font-medium">Net income up AED 12,700 (+4.6%) vs May</p>
                  <p className="text-xs text-slate-500 mt-0.5">Best performing month since Q1 2026</p>
                </div>
              </div>
            </div>

            {/* Payment Pipeline */}
            <div className="rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-white">Payment Pipeline</h2>
                <p className="text-xs text-slate-500 mt-0.5">Deals closing soon — expected revenue</p>
              </div>
              <div className="divide-y divide-slate-800">
                {PIPELINE.map((deal) => (
                  <div key={deal.deal} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-100 leading-snug">{deal.deal}</p>
                      <span className="shrink-0 text-sm font-semibold text-white tabular-nums">{fmtAED(deal.value)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{deal.agent}</span>
                        <span className="text-slate-700">·</span>
                        <span className={[
                          'text-xs font-medium px-1.5 py-0.5 rounded-full',
                          deal.stage === 'Contract Review' ? 'bg-violet-500/15 text-violet-400' :
                          deal.stage === 'Proposal' ? 'bg-sky-500/15 text-sky-400' :
                          'bg-amber-500/15 text-amber-400',
                        ].join(' ')}>{deal.stage}</span>
                      </div>
                      <span className="text-xs text-slate-500">{deal.expected}</span>
                    </div>
                  </div>
                ))}
                <div className="px-5 py-3 bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Expected</span>
                    <span className="text-sm font-semibold text-[#D4AF37] tabular-nums">
                      {fmtAED(PIPELINE.reduce((s, d) => s + d.value, 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Invoice Register</h2>
              <p className="text-xs text-slate-500 mt-0.5">{INVOICES.length} invoices · May–June 2026</p>
            </div>
            <div className="flex items-center gap-2">
              {(['paid', 'pending', 'overdue'] as InvoiceStatus[]).map(s => (
                <span key={s} className={['rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[s]].join(' ')}>
                  {INVOICES.filter(i => i.status === s).length} {s}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  {[
                    { key: 'id',     label: 'Invoice #' },
                    { key: 'client', label: 'Client' },
                    { key: 'property', label: 'Property' },
                    { key: 'agent',  label: 'Agent' },
                    { key: 'amount', label: 'Amount' },
                    { key: 'status', label: 'Status' },
                    { key: 'date',   label: 'Date' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors select-none"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key
                          ? sortDir === 'asc'
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />
                          : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {INVOICES.map((inv) => {
                  const Icon = STATUS_ICONS[inv.status]
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{inv.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-100">{inv.client}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-[220px] truncate">{inv.property}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{inv.agent}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-white tabular-nums whitespace-nowrap">
                        AED {inv.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={['flex items-center gap-1.5 w-fit rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[inv.status]].join(' ')}>
                          <Icon className="h-3 w-3" />
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{inv.date}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/40">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total ({INVOICES.length} invoices)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-white tabular-nums">
                    AED {INVOICES.reduce((s, i) => s + i.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Commission Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Commission Breakdown — Per Agent</h2>
              <p className="text-xs text-slate-500 mt-0.5">June 2026 — Year-to-date included</p>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-400">{COMMISSIONS.length} agents</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  {['Agent', 'Deals Closed', 'Revenue Generated', 'Commission Rate', 'Commission MTD', 'YTD Commission'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {COMMISSIONS.sort((a, b) => b.commission - a.commission).map((row, idx) => (
                  <tr key={row.agent} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={[
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          idx === 0 ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-slate-800 text-slate-400',
                        ].join(' ')}>
                          {idx + 1}
                        </div>
                        <span className="text-sm font-medium text-slate-100">{row.agent}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{row.deals}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white tabular-nums">AED {row.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-300">{row.rate}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#D4AF37] tabular-nums">AED {row.commission.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">AED {row.ytd.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-800/40">
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-white tabular-nums">
                    AED {COMMISSIONS.reduce((s, r) => s + r.revenue, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-sm font-bold text-[#D4AF37] tabular-nums">
                    AED {COMMISSIONS.reduce((s, r) => s + r.commission, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-300 tabular-nums">
                    AED {COMMISSIONS.reduce((s, r) => s + r.ytd, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
