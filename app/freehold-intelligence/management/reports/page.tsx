'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  FileBarChart2, Sparkles, Download, Eye, AlertTriangle,
  CheckCircle2, TrendingUp, Calendar, Clock, ChevronDown,
  FileText, Users, Megaphone, DollarSign, ArrowUpRight, Zap,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const TOP_EVENTS = [
  { rank: 1,  type: 'deal',     icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/15', text: 'Sara Al Mansoori closed Palm Jumeirah Villa deal — AED 4.2M commission AED 63K' },
  { rank: 2,  type: 'lead',     icon: TrendingUp,    color: 'text-teal-400 bg-teal-500/15',         text: 'Meta CPL hit all-time low of AED 32 — 68 new leads in 24 hours from Dubai Hills campaign' },
  { rank: 3,  type: 'finance',  icon: DollarSign,    color: 'text-gold bg-gold/15',    text: 'Monthly revenue target of AED 300K exceeded — current MTD AED 320K (+6.7% above target)' },
  { rank: 4,  type: 'deal',     icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/15', text: 'Khalid Rashid progressed 2 deals to Contract Review stage — combined value AED 8M' },
  { rank: 5,  type: 'warning',  icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/15',     text: 'Tariq Bin Zayed deal (AED 4.2M) at risk — 12 days without agent follow-up action required' },
  { rank: 6,  type: 'ads',      icon: Megaphone,     color: 'text-violet-400 bg-violet-500/15',   text: 'Google Ads CTR dropped 15% week-over-week — "Palm Q3" campaign underperforming, review keywords' },
  { rank: 7,  type: 'team',     icon: Users,         color: 'text-indigo-400 bg-indigo-500/15',   text: '7 of 12 agents logged in before 9AM — team engagement highest since January 2026' },
  { rank: 8,  type: 'deal',     icon: CheckCircle2,  color: 'text-emerald-400 bg-emerald-500/15', text: 'Ahmed Hassan signed MOU for Downtown Dubai 3BR — deal value AED 950K, expected close June 14' },
  { rank: 9,  type: 'finance',  icon: DollarSign,    color: 'text-gold bg-gold/15',    text: '3 invoices overdue — total AED 64,500 outstanding. Emirates Hills and DIFC deals flagged for follow-up' },
  { rank: 10, type: 'ads',      icon: Megaphone,     color: 'text-violet-400 bg-violet-500/15',   text: 'WhatsApp broadcast to 148 warm leads generated 18 deal conversions — highest ROI channel at 1,200%' },
]

function fmtAedShort(n: number): string {
  if (!n || n <= 0) return 'AED 0'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

type SummaryMetric = { value: string }
const ZERO_SUMMARY: Record<'leads' | 'deals' | 'revenue' | 'spend' | 'cpl' | 'roi', SummaryMetric> = {
  leads: { value: '0' }, deals: { value: '0' }, revenue: { value: 'AED 0' },
  spend: { value: 'AED 0' }, cpl: { value: 'AED 0' }, roi: { value: '—' },
}

type ReportStatus = 'ready' | 'generating' | 'scheduled'

const AUTOMATED_REPORTS = [
  { id: 1, nameKey: 'mgmt.reports.rpt.weeklyName',   icon: FileBarChart2, descKey: 'mgmt.reports.rpt.weeklyDesc',   lastGenerated: '02 Jun 2026', scheduleKey: 'mgmt.reports.everyMonday' },
  { id: 2, nameKey: 'mgmt.reports.rpt.monthlyName',  icon: DollarSign,    descKey: 'mgmt.reports.rpt.monthlyDesc',  lastGenerated: '01 Jun 2026', scheduleKey: 'mgmt.reports.firstOfMonth' },
  { id: 3, nameKey: 'mgmt.reports.rpt.campaignName', icon: Megaphone,     descKey: 'mgmt.reports.rpt.campaignDesc', lastGenerated: '01 Jun 2026', scheduleKey: 'mgmt.reports.everyMonday' },
  { id: 4, nameKey: 'mgmt.reports.rpt.teamName',     icon: Users,         descKey: 'mgmt.reports.rpt.teamDesc',     lastGenerated: '02 Jun 2026', scheduleKey: 'mgmt.reports.everyMonday' },
]

const AI_INSIGHTS = [
  {
    type: 'opportunity',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/20',
    titleKey: 'mgmt.reports.insight.oppTitle',
    bodyKey: 'mgmt.reports.insight.oppBody',
    actionKey: 'mgmt.reports.insight.oppAction',
    href: '/freehold-intelligence/analytics',
  },
  {
    type: 'warning',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/20',
    titleKey: 'mgmt.reports.insight.warnTitle',
    bodyKey: 'mgmt.reports.insight.warnBody',
    actionKey: 'mgmt.reports.insight.warnAction',
    href: '/freehold-intelligence/management/deals',
  },
  {
    type: 'success',
    icon: CheckCircle2,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/5',
    borderColor: 'border-teal-500/20',
    titleKey: 'mgmt.reports.insight.successTitle',
    bodyKey: 'mgmt.reports.insight.successBody',
    actionKey: 'mgmt.reports.insight.successAction',
    href: '/freehold-intelligence/finance',
  },
]

const REPORT_HISTORY: { id: string; typeKey: string; date: string; status: ReportStatus; size: string; generatedBy: string | null }[] = [
  { id: 'RPT-2026-088', typeKey: 'mgmt.reports.histType.weeklyPerf',       date: '02 Jun 2026 09:00', status: 'ready',     size: '2.4 MB', generatedBy: null },
  { id: 'RPT-2026-087', typeKey: 'mgmt.reports.histType.campaignAnalysis', date: '02 Jun 2026 09:00', status: 'ready',     size: '1.8 MB', generatedBy: null },
  { id: 'RPT-2026-086', typeKey: 'mgmt.reports.histType.monthlyRevenue',   date: '01 Jun 2026 00:01', status: 'ready',     size: '3.1 MB', generatedBy: null },
  { id: 'RPT-2026-085', typeKey: 'mgmt.reports.histType.teamProd',         date: '26 May 2026 09:00', status: 'ready',     size: '1.2 MB', generatedBy: null },
  { id: 'RPT-2026-084', typeKey: 'mgmt.reports.histType.weeklyPerf',       date: '26 May 2026 09:00', status: 'ready',     size: '2.3 MB', generatedBy: null },
  { id: 'RPT-2026-083', typeKey: 'mgmt.reports.histType.customRoi',        date: '24 May 2026 14:32', status: 'ready',     size: '4.7 MB', generatedBy: 'M. Ezz' },
  { id: 'RPT-2026-082', typeKey: 'mgmt.reports.histType.monthlyRevenue',   date: '01 May 2026 00:01', status: 'ready',     size: '2.9 MB', generatedBy: null },
  { id: 'RPT-2026-081', typeKey: 'mgmt.reports.histType.campaignAnalysis', date: '28 Apr 2026 09:00', status: 'ready',     size: '1.6 MB', generatedBy: null },
]

const STATUS_STYLES: Record<ReportStatus, string> = {
  ready:      'bg-emerald-500/15 text-emerald-400',
  generating: 'bg-amber-500/15 text-amber-400',
  scheduled:  'bg-surface-3 text-slate-400',
}

const REPORT_TYPES: { value: string; labelKey: string }[] = [
  { value: 'Weekly Performance Report',  labelKey: 'mgmt.reports.type.weekly' },
  { value: 'Monthly Revenue Report',     labelKey: 'mgmt.reports.type.monthly' },
  { value: 'Campaign ROI Analysis',      labelKey: 'mgmt.reports.type.campaignRoi' },
  { value: 'Team Productivity Report',   labelKey: 'mgmt.reports.type.teamProd' },
  { value: 'Deal Pipeline Report',       labelKey: 'mgmt.reports.type.pipeline' },
  { value: 'Custom Date Range Report',   labelKey: 'mgmt.reports.type.customRange' },
  { value: 'Agent Performance Report',   labelKey: 'mgmt.reports.type.agentPerf' },
  { value: 'Market Trends Report',       labelKey: 'mgmt.reports.type.marketTrends' },
]

interface Analytics {
  ytd: { salesAed: number; commissionAed: number; deals: number; leads: number; costPerLeadAed: number }
  monthlyDeals: { month: string; sales: number; commission: number; deals: number }[]
  monthlyLeads: { month: string; leads: number }[]
  leadsBySource: { source: string; leads: number; closed: number; conversionPct: number }[]
  expensesByCategory: Record<string, number>
  conversion: { totalLeads: number; closedDeals: number; conversionPct: number }
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const t = useT()
  const [reportType, setReportType] = useState(REPORT_TYPES[0].value)
  const [dateFrom,   setDateFrom]   = useState('2026-06-01')
  const [dateTo,     setDateTo]     = useState('2026-06-06')
  const [generating, setGenerating] = useState(false)
  const [generated,  setGenerated]  = useState(false)
  const [format,     setFormat]     = useState('CSV')
  const [analytics,  setAnalytics]  = useState<Analytics | null>(null)
  const [summary,    setSummary]    = useState(ZERO_SUMMARY)

  useEffect(() => {
    fetch('/api/freehold/management/analytics', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: Analytics | null) => {
        if (!d) return
        setAnalytics(d)
        const adSpend = d.expensesByCategory?.ad_spend || 0
        const roi = adSpend > 0 ? Math.round((d.ytd.commissionAed / adSpend) * 100) : 0
        setSummary({
          leads:   { value: String(d.ytd.leads) },
          deals:   { value: String(d.ytd.deals) },
          revenue: { value: fmtAedShort(d.ytd.commissionAed) },
          spend:   { value: fmtAedShort(adSpend) },
          cpl:     { value: d.ytd.costPerLeadAed > 0 ? `AED ${d.ytd.costPerLeadAed}` : '—' },
          roi:     { value: roi > 0 ? `${roi}%` : '—' },
        })
      })
      .catch(() => {})
  }, [])

  function buildReportRows(): (string | number)[][] {
    const a = analytics
    const rows: (string | number)[][] = [["Freehold Property UAE — " + reportType], ["Generated", new Date().toISOString()], [""]]
    if (a) {
      rows.push(["YTD Summary"], ["Leads", a.ytd.leads], ["Deals closed", a.ytd.deals], ["Sales value (AED)", Math.round(a.ytd.salesAed)], ["Commission (AED)", Math.round(a.ytd.commissionAed)], ["Conversion %", a.conversion.conversionPct], [""])
      rows.push(["Monthly deals"], ["Month", "Deals", "Sales AED", "Commission AED"])
      a.monthlyDeals.forEach((m) => rows.push([m.month, m.deals, Math.round(m.sales), Math.round(m.commission)]))
      rows.push([""], ["Leads by source"], ["Source", "Leads", "Closed", "Conversion %"])
      a.leadsBySource.forEach((s) => rows.push([s.source, s.leads, s.closed, s.conversionPct]))
    } else {
      rows.push(["No data available yet."])
    }
    return rows
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setGenerated(false)
    // Build a real export from live analytics.
    setTimeout(() => {
      downloadCsv(`${reportType.replace(/\s+/g, '-').toLowerCase()}-${dateFrom}_to_${dateTo}.csv`, buildReportRows())
      setGenerating(false)
      setGenerated(true)
      toast.success(t('mgmt.reports.generatedToast'))
    }, 300)
  }

  return (
    <div className="min-h-screen pb-16 bg-ink">
      {/* Header */}
      <div className="border-b border-line bg-app/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">{t('mgmt.reports.title')}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{t('mgmt.reports.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span className="text-xs font-medium text-gold">{t('mgmt.reports.aiPowered')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">

        {/* Generate & export reports — the management dashboard (ROI tab) and
            Events tab own the live numbers; this page is the report builder, so
            it no longer re-renders those summaries. */}

        <div className="grid gap-6 xl:grid-cols-3">

          {/* Automated Reports */}
          <div className="xl:col-span-2 rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-white">{t('mgmt.reports.automated')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('mgmt.reports.automatedHint')}</p>
            </div>
            <div className="divide-y divide-line">
              {AUTOMATED_REPORTS.map((report) => {
                const Icon = report.icon
                return (
                  <div key={report.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100">{t(report.nameKey)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t(report.descKey)}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Clock className="h-3 w-3" /> {t(report.scheduleKey)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Calendar className="h-3 w-3" /> {t('mgmt.reports.lastLabel', { date: report.lastGenerated })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { downloadCsv(`${t(report.nameKey).replace(/\s+/g, '-').toLowerCase()}.csv`, buildReportRows()); toast.success(t('mgmt.reports.downloaded', { name: t(report.nameKey) })) }}
                        className="flex items-center gap-1.5 rounded-lg border border-gold/25 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/20 transition-colors">
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Generate New Report */}
          <div className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-semibold text-white">{t('mgmt.reports.generateNew')}</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{t('mgmt.reports.generateHint')}</p>
            </div>
            <form onSubmit={handleGenerate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('mgmt.reports.reportType')}
                </label>
                <div className="relative">
                  <select
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40 pr-8"
                  >
                    {REPORT_TYPES.map(rt => (
                      <option key={rt.value} value={rt.value}>{t(rt.labelKey)}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('mgmt.reports.dateRange')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">{t('mgmt.reports.from')}</p>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">{t('mgmt.reports.to')}</p>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('mgmt.reports.format')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['PDF', 'Excel', 'CSV'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={[
                        'rounded-lg border py-2 text-xs font-medium transition-colors',
                        fmt === format
                          ? 'border-gold/30 bg-gold/10 text-gold'
                          : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200',
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
                    ? 'bg-surface-3 text-slate-400 cursor-not-allowed'
                    : 'bg-gold text-ink hover:opacity-90',
                ].join(' ')}
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" />
                    {t('mgmt.reports.generating')}
                  </span>
                ) : t('mgmt.reports.generate')}
              </button>

              {generated && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">{t('mgmt.reports.reportReady')}</p>
                    <p className="text-xs text-slate-500">{t('mgmt.reports.reportReadyHint')}</p>
                  </div>
                  <button
                    onClick={() => { downloadCsv(`${reportType.replace(/\s+/g, '-').toLowerCase()}.csv`, buildReportRows()); toast.success(t('mgmt.reports.downloadedToast')) }}
                    className="ml-auto flex items-center gap-1 text-xs font-medium text-gold hover:opacity-80 transition-opacity">
                    <Download className="h-3.5 w-3.5" />
                    {t('mgmt.reports.download')}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Report History */}
        <div className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">{t('mgmt.reports.history')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('mgmt.reports.historyHint', { count: REPORT_HISTORY.length })}</p>
            </div>
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  {['mgmt.reports.col.reportId', 'mgmt.reports.col.reportType', 'mgmt.reports.col.generated', 'mgmt.reports.col.generatedBy', 'mgmt.reports.col.size', 'mgmt.reports.col.status', 'mgmt.reports.col.actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {REPORT_HISTORY.map((report) => (
                  <tr key={report.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{report.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100 whitespace-nowrap">{t(report.typeKey)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{report.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{report.generatedBy ?? t('mgmt.reports.automatedBy')}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{report.size}</td>
                    <td className="px-4 py-3">
                      <span className={['rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[report.status]].join(' ')}>
                        {t(`mgmt.reports.status.${report.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { downloadCsv(`${report.id}.csv`, buildReportRows()); toast.success(t('mgmt.reports.idDownloaded', { id: report.id })) }}
                          className="flex items-center gap-1 text-xs font-medium text-gold hover:opacity-80 transition-opacity">
                          <Download className="h-3.5 w-3.5" />
                          CSV
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
