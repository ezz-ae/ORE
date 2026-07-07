'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Database, UploadCloud, Loader2, Sparkles } from 'lucide-react'
import { PageHeader, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// The system data base — bulk-import historical leads (yours, or exported
// from any previous CRM) into the network targeting brain. Raw rows stay
// tenant-private; only anonymized dimension×outcome signals reach the shared
// benchmarks every system user benefits from.

interface Stat { tenantId: string; rows: number; lastImport: string | null }
interface Benchmark { platform: string; area: string; interest: string; ageBand: string; leads: number; qualifiedRate: number; closeRate: number; tenants: number }

const FIELD_ALIASES: Record<string, string> = {
  source: 'source', platform: 'platform', campaign: 'campaign', area: 'area',
  project_type: 'projectType', projecttype: 'projectType', type: 'projectType',
  price_band: 'priceBandAED', pricebandaed: 'priceBandAED', budget: 'priceBandAED',
  age_band: 'ageBand', ageband: 'ageBand', age: 'ageBand',
  city: 'city', interest: 'interest', interests: 'interest',
  outcome: 'outcome', status: 'outcome',
  lead_date: 'leadDate', leaddate: 'leadDate', date: 'leadDate', created: 'leadDate',
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
  const headers = parseLine(lines[0]).map((h) => FIELD_ALIASES[h.trim().toLowerCase().replace(/\s+/g, '_')] ?? '')
  return lines.slice(1).map((line) => {
    const cells = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { if (h && cells[i]?.trim()) row[h] = cells[i].trim() })
    return row
  }).filter((r) => Object.keys(r).length > 0)
}

export default function DataBasePage() {
  const t = useT()
  const [stats, setStats] = useState<Stat[]>([])
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [tenant, setTenant] = useState<'base' | 'this'>('base')
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)

  function load() {
    fetch('/api/freehold/base/import', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.stats)) setStats(d.stats)
        if (Array.isArray(d?.benchmarks)) setBenchmarks(d.benchmarks)
      })
      .catch(() => {})
  }
  useEffect(() => { load() }, [])

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
    if (!rows.length) { toast.error(t('sd.noRows')); return }

    setImporting(true)
    let done = 0
    try {
      for (let i = 0; i < rows.length; i += 1000) {
        const res = await fetch('/api/freehold/base/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant, rows: rows.slice(i, i + 1000) }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d?.error || 'Import failed')
        done += d.inserted ?? 0
      }
      toast.success(t('sd.imported', { n: done }))
      setText('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('sd.importFailed'))
    } finally { setImporting(false) }
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
    </div>
  )
}
