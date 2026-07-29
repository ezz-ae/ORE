'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  FileBarChart2, Sparkles, Download, ChevronDown, CheckCircle2,
  FileText, Users, Megaphone, DollarSign, Zap,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { BRAND } from '@/lib/freehold/brand'

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

// One-tap report templates — each exports a real CSV from live analytics.
const AUTOMATED_REPORTS = [
  { id: 1, nameKey: 'mgmt.reports.rpt.weeklyName',   icon: FileBarChart2, descKey: 'mgmt.reports.rpt.weeklyDesc' },
  { id: 2, nameKey: 'mgmt.reports.rpt.monthlyName',  icon: DollarSign,    descKey: 'mgmt.reports.rpt.monthlyDesc' },
  { id: 3, nameKey: 'mgmt.reports.rpt.campaignName', icon: Megaphone,     descKey: 'mgmt.reports.rpt.campaignDesc' },
  { id: 4, nameKey: 'mgmt.reports.rpt.teamName',     icon: Users,         descKey: 'mgmt.reports.rpt.teamDesc' },
]

// Real report-history log: an entry is written ONLY when a report is actually
// generated on this device (persisted to localStorage). No fabricated rows.
type HistItem = { id: string; typeValue: string; date: string; size: string; by: string | null }
const HISTORY_KEY = 'fi-mgmt-report-history'

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

