'use client'

import { useState } from 'react'
import { Building2, Plus, Sparkles, CheckCircle2, AlertCircle, Search, Globe, RefreshCw, TrendingUp } from 'lucide-react'

interface DeveloperRow {
  name:          string
  initials:      string
  color:         string
  listings:      number
  profileStatus: 'Complete' | 'Incomplete' | 'Draft'
  seo:           number
  wordCount:     number
  leads30d:      number
  lastUpdated:   string
  checklist:     { item: string; done: boolean }[]
}

const DEVELOPERS: DeveloperRow[] = [
  {
    name: 'Emaar', initials: 'EM', color: 'bg-sky-500/20 text-sky-300',
    listings: 6, profileStatus: 'Complete', seo: 94, wordCount: 2800, leads30d: 58, lastUpdated: '2026-05-21',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: true },
      { item: 'Hero image uploaded', done: true },
      { item: 'SEO meta title & description', done: true },
      { item: 'Schema markup applied', done: true },
    ],
  },
  {
    name: 'Nakheel', initials: 'NK', color: 'bg-emerald-500/20 text-emerald-300',
    listings: 4, profileStatus: 'Complete', seo: 88, wordCount: 2400, leads30d: 41, lastUpdated: '2026-05-18',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: true },
      { item: 'Hero image uploaded', done: true },
      { item: 'SEO meta title & description', done: true },
      { item: 'Schema markup applied', done: false },
    ],
  },
  {
    name: 'DAMAC', initials: 'DC', color: 'bg-amber-500/20 text-amber-300',
    listings: 5, profileStatus: 'Complete', seo: 82, wordCount: 2100, leads30d: 33, lastUpdated: '2026-05-15',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: true },
      { item: 'Hero image uploaded', done: true },
      { item: 'SEO meta title & description', done: true },
      { item: 'Schema markup applied', done: false },
    ],
  },
  {
    name: 'Sobha Realty', initials: 'SB', color: 'bg-violet-500/20 text-violet-300',
    listings: 4, profileStatus: 'Complete', seo: 91, wordCount: 2600, leads30d: 27, lastUpdated: '2026-05-20',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: true },
      { item: 'Hero image uploaded', done: true },
      { item: 'SEO meta title & description', done: true },
      { item: 'Schema markup applied', done: true },
    ],
  },
  {
    name: 'Meraas', initials: 'MR', color: 'bg-cyan-500/20 text-cyan-300',
    listings: 3, profileStatus: 'Complete', seo: 85, wordCount: 2200, leads30d: 19, lastUpdated: '2026-05-16',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: true },
      { item: 'Hero image uploaded', done: false },
      { item: 'SEO meta title & description', done: true },
      { item: 'Schema markup applied', done: false },
    ],
  },
  {
    name: 'Ellington', initials: 'EL', color: 'bg-pink-500/20 text-pink-300',
    listings: 2, profileStatus: 'Complete', seo: 79, wordCount: 1800, leads30d: 11, lastUpdated: '2026-05-12',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: true },
      { item: 'Hero image uploaded', done: true },
      { item: 'SEO meta title & description', done: true },
      { item: 'Schema markup applied', done: false },
    ],
  },
  {
    name: 'Binghatti', initials: 'BG', color: 'bg-rose-500/20 text-rose-300',
    listings: 3, profileStatus: 'Incomplete', seo: 61, wordCount: 1200, leads30d: 6, lastUpdated: '2026-05-10',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: true },
      { item: 'Hero image uploaded', done: false },
      { item: 'SEO meta title & description', done: false },
      { item: 'Schema markup applied', done: false },
    ],
  },
  {
    name: 'Azizi', initials: 'AZ', color: 'bg-orange-500/20 text-orange-300',
    listings: 3, profileStatus: 'Draft', seo: 58, wordCount: 900, leads30d: 4, lastUpdated: '2026-05-02',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: false },
      { item: 'Hero image uploaded', done: false },
      { item: 'SEO meta title & description', done: false },
      { item: 'Schema markup applied', done: false },
    ],
  },
  {
    name: 'Select Group', initials: 'SG', color: 'bg-indigo-500/20 text-indigo-300',
    listings: 2, profileStatus: 'Draft', seo: 54, wordCount: 800, leads30d: 2, lastUpdated: '2026-04-28',
    checklist: [
      { item: 'Developer overview written', done: true },
      { item: 'Key projects listed', done: false },
      { item: 'Hero image uploaded', done: false },
      { item: 'SEO meta title & description', done: false },
      { item: 'Schema markup applied', done: false },
    ],
  },
  {
    name: 'RAK Properties', initials: 'RP', color: 'bg-teal-500/20 text-teal-300',
    listings: 2, profileStatus: 'Incomplete', seo: 48, wordCount: 700, leads30d: 0, lastUpdated: '2026-04-20',
    checklist: [
      { item: 'Developer overview written', done: false },
      { item: 'Key projects listed', done: false },
      { item: 'Hero image uploaded', done: false },
      { item: 'SEO meta title & description', done: false },
      { item: 'Schema markup applied', done: false },
    ],
  },
]

