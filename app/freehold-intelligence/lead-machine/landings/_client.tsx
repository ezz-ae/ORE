'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Globe, Sparkles, ArrowUpRight, Search, Plus, CheckCircle2,
  AlertTriangle, Clock, Pencil, Loader2,
} from 'lucide-react'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { PageHeader, StatCard } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type StatusFilter = 'All' | 'live' | 'draft' | 'pending_review' | 'missing'

const STATUS_CONFIG: Record<string, { labelKey: string; dot: string; badge: string; icon: React.ElementType }> = {
  live:           { labelKey: 'lm.landings.status.live',          dot: 'bg-emerald-400', badge: 'text-emerald-400 border-emerald-400/25 bg-emerald-400/[0.08]', icon: CheckCircle2 },
  draft:          { labelKey: 'lm.landings.status.draft',         dot: 'bg-amber-400',   badge: 'text-amber-400 border-amber-400/25 bg-amber-400/[0.08]',       icon: Pencil       },
  pending_review: { labelKey: 'lm.landings.status.pendingReview', dot: 'bg-gold',        badge: 'text-gold border-gold/25 bg-gold/[0.08]',                      icon: Clock        },
  missing:        { labelKey: 'lm.landings.status.missing',       dot: 'bg-red-400',     badge: 'text-red-400 border-red-400/25 bg-red-400/[0.08]',             icon: AlertTriangle },
}

const FILTER_PILLS: { id: StatusFilter; labelKey: string }[] = [
  { id: 'All',           labelKey: 'lm.landings.filter.all' },
  { id: 'live',          labelKey: 'lm.landings.filter.live' },
  { id: 'pending_review',labelKey: 'lm.landings.filter.pendingReview' },
  { id: 'draft',         labelKey: 'lm.landings.filter.draft' },
  { id: 'missing',       labelKey: 'lm.landings.filter.missing' },
]

function fmtPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

