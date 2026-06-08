'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
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
  if (status === 'Published')    return 'text-gold bg-gold/10 border-gold/20'
  if (status === 'Needs Review') return 'text-slate-400 bg-rose-500/10 border-rose-500/20'
  return 'text-slate-400 bg-surface-2 border-line-strong'
}

function seoColor(score: number) {
  if (score >= 85) return 'text-gold'
  if (score >= 65) return 'text-gold'
  return 'text-slate-400'
}

export default function AiManagerListingsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')
  const [processing, setProcessing] = useState<string | null>(null)
  const [improved, setImproved] = useState<string[]>([])

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
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        <Bot className="h-3.5 w-3.5" />
        AI Manager · Listings
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Listings
          </h1>
          <div className="mt-2 flex flex-wrap gap-3">
            <span className="rounded-xl border border-gold/20 bg-gold/10 px-3 py-1 text-xs">
              <span className="text-slate-500">Published </span>
              <span className="font-semibold text-gold">{counts.Published}</span>
            </span>
            <span className="rounded-xl border border-line bg-surface-2 px-3 py-1 text-xs">
              <span className="text-slate-500">Draft </span>
              <span className="font-semibold text-slate-400">{counts.Draft}</span>
            </span>
            <span className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs">
              <span className="text-slate-500">Needs Review </span>
              <span className="font-semibold text-slate-400">{counts['Needs Review']}</span>
            </span>
          </div>
        </div>
        <Link
          href="/freehold-intelligence/ai-manager/listings/new"
          className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20"
        >
          <Plus className="h-4 w-4" />
          New Listing
        </Link>
      </div>

      {/* Bulk AI actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          disabled={processing === 'meta'}
          onClick={() => {
            setProcessing('meta')
            toast.promise(new Promise(r => setTimeout(r, 2000)), {
              loading: 'Refreshing meta descriptions…',
              success: 'Meta descriptions refreshed',
              error: 'Refresh failed',
            })
            setTimeout(() => setProcessing(null), 2000)
          }}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-rose-500/20 hover:text-slate-300 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {processing === 'meta' ? 'Refreshing…' : 'Refresh Meta Descriptions'}
        </button>
        <button
          disabled={processing === 'seo'}
          onClick={() => {
            setProcessing('seo')
            toast.promise(new Promise(r => setTimeout(r, 2500)), {
              loading: 'Running SEO audit…',
              success: 'SEO audit complete',
              error: 'Audit failed',
            })
            setTimeout(() => setProcessing(null), 2500)
          }}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-rose-500/20 hover:text-slate-300 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {processing === 'seo' ? 'Auditing…' : 'Check All SEO'}
        </button>
        <button
          disabled={processing === 'summary'}
          onClick={() => {
            setProcessing('summary')
            toast.promise(new Promise(r => setTimeout(r, 2200)), {
              loading: 'Regenerating summaries…',
              success: 'Summaries regenerated',
              error: 'Regeneration failed',
            })
            setTimeout(() => setProcessing(null), 2200)
          }}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-rose-500/20 hover:text-slate-300 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {processing === 'summary' ? 'Regenerating…' : 'Regenerate Summaries'}
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
                ? 'bg-rose-500/10 border-rose-500/30 text-slate-300'
                : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200 hover:border-line-strong'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface-2">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-line">
              {['Name', 'Area', 'Property Status', 'Content Status', 'SEO Score', 'Words', 'Images', 'Last Updated', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {listings.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                  No listings match this filter.
                </td>
              </tr>
            ) : (
              listings.map(({ prop, content }) => (
                <tr key={prop.id} className="group transition hover:bg-surface-2">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                      <span className="text-sm font-medium text-slate-300 leading-snug">{prop.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-400">{prop.area}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-sm font-medium text-slate-400 capitalize">
                      {prop.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium ${statusBadge(content.status)}`}>
                      {content.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm font-semibold ${seoColor(content.seo)}`}>{content.seo}</span>
                    <span className="text-xs text-slate-500">/100</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-400">{content.words.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-400">{prop.imageCount}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{prop.lastUpdated}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Link href="/freehold-intelligence/ai-manager/listings/new" className="text-xs text-slate-400 hover:text-slate-200 transition">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        disabled={improved.includes(prop.id)}
                        onClick={() => {
                          setImproved(p => [...p, prop.id])
                          toast.promise(new Promise(r => setTimeout(r, 1800)), {
                            loading: 'Applying AI improvements…',
                            success: `${prop.title} updated`,
                            error: 'Update failed',
                          })
                        }}
                        className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-50"
                      >
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

      <p className="mt-3 text-sm text-slate-500">
        {listings.length} of {inventoryProperties.length} listings · AI Manager
      </p>
    </div>
  )
}
