'use client'

import Link from 'next/link'
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
  if (type === 'Landing') return 'text-sky-400 bg-sky-500/10 border-sky-500/20'
  if (type === 'Blog')    return 'text-violet-400 bg-violet-500/10 border-violet-500/20'
  if (type === 'Legal')   return 'text-white/40 bg-white/[0.04] border-white/10'
  return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
}

function statusBadge(status: PageRow['status']) {
  if (status === 'Published') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (status === 'Review')    return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

function seoColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-[#D4AF37]'
  return 'text-rose-400'
}

export default function WebsitePagesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-rose-400/80">
        <FileText className="h-3.5 w-3.5" />
        AI Manager · Pages
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
          Website Pages
        </h1>
        <button className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/20">
          <Sparkles className="h-4 w-4" />
          AI Review All
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Total </span>
          <span className="font-semibold text-white/90">{websitePages.length}</span>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Published </span>
          <span className="font-semibold text-emerald-400">{websitePages.filter((p) => p.status === 'Published').length}</span>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Needs Review </span>
          <span className="font-semibold text-amber-400">{websitePages.filter((p) => p.status === 'Review').length}</span>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Draft </span>
          <span className="font-semibold text-white/60">{websitePages.filter((p) => p.status === 'Draft').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.03]">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Page Title', 'URL', 'Type', 'Status', 'Words', 'SEO Score', 'Last AI Review', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-white/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {websitePages.map((page) => (
              <tr key={page.url} className="group transition hover:bg-white/[0.02]">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    {page.status === 'Review'
                      ? <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                      : <Globe className="h-3.5 w-3.5 flex-shrink-0 text-white/25" />
                    }
                    <span className="text-sm font-medium text-white/80">{page.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-white/40">{page.url}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${typeBadge(page.type)}`}>
                    {page.type}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadge(page.status)}`}>
                    {page.status === 'Published' && <Check className="h-3 w-3" />}
                    {page.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-sm text-white/50">{page.words.toLocaleString()}</td>
                <td className="px-4 py-3.5">
                  <span className={`text-sm font-semibold ${seoColor(page.seo)}`}>{page.seo}</span>
                  <span className="text-xs text-white/25">/100</span>
                </td>
                <td className="px-4 py-3.5 text-xs text-white/40">{page.lastAiReview}</td>
                <td className="px-4 py-3.5">
                  <button className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400 transition hover:bg-rose-500/20">
                    <Sparkles className="h-3 w-3" />
                    AI Review
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
