'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MapPin, Sparkles, Globe, Plus, RefreshCw, TrendingUp, FileText, Search } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface AreaRow {
  slug:        string
  name:        string
  status:      'Published' | 'Draft' | 'Missing'
  seo:         number
  properties:  number
  leads30d:    number
  lastUpdated: string
}

type FilterKey = 'All' | 'Published' | 'Draft' | 'Missing'

const STATUS_STYLE: Record<AreaRow['status'], string> = {
  Published: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Draft:     'text-amber-400   bg-amber-400/10   border-amber-400/20',
  Missing:   'text-red-400     bg-red-400/10     border-red-400/20',
}

function seoBar(score: number) {
  const color = score >= 80 ? 'bg-teal-400' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 rounded-full bg-surface-3">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${score >= 80 ? 'text-teal-400' : score >= 60 ? 'text-amber-400' : 'text-red-400/80'}`}>{score}</span>
    </div>
  )
}

function deriveStatus(score: number | null, projectCount: number | null): AreaRow['status'] {
  if (!projectCount || projectCount < 2) return 'Missing'
  const s = score ?? 0
  if (s >= 70) return 'Published'
  if (s >= 40) return 'Draft'
  return 'Missing'
}

export default function AreaGuidesPage() {
  const t = useT()
  const STATUS_LABEL: Record<AreaRow['status'], string> = {
    Published: t('paim.areas.statusPublished'),
    Draft:     t('paim.areas.statusDraft'),
    Missing:   t('paim.areas.statusMissing'),
  }
  const FILTER_LABEL: Record<FilterKey, string> = {
    All:       t('paim.areas.filterAll'),
    Published: t('paim.areas.filterPublished'),
    Draft:     t('paim.areas.filterDraft'),
    Missing:   t('paim.areas.filterMissing'),
  }
  const [areas,    setAreas]    = useState<AreaRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterKey>('All')
  const [search,   setSearch]   = useState('')
  const [writing,  setWriting]  = useState<string | null>(null)
  const [written,  setWritten]  = useState<string[]>([])
  const [showNew,  setShowNew]  = useState(false)
  const [newName,  setNewName]  = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/freehold/public/areas').then((r) => r.ok ? r.json() : { areas: [] }).catch(() => ({ areas: [] })),
      fetch('/api/freehold/web-content?kind=area', { cache: 'no-store' }).then((r) => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
    ])
      .then(([data, custom]) => {
        const mapped: AreaRow[] = (data.areas ?? []).map((a: {
          slug: string; name: string; avg_score: number | null;
          project_count: number | null; avg_yield: number | null
        }) => ({
          slug: a.slug,
          name: a.name,
          status: deriveStatus(a.avg_score, a.project_count),
          seo: Math.min(100, Math.round((a.avg_score ?? 40) * 1.1)),
          properties: a.project_count ?? 0,
          leads30d: 0,
          lastUpdated: new Date().toISOString().slice(0, 10),
        }))
        const customAreas: AreaRow[] = (custom.items ?? []).map((c: { slug: string; name: string; status: string; body?: string }) => ({
          slug: c.slug,
          name: c.name,
          status: (c.status === 'published' ? 'Published' : 'Draft') as AreaRow['status'],
          seo: c.body ? 60 : 20,
          properties: 0,
          leads30d: 0,
          lastUpdated: new Date().toISOString().slice(0, 10),
        }))
        const seen = new Set(mapped.map((m) => m.slug))
        setAreas([...customAreas.filter((c) => !seen.has(c.slug)), ...mapped])
      })
      .catch(() => toast.error(t('paim.areas.toastLoadFail')))
      .finally(() => setLoading(false))
  }, [])

  const filtered = areas
    .filter((a) => filter === 'All' || a.status === filter)
    .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))

  async function aiWrite(name: string) {
    setWriting(name)
    try {
      const res = await fetch('/api/freehold/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Write an SEO-optimised area guide for ${name}, Dubai for property investors and buyers. Cover lifestyle, connectivity, schools, amenities, property types, price trends, and rental yield outlook. 350-450 words, ready to publish.`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.text) throw new Error(data?.error || 'AI failed')
      try { await navigator.clipboard.writeText(data.text) } catch { /* clipboard optional */ }
      setWritten((p) => [...p, name])
      toast.success(data.source === 'gemini' ? t('paim.areas.toastGeneratedCopied', { name }) : t('paim.areas.toastGenerated', { name }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('paim.areas.toastGenFail'))
    } finally {
      setWriting(null)
    }
  }

  const published  = areas.filter((a) => a.status === 'Published').length
  const avgSeo     = areas.length ? Math.round(areas.reduce((s, a) => s + a.seo, 0) / areas.length) : 0
  const totalLeads = areas.reduce((s, a) => s + a.leads30d, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('paim.areas.title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('paim.areas.subtitle')}</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/[0.07] px-3 py-1.5 text-xs font-medium text-teal-400 transition hover:bg-teal-400/15">
          <Plus className="h-3.5 w-3.5" /> {showNew ? t('paim.areas.cancel') : t('paim.areas.newArea')}
        </button>
      </div>

      {showNew && (
        <div className="mb-5 rounded-xl border border-teal-400/20 bg-teal-400/[0.03] p-4 space-y-3">
          <div className="text-sm font-semibold text-white">{t('paim.areas.newAreaTitle')}</div>
          <input autoFocus placeholder={t('paim.areas.newAreaPlaceholder')} value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-400/40" />
          <div className="flex gap-2">
            <button onClick={async () => {
              const name = newName.trim()
              if (!name) return
              try {
                const res = await fetch('/api/freehold/web-content', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind: 'area', name }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.error || 'Failed')
                setAreas((prev) => [{ slug: data.item.slug, name: data.item.name, status: 'Draft', seo: 20, properties: 0, leads30d: 0, lastUpdated: new Date().toISOString().slice(0, 10) }, ...prev])
                setShowNew(false); setNewName(''); toast.success(t('paim.areas.toastCreated'))
              } catch (err) { toast.error(err instanceof Error ? err.message : t('paim.areas.toastCreateFail')) }
            }}
              className="rounded-full border border-teal-400/25 bg-teal-400/[0.07] px-4 py-2 text-xs font-medium text-teal-400 transition hover:bg-teal-400/15">
              {t('paim.areas.create')}
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">{t('paim.areas.cancel')}</button>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { id: 'published', label: t('paim.areas.statPublished'), value: loading ? '…' : published, sub: t('paim.areas.statPublishedSub', { n: areas.length }), Icon: Globe,      color: 'text-emerald-400' },
          { id: 'avgSeo',    label: t('paim.areas.statAvgSeo'),    value: loading ? '…' : avgSeo,    sub: t('paim.areas.statAvgSeoSub'),           Icon: TrendingUp,  color: 'text-teal-400'     },
          { id: 'leads',     label: t('paim.areas.statLeads'),     value: loading ? '…' : totalLeads, sub: t('paim.areas.statLeadsSub'),      Icon: FileText,    color: 'text-gold'   },
        ].map(({ id, label, value, sub, Icon, color }) => (
          <div key={id} className="rounded-xl border border-line bg-surface p-4">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label} · {sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input type="text" placeholder={t('paim.areas.searchPlaceholder')} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-teal-400/30" />
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {(['All', 'Published', 'Draft', 'Missing'] as FilterKey[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${filter === f ? 'bg-surface-3 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
        <div className="grid grid-cols-[1fr,auto,auto,auto] gap-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <div>{t('paim.areas.colArea')}</div>
          <div className="text-center">{t('paim.areas.colStatus')}</div>
          <div className="text-center">{t('paim.areas.colSeo')}</div>
          <div className="text-center">{t('paim.areas.colActions')}</div>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">{t('paim.areas.loading')}</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">{t('paim.areas.emptyFilter')}</div>
        )}

        {filtered.map((a) => {
          const isWriting = writing === a.name
          const isWritten = written.includes(a.name)
          return (
            <div key={a.slug} className="grid grid-cols-[1fr,auto,auto,auto] items-center gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-400/50" />
                  <span className="text-sm font-medium text-slate-300 truncate">{a.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 pl-5">
                  <span>{t('paim.areas.propsSuffix', { n: a.properties })}</span>
                </div>
              </div>
              <div className="flex justify-center">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              </div>
              <div className="flex justify-center">{seoBar(a.seo)}</div>
              <div className="flex items-center gap-1.5 justify-center">
                <button onClick={() => aiWrite(a.name)} disabled={isWriting}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    isWritten ? 'border-emerald-400/20 text-emerald-400' : 'border-teal-400/20 bg-teal-400/[0.06] text-teal-400/80 hover:bg-teal-400/15'
                  } disabled:opacity-50`}>
                  {isWriting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {isWriting ? t('paim.areas.writing') : isWritten ? t('paim.areas.done') : t('paim.areas.aiWrite')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        {t('paim.areas.footer', { n: areas.length })}
      </p>
    </div>
  )
}