export default function LandingsClient({ initialProperties }: { initialProperties: InventoryProperty[] }) {
  const [properties, setProperties] = useState<InventoryProperty[]>(initialProperties)
  const [filter, setFilter] = useState<StatusFilter>('All')
  const [query, setQuery] = useState('')
  const [bulkCreating, setBulkCreating] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const t = useT()

  const props = properties
    .filter((p) => filter === 'All' || p.landingStatus === filter)
    .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.developer.toLowerCase().includes(query.toLowerCase()))

  const live    = properties.filter((p) => p.landingStatus === 'live').length
  const missing = properties.filter((p) => p.landingStatus === 'missing').length
  const draft   = properties.filter((p) => p.landingStatus === 'draft').length
  const pending = properties.filter((p) => p.landingStatus === 'pending_review').length

  // Create one landing page. Step 1 persists a page from live project data
  // (always works, even without an AI key); step 2 best-effort enriches the
  // copy with AI using the new slug. Returns true once the page is persisted.
  async function generateFor(p: InventoryProperty): Promise<boolean> {
    const res = await fetch('/api/crm/landing-pages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug: p.slug }),
    }).catch(() => null)
    if (!res || !res.ok) return false
    const data = await res.json().catch(() => null) as { slug?: string } | null
    const slug = data?.slug || p.slug

    // Best-effort: upgrade the persisted page with AI-written sections.
    fetch('/api/crm/landing-pages/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug: p.slug, slug, audience: 'investor' }),
    }).catch(() => {})

    setProperties((prev) => prev.map((x) => x.id === p.id ? { ...x, landingStatus: 'draft', landingUrl: `/lp/${slug}` } : x))
    return true
  }

  async function generateOne(p: InventoryProperty) {
    setGeneratingId(p.id)
    const ok = await generateFor(p)
    setGeneratingId(null)
    if (ok) toast.success(`Landing page generated for ${p.name}`)
    else toast.error(`Could not generate a landing page for ${p.name}`)
  }

  async function bulkCreate() {
    const targets = properties.filter((p) => p.landingStatus === 'missing')
    if (!targets.length) return
    setBulkCreating(true)
    let ok = 0
    for (const p of targets) {
      if (await generateFor(p)) ok++
    }
    setBulkCreating(false)
    if (ok) toast.success(`Generated ${ok} landing page${ok === 1 ? '' : 's'}`)
    if (ok < targets.length) toast.error(`${targets.length - ok} could not be generated`)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <PageHeader
        eyebrow={t('lm.hub.eyebrow')}
        Icon={Globe}
        title={t('lm.landings.title')}
        subtitle={t('lm.landings.subtitle', { n: String(properties.length) })}
        actions={
          <button
            onClick={bulkCreate}
            disabled={bulkCreating || missing === 0}
            className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-medium text-ink transition hover:bg-[#F0CB67] disabled:opacity-60"
          >
            {bulkCreating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.landings.creatingAll')}</>
            ) : (
              <><Plus className="h-3.5 w-3.5" /> {t('lm.landings.createAll')}</>
            )}
          </button>
        }
        className="mb-7"
      />

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <StatCard label={t('lm.landings.stat.live')}    value={live}    hint={t('lm.landings.stat.activePages')} Icon={CheckCircle2} />
        <StatCard label={t('lm.landings.stat.pending')} value={pending} hint={t('lm.landings.stat.inReview')}   Icon={Clock}        />
        <StatCard label={t('lm.landings.stat.draft')}   value={draft}   hint={t('lm.landings.stat.unpublished')} Icon={Pencil}       />
        <StatCard label={t('lm.landings.stat.missing')} value={missing} hint={t('lm.landings.stat.needPages')}  Icon={AlertTriangle} />
      </div>

      {/* Missing alert */}
      {missing > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] border border-red-400/15 bg-red-400/[0.04] px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400/80" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-red-300">
              {t('lm.landings.alertTitle', { n: String(missing), singular: missing === 1 ? 'property is' : 'properties are', plural: missing === 1 ? '' : 's' })}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {t('lm.landings.alertDesc')}
            </div>
          </div>
          <button onClick={bulkCreate} disabled={bulkCreating}
            className="shrink-0 rounded-full border border-red-400/20 bg-red-400/[0.07] px-3 py-1.5 text-xs text-red-400/80 transition hover:bg-red-400/15 disabled:opacity-50">
            {bulkCreating ? t('lm.landings.creating') : t('lm.landings.generateAll')}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
          <input
            type="text"
            placeholder={t('lm.landings.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/30"
          />
        </div>
        <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1">
          {FILTER_PILLS.map(({ id, labelKey }) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`rounded-[8px] px-2.5 py-1 text-xs font-medium transition whitespace-nowrap ${
                filter === id ? 'bg-surface-2 text-white' : 'text-slate-600 hover:text-slate-400'
              }`}>
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Property list */}
      <div className="rounded-[16px] border border-line bg-surface divide-y divide-white/[0.04] overflow-hidden">
        {props.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-600">{t('lm.landings.empty')}</div>
        )}
        {props.map((p) => {
          const sc = STATUS_CONFIG[p.landingStatus]
          const StatusIcon = sc.icon
          return (
            <div key={p.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{p.name}</span>
                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sc.badge}`}>
                      <StatusIcon className="h-3 w-3" /> {t(sc.labelKey)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                    <span>{p.area}</span>
                    <span>·</span>
                    <span>{p.developer}</span>
                    <span>·</span>
                    <span>{fmtPrice(p.startingPriceAED)}</span>
                    {p.linkedCampaigns > 0 && (
                      <><span>·</span>
                      <span className="text-gold/60">{p.linkedCampaigns} {p.linkedCampaigns === 1 ? t('lm.landings.campaign') : t('lm.landings.campaigns')}</span></>
                    )}
                  </div>

                  {/* Mini progress bar for ad readiness */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 w-20 rounded-full bg-surface-2">
                      <div
                        className={`h-1 rounded-full ${p.adReadiness >= 80 ? 'bg-gold' : p.adReadiness >= 60 ? 'bg-amber-400/60' : 'bg-red-400/50'}`}
                        style={{ width: `${p.adReadiness}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-600">{t('lm.landings.adReady', { n: String(p.adReadiness) })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {p.landingStatus !== 'missing' && (
                    <a href={`/lp/${p.slug}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
                      <Globe className="h-3 w-3" />
                    </a>
                  )}

                  <Link href={`/freehold-intelligence/inventory/${p.id}/generate`}
                    className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
                    <Pencil className="h-3 w-3" /> {t('lm.landings.edit')}
                  </Link>

                  {p.landingStatus === 'missing' ? (
                    <button onClick={() => generateOne(p)} disabled={generatingId === p.id}
                      className="flex items-center gap-1 rounded-full border border-gold/25 bg-gold/[0.07] px-2.5 py-1.5 text-xs text-gold/80 transition hover:text-gold disabled:opacity-50">
                      {generatingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {t('lm.landings.create')}
                    </button>
                  ) : (
                    <Link href={`/freehold-intelligence/inventory/${p.id}`}
                      className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer info */}
      <div className="mt-6 rounded-[14px] border border-line bg-surface-2 px-5 py-4">
        <div className="flex items-start gap-3 text-xs text-slate-500">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
          <div>
            {t('lm.landings.footer', { path: '/lp/{property-slug}' })}
          </div>
        </div>
      </div>

    </div>
  )
}
