'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Sparkles, Globe, Check, AlertCircle } from 'lucide-react'

interface PageRow {
  title: string
  url: string
  type: 'Landing' | 'Blog' | 'Static' | 'Legal'
  status: 'Published' | 'Draft' | 'Review'
  words: number
  seo: number
  lastAiReview: string
}

const websitePages: PageRow[] = [
  { title: 'Home',                  url: '/',                      type: 'Landing', status: 'Published', words: 1200, seo: 88, lastAiReview: '2026-05-20' },
  { title: 'Projects',              url: '/projects',              type: 'Landing', status: 'Published', words: 950,  seo: 82, lastAiReview: '2026-05-18' },
  { title: 'About',                 url: '/about',                 type: 'Static',  status: 'Published', words: 680,  seo: 71, lastAiReview: '2026-05-10' },
  { title: 'Contact',               url: '/contact',               type: 'Static',  status: 'Published', words: 320,  seo: 65, lastAiReview: '2026-05-08' },
  { title: 'Dubai Hills Guide',     url: '/areas/dubai-hills',     type: 'Landing', status: 'Published', words: 3200, seo: 94, lastAiReview: '2026-05-22' },
  { title: 'Palm Jumeirah',         url: '/areas/palm-jumeirah',   type: 'Landing', status: 'Review',    words: 2800, seo: 78, lastAiReview: '2026-05-05' },
  { title: 'Blog',                  url: '/blog',                  type: 'Blog',    status: 'Published', words: 450,  seo: 60, lastAiReview: '2026-05-15' },
  { title: 'Privacy Policy',        url: '/privacy',               type: 'Legal',   status: 'Draft',     words: 1800, seo: 42, lastAiReview: '2026-04-12' },
  { title: 'Terms & Conditions',    url: '/terms',                 type: 'Legal',   status: 'Draft',     words: 2100, seo: 38, lastAiReview: '2026-04-12' },
  { title: 'AI Chat',               url: '/chat',                  type: 'Static',  status: 'Review',    words: 280,  seo: 55, lastAiReview: '2026-05-01' },
]

function typeBadge(type: PageRow['type']) {
  if (type === 'Landing') return 'text-slate-400 bg-sky-500/10 border-sky-500/20'
  if (type === 'Blog')    return 'text-slate-400 bg-violet-500/10 border-violet-500/20'
  if (type === 'Legal')   return 'text-slate-400 bg-surface-2 border-line-strong'
  return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
}

function statusBadge(status: PageRow['status']) {
  if (status === 'Published') return 'text-gold bg-gold/10 border-gold/20'
  if (status === 'Review')    return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  return 'text-slate-400 bg-surface-2 border-line-strong'
}

function seoColor(score: number) {
  if (score >= 80) return 'text-gold'
  if (score >= 60) return 'text-gold'
  return 'text-slate-400'
}

type FilterKey = 'All' | PageRow['type'] | PageRow['status']
const FILTERS: FilterKey[] = ['All', 'Landing', 'Blog', 'Static', 'Legal', 'Published', 'Review', 'Draft']

export default function WebsitePagesPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<string[]>([])
  const filtered = websitePages.filter((p) => {
    if (activeFilter === 'All') return true
    return p.type === activeFilter || p.status === activeFilter
  })

  function startReview(slug: string) {
    setReviewing(slug)
    toast.promise(new Promise(r => setTimeout(r, 2000)), {
      loading: 'AI reviewing page…',
      success: 'Review complete',
      error: 'Review failed',
    })
    setTimeout(() => { setReviewing(null); setReviewed(r => [...r, slug]) }, 2000)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        <FileText className="h-3.5 w-3.5" />
        AI Manager · Pages
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          Website Pages
        </h1>
        <button
          disabled={reviewing !== null}
          onClick={() => {
            setReviewing('all')
            toast.promise(new Promise(r => setTimeout(r, 2500)), {
              loading: `Reviewing ${filtered.length} pages…`,
              success: 'All pages reviewed',
              error: 'Review failed',
            })
            setTimeout(() => { setReviewing(null); setReviewed(filtered.map(p => p.slug)) }, 2500)
          }}
          className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {reviewing === 'all' ? 'Reviewing…' : 'AI Review All'}
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

      {/* Stats */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span className="text-slate-500">Total </span>
          <span className="font-semibold text-slate-100">{websitePages.length}</span>
        </div>
        <div className="rounded-xl border border-gold/20 bg-gold/10 px-4 py-2.5 text-sm">
          <span className="text-slate-500">Published </span>
          <span className="font-semibold text-gold">{websitePages.filter((p) => p.status === 'Published').length}</span>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm">
          <span className="text-slate-500">Needs Review </span>
          <span className="font-semibold text-amber-400">{websitePages.filter((p) => p.status === 'Review').length}</span>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span className="text-slate-500">Draft </span>
          <span className="font-semibold text-slate-400">{websitePages.filter((p) => p.status === 'Draft').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface-2">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-line">
              {['Page Title', 'URL', 'Type', 'Status', 'Words', 'SEO Score', 'Last AI Review', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((page) => (
              <tr key={page.url} className="group transition hover:bg-surface-2">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    {page.status === 'Review'
                      ? <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                      : <Globe className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                    }
                    <span className="text-sm font-medium text-slate-300">{page.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{page.url}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium ${typeBadge(page.type)}`}>
                    {page.type}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium ${statusBadge(page.status)}`}>
                    {page.status === 'Published' && <Check className="h-3 w-3" />}
                    {page.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-400">{page.words.toLocaleString()}</td>
                <td className="px-4 py-3.5">
                  <span className={`text-sm font-semibold ${seoColor(page.seo)}`}>{page.seo}</span>
                  <span className="text-xs text-slate-500">/100</span>
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-400">{page.lastAiReview}</td>
                <td className="px-4 py-3.5">
                  {reviewed.includes(page.slug) ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <Check className="h-3 w-3" /> Reviewed
                    </span>
                  ) : (
                    <button
                      disabled={reviewing === page.slug}
                      onClick={() => startReview(page.slug)}
                      className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      <Sparkles className="h-3 w-3" />
                      {reviewing === page.slug ? 'Reviewing…' : 'AI Review'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
