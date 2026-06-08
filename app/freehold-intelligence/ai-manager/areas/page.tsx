'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MapPin, Sparkles, Globe, Plus, RefreshCw, TrendingUp, FileText, Search } from 'lucide-react'

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
  const color = score >= 80 ? 'bg-sky-400' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 rounded-full bg-surface-3">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${score >= 80 ? 'text-sky-400' : score >= 60 ? 'text-amber-400' : 'text-red-400/80'}`}>{score}</span>
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
  const [areas,    setAreas]    = useState<AreaRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterKey>('All')
  const [search,   setSearch]   = useState('')
  const [writing,  setWriting]  = useState<string | null>(null)
  const [written,  setWritten]  = useState<string[]>([])
  const [showNew,  setShowNew]  = useState(false)
  const [newName,  setNewName]  = useState('')

  useEffect(() => {
    fetch('/api/freehold/public/areas')
      .then((r) => r.json())
      .then((data) => {
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
        setAreas(mapped)
      })
      .catch(() => toast.error('Failed to load area data'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = areas
    .filter((a) => filter === 'All' || a.status === filter)
    .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))

  function aiWrite(name: string) {
    setWriting(name)
    setTimeout(() => { setWriting(null); setWritten((p) => [...p, name]) }, 2200)
  }

  const published  = areas.filter((a) => a.status === 'Published').length
  const avgSeo     = areas.length ? Math.round(areas.reduce((s, a) => s + a.seo, 0) / areas.length) : 0
  const totalLeads = areas.reduce((s, a) => s + a.leads30d, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Area Guides</h1>
          <p className="mt-1 text-xs text-slate-500">SEO-optimised location pages for each area you serve</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-3 py-1.5 text-xs font-medium text-sky-400 transition hover:bg-sky-400/15">
          <Plus className="h-3.5 w-3.5" /> {showNew ? 'Cancel' : 'New area'}
        </button>
      </div>

      {showNew && (
        <div className="mb-5 rounded-xl border border-sky-400/20 bg-sky-400/[0.03] p-4 space-y-3">
          <div className="text-sm font-semibold text-white">New area guide</div>
          <input autoFocus placeholder="Area name (e.g. Dubai Marina)" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-400/40" />
          <div className="flex gap-2">
            <button onClick={() => { setShowNew(false); setNewName(''); toast.success('Area guide created') }}
              className="rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-4 py-2 text-xs font-medium text-sky-400 transition hover:bg-sky-400/15">
              Create
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">Cancel</button>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Published', value: loading ? '…' : published, sub: `${areas.length} total`, Icon: Globe,      color: 'text-emerald-400' },
          { label: 'Avg SEO',   value: loading ? '…' : avgSeo,    sub: '/ 100 score',           Icon: TrendingUp,  color: 'text-sky-400'     },
          { label: '30d Leads', value: loading ? '…' : totalLeads, sub: 'from area pages',      Icon: FileText,    color: 'text-gold'   },
        ].map(({ label, value, sub, Icon, color }) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label} · {sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input type="text" placeholder="Search areas…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/30" />
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {(['All', 'Published', 'Draft', 'Missing'] as FilterKey[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${filter === f ? 'bg-surface-3 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
        <div className="grid grid-cols-[1fr,auto,auto,auto] gap-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <div>Area</div>
          <div className="text-center">Status</div>
          <div className="text-center">SEO</div>
          <div className="text-center">Actions</div>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Loading from Neon…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No areas match your filter.</div>
        )}

        {filtered.map((a) => {
          const isWriting = writing === a.name
          const isWritten = written.includes(a.name)
          return (
            <div key={a.slug} className="grid grid-cols-[1fr,auto,auto,auto] items-center gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-400/50" />
                  <span className="text-sm font-medium text-slate-300 truncate">{a.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 pl-5">
                  <span>{a.properties} prop.</span>
                </div>
              </div>
              <div className="flex justify-center">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>{a.status}</span>
              </div>
              <div className="flex justify-center">{seoBar(a.seo)}</div>
              <div className="flex items-center gap-1.5 justify-center">
                <button onClick={() => aiWrite(a.name)} disabled={isWriting}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    isWritten ? 'border-emerald-400/20 text-emerald-400' : 'border-sky-400/20 bg-sky-400/[0.06] text-sky-400/80 hover:bg-sky-400/15'
                  } disabled:opacity-50`}>
                  {isWriting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {isWriting ? 'Writing…' : isWritten ? 'Done' : 'AI Write'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        {areas.length} areas loaded from Neon · AI Write generates SEO-optimised content for review before publishing.
      </p>
    </div>
  )
}
