'use client'

import { useState } from 'react'
import { MapPin, Sparkles, Globe, Plus } from 'lucide-react'

interface AreaRow {
  name: string
  status: 'Published' | 'Draft' | 'Missing'
  seo: number
  words: number
  properties: number
  lastUpdated: string
}

const areas: AreaRow[] = [
  { name: 'Dubai Hills Estate',       status: 'Published', seo: 92, words: 3200, properties: 8, lastUpdated: '2026-05-20' },
  { name: 'Palm Jumeirah',            status: 'Published', seo: 88, words: 2800, properties: 6, lastUpdated: '2026-05-18' },
  { name: 'Mohammed Bin Rashid City', status: 'Published', seo: 98, words: 3100, properties: 5, lastUpdated: '2026-05-22' },
  { name: 'Downtown Dubai',           status: 'Published', seo: 95, words: 2900, properties: 6, lastUpdated: '2026-05-19' },
  { name: 'JVC',                      status: 'Published', seo: 81, words: 2100, properties: 4, lastUpdated: '2026-05-08' },
  { name: 'Business Bay',             status: 'Published', seo: 76, words: 1900, properties: 5, lastUpdated: '2026-05-15' },
  { name: 'Ras Al Khaimah',          status: 'Published', seo: 73, words: 1800, properties: 3, lastUpdated: '2026-05-14' },
  { name: 'Dubai Marina',             status: 'Draft',     seo: 64, words: 1400, properties: 7, lastUpdated: '2026-05-10' },
  { name: 'Jumeirah Beach Residence', status: 'Draft',     seo: 58, words: 1100, properties: 4, lastUpdated: '2026-04-25' },
  { name: 'Dubai Creek Harbour',      status: 'Draft',     seo: 55, words: 900,  properties: 3, lastUpdated: '2026-04-30' },
  { name: 'Arabian Ranches',          status: 'Missing',   seo: 40, words: 600,  properties: 2, lastUpdated: '2026-04-12' },
  { name: 'Dubai Sports City',        status: 'Missing',   seo: 42, words: 650,  properties: 2, lastUpdated: '2026-04-08' },
]

type FilterKey = 'All' | AreaRow['status']
const FILTERS: FilterKey[] = ['All', 'Published', 'Draft', 'Missing']

function statusBadge(status: AreaRow['status']) {
  if (status === 'Published') return 'text-[#D4AF37] bg-emerald-500/10 border-emerald-500/20'
  if (status === 'Missing')   return 'text-white/55 bg-rose-500/10 border-rose-500/20'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

function seoColor(score: number) {
  if (score >= 80) return 'text-[#D4AF37]'
  if (score >= 60) return 'text-[#D4AF37]'
  return 'text-white/55'
}

export default function AreaGuidesPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')
  const filtered = activeFilter === 'All' ? areas : areas.filter((a) => a.status === activeFilter)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-white/55/80">
        <MapPin className="h-3.5 w-3.5" />
        AI Manager · Areas
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
          Area Guides
        </h1>
        <button className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-white/55 transition hover:bg-rose-500/20">
          <Plus className="h-4 w-4" />
          Add Area
        </button>
      </div>

      {/* Filter pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition border ${
              activeFilter === f
                ? 'bg-rose-500/10 border-rose-500/30 text-white/55'
                : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/80 hover:border-white/20'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Total </span>
          <span className="font-semibold text-white/90">{areas.length}</span>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Published </span>
          <span className="font-semibold text-[#D4AF37]">{areas.filter((a) => a.status === 'Published').length}</span>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Draft </span>
          <span className="font-semibold text-white/60">{areas.filter((a) => a.status === 'Draft').length}</span>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Missing </span>
          <span className="font-semibold text-white/55">{areas.filter((a) => a.status === 'Missing').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.03]">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Area Name', 'Status', 'SEO Score', 'Word Count', 'Properties', 'Last Updated', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[13px] font-medium uppercase tracking-widest text-white/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-white/25">
                  No areas match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((area) => (
                <tr key={area.name} className="group transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 flex-shrink-0 text-white/25" />
                      <span className="text-sm font-medium text-white/80">{area.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${statusBadge(area.status)}`}>
                      {area.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm font-semibold ${seoColor(area.seo)}`}>{area.seo}</span>
                    <span className="text-xs text-white/25">/100</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{area.words.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{area.properties}</td>
                  <td className="px-4 py-3.5 text-xs text-white/40">{area.lastUpdated}</td>
                  <td className="px-4 py-3.5">
                    {area.status === 'Missing' ? (
                      <button className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[13px] font-medium text-white/55 transition hover:bg-rose-500/20">
                        <Sparkles className="h-3 w-3" />
                        Generate
                      </button>
                    ) : (
                      <button className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[13px] font-medium text-white/55 transition hover:bg-rose-500/20">
                        <Sparkles className="h-3 w-3" />
                        AI Improve
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] text-white/25">
        {filtered.length} of {areas.length} areas shown
      </p>
    </div>
  )
}
