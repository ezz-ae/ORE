'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Database, UploadCloud, Loader2, Sparkles, FileSpreadsheet, BarChart3, Users } from 'lucide-react'
import { PageHeader, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// The system data base — bulk-import historical leads (yours, or exported
// from any previous CRM) into the network targeting brain. Raw rows stay
// tenant-private; only anonymized dimension×outcome signals reach the shared
// benchmarks every system user benefits from.

interface Stat { tenantId: string; rows: number; lastImport: string | null }
// `leads` can come back as a bucketed range (e.g. "50-99") instead of an
// exact number when Settings → Data Security → number masking is on — the
// server decides which, so the client just renders whatever it gets.
interface Benchmark { platform: string; area: string; interest: string; ageBand: string; leads: number | string; qualifiedRate: number; closeRate: number; tenants: number }
// Row count, outcome mix, and per-field fill-rate for one tenant — never a
// row's actual values. Mirrors lib/entrestate/targeting-base.ts BaseQuality.
interface Quality {
  tenantId: string
  rows: number
  outcomes: { lead: number; qualified: number; closed: number; lost: number }
  fieldCoverage: { field: string; pct: number }[]
}

const FIELD_LABEL_KEY: Record<string, string> = {
  platform: 'sd.field.platform', area: 'sd.field.area', projectType: 'sd.field.projectType',
  priceBand: 'sd.field.priceBand', ageBand: 'sd.field.ageBand', city: 'sd.field.city', interest: 'sd.field.interest',
}
const OUTCOME_COLOR: Record<string, string> = {
  lead: '#94A3B8', qualified: '#a78bfa', closed: '#34D399', lost: '#F87171',
}

const FIELD_ALIASES: Record<string, string> = {
  source: 'source', platform: 'platform', campaign: 'campaign', area: 'area',
  project_type: 'projectType', projecttype: 'projectType', type: 'projectType',
  price_band: 'priceBandAED', pricebandaed: 'priceBandAED', budget: 'priceBandAED',
  age_band: 'ageBand', ageband: 'ageBand', age: 'ageBand',
  city: 'city', interest: 'interest', interests: 'interest',
  outcome: 'outcome', status: 'outcome',
  lead_date: 'leadDate', leaddate: 'leadDate', date: 'leadDate', created: 'leadDate',
}
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ACCEPTED_EXT = ['.csv', '.txt', '.xlsx', '.xls']

function aliasHeader(h: string): string {
  return FIELD_ALIASES[h.trim().toLowerCase().replace(/\s+/g, '_')] ?? ''
}

// Minimal CSV parser (handles quoted cells with commas).
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const parseLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { q = !q; continue }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue }
      cur += ch
    }
    out.push(cur)
    return out
  }
  const headers = parseLine(lines[0]).map(aliasHeader)
  return lines.slice(1).map((line) => {
    const cells = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { if (h && cells[i]?.trim()) row[h] = cells[i].trim() })
    return row
  }).filter((r) => Object.keys(r).length > 0)
}

// Same header-aliasing as parseCsv, applied to objects already keyed by
// their original (un-aliased) header text — the shape xlsx's sheet_to_json
// returns, so a spreadsheet upload maps onto the exact same columns a pasted
// CSV does, no separate parsing path to keep in sync.
function remapObjectRows(raw: Record<string, unknown>[]): Record<string, string>[] {
  return raw.map((r) => {
    const row: Record<string, string> = {}
    for (const [key, value] of Object.entries(r)) {
      const h = aliasHeader(key)
      const v = String(value ?? '').trim()
      if (h && v) row[h] = v
    }
    return row
  }).filter((r) => Object.keys(r).length > 0)
}

