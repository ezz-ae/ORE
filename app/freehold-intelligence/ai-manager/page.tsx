'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bot, MapPin, Building2, FileText, BookOpen, ArrowUpRight, Activity } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { ExpertDepth } from '@/components/freehold/expert-depth'

type WcItem = { id: string; kind: string; name: string; status: string; created_at: string }

const CONTENT_TYPES = [
  { labelKey: 'studio.ct.listings',   href: '/freehold-intelligence/ai-manager/listings',   icon: Bot,       kind: 'listing'   },
  { labelKey: 'studio.ct.areas',      href: '/freehold-intelligence/ai-manager/areas',      icon: MapPin,    kind: 'area'      },
  { labelKey: 'studio.ct.developers', href: '/freehold-intelligence/ai-manager/developers', icon: Building2, kind: 'developer' },
  { labelKey: 'studio.ct.pages',      href: '/freehold-intelligence/ai-manager/pages',      icon: FileText,  kind: 'page'      },
  { labelKey: 'studio.ct.topics',     href: '/freehold-intelligence/ai-manager/topics',     icon: BookOpen,  kind: 'topic'     },
]

export default function AiManagerPage() {
  const t = useT()
  const depth = ['studio.ai.q1', 'studio.ai.q2', 'studio.ai.q3', 'studio.ai.q4']

  // Real content inventory. Listings/areas/developers count from the LIVE
  // catalogue (the exact source each sub-page loads) so the cards never read
  // "0 items" while their page is full — pages/topics have no catalogue source,
  // so those honestly count the web-content store. Recent activity is the newest
  // content pieces.
  const [items, setItems] = useState<WcItem[] | null>(null)
  const [listingCount, setListingCount] = useState<number | null>(null)
  const [areaCount, setAreaCount] = useState<number | null>(null)
  const [developerCount, setDeveloperCount] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/freehold/web-content', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setItems([]))
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.properties)) setListingCount(d.properties.length) })
      .catch(() => {})
    fetch('/api/freehold/public/areas', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.areas)) setAreaCount(d.areas.length) })
      .catch(() => {})
    fetch('/api/freehold/public/developers', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.developers)) setDeveloperCount(d.developers.length) })
      .catch(() => {})
  }, [])

  const countFor = (kind: string) =>
    kind === 'listing' ? listingCount
      : kind === 'area' ? areaCount
      : kind === 'developer' ? developerCount
      : items ? items.filter((i) => i.kind === kind).length : null
  const draftsFor = (kind: string) =>
    items ? items.filter((i) => i.kind === kind && i.status !== 'published').length : 0
  const recent = (items ?? []).slice(0, 6)
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('studio.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('studio.subtitle')}</p>
      </div>

      {/* Expert depth — plan / fix / audit content via the single docked Expert */}
      <ExpertDepth prompts={depth} titleKey="studio.ai.title" subtitleKey="studio.ai.subtitle" className="mt-6" />

      {/* Content type cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_TYPES.map((ct) => {
          const Icon = ct.icon
          const count = countFor(ct.kind)
          const drafts = draftsFor(ct.kind)
          return (
            <Link
              key={ct.labelKey}
              href={ct.href}
              className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface-2 p-5 transition hover:border-gold/20 hover:bg-surface-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                  <Icon className="h-4 w-4 text-gold" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-slate-300" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">{t(ct.labelKey)}</div>
                <div className="mt-0.5 text-sm text-slate-400">{count == null ? '—' : t('studio.itemCount', { count })}</div>
                {ct.kind !== 'listing' && drafts > 0 && (
                  <div className="mt-1 text-sm font-medium text-amber-400">{t('studio.draftCount', { count: drafts })}</div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* AI Activity feed */}
      <div className="mt-8 rounded-2xl border border-line bg-surface-2 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100">{t('studio.activity')}</h2>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">{t('studio.activityEmpty')}</p>
        ) : (
          <ul className="space-y-4">
            {recent.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold/50" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-400">
                    {t(item.status === 'published' ? 'studio.activityPublished' : 'studio.activityDrafted', { name: item.name })}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
