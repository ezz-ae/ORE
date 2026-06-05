'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { BookOpen, Plus, Sparkles, Calendar, Check, CheckCircle } from 'lucide-react'

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

const FILTERS: Array<TopicStatus | 'All'> = ['All', 'Published', 'Draft', 'Scheduled', 'Idea']
const CATEGORY_FILTERS: Array<TopicCategory | 'All'> = ['All', 'Market News', 'Area Guide', 'Investment', 'Legal', 'Lifestyle']

function categoryBadge(cat: TopicCategory) {
  if (cat === 'Market News') return 'text-white/55 bg-sky-500/10 border-sky-500/20'
  if (cat === 'Area Guide')  return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20'
  if (cat === 'Investment')  return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20'
  if (cat === 'Legal')       return 'text-white/55 bg-violet-500/10 border-violet-500/20'
  return 'text-white/55 bg-rose-500/10 border-rose-500/20'
}

function statusBadge(status: TopicStatus) {
  if (status === 'Published')  return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20'
  if (status === 'Scheduled')  return 'text-white/55 bg-sky-500/10 border-sky-500/20'
  if (status === 'Idea')       return 'text-white/40 bg-white/[0.04] border-white/[0.08]'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

function seoColor(score: number) {
  if (score === 0)   return 'text-white/25'
  if (score >= 80)   return 'text-[#D4AF37]'
  if (score >= 60)   return 'text-[#D4AF37]'
  return 'text-white/55'
}

export default function TopicsPage() {
  const [activeFilter, setActiveFilter] = useState<TopicStatus | 'All'>('All')
  const [categoryFilter, setCategoryFilter] = useState<TopicCategory | 'All'>('All')
  const [topicStatuses, setTopicStatuses] = useState<Record<string, TopicStatus>>({})
  const [flash, setFlash] = useState<string | null>(null)

  function getStatus(topic: TopicRow): TopicStatus {
    return topicStatuses[topic.title] ?? topic.status
  }

  function triggerFlash(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2500)
  }

  function handlePublish(topic: TopicRow) {
    setTopicStatuses((prev) => ({ ...prev, [topic.title]: 'Published' }))
    triggerFlash(`Published: "${topic.title.slice(0, 45)}"`)
  }

  function handleGenerate(topic: TopicRow) {
    setTopicStatuses((prev) => ({ ...prev, [topic.title]: 'Draft' }))
    triggerFlash(`Generated draft: "${topic.title.slice(0, 40)}"`)
  }

  const filtered = useMemo(() => {
    return topics.filter((t) => {
      const status = getStatus(t)
      if (activeFilter !== 'All' && status !== activeFilter) return false
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, categoryFilter, topicStatuses])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-white/55/80">
        <BookOpen className="h-3.5 w-3.5" />
        AI Manager · Topics
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
          Topics &amp; Content Calendar
        </h1>
        <button className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-white/55 transition hover:bg-rose-500/20">
          <Plus className="h-4 w-4" />
          Generate Topic
        </button>
      </div>

      {/* Status filter pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f as TopicStatus | 'All')}
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
      {/* Category filter */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c as TopicCategory | 'All')}
            className={[
              'rounded-full px-2.5 py-0.5 text-[13px] font-medium transition border',
              categoryFilter === c
                ? 'border-white/25 bg-white/[0.06] text-white/80'
                : 'border-white/[0.08] text-white/30 hover:text-white/55',
            ].join(' ')}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-2.5 text-sm">
          <span className="text-white/40">Total </span>
          <span className="font-semibold text-white/90">{topics.length}</span>
        </div>
        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Published </span>
          <span className="font-semibold text-[#D4AF37]">{topics.filter((t) => t.status === 'Published').length}</span>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2.5 text-sm">
          <span className="text-white/40">Scheduled </span>
          <span className="font-semibold text-white/55">{topics.filter((t) => t.status === 'Scheduled').length}</span>
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
                <th key={h} className="px-4 py-3 text-left text-[13px] font-medium uppercase tracking-widest text-white/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-white/30">
                  No topics match these filters.
                </td>
              </tr>
            ) : filtered.map((topic, i) => {
              const effectiveStatus = getStatus(topic)
              return (
              <tr key={i} className="group transition hover:bg-white/[0.02]">
                <td className="px-4 py-3.5">
                  <span className="text-sm font-medium leading-snug text-white/80">{topic.title}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${categoryBadge(topic.category)}`}>
                    {topic.category}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${statusBadge(effectiveStatus)}`}>
                    {effectiveStatus === 'Published' && <Check className="h-3 w-3" />}
                    {effectiveStatus === 'Scheduled' && <Calendar className="h-3 w-3" />}
                    {effectiveStatus}
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
                    {effectiveStatus === 'Published' ? (
                      <span className="flex items-center gap-1 text-[13px] text-[#D4AF37]">
                        <CheckCircle className="h-3 w-3" /> Live
                      </span>
                    ) : (
                      <>
                        <button className="text-xs text-white/40 transition hover:text-white/70">Edit</button>
                        <button
                          onClick={() => effectiveStatus === 'Idea' ? handleGenerate(topic) : handlePublish(topic)}
                          className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[13px] font-medium text-white/55 transition hover:bg-rose-500/20"
                        >
                          <Sparkles className="h-3 w-3" />
                          {effectiveStatus === 'Idea' ? 'Generate' : 'Publish'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {flash && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#D4AF37]/25 bg-[#131B2B] px-5 py-2.5 text-[13px] font-medium text-[#D4AF37] shadow-xl">
          {flash}
        </div>
      )}
    </div>
  )
}
