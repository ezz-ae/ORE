'use client'

import Link from 'next/link'
import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { Bot, Plus, Edit2, Sparkles, Package, Loader2, Megaphone } from 'lucide-react'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { useT } from '@/lib/i18n/provider'

type ListingStatus = 'Published' | 'Draft'
type FilterKey = 'All' | ListingStatus | 'Off Plan' | 'Ready'
// Content status/word-count come from a real web-content row when one exists
// for this listing's slug; otherwise the listing simply has no content yet.
type Content = { status: ListingStatus; words: number | null; id?: string }

const FILTERS: FilterKey[] = ['All', 'Published', 'Draft', 'Off Plan', 'Ready']

const FILTER_KEY: Record<FilterKey, string> = {
  'All': 'paim.listings.filter.All',
  'Published': 'paim.listings.filter.Published',
  'Draft': 'paim.listings.filter.Draft',
  'Off Plan': 'paim.listings.filter.OffPlan',
  'Ready': 'paim.listings.filter.Ready',
}

const STATUS_KEY: Record<ListingStatus, string> = {
  'Published': 'paim.listings.status.Published',
  'Draft': 'paim.listings.status.Draft',
}

function statusBadge(status: ListingStatus) {
  if (status === 'Published') return 'text-gold bg-gold/10 border-gold/20'
  return 'text-slate-400 bg-surface-2 border-line-strong'
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

export default function ListingsClient({ initialProperties }: { initialProperties: InventoryProperty[] }) {
  const t = useT()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')
  const [processing, setProcessing] = useState<string | null>(null)
  const [improving, setImproving] = useState<string[]>([])
  // Content keyed by listing slug, loaded from the real web-content store.
  const [content, setContent] = useState<Record<string, Content>>({})

  async function loadContent() {
    const res = await fetch('/api/freehold/web-content?kind=listing', { cache: 'no-store' }).catch(() => null)
    const d = res && res.ok ? await res.json().catch(() => null) : null
    const map: Record<string, Content> = {}
    for (const it of (d?.items ?? []) as Array<{ id: string; slug: string; status: string; body?: string }>) {
      map[it.slug] = { id: it.id, status: it.status === 'published' ? 'Published' : 'Draft', words: it.body ? wordCount(it.body) : null }
    }
    setContent(map)
  }
  useEffect(() => { loadContent() }, [])

  const contentFor = (prop: InventoryProperty): Content => content[prop.slug] ?? { status: 'Draft', words: null }

  const listings = useMemo(() => {
    return initialProperties
      .map((prop) => ({ prop, content: contentFor(prop) }))
      .filter(({ prop, content }) => {
        if (activeFilter === 'All')      return true
        if (activeFilter === 'Off Plan') return prop.status === 'off_plan'
        if (activeFilter === 'Ready')    return prop.status === 'ready'
        return content.status === activeFilter
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, initialProperties, content])

  const counts = useMemo(() => ({
    Published: initialProperties.filter((p) => content[p.slug]?.status === 'Published').length,
    Draft:     initialProperties.filter((p) => (content[p.slug]?.status ?? 'Draft') === 'Draft').length,
  }), [initialProperties, content])

  // Real AI rewrite for one listing — generates fresh copy and SAVES it to the
  // web-content store (published) so the status/word-count survive a reload.
  async function improveOne(prop: InventoryProperty): Promise<boolean> {
    const res = await fetch('/api/freehold/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Write an SEO-optimised property listing description (180-260 words) for "${prop.name}" in ${prop.area}, Dubai (${prop.developer}). Specific, publication-ready, no placeholders.`,
      }),
    }).catch(() => null)
    if (!res || !res.ok) return false
    const data = await res.json().catch(() => null) as { text?: string } | null
    const text = data?.text?.trim() || ''
    if (!text) return false
    const existing = content[prop.slug]
    const save = existing?.id
      ? fetch('/api/freehold/web-content', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: existing.id, body: text, status: 'published' }) })
      : fetch('/api/freehold/web-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'listing', name: prop.name, slug: prop.slug, body: text, status: 'published' }) })
    const saved = await save.catch(() => null)
    if (!saved || !saved.ok) return false
    setContent((c) => ({ ...c, [prop.slug]: { ...c[prop.slug], status: 'Published', words: wordCount(text) } }))
    return true
  }

  async function handleImprove(prop: InventoryProperty) {
    setImproving((p) => [...p, prop.id])
    const ok = await improveOne(prop)
    setImproving((p) => p.filter((x) => x !== prop.id))
    if (ok) toast.success(t('paim.listings.toast.updated', { name: prop.name }))
    else toast.error(t('paim.listings.toast.updateFailed', { name: prop.name }))
  }

  // Bulk: run the real AI rewrite across the visible listings.
  async function runBulk(kind: string, label: string) {
    if (processing) return
    setProcessing(kind)
    let ok = 0
    for (const { prop } of listings) {
      if (await improveOne(prop)) ok++
    }
    setProcessing(null)
    if (ok) toast.success(t('paim.listings.toast.bulkOk', { label, n: ok }))
    else toast.error(t('paim.listings.toast.bulkFailed', { label }))
  }

  const bulkActions = [
    { kind: 'meta',    idle: t('paim.listings.bulk.metaIdle'),    busy: t('paim.listings.bulk.metaBusy'),    label: t('paim.listings.bulk.metaLabel') },
    { kind: 'seo',     idle: t('paim.listings.bulk.seoIdle'),     busy: t('paim.listings.bulk.seoBusy'),     label: t('paim.listings.bulk.seoLabel') },
    { kind: 'summary', idle: t('paim.listings.bulk.summaryIdle'), busy: t('paim.listings.bulk.summaryBusy'), label: t('paim.listings.bulk.summaryLabel') },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        <Bot className="h-3.5 w-3.5" />
        {t('paim.listings.breadcrumb')}
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('paim.listings.title')}</h1>
          <div className="mt-2 flex flex-wrap gap-3">
            <span className="rounded-xl border border-gold/20 bg-gold/10 px-3 py-1 text-xs">
              <span className="text-slate-500">{t('paim.listings.published')} </span>
              <span className="font-semibold text-gold">{counts.Published}</span>
            </span>
            <span className="rounded-xl border border-line bg-surface-2 px-3 py-1 text-xs">
              <span className="text-slate-500">{t('paim.listings.draft')} </span>
              <span className="font-semibold text-slate-400">{counts.Draft}</span>
            </span>
          </div>
        </div>
        <Link
          href="/freehold-intelligence/ai-manager/listings/new"
          className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20"
        >
          <Plus className="h-4 w-4" />
          {t('paim.listings.newListing')}
        </Link>
      </div>

      {/* Bulk AI actions — real generation across the visible listings */}
      <div className="mt-6 flex flex-wrap gap-2">
        {bulkActions.map((a) => (
          <button
            key={a.kind}
            disabled={!!processing}
            onClick={() => runBulk(a.kind, a.label)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-rose-500/20 hover:text-slate-300 disabled:opacity-60"
          >
            {processing === a.kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {processing === a.kind ? a.busy : a.idle}
          </button>
        ))}
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
            {t(FILTER_KEY[f])}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface-2">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-line">
              {[
                'paim.listings.col.name',
                'paim.listings.col.area',
                'paim.listings.col.propertyStatus',
                'paim.listings.col.contentStatus',
                'paim.listings.col.words',
                'paim.listings.col.images',
                'paim.listings.col.lastUpdated',
                'paim.listings.col.actions',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-500">
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {listings.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                  {t('paim.listings.empty')}
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
                      {t(STATUS_KEY[content.status])}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-400">{content.words != null ? content.words.toLocaleString() : '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-400">{prop.imageCount}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">{prop.lastUpdated || '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Link href="/freehold-intelligence/ai-manager/listings/new" className="text-xs text-slate-400 hover:text-slate-200 transition">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        disabled={improving.includes(prop.id) || !!processing}
                        onClick={() => handleImprove(prop)}
                        className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {improving.includes(prop.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {improving.includes(prop.id) ? t('paim.listings.improveBusy') : t('paim.listings.improveIdle')}
                      </button>
                      <Link
                        href={`/freehold-intelligence/lead-machine/creatives/generate?project=${encodeURIComponent(prop.slug)}&name=${encodeURIComponent(prop.name)}&area=${encodeURIComponent(prop.area)}&developer=${encodeURIComponent(prop.developer)}&price=${prop.startingPriceAED ?? ''}`}
                        className="flex items-center gap-1 rounded-lg border border-gold/25 bg-gold/[0.07] px-2.5 py-1 text-sm font-medium text-gold transition hover:bg-gold/[0.14]"
                      >
                        <Megaphone className="h-3 w-3" /> {t('paim.listings.adCreatives')}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        {t('paim.listings.footer', { shown: listings.length, total: initialProperties.length })}
      </p>
    </div>
  )
}