type FilterKey = 'All' | 'Complete' | 'Incomplete' | 'Draft'

const STATUS_STYLE: Record<DeveloperRow['profileStatus'], string> = {
  Complete:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Incomplete: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  Draft:      'text-slate-400   bg-slate-800/50   border-slate-700',
}

export default function DeveloperProfilesPage() {
  const [filter,   setFilter]   = useState<FilterKey>('All')
  const [query,    setQuery]    = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [writing,  setWriting]  = useState<string | null>(null)
  const [written,  setWritten]  = useState<string[]>([])

  const filtered = DEVELOPERS
    .filter((d) => filter === 'All' || d.profileStatus === filter)
    .filter((d) => !query || d.name.toLowerCase().includes(query.toLowerCase()))

  function aiWrite(name: string) {
    setWriting(name)
    setTimeout(() => {
      setWriting(null)
      setWritten((prev) => [...prev, name])
    }, 2200)
  }

  const complete = DEVELOPERS.filter((d) => d.profileStatus === 'Complete').length
  const avgSeo   = Math.round(DEVELOPERS.reduce((s, d) => s + d.seo, 0) / DEVELOPERS.length)
  const totalLeads = DEVELOPERS.reduce((s, d) => s + d.leads30d, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Developer Profiles</h1>
          <p className="mt-1 text-xs text-slate-500">SEO pages for each developer — drives organic ranking</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/[0.07] px-3 py-1.5 text-xs font-medium text-sky-400 transition hover:bg-sky-400/15">
          <Plus className="h-3.5 w-3.5" /> Add developer
        </button>
      </div>

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Complete',  value: `${complete}/${DEVELOPERS.length}`, Icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Avg SEO',   value: avgSeo,                             Icon: TrendingUp,   color: 'text-sky-400'     },
          { label: '30d Leads', value: totalLeads,                         Icon: Globe,        color: 'text-[#D4AF37]'   },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <Icon className={`h-4 w-4 ${color}`} />
            <div className="mt-2 text-xl font-semibold text-white">{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Missing profiles alert */}
      {DEVELOPERS.some((d) => d.profileStatus !== 'Complete') && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.03] px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" />
          <div>
            <div className="text-sm font-medium text-amber-300/90">
              {DEVELOPERS.filter((d) => d.profileStatus !== 'Complete').length} profiles incomplete
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Incomplete profiles reduce Google ranking for developer searches. Use AI Write to complete them.
            </div>
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search developers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/30"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(['All', 'Complete', 'Incomplete', 'Draft'] as FilterKey[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                filter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Developer cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-10 text-center text-sm text-slate-500">
            No developers match.
          </div>
        )}
        {filtered.map((d) => {
          const isExpanded = expanded === d.name
          const isWriting  = writing === d.name
          const isWritten  = written.includes(d.name)
          const doneCount  = d.checklist.filter((c) => c.done).length
          const total      = d.checklist.length

          return (
            <div key={d.name} className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpanded(isExpanded ? null : d.name)}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${d.color}`}>
                  {d.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-300">{d.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[d.profileStatus]}`}>
                      {d.profileStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span>{d.listings} listings</span>
                    <span>·</span>
                    <span>SEO {d.seo}</span>
                    <span>·</span>
                    <span>{(d.wordCount / 1000).toFixed(1)}k words</span>
                    {d.leads30d > 0 && <><span>·</span><span className="text-sky-400/70">{d.leads30d} leads</span></>}
                  </div>
                </div>
                {/* Checklist progress */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    {d.checklist.map((_, i) => (
                      <div key={i} className={`h-1.5 w-1.5 rounded-full ${i < doneCount ? 'bg-sky-400' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">{doneCount}/{total}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-800 px-5 py-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Profile checklist</div>
                  <div className="space-y-2 mb-4">
                    {d.checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {item.done
                          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                          : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-600" />
                        }
                        <span className={`text-xs ${item.done ? 'text-slate-400' : 'text-slate-500'}`}>{item.item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => aiWrite(d.name)}
                      disabled={isWriting}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        isWritten
                          ? 'border-emerald-400/25 text-emerald-400'
                          : 'border-sky-400/25 bg-sky-400/[0.06] text-sky-400 hover:bg-sky-400/15'
                      } disabled:opacity-50`}>
                      {isWriting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {isWriting ? 'Writing…' : isWritten ? 'Content ready' : 'AI Complete profile'}
                    </button>
                    <button className="flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
                      <Globe className="h-3 w-3" /> Preview
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