export default function DataBasePage() {
  const t = useT()
  const [stats, setStats] = useState<Stat[]>([])
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [quality, setQuality] = useState<{ base: Quality | null; this: Quality | null }>({ base: null, this: null })
  const [tenant, setTenant] = useState<'base' | 'this'>('base')
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function load() {
    fetch('/api/freehold/base/import', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.stats)) setStats(d.stats)
        if (Array.isArray(d?.benchmarks)) setBenchmarks(d.benchmarks)
        if (d?.quality) setQuality({ base: d.quality.base ?? null, this: d.quality.this ?? null })
      })
      .catch(() => {})
  }
  useEffect(() => { load() }, [])

  async function importRows(rows: Record<string, unknown>[]) {
    if (!rows.length) { toast.error(t('sd.noRows')); return }
    setImporting(true)
    let done = 0
    let sanitized = 0
    try {
      for (let i = 0; i < rows.length; i += 1000) {
        const res = await fetch('/api/freehold/base/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant, rows: rows.slice(i, i + 1000) }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d?.error || 'Import failed')
        done += d.inserted ?? 0
        sanitized += d.sanitized ?? 0
      }
      toast.success(t('sd.imported', { n: done }))
      if (sanitized > 0) toast.info(t('sd.sanitizedNote', { n: sanitized }))
      setText('')
      setFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('sd.importFailed'))
    } finally { setImporting(false) }
  }

  async function runImport() {
    const raw = text.trim()
    if (!raw) return
    let rows: Record<string, unknown>[] = []
    try {
      if (raw.startsWith('[') || raw.startsWith('{')) {
        const parsed = JSON.parse(raw)
        rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : []
      } else {
        rows = parseCsv(raw)
      }
    } catch {
      toast.error(t('sd.parseError'))
      return
    }
    await importRows(rows)
  }

  async function onFileSelected(file: File | null) {
    if (!file) return
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ACCEPTED_EXT.includes(ext)) { toast.error(t('sd.uploadBadType')); return }
    if (file.size > MAX_UPLOAD_BYTES) { toast.error(t('sd.uploadTooLarge')); return }
    setFileName(file.name)
    try {
      let rows: Record<string, unknown>[] = []
      if (ext === '.csv' || ext === '.txt') {
        rows = parseCsv(await file.text())
      } else {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        rows = remapObjectRows(raw)
      }
      await importRows(rows)
    } catch {
      toast.error(t('sd.uploadReadError'))
      setFileName('')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <PageHeader
        eyebrow={t('settings.tab.data')}
        Icon={Database}
        title={t('sd.title')}
        subtitle={t('sd.subtitle')}
      />

      {/* Import */}
      <Panel className="mt-6">
        <PanelHeader title={t('sd.import')} icon={<UploadCloud className="h-4 w-4 text-gold" />} />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'base' as const, label: t('sd.tenant.base'), desc: t('sd.tenant.baseDesc') },
              { key: 'this' as const, label: t('sd.tenant.this'), desc: t('sd.tenant.thisDesc') },
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTenant(opt.key)}
                className={`flex-1 rounded-xl border p-3 text-start transition ${
                  tenant === opt.key ? 'border-gold/40 bg-gold/[0.07]' : 'border-line bg-surface-2 hover:border-line-strong'
                }`}
              >
                <div className="text-sm font-semibold text-white">{opt.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Real file upload — CSV or Excel, not a placeholder */}
          <div className="rounded-xl border border-dashed border-line-strong bg-surface-2 p-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
              <FileSpreadsheet className="h-6 w-6 text-gold" />
              <span className="text-sm font-semibold text-white">{fileName || t('sd.uploadFile')}</span>
              <span className="text-xs text-slate-500">{t('sd.uploadHint')}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                disabled={importing}
                className="hidden"
                onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={t('sd.placeholder')}
            className="w-full rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs text-white placeholder:text-slate-600 outline-none focus:border-gold/40"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{t('sd.columns')}</p>
            <button
              onClick={runImport}
              disabled={importing || !text.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {t('sd.run')}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">{t('sd.privacy')}</p>
        </div>
      </Panel>

      {/* Base stats */}
      {stats.length > 0 && (
        <Panel className="mt-6">
          <PanelHeader title={t('sd.stats')} icon={<Database className="h-4 w-4 text-gold" />} />
          <div className="divide-y divide-line">
            {stats.map((s) => (
              <div key={s.tenantId} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{s.tenantId}</span>
                <span className="shrink-0 text-slate-400">{s.rows.toLocaleString()} {t('sd.rows')}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Data Pool quality — how much, and how complete, for the tenant currently selected above */}
      {quality[tenant] && (
        <Panel className="mt-6">
          <PanelHeader title={t('sd.quality.title')} icon={<BarChart3 className="h-4 w-4 text-gold" />} />
          <div className="p-5">
            <p className="text-xs text-slate-500">{t('sd.quality.subtitle')}</p>

            {/* Outcome mix */}
            <div className="mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('sd.quality.outcomes')}</div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div className="flex h-full w-full">
                  {(['lead', 'qualified', 'closed', 'lost'] as const).map((k) => {
                    const q = quality[tenant]!
                    const pct = q.rows > 0 ? (q.outcomes[k] / q.rows) * 100 : 0
                    return pct > 0 ? (
                      <div key={k} style={{ width: `${pct}%`, background: OUTCOME_COLOR[k] }} title={`${t(`sd.outcome.${k}`)}: ${q.outcomes[k]}`} />
                    ) : null
                  })}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {(['lead', 'qualified', 'closed', 'lost'] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="h-2 w-2 rounded-full" style={{ background: OUTCOME_COLOR[k] }} />
                    {t(`sd.outcome.${k}`)} <span className="text-slate-300">{quality[tenant]!.outcomes[k]}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Field coverage — criteria, never the actual values */}
            <div className="mt-5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('sd.quality.criteria')}</div>
              <div className="mt-2.5 space-y-2">
                {quality[tenant]!.fieldCoverage.map((f) => (
                  <div key={f.field} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-slate-400">{t(FIELD_LABEL_KEY[f.field] ?? f.field)}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gold/70" style={{ width: `${f.pct}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-end text-xs tabular-nums text-slate-300">{f.pct}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">{t('sd.quality.criteriaNote')}</p>
            </div>
          </div>
        </Panel>
      )}

      {/* Network benchmarks — the shared benefit */}
      {benchmarks.length > 0 && (
        <Panel className="mt-6">
          <PanelHeader title={t('sd.benchmarks')} icon={<Sparkles className="h-4 w-4 text-gold" />} />
          <div className="divide-y divide-line">
            {benchmarks.slice(0, 10).map((b, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-200">
                  {[b.platform, b.area, b.interest, b.ageBand].filter(Boolean).join(' · ') || '—'}
                </span>
                <span className="shrink-0 text-slate-500">{b.leads} {t('sd.rows')}</span>
                <span className="shrink-0 text-gold">{b.qualifiedRate}% {t('sd.qualified')}</span>
                <span className="shrink-0 text-emerald-400">{b.closeRate}% {t('sd.closed')}</span>
              </div>
            ))}
          </div>
          <p className="px-5 py-3 text-[11px] leading-relaxed text-slate-500">{t('sd.benchNote')}</p>
        </Panel>
      )}

      {/* This Data Pool is anonymized by design — real Meta Custom Audiences
          need actual contacts, which live on the Audiences page instead. */}
      <Panel className="mt-6">
        <PanelHeader title={t('sd.audience.title')} icon={<Users className="h-4 w-4 text-gold" />} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="max-w-xl text-xs leading-relaxed text-slate-500">{t('sd.audience.body')}</p>
          <Link
            href="/freehold-intelligence/lead-machine/audiences"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            {t('sd.audience.cta')}
          </Link>
        </div>
      </Panel>
    </div>
  )
}
