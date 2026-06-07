'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Sparkles, Globe, Plus, RefreshCw, TrendingUp, FileText, Search } from 'lucide-react'

interface AreaRow {
  name:        string
  status:      'Published' | 'Draft' | 'Missing'
  seo:         number
  words:       number
  properties:  number
  leads30d:    number
  lastUpdated: string
  slug:        string
}

const AREAS: AreaRow[] = [
  { name: 'Dubai Hills Estate',       slug: 'dubai-hills-estate',       status: 'Published', seo: 92, words: 3200, properties: 8,  leads30d: 47, lastUpdated: '2026-05-20' },
  { name: 'Palm Jumeirah',            slug: 'palm-jumeirah',            status: 'Published', seo: 88, words: 2800, properties: 6,  leads30d: 62, lastUpdated: '2026-05-18' },
  { name: 'Mohammed Bin Rashid City', slug: 'mbr-city',                 status: 'Published', seo: 98, words: 3100, properties: 5,  leads30d: 38, lastUpdated: '2026-05-22' },
  { name: 'Downtown Dubai',           slug: 'downtown-dubai',           status: 'Published', seo: 95, words: 2900, properties: 6,  leads30d: 55, lastUpdated: '2026-05-19' },
  { name: 'JVC',                      slug: 'jvc',                      status: 'Published', seo: 81, words: 2100, properties: 4,  leads30d: 29, lastUpdated: '2026-05-08' },
  { name: 'Business Bay',             slug: 'business-bay',             status: 'Published', seo: 76, words: 1900, properties: 5,  leads30d: 22, lastUpdated: '2026-05-15' },
  { name: 'Ras Al Khaimah',           slug: 'ras-al-khaimah',           status: 'Published', seo: 73, words: 1800, properties: 3,  leads30d: 14, lastUpdated: '2026-05-14' },
  { name: 'Dubai Marina',             slug: 'dubai-marina',             status: 'Draft',     seo: 64, words: 1400, properties: 7,  leads30d: 0,  lastUpdated: '2026-05-10' },
  { name: 'Jumeirah Beach Residence', slug: 'jbr',                      status: 'Draft',     seo: 58, words: 1100, properties: 4,  leads30d: 0,  lastUpdated: '2026-04-25' },
  { name: 'Dubai Creek Harbour',      slug: 'dubai-creek-harbour',      status: 'Draft',     seo: 55, words: 900,  properties: 3,  leads30d: 0,  lastUpdated: '2026-04-30' },
  { name: 'Arabian Ranches',          slug: 'arabian-ranches',          status: 'Missing',   seo: 40, words: 600,  properties: 2,  leads30d: 0,  lastUpdated: '2026-04-12' },
  { name: 'Dubai Sports City',        slug: 'dubai-sports-city',        status: 'Missing',   seo: 42, words: 650,  properties: 2,  leads30d: 0,  lastUpdated: '2026-04-08' },
]

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
      <div className="h-1 w-14 rounded-full bg-slate-700">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${score >= 80 ? 'text-sky-400' : score >= 60 ? 'text-amber-400' : 'text-red-400/80'}`}>{score}</span>
    </div>
  )
}

function wordProgress(words: number) {
  const target = 3000
  const pct    = Math.min(Math.round((words / target) * 100), 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 rounded-full bg-slate-700">
        <div className="h-1 rounded-full bg-sky-400/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{(words / 1000).toFixed(1)}k</span>
    </div>
  )
}

export default function AreaGuidesPage() {
  const [filter,   setFilter]   = useState<FilterKey>('All')
  const [query,    setQuery]    = useState('')
  const [writing,  setWriting]  = useState<string | null>(null)
  const [written,  setWritten]  = useState<string[]>([])

  const filtered = AREAS
    .filter((a) => filter === 'All' || a.status === filter)
    .filter((a) => !query || a.name.toLowerCase().includes(query.toLowerCase()))

  function aiWrite(name: string) {
    setWriting(name)
    setTimeout(() => {
      setWriting(null)
      setWritten((prev) => [...prev, name])
    }, 2200)
  }

  const published = AREAS.filter((a) => a.status === 'Published').length
  const avgSeo    = Math.round(AREAS.reduce((s, a) => s + a.seo, 0) / AREAS.length)
  const totalLeads = AREAS.reduce((s, a) => s + a.leads30d, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Area Guides</h1>
          <p className="mt-1 text-xs text-slate-500">SEO-optimised location pages for each area you serve</p>
        </div>
        <button onClick={() => toast.success('New area — editor ready')} className="flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-3 py-1.5 text-xs font-medium text-sky-400 transition hover:bg-sky-400/15">
          <Plus className="h-3.5 w-3.5" /> New area
        </button>
      </div>

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Published', value: published, sub: `${AREAS.length} total`, Icon: Globe,      color: 'text-emerald-400' },
          { label: 'Avg SEO',   value: avgSeo,    sub: '/ 100 score',           Icon: TrendingUp,  color: 'text-sky-400'     },
          { label: '30d Leads', value: totalLeads, sub: 'from area pages',      Icon: FileText,    color: 'text-[#D4AF37]'   },
        ].map(({ label, value, sub, Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label} · {sub}</div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search areas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/30"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(['All', 'Published', 'Draft', 'Missing'] as FilterKey[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                filter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 divide-y divide-slate-800 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr,auto,auto,auto,auto] gap-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <div>Area</div>
          <div className="text-center">Status</div>
          <div className="text-center">SEO</div>
          <div className="text-center">Words</div>
          <div className="text-center">Actions</div>
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No areas match your filter.</div>
        )}

        {filtered.map((a) => {
          const isWriting = writing === a.name
          const isWritten = written.includes(a.name)
          return (
            <div key={a.name} className="grid grid-cols-[1fr,auto,auto,auto,auto] items-center gap-4 px-5 py-3.5">
              {/* Name */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-400/50" />
                  <span className="text-sm font-medium text-slate-300 truncate">{a.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 pl-5">
                  <span>{a.properties} prop.</span>
                  {a.leads30d > 0 && <><span>·</span><span className="text-sky-400/70">{a.leads30d} leads</span></>}
                </div>
              </div>
              {/* Status */}
              <div className="flex justify-center">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                  {a.status}
                </span>
              </div>
              {/* SEO */}
              <div className="flex justify-center">{seoBar(a.seo)}</div>
              {/* Words */}
              <div className="flex justify-center">{wordProgress(a.words)}</div>
              {/* Actions */}
              <div className="flex items-center gap-1.5 justify-center">
                <button
                  onClick={() => aiWrite(a.name)}
                  disabled={isWriting}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    isWritten
                      ? 'border-emerald-400/20 text-emerald-400'
                      : 'border-sky-400/20 bg-sky-400/[0.06] text-sky-400/80 hover:bg-sky-400/15'
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
        AI Write generates SEO-optimised content using property data and area context. Review before publishing.
      </p>
    </div>
  )
}
