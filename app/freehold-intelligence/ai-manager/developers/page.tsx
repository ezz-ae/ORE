'use client'

import { useState } from 'react'
import { Building2, Plus, Sparkles, Check } from 'lucide-react'

interface DeveloperRow {
  name: string
  initials: string
  color: string
  listings: number
  profileStatus: 'Complete' | 'Incomplete' | 'Draft'
  seo: number
  lastUpdated: string
}

const developers: DeveloperRow[] = [
  { name: 'Emaar',         initials: 'EM', color: 'bg-sky-500/20 text-white/55',     listings: 6, profileStatus: 'Complete',   seo: 94, lastUpdated: '2026-05-21' },
  { name: 'Nakheel',       initials: 'NK', color: 'bg-emerald-500/20 text-[#D4AF37]', listings: 4, profileStatus: 'Complete',   seo: 88, lastUpdated: '2026-05-18' },
  { name: 'DAMAC',         initials: 'DC', color: 'bg-amber-500/20 text-amber-300',  listings: 5, profileStatus: 'Complete',   seo: 82, lastUpdated: '2026-05-15' },
  { name: 'Binghatti',     initials: 'BG', color: 'bg-rose-500/20 text-white/55',    listings: 3, profileStatus: 'Incomplete', seo: 61, lastUpdated: '2026-05-10' },
  { name: 'Sobha Realty',  initials: 'SB', color: 'bg-violet-500/20 text-white/55', listings: 4, profileStatus: 'Complete',   seo: 91, lastUpdated: '2026-05-20' },
  { name: 'Select Group',  initials: 'SG', color: 'bg-indigo-500/20 text-indigo-300', listings: 2, profileStatus: 'Draft',      seo: 54, lastUpdated: '2026-04-28' },
  { name: 'RAK Properties', initials: 'RP', color: 'bg-teal-500/20 text-teal-300',  listings: 2, profileStatus: 'Incomplete', seo: 48, lastUpdated: '2026-04-20' },
  { name: 'Azizi',         initials: 'AZ', color: 'bg-orange-500/20 text-orange-300', listings: 3, profileStatus: 'Draft',      seo: 58, lastUpdated: '2026-05-02' },
  { name: 'Ellington',     initials: 'EL', color: 'bg-pink-500/20 text-pink-300',   listings: 2, profileStatus: 'Complete',   seo: 79, lastUpdated: '2026-05-12' },
  { name: 'Meraas',        initials: 'MR', color: 'bg-cyan-500/20 text-cyan-300',   listings: 3, profileStatus: 'Complete',   seo: 85, lastUpdated: '2026-05-16' },
]

function statusBadge(status: DeveloperRow['profileStatus']) {
  if (status === 'Complete')   return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20'
  if (status === 'Incomplete') return 'text-white/55 bg-rose-500/10 border-rose-500/20'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

function seoColor(score: number) {
  if (score >= 80) return 'text-[#D4AF37]'
  if (score >= 60) return 'text-[#D4AF37]'
  return 'text-white/55'
}

type FilterKey = 'All' | DeveloperRow['profileStatus']
const FILTERS: FilterKey[] = ['All', 'Complete', 'Incomplete', 'Draft']

export default function DeveloperProfilesPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')
  const filtered = activeFilter === 'All' ? developers : developers.filter((d) => d.profileStatus === activeFilter)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-white/55/80">
        <Building2 className="h-3.5 w-3.5" />
        AI Manager · Developers
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">
          Developer Profiles
        </h1>
        <button className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-white/55 transition hover:bg-rose-500/20">
          <Plus className="h-4 w-4" />
          Add Developer
        </button>
      </div>

      {/* Filter pills */}
      <div className="mt-5 flex flex-wrap gap-2">
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
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Total </span>
          <span className="font-semibold text-white/90">{developers.length}</span>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Complete </span>
          <span className="font-semibold text-[#D4AF37]">{developers.filter((d) => d.profileStatus === 'Complete').length}</span>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Incomplete </span>
          <span className="font-semibold text-white/55">{developers.filter((d) => d.profileStatus === 'Incomplete').length}</span>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Draft </span>
          <span className="font-semibold text-white/60">{developers.filter((d) => d.profileStatus === 'Draft').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.03]">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Developer', 'Listings', 'Profile Status', 'SEO Score', 'Last Updated', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[13px] font-medium uppercase tracking-widest text-white/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.map((dev) => (
              <tr key={dev.name} className="group transition hover:bg-white/[0.02]">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${dev.color}`}>
                      {dev.initials}
                    </div>
                    <span className="text-sm font-medium text-white/80">{dev.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-white/50">{dev.listings}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${statusBadge(dev.profileStatus)}`}>
                    {dev.profileStatus === 'Complete' && <Check className="h-3 w-3" />}
                    {dev.profileStatus}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-sm font-semibold ${seoColor(dev.seo)}`}>{dev.seo}</span>
                  <span className="text-xs text-white/25">/100</span>
                </td>
                <td className="px-4 py-3.5 text-xs text-white/40">{dev.lastUpdated}</td>
                <td className="px-4 py-3.5">
                  <button className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[13px] font-medium text-white/55 transition hover:bg-rose-500/20">
                    <Sparkles className="h-3 w-3" />
                    AI Improve
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
