'use client'

import Link from 'next/link'
import { Bot, Plus, Filter, Edit2, Sparkles, Package } from 'lucide-react'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

const FILTERS = ['All', 'Published', 'Draft', 'Needs Review', 'Off Plan', 'Ready']

// Fake per-listing SEO/content data keyed by index
const fakeData = [
  { seo: 91, words: 2200, status: 'Published' },
  { seo: 84, words: 1800, status: 'Published' },
  { seo: 65, words: 950,  status: 'Needs Review' },
  { seo: 78, words: 1400, status: 'Draft' },
  { seo: 95, words: 2400, status: 'Published' },
  { seo: 52, words: 800,  status: 'Needs Review' },
  { seo: 88, words: 2100, status: 'Published' },
  { seo: 70, words: 1600, status: 'Draft' },
]

function seoColor(score: number) {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 65) return 'text-[#D4AF37]'
  return 'text-rose-400'
}

function statusBadge(status: string) {
  if (status === 'Published')    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (status === 'Needs Review') return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  if (status === 'Draft')        return 'text-white/50 bg-white/[0.04] border-white/10'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

const listings = inventoryProperties.slice(0, 8)

export default function AiManagerListingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-rose-400/80">
        <Bot className="h-3.5 w-3.5" />
        AI Manager · Listings
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
          Listings
        </h1>
        <Link
          href="/freehold-intelligence/ai-manager/listings/new"
          className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/20"
        >
          <Plus className="h-4 w-4" />
          New Listing
        </Link>
      </div>

      {/* Bulk AI actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-rose-500/20 hover:text-rose-400">
          <Sparkles className="h-3.5 w-3.5" />
          Refresh Meta Descriptions
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-rose-500/20 hover:text-rose-400">
          <Sparkles className="h-3.5 w-3.5" />
          Check All SEO
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-rose-500/20 hover:text-rose-400">
          <Sparkles className="h-3.5 w-3.5" />
          Regenerate Summaries
        </button>
      </div>

      {/* Filter pills */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              i === 0
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'border border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/80'
            }`}
          >
            {f}
          </button>
        ))}
        <button className="ml-auto flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/40 hover:text-white/70">
          <Filter className="h-3 w-3" />
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.03]">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Name', 'Area', 'Status', 'SEO Score', 'Words', 'Images', 'Last Updated', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-white/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {listings.map((prop, i) => {
              const fake = fakeData[i] ?? fakeData[0]
              return (
                <tr key={prop.id} className="group transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 flex-shrink-0 text-white/25" />
                      <span className="text-sm font-medium text-white/80 leading-snug">{prop.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{prop.area}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadge(fake.status)}`}>
                      {fake.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm font-semibold ${seoColor(fake.seo)}`}>{fake.seo}</span>
                    <span className="text-xs text-white/25">/100</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{fake.words.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{prop.imageCount}</td>
                  <td className="px-4 py-3.5 text-xs text-white/40">{prop.lastUpdated}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <button className="text-xs text-white/40 hover:text-white/70 transition">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400 transition hover:bg-rose-500/20">
                        <Sparkles className="h-3 w-3" />
                        AI Improve
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