function csvString(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
function fmtSize(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const ymd = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function ReportsPage() {
  const t = useT()
  const [reportType, setReportType] = useState(REPORT_TYPES[0].value)
  // Default range: first of the current month → today. The old hardcoded
  // '2026-06-01'..'2026-06-06' literals silently aged into the past.
  const [dateFrom,   setDateFrom]   = useState(() => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [dateTo,     setDateTo]     = useState(() => ymd(new Date()))
  const [generating, setGenerating] = useState(false)
  const [generated,  setGenerated]  = useState(false)
  const [format,     setFormat]     = useState('CSV')
  // LITE: the generate panel folds on phones.
  const [genOpen,    setGenOpen]    = useState(false)
  const [analytics,  setAnalytics]  = useState<Analytics | null>(null)
  const [summary,    setSummary]    = useState(ZERO_SUMMARY)
  const { user } = useSession()
  const [history, setHistory] = useState<HistItem[]>([])

  useEffect(() => {
    try { const raw = localStorage.getItem(HISTORY_KEY); if (raw) setHistory(JSON.parse(raw)) } catch { /* ignore */ }
  }, [])

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

  // Which sections a report type includes — so the Report Type selector
  // actually scopes the output instead of only renaming the file.
  function sectionsFor(type: string): { monthly: boolean; sources: boolean } {
    const roiOrTrends = /ROI|Trends/i.test(type)
    const revenueOrPipeline = /Revenue|Pipeline/i.test(type)
    return { monthly: !roiOrTrends, sources: !revenueOrPipeline }
  }
  // Keep a monthly row only when its month parses within the chosen range;
  // an unparseable month label is kept (honest — never silently dropped).
  function monthInRange(month: string): boolean {
    const d = new Date(/^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month)
    if (Number.isNaN(d.getTime())) return true
    return d >= new Date(dateFrom) && d <= new Date(`${dateTo}T23:59:59`)
  }

  function buildReportRows(): (string | number)[][] {
    const a = analytics
    const { monthly, sources } = sectionsFor(reportType)
    const rows: (string | number)[][] = [
      [`${BRAND.legalName} UAE — ` + reportType],
      ["Period", `${dateFrom} → ${dateTo}`],
      ["Generated", new Date().toISOString()],
      [""],
    ]
    if (a) {
      rows.push(["YTD Summary"], ["Leads", a.ytd.leads], ["Deals closed", a.ytd.deals], ["Sales value (AED)", Math.round(a.ytd.salesAed)], ["Commission (AED)", Math.round(a.ytd.commissionAed)], ["Conversion %", a.conversion.conversionPct], [""])
      if (monthly) {
        rows.push(["Monthly deals"], ["Month", "Deals", "Sales AED", "Commission AED"])
        const mrows = a.monthlyDeals.filter((m) => monthInRange(m.month))
        ;(mrows.length ? mrows : a.monthlyDeals).forEach((m) => rows.push([m.month, m.deals, Math.round(m.sales), Math.round(m.commission)]))
        rows.push([""])
      }
      if (sources) {
        rows.push(["Leads by source"], ["Source", "Leads", "Closed", "Conversion %"])
        a.leadsBySource.forEach((s) => rows.push([s.source, s.leads, s.closed, s.conversionPct]))
      }
    } else {
      rows.push(["No data available yet."])
    }
    return rows
  }

  // ── Format writers — CSV / Excel (xlsx) / PDF (pdf-lib), all real files ──
  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }
  async function buildXlsx(rows: (string | number)[][]): Promise<Blob> {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }
  async function buildPdf(rows: (string | number)[][], title: string): Promise<Blob> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    // pdf-lib's standard fonts are Latin-1 only — strip anything it can't encode.
    const latin = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    let page = doc.addPage()
    let y = page.getSize().height - 48
    doc.setTitle(latin(title))
    for (const row of rows) {
      const isHeader = row.length === 1 && String(row[0]).trim() !== ''
      const line = latin(row.map(String).join('   ')).slice(0, 120)
      if (y < 48) { page = doc.addPage(); y = page.getSize().height - 48 }
      if (line) page.drawText(line, { x: 40, y, size: isHeader ? 11 : 9, font: isHeader ? bold : font, color: rgb(0.1, 0.1, 0.12) })
      y -= isHeader ? 20 : 14
    }
    const bytes = await doc.save()
    return new Blob([bytes as BlobPart], { type: 'application/pdf' })
  }

  // The one place that generates a report — in the format the user chose
  // (CSV / Excel / PDF, all real), from live analytics, with a REAL history entry.
  async function runExport(typeValue: string, baseName: string, fmt: string) {
    const rows = buildReportRows()
    let blob: Blob, ext: string
    if (fmt === 'Excel') { blob = await buildXlsx(rows); ext = 'xlsx' }
    else if (fmt === 'PDF') { blob = await buildPdf(rows, `${BRAND.legalName} — ${typeValue}`); ext = 'pdf' }
    else { blob = new Blob([csvString(rows)], { type: 'text/csv' }); ext = 'csv' }
    downloadBlob(`${baseName}.${ext}`, blob)
    setHistory((prev) => {
      const item: HistItem = {
        id: `RPT-${new Date().getFullYear()}-${String(prev.length + 1).padStart(3, '0')}`,
        typeValue,
        date: new Date().toISOString(),
        size: fmtSize(blob.size),
        by: user?.name ?? null,
      }
      const next = [item, ...prev].slice(0, 100)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  function typeLabel(value: string): string {
    const rt = REPORT_TYPES.find((r) => r.value === value)
    return rt ? t(rt.labelKey) : value
  }
  function fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleString() } catch { return iso }
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setGenerated(false)
    setTimeout(async () => {
      try {
        await runExport(reportType, `${reportType.replace(/\s+/g, '-').toLowerCase()}-${dateFrom}_to_${dateTo}`, format)
        setGenerated(true)
        toast.success(t('mgmt.reports.generatedToast'))
      } catch {
        toast.error(t('ed.saveFailed'))
      } finally {
        setGenerating(false)
      }
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
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { runExport(t(report.nameKey), t(report.nameKey).replace(/\s+/g, '-').toLowerCase(), 'CSV'); toast.success(t('mgmt.reports.downloaded', { name: t(report.nameKey) })) }}
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

          {/* Generate New Report — the control panel folds on phones */}
          <div className="rounded-xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setGenOpen((v) => !v)}
              className="w-full border-b border-line px-5 py-4 text-start md:pointer-events-none"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-semibold text-white">{t('mgmt.reports.generateNew')}</h2>
                <ChevronDown className={`ms-auto h-4 w-4 text-slate-500 transition md:hidden ${genOpen ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{t('mgmt.reports.generateHint')}</p>
            </button>
            <form onSubmit={handleGenerate} className={`p-5 space-y-4 ${genOpen ? '' : 'max-md:hidden'}`}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t('mgmt.reports.reportType')}
                </label>
                <div className="relative">
                  <select
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40 pe-8"
                  >
                    {REPORT_TYPES.map(rt => (
                      <option key={rt.value} value={rt.value}>{t(rt.labelKey)}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                    onClick={() => { downloadText(`${reportType.replace(/\s+/g, '-').toLowerCase()}.csv`, csvString(buildReportRows())); toast.success(t('mgmt.reports.downloadedToast')) }}
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
              <p className="text-xs text-slate-500 mt-0.5">{t('mgmt.reports.historyHint', { count: history.length })}</p>
            </div>
            <FileText className="h-4 w-4 text-slate-500" />
          </div>
          {history.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">{t('mgmt.reports.historyEmpty')}</div>
          ) : (
          <>
          {/* LITE: stacked report cards on phones — the 7-column table stays md+ */}
          <div className="divide-y divide-line md:hidden">
            {history.map((report) => (
              <div key={report.id} className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-slate-100">{typeLabel(report.typeValue)}</span>
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">{t('mgmt.reports.status.ready')}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-400">
                  {fmtDate(report.date)} · {report.by ?? t('mgmt.reports.automatedBy')} · {report.size}
                </div>
                <button
                  onClick={() => { downloadText(`${report.id}.csv`, csvString(buildReportRows())); toast.success(t('mgmt.reports.idDownloaded', { id: report.id })) }}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-gold transition-opacity hover:opacity-80">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  {['mgmt.reports.col.reportId', 'mgmt.reports.col.reportType', 'mgmt.reports.col.generated', 'mgmt.reports.col.generatedBy', 'mgmt.reports.col.size', 'mgmt.reports.col.status', 'mgmt.reports.col.actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((report) => (
                  <tr key={report.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{report.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-100 whitespace-nowrap">{typeLabel(report.typeValue)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{fmtDate(report.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{report.by ?? t('mgmt.reports.automatedBy')}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{report.size}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-400">{t('mgmt.reports.status.ready')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { downloadText(`${report.id}.csv`, csvString(buildReportRows())); toast.success(t('mgmt.reports.idDownloaded', { id: report.id })) }}
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
          </>
          )}
        </div>

      </div>
    </div>
  )
}
