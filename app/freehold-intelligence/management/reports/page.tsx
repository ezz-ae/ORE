'use client'

import { useState } from 'react'
import {
  FileBarChart2, Sparkles, Download, Eye, AlertTriangle,
  CheckCircle2, TrendingUp, Calendar, Clock, ChevronDown,
  FileText, Users, Megaphone, DollarSign, ArrowUpRight, Zap,
} from 'lucide-react'

const TOP_EVENTS = [
  { rank: 1,  type: 'deal',     icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/15', text: 'Sara Al Mansoori closed Palm Jumeirah Villa deal — AED 4.2M commission AED 63K' },
  { rank: 2,  type: 'lead',     icon: TrendingUp,    color: 'text-sky-400 bg-sky-500/15',         text: 'Meta CPL hit all-time low of AED 32 — 68 new leads in 24 hours from Dubai Hills campaign' },
  { rank: 3,  type: 'finance',  icon: DollarSign,    color: 'text-[#D4AF37] bg-[#D4AF37]/15',    text: 'Monthly revenue target of AED 300K exceeded — current MTD AED 320K (+6.7% above target)' },
  { rank: 4,  type: 'deal',     icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/15', text: 'Khalid Rashid progressed 2 deals to Contract Review stage — combined value AED 8M' },
  { rank: 5,  type: 'warning',  icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/15',     text: 'Tariq Bin Zayed deal (AED 4.2M) at risk — 12 days without agent follow-up action required' },
  { rank: 6,  type: 'ads',      icon: Megaphone,     color: 'text-violet-400 bg-violet-500/15',   text: 'Google Ads CTR dropped 15% week-over-week — "Palm Q3" campaign underperforming, review keywords' },
  { rank: 7,  type: 'team',     icon: Users,         color: 'text-indigo-400 bg-indigo-500/15',   text: '7 of 12 agents logged in before 9AM — team engagement highest since January 2026' },
  { rank: 8,  type: 'deal',     icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/15', text: 'Ahmed Hassan signed MOU for Downtown Dubai 3BR — deal value AED 950K, expected close June 14' },
  { rank: 9,  type: 'finance',  icon: DollarSign,    color: 'text-[#D4AF37] bg-[#D4AF37]/15',    text: '3 invoices overdue — total AED 64,500 outstanding. Emirates Hills and DIFC deals flagged for follow-up' },
  { rank: 10, type: 'ads',      icon: Megaphone,     color: 'text-violet-400 bg-violet-500/15',   text: 'WhatsApp broadcast to 148 warm leads generated 18 deal conversions — highest ROI channel at 1,200%' },
]

const WEEKLY_SUMMARY = {
  leads:   { value: 142,   delta: '+18%', positive: true },
  deals:   { value: 5,     delta: '+2',   positive: true },
  revenue: { value: 'AED 320K', delta: '+3.2%', positive: true },
  spend:   { value: 'AED 18.4K', delta: '-4%', positive: true },
  cpl:     { value: 'AED 38', delta: '-11%', positive: true },
  roi:     { value: '835%', delta: '+8%', positive: true },
}

type ReportStatus = 'ready' | 'generating' | 'scheduled'

const AUTOMATED_REPORTS = [
  { id: 1, name: 'Weekly Performance Report',   icon: FileBarChart2, desc: 'Leads, deals, revenue & agent activity',   lastGenerated: '02 Jun 2026', schedule: 'Every Monday' },
  { id: 2, name: 'Monthly Revenue Report',      icon: DollarSign,    desc: 'Full financial breakdown with invoices',    lastGenerated: '01 Jun 2026', schedule: '1st of month' },
  { id: 3, name: 'Campaign Analysis Report',    icon: Megaphone,     desc: 'Ad spend, ROI, CAC per channel',           lastGenerated: '01 Jun 2026', schedule: 'Every Monday' },
  { id: 4, name: 'Team Productivity Report',    icon: Users,         desc: 'Agent KPIs, deal activity, response time', lastGenerated: '02 Jun 2026', schedule: 'Every Monday' },
]

const AI_INSIGHTS = [
  {
    type: 'opportunity',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/20',
    title: 'Opportunity: Scale WhatsApp',
    body: 'WhatsApp is generating 1,200% ROI with only AED 130K spend. Increasing budget by AED 25K/month could generate an additional AED 300K in monthly revenue based on current conversion rates.',
    action: 'View WhatsApp Analytics',
  },
  {
    type: 'warning',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/20',
    title: 'Warning: 4 Stalled Deals',
    body: 'Four deals worth a combined AED 11.9M have had no activity in 7+ days. Based on historical data, deals inactive for 14+ days have a 68% lower close rate. Immediate agent intervention recommended.',
    action: 'Review At-Risk Deals',
  },
  {
    type: 'success',
    icon: CheckCircle2,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/5',
    borderColor: 'border-sky-500/20',
    title: 'Success: Best Q2 Revenue',
    body: "June 2026 is on track to be your best month since the company's founding. Revenue MTD AED 320K with 10 business days remaining. Full-month projection: AED 390K — 30% above Q2 average.",
    action: 'View Finance Dashboard',
  },
]

const REPORT_HISTORY: { id: string; type: string; date: string; status: ReportStatus; size: string; generatedBy: string }[] = [
  { id: 'RPT-2026-088', type: 'Weekly Performance',    date: '02 Jun 2026 09:00', status: 'ready',     size: '2.4 MB', generatedBy: 'Automated' },
  { id: 'RPT-2026-087', type: 'Campaign Analysis',     date: '02 Jun 2026 09:00', status: 'ready',     size: '1.8 MB', generatedBy: 'Automated' },
  { id: 'RPT-2026-086', type: 'Monthly Revenue',       date: '01 Jun 2026 00:01', status: 'ready',     size: '3.1 MB', generatedBy: 'Automated' },
  { id: 'RPT-2026-085', type: 'Team Productivity',     date: '26 May 2026 09:00', status: 'ready',     size: '1.2 MB', generatedBy: 'Automated' },
  { id: 'RPT-2026-084', type: 'Weekly Performance',    date: '26 May 2026 09:00', status: 'ready',     size: '2.3 MB', generatedBy: 'Automated' },
  { id: 'RPT-2026-083', type: 'Custom ROI Analysis',   date: '24 May 2026 14:32', status: 'ready',     size: '4.7 MB', generatedBy: 'M. Ezz' },
  { id: 'RPT-2026-082', type: 'Monthly Revenue',       date: '01 May 2026 00:01', status: 'ready',     size: '2.9 MB', generatedBy: 'Automated' },
  { id: 'RPT-2026-081', type: 'Campaign Analysis',     date: '28 Apr 2026 09:00', status: 'ready',     size: '1.6 MB', generatedBy: 'Automated' },
]

const STATUS_STYLES: Record<ReportStatus, string> = {
  ready:      'bg-emerald-500/15 text-emerald-400',
  generating: 'bg-amber-500/15 text-amber-400',
  scheduled:  'bg-slate-700/60 text-slate-400',
}

const REPORT_TYPES = [
  'Weekly Performance Report',
  'Monthly Revenue Report',
  'Campaign ROI Analysis',
  'Team Productivity Report',
  'Deal Pipeline Report',
  'Custom Date Range Report',
  'Agent Performance Report',
  'Market Trends Report',
]

export default function ReportsPage() {
  const [reportType, setReportType] = useState(REPORT_TYPES[0])
  const [dateFrom,   setDateFrom]   = useState('2026-06-01')
  const [dateTo,     setDateTo]     = useState('2026-06-06')
  const [generating, setGenerating] = useState(false)
  const [generated,  setGenerated]  = useState(false)

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setGenerated(false)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 2200)
  }

  return (
    <div className="min-h-screen pb-16 bg-[#0D1117]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#090C12]/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Smart Reports</h1>
            <p className="mt-0.5 text-sm text-slate-500">Executive intelligence · AI-powered insights · June 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span className="text-xs font-medium text-[#D4AF37]">AI-Powered</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Top Events This Week */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Top Events This Week</h2>
              <p className="text-xs text-slate-500">AI-curated — 10 most important things that happened</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-500">Updated 6 Jun 2026, 09:00 AM</span>
            </div>
          </div>
          <div className="divide-y divide-slate-800">
            {TOP_EVENTS.map((ev) => {
              const Icon = ev.icon
              return (
                <div key={ev.rank} className="flex items-start gap-4 px-5 py-3.5">
                  <span className="shrink-0 w-5 text-xs font-bold text-slate-600 mt-0.5">{ev.rank}.</span>
                  <div className={['flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', ev.color].join(' ')}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed flex-1">{ev.text}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Weekly Summary Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Weekly Summary</h2>
            <p className="text-xs text-slate-500 mt-0.5">Week of 2–6 June 2026 · Key metrics at a glance</p>
          </div>
          <div className="grid grid-cols-2 gap-0 divide-y divide-slate-800 md:grid-cols-3 md:divide-y-0 xl:grid-cols-6">
            {[
              { label: 'New Leads',       ...WEEKLY_SUMMARY.leads,   icon: TrendingUp,    unit: '' },
              { label: 'Deals Closed',    ...WEEKLY_SUMMARY.deals,   icon: CheckCircle2,  unit: '' },
              { label: 'Revenue MTD',     ...WEEKLY_SUMMARY.revenue, icon: DollarSign,    unit: '' },
              { label: 'Total Ad Spend',  ...WEEKLY_SUMMARY.spend,   icon: Megaphone,     unit: '' },
              { label: 'Cost per Lead',   ...WEEKLY_SUMMARY.cpl,     icon: Users,         unit: '' },
              { label: 'Marketing ROI',   ...WEEKLY_SUMMARY.roi,     icon: ArrowUpRight,  unit: '' },
            ].map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className={[
                    'p-5',
                    idx < 5 ? 'xl:border-r xl:border-slate-800' : '',
                    idx % 2 === 0 && idx < 4 ? 'border-r border-slate-800 md:border-r-0' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500">{item.label}</span>
                  </div>
                  <p className="text-xl font-bold text-white tabular-nums">{item.value}</p>
                  <p className={['text-xs font-semibold mt-0.5', item.positive ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
                    {item.delta} vs last week
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* AI Insight Cards */}
        <div className="grid gap-4 xl:grid-cols-3">
          {AI_INSIGHTS.map((insight) => {
            const Icon = insight.icon
            return (
              <div key={insight.title} className={['rounded-xl border p-5', insight.bgColor, insight.borderColor].join(' ')}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/60', insight.color].join(' ')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className={['text-sm font-semibold', insight.color].join(' ')}>{insight.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">AI Generated · June 2026</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{insight.body}</p>
                <button className={[
                  'text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-80',
                  insight.color,
                ].join(' ')}>
                  {insight.action} <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">

          {/* Automated Reports */}
          <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Automated Reports</h2>
              <p className="text-xs text-slate-500 mt-0.5">Scheduled reports — download or view online</p>
            </div>
            <div className="divide-y divide-slate-800">
              {AUTOMATED_REPORTS.map((report) => {
                const Icon = report.icon
                return (
                  <div key={report.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100">{report.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{report.desc}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Clock className="h-3 w-3" /> {report.schedule}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Calendar className="h-3 w-3" /> Last: {report.lastGenerated}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white transition-colors">
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors">
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Generate New Report */}
          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#D4AF37]" />
                <h2 className="text-sm font-semibold text-white">Generate New Report</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Custom date range · instant generation</p>
            </div>
            <form onSubmit={handleGenerate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Report Type
                </label>
                <div className="relative">
                  <select
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]/40 pr-8"
                  >
                    {REPORT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">From</p>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/40"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">To</p>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]/40"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['PDF', 'Excel', 'CSV'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      className={[
                        'rounded-lg border py-2 text-xs font-medium transition-colors',
                        fmt === 'PDF'
                          ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]'
                          : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200',
                      ].join(' ')}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={generating}
                className={[
                  'w-full rounded-lg py-2.5 text-sm font-semibold transition-all',
                  generating
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-[#D4AF37] text-[#0D1117] hover:opacity-90',
                ].join(' ')}
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" />
                    Generating…
                  </span>
                ) : 'Generate Report'}
              </button>

              {generated && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Report Ready</p>
                    <p className="text-xs text-slate-500">Your report has been generated successfully</p>
                  </div>
                  <button className="ml-auto flex items-center gap-1 text-xs font-medium text-[#D4AF37] hover:opacity-80 transition-opacity">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Report History */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Report History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Last {REPORT_HISTORY.length} generated reports</p>
            </div>
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  {['Report ID', 'Report Type', 'Generated', 'Generated By', 'Size', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {REPORT_HISTORY.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{report.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100 whitespace-nowrap">{report.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{report.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{report.generatedBy}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{report.size}</td>
                    <td className="px-4 py-3">
                      <span className={['rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[report.status]].join(' ')}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <span className="text-slate-700">·</span>
                        <button className="flex items-center gap-1 text-xs font-medium text-[#D4AF37] hover:opacity-80 transition-opacity">
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
