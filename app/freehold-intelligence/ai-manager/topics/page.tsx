'use client'

import Link from 'next/link'
import { BookOpen, Plus, Sparkles, Calendar, Check } from 'lucide-react'

type TopicStatus = 'Published' | 'Draft' | 'Scheduled' | 'Idea'
type TopicCategory = 'Market News' | 'Area Guide' | 'Investment' | 'Legal' | 'Lifestyle'

interface TopicRow {
  title: string
  category: TopicCategory
  status: TopicStatus
  scheduledDate?: string
  words: number
  seo: number
}

const topics: TopicRow[] = [
  {
    title: 'Dubai Property Market Q2 2026 Report',
    category: 'Market News',
    status: 'Published',
    words: 2800,
    seo: 91,
  },
  {
    title: 'Top 10 Areas for ROI in Dubai',
    category: 'Investment',
    status: 'Published',
    words: 2400,
    seo: 88,
  },
  {
    title: 'Golden Visa: Complete Guide for Property Investors',
    category: 'Legal',
    status: 'Published',
    words: 3100,
    seo: 94,
  },
  {
    title: 'Off Plan vs Ready Properties',
    category: 'Investment',
    status: 'Scheduled',
    scheduledDate: '2026-06-10',
    words: 1900,
    seo: 82,
  },
  {
    title: 'Dubai Hills Estate: Living Guide',
    category: 'Area Guide',
    status: 'Published',
    words: 2600,
    seo: 89,
  },
  {
    title: 'How to Choose a Developer in Dubai',
    category: 'Investment',
    status: 'Draft',
    words: 1400,
    seo: 64,
  },
  {
    title: 'Palm Jumeirah vs Dubai Marina',
    category: 'Area Guide',
    status: 'Scheduled',
    scheduledDate: '2026-06-15',
    words: 2100,
    seo: 77,
  },
  {
    title: 'UAE Mortgage Guide for Expats',
    category: 'Legal',
    status: 'Draft',
    words: 1700,
    seo: 58,
  },
  {
    title: 'Property Tax in Dubai Explained',
    category: 'Legal',
    status: 'Idea',
    words: 0,
    seo: 0,
  },
  {
    title: 'Best Family Communities 2026',
    category: 'Lifestyle',
    status: 'Idea',
    words: 0,
    seo: 0,
  },
  {
    title: 'Binghatti vs DAMAC: Comparison',
    category: 'Market News',
    status: 'Draft',
    words: 1600,
    seo: 61,
  },
  {
    title: 'Dubai Creek Harbour: Investment Outlook',
    category: 'Area Guide',
    status: 'Scheduled',
    scheduledDate: '2026-06-20',
    words: 2300,
    seo: 80,
  },
]

const FILTERS: Array<TopicStatus | 'All'> = ['All', 'Published', 'Draft', 'Scheduled', 'Ideas']

function categoryBadge(cat: TopicCategory) {
  if (cat === 'Market News') return 'text-sky-400 bg-sky-500/10 border-sky-500/20'
  if (cat === 'Area Guide')  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (cat === 'Investment')  return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20'
  if (cat === 'Legal')       return 'text-violet-400 bg-violet-500/10 border-violet-500/20'
  return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
}

function statusBadge(status: TopicStatus) {
  if (status === 'Published')  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (status === 'Scheduled')  return 'text-sky-400 bg-sky-500/10 border-sky-500/20'
  if (status === 'Idea')       return 'text-white/40 bg-white/[0.04] border-white/[0.08]'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

function seoColor(score: number) {
  if (score === 0)   return 'text-white/25'
  if (score >= 80)   return 'text-emerald-400'
  if (score >= 60)   return 'text-[#D4AF37]'
  return 'text-rose-400'
}

export default function TopicsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-rose-400/80">
        <BookOpen className="h-3.5 w-3.5" />
        AI Manager · Topics
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
          Topics &amp; Content Calendar
        </h1>
        <button className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/20">
          <Plus className="h-4 w-4" />
          Generate Topic
        </button>
      </div>

      {/* Filter pills */}
      <div className="mt-6 flex flex-wrap gap-2">
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
      </div>

      {/* Stats */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Total </span>
          <span className="font-semibold text-white/90">{topics.length}</span>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Published </span>
          <span className="font-semibold text-emerald-400">{topics.filter((t) => t.status === 'Published').length}</span>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Scheduled </span>
          <span className="font-semibold text-sky-400">{topics.filter((t) => t.status === 'Scheduled').length}</span>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Draft </span>
          <span className="font-semibold text-white/60">{topics.filter((t) => t.status === 'Draft').length}</span>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Ideas </span>
          <span className="font-semibold text-white/40">{topics.filter((t) => t.status === 'Idea').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.05] bg-white/[0.03]">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['Title', 'Category', 'Status', 'Scheduled', 'Words', 'SEO', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-widest text-white/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {topics.map((topic, i) => (
              <tr key={i} className="group transition hover:bg-white/[0.02]">
                <td className="px-4 py-3.5">
                  <span className="text-sm font-medium text-white/80 leading-snug">{topic.title}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${categoryBadge(topic.category)}`}>
                    {topic.category}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadge(topic.status)}`}>
                    {topic.status === 'Published' && <Check className="h-3 w-3" />}
                    {topic.status === 'Scheduled' && <Calendar className="h-3 w-3" />}
                    {topic.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs text-white/40">
                  {topic.scheduledDate ?? '—'}
                </td>
                <td className="px-4 py-3.5 text-sm text-white/50">
                  {topic.words > 0 ? topic.words.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3.5">
                  {topic.seo > 0 ? (
                    <>
                      <span className={`text-sm font-semibold ${seoColor(topic.seo)}`}>{topic.seo}</span>
                      <span className="text-xs text-white/25">/100</span>
                    </>
                  ) : (
                    <span className="text-xs text-white/25">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <button className="text-xs text-white/40 transition hover:text-white/70">
                      Edit
                    </button>
                    {topic.status !== 'Published' && (
                      <button className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400 transition hover:bg-rose-500/20">
                        <Sparkles className="h-3 w-3" />
                        {topic.status === 'Idea' ? 'Generate' : 'Publish'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
