'use client'

import { useEffect, useState } from 'react'
import { FileText, Globe, ArrowUpRight, LayoutTemplate } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// The REAL sitemap of the public site — every row is an actual route you can
// open, plus the live landing pages generated from Inventory. No invented SEO
// scores, word counts or review statuses.

const SITE = 'https://www.freeholdproperty.ae'

const CORE_PAGES: { title: string; url: string }[] = [
  { title: 'Home',              url: '/' },
  { title: 'Projects',          url: '/projects' },
  { title: 'Compare projects',  url: '/projects/compare' },
  { title: 'Properties',        url: '/properties' },
  { title: 'Search',            url: '/search' },
  { title: 'Services',          url: '/services' },
  { title: 'ROI calculator',    url: '/tools/roi-calculator' },
  { title: 'Market tracker',    url: '/tools/market-tracker' },
  { title: 'Payment simulator', url: '/tools/payment-simulator' },
  { title: 'Comparator',        url: '/tools/comparator' },
  { title: 'AI discovery',      url: '/tools/ai-discovery' },
  { title: 'Terms',             url: '/terms' },
]

interface Landing { name: string; url: string }

export default function WebsitePagesPage() {
  const t = useT()
  const [landings, setLandings] = useState<Landing[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !Array.isArray(d?.properties)) return
        setLandings(
          d.properties
            .filter((p: { landingUrl?: string | null }) => p.landingUrl)
            .map((p: { name: string; landingUrl: string }) => ({ name: p.name, url: p.landingUrl })),
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const Row = ({ title, url }: { title: string; url: string }) => (
    <a
      href={`${SITE}${url}`}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.03]"
    >
      <Globe className="h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-100">{title}</div>
        <div className="truncate font-mono text-xs text-slate-500">{url}</div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-gold" />
    </a>
  )

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
        <FileText className="h-4 w-4" /> {t('paim.pages.breadcrumb')}
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">{t('paim.pages.liveTitle')}</h1>
      <p className="mt-1 max-w-[58ch] text-sm text-slate-400">{t('paim.pages.liveSubtitle')}</p>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('paim.pages.core')}</h2>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {CORE_PAGES.map((p) => <Row key={p.url} {...p} />)}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <LayoutTemplate className="h-4 w-4" /> {t('paim.pages.landings')} · {landings.length}
        </h2>
        {landings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-sm text-slate-400">
            {t('paim.pages.noLandings')}
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {landings.map((p) => <Row key={p.url} title={p.name} url={p.url} />)}
          </div>
        )}
      </section>
    </div>
  )
}
