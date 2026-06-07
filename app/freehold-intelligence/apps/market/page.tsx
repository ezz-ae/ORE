'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Database, Search, TrendingUp, X, ChevronDown, ChevronUp } from 'lucide-react'
import { projects } from '@/src/data/projects'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import type { ProjectStatus } from '@/src/types/project'

type SortKey    = 'readiness' | 'price' | 'name'
type StatusFilter = 'All' | ProjectStatus

const ALL_AREAS = Array.from(new Set(projects.map((p) => p.area))).sort()
const ALL_STATUSES: StatusFilter[] = ['All', 'Ready', 'Off-plan', 'Under construction', 'Secondary', 'Rental']

function statusTone(s: string) {
  if (s === 'Ready')             return { dot: 'bg-gold', text: 'text-gold', bg: 'bg-gold/10 border-gold/20' }
  if (s === 'Under construction') return { dot: 'bg-gold', text: 'text-[#F8E7AE]', bg: 'bg-gold/10 border-gold/20' }
  return                                 { dot: 'bg-sky-400',   text: 'text-sky-200',   bg: 'bg-sky-400/10 border-sky-400/20' }
}

function readinessTone(n: number) {
  if (n >= 90) return 'bg-gold'
  if (n >= 80) return 'bg-gold'
  return 'bg-surface-3'
}

export default function MarketIntelligencePage() {
  const [query,        setQuery]        = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [areaFilter,   setAreaFilter]   = useState<string>('All')
  const [sortKey,      setSortKey]      = useState<SortKey>('readiness')
  const [sortAsc,      setSortAsc]      = useState(false)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = useMemo(() => {
    let items = [...projects]
    if (statusFilter !== 'All') items = items.filter((p) => p.status === statusFilter)
    if (areaFilter   !== 'All') items = items.filter((p) => p.area   === areaFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter((p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.developer.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    items.sort((a, b) => {
      let diff = 0
      if (sortKey === 'readiness') diff = a.campaignReadiness - b.campaignReadiness
      if (sortKey === 'price')     diff = a.startingPrice - b.startingPrice
      if (sortKey === 'name')      diff = a.projectName.localeCompare(b.projectName)
      return sortAsc ? diff : -diff
    })
    return items
  }, [query, statusFilter, areaFilter, sortKey, sortAsc])

  function clearFilters() {
    setQuery('')
    setStatusFilter('All')
    setAreaFilter('All')
    setSortKey('readiness')
    setSortAsc(false)
  }

  const isFiltered = query || statusFilter !== 'All' || areaFilter !== 'All'

  const topStats = [
    { label: 'Projects indexed', value: projects.length.toString() },
    { label: 'Ready inventory',  value: projects.filter(p => p.status === 'Ready').length.toString() },
    { label: 'Avg readiness',    value: `${Math.round(projects.reduce((a, p) => a + p.campaignReadiness, 0) / projects.length)}%` },
    { label: 'Coverage',         value: '3 Emirates' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:pt-16">

      {/* Header */}
      <section className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
            <Database className="h-3.5 w-3.5" /> Market Intelligence
          </div>
          <h1 className="mt-4 text-[40px] font-semibold leading-[1.02] tracking-tight text-white sm:text-[52px]">
            {projects.length} projects.
            <br />
            <span className="text-slate-500">Full intelligence layer.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-[1.65] text-slate-300">
            Internal market database. Every project carries ad angle, buyer profile, payment plan, readiness score, and sales guidance — not for public use.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:shrink-0 lg:grid-cols-4">
          {topStats.map((s) => (
            <div key={s.label} className="rounded-[18px] border border-line bg-surface p-4 text-center">
              <div className="text-[26px] font-semibold leading-none text-white">{s.value}</div>
              <div className="mt-1 text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Prompt */}
      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about any project, area, payment plan, buyer profile…"
          suggestions={[
            'Which projects are ready for Meta ads today?',
            'Compare Palm Jumeirah vs Dubai Hills for HNW buyers.',
            'Show all off-plan below AED 1M.',
            'What is the best Business Bay angle?',
          ]}
        />
      </section>

      {/* Search + Filters */}
      <section className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, areas, developers, tags…"
              className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-9 pr-9 text-sm text-slate-200 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Area select */}
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-slate-300 focus:border-gold/40 focus:outline-none"
          >
            <option value="All">All areas</option>
            {ALL_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Status pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                statusFilter === s
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
          {isFiltered && (
            <button onClick={clearFilters} className="ml-1 text-sm text-slate-500 transition hover:text-slate-300">
              Clear all
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {filtered.length === projects.length
            ? `${projects.length} projects · sorted by readiness`
            : `${filtered.length} of ${projects.length} projects`}
        </p>
      </section>

      {/* Table */}
      <section className="mt-5">
        <div className="overflow-hidden rounded-[24px] border border-line bg-surface">
          {/* Table header */}
          <div className="hidden grid-cols-[2fr_1fr_1fr_0.8fr_2fr_auto] gap-4 border-b border-line px-6 py-3.5 lg:grid">
            {[
              { label: 'Project',   key: 'name'      as SortKey, sortable: true  },
              { label: 'Price from', key: 'price'    as SortKey, sortable: true  },
              { label: 'Status',    key: null,                   sortable: false },
              { label: 'Readiness', key: 'readiness' as SortKey, sortable: true  },
              { label: 'Sales angle', key: null,                 sortable: false },
              { label: '',          key: null,                   sortable: false },
            ].map(({ label, key, sortable }) => (
              <div key={label} className="flex items-center gap-1">
                {sortable && key ? (
                  <button
                    onClick={() => handleSort(key)}
                    className={[
                      'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition',
                      sortKey === key ? 'text-slate-300' : 'text-slate-500 hover:text-slate-400',
                    ].join(' ')}
                  >
                    {label}
                    {sortKey === key && (sortAsc ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
                  </button>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
                )}
              </div>
            ))}
          </div>

          <div className="divide-y divide-line">
            {filtered.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm text-slate-500">No projects match these filters.</p>
                <button
                  onClick={clearFilters}
                  className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filtered.map((project) => {
                const tone = statusTone(project.status)
                return (
                  <Link
                    key={project.id}
                    href={`/freehold-intelligence/apps/market/${project.id}`}
                    className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-surface-2 lg:grid lg:grid-cols-[2fr_1fr_1fr_0.8fr_2fr_auto] lg:items-center lg:gap-4 lg:px-6 lg:py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-gold">
                        {project.projectName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{project.area} · {project.emirate}</p>
                    </div>

                    <div className="text-sm font-medium text-slate-200">
                      AED {Number(project.startingPrice).toLocaleString()}
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.bg} ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {project.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full ${readinessTone(project.campaignReadiness)}`} style={{ width: `${project.campaignReadiness}%` }} />
                      </div>
                      <span className="w-8 text-right text-sm tabular-nums text-slate-500">{project.campaignReadiness}</span>
                    </div>

                    <p className="hidden truncate text-sm text-slate-400 lg:block">{project.salesAngle}</p>

                    <ArrowUpRight className="hidden h-4 w-4 text-slate-600 transition group-hover:text-gold lg:block" />
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* Intelligence note */}
      <section className="mt-10 rounded-[20px] border border-gold/15 bg-gold/[0.04] px-6 py-5">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold/80">Internal use only</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Sales angles, ad angles, buyer profiles, and ROI notes are internal intelligence — not for client-facing materials. Use the Notebook to adapt them into approved output.
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
