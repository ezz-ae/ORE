'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { Bot, Plus, Edit2, Sparkles, Package } from 'lucide-react'
import { inventoryProperties, type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'

type ListingStatus = 'Published' | 'Draft' | 'Needs Review'
type FilterKey = 'All' | ListingStatus | 'Off Plan' | 'Ready'

const FILTERS: FilterKey[] = ['All', 'Published', 'Draft', 'Needs Review', 'Off Plan', 'Ready']

const contentData: Record<string, { status: ListingStatus; seo: number; words: number }> = {
  prop_sobha_007:  { status: 'Published',    seo: 95, words: 2400 },
  prop_hills_002:  { status: 'Published',    seo: 91, words: 2200 },
  prop_palm_001:   { status: 'Published',    seo: 88, words: 1800 },
  prop_jvc_005:    { status: 'Published',    seo: 84, words: 1900 },
  prop_bay_003:    { status: 'Needs Review', seo: 65, words: 950  },
  prop_creek_006:  { status: 'Draft',        seo: 58, words: 840  },
  prop_marina_004: { status: 'Needs Review', seo: 52, words: 800  },
  prop_rak_008:    { status: 'Draft',        seo: 38, words: 420  },
}

function statusBadge(status: ListingStatus) {
  if (status === 'Published')    return 'text-[#D4AF37] bg-emerald-500/10 border-emerald-500/20'
  if (status === 'Needs Review') return 'text-white/55 bg-rose-500/10 border-rose-500/20'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

function seoColor(score: number) {
  if (score >= 85) return 'text-[#D4AF37]'
  if (score >= 65) return 'text-[#D4AF37]'
  return 'text-white/55'
}

export default function AiManagerListingsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')

  const listings = useMemo(() => {
    return inventoryProperties
      .map((prop) => ({ prop, content: contentData[prop.id] ?? { status: 'Draft' as ListingStatus, seo: 40, words: 300 } }))
      .filter(({ prop, content }) => {
        if (activeFilter === 'All')         return true
        if (activeFilter === 'Off Plan')    return prop.status === 'off_plan'
        if (activeFilter === 'Ready')       return prop.status === 'ready'
        return content.status === activeFilter
      })
  }, [activeFilter])

  const counts = useMemo(() => ({
    Published:    inventoryProperties.filter((p) => contentData[p.id]?.status === 'Published').length,
    Draft:        inventoryProperties.filter((p) => contentData[p.id]?.status === 'Draft').length,
    'Needs Review': inventoryProperties.filter((p) => contentData[p.id]?.status === 'Needs Review').length,
  }), [])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-white/55/80">
        <Bot className="h-3.5 w-3.5" />
        AI Manager · Listings
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
            Listings
          </h1>
          <div className="mt-2 flex flex-wrap gap-3">
            <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs">
              <span className="text-white/40">Published </span>
              <span className="font-semibold text-[#D4AF37]">{counts.Published}</span>
            </span>
            <span className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs">
              <span className="text-white/40">Draft </span>
              <span className="font-semibold text-white/60">{counts.Draft}</span>
            </span>
            <span className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs">
              <span className="text-white/40">Needs Review </span>
              <span className="font-semibold text-white/55">{counts['Needs Review']}</span>
            </span>
          </div>
        </div>
        <Link
          href="/freehold-intelligence/ai-manager/listings/new"
          className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-white/55 transition hover:bg-rose-500/20"
        >
          <Plus className="h-4 w-4" />
          New Listing
        </Link>
      </div>

      {/* Bulk AI actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-rose-500/20 hover:text-white/55">
          <Sparkles className="h-3.5 w-3.5" />
          Refresh Meta Descriptions
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-rose-500/20 hover:text-white/55">
          <Sparkles className="h-3.5 w-3.5" />
          Check All SEO
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-rose-500/20 hover:text-white/55">
          <Sparkles className="h-3.5 w-3.5" />
          Regenerate Summaries
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

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.03]">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Name', 'Area', 'Property Status', 'Content Status', 'SEO Score', 'Words', 'Images', 'Last Updated', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[13px] font-medium uppercase tracking-widest text-white/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {listings.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-white/25">
                  No listings match this filter.
                </td>
              </tr>
            ) : (
              listings.map(({ prop, content }) => (
                <tr key={prop.id} className="group transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 flex-shrink-0 text-white/25" />
                      <span className="text-sm font-medium text-white/80 leading-snug">{prop.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{prop.area}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[13px] font-medium text-white/50 capitalize">
                      {prop.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${statusBadge(content.status)}`}>
                      {content.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm font-semibold ${seoColor(content.seo)}`}>{content.seo}</span>
                    <span className="text-xs text-white/25">/100</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{content.words.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{prop.imageCount}</td>
                  <td className="px-4 py-3.5 text-xs text-white/40">{prop.lastUpdated}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <button className="text-xs text-white/40 hover:text-white/70 transition">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[13px] font-medium text-white/55 transition hover:bg-rose-500/20">
                        <Sparkles className="h-3 w-3" />
                        AI Improve
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] text-white/25">
        {listings.length} of {inventoryProperties.length} listings · AI Manager
      </p>
    </div>
  )
}
