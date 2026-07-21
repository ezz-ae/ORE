'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BookOpen, Plus, Sparkles, Check, CheckCircle, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { BRAND } from '@/lib/freehold/brand'

type TopicStatus = 'published' | 'draft'

interface Topic {
  id: string
  title: string
  status: TopicStatus
  body: string
  createdAt: string
}

const FILTERS: Array<TopicStatus | 'all'> = ['all', 'published', 'draft']

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

export default function TopicsPage() {
  const t = useT()

  const statusKey: Record<TopicStatus, string> = {
    published: 'paim.topics.status.published',
    draft: 'paim.topics.status.draft',
  }
  const filterKey: Record<TopicStatus | 'all', string> = {
    all: 'paim.topics.filter.all',
    published: 'paim.topics.filter.published',
    draft: 'paim.topics.filter.draft',
  }
  const colKey = ['paim.topics.col.title', 'paim.topics.col.status', 'paim.topics.col.words', 'paim.topics.col.actions']

  const [items, setItems] = useState<Topic[] | null>(null)
  const [activeFilter, setActiveFilter] = useState<TopicStatus | 'all'>('all')
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const mapRow = (r: Record<string, unknown>): Topic => ({
    id: String(r.id), title: String(r.name ?? ''), status: r.status === 'published' ? 'published' : 'draft',
    body: typeof r.body === 'string' ? r.body : '', createdAt: String(r.created_at ?? ''),
  })

  async function load() {
    const res = await fetch('/api/freehold/web-content?kind=topic', { cache: 'no-store' }).catch(() => null)
    const d = res && res.ok ? await res.json().catch(() => null) : null
    setItems(Array.isArray(d?.items) ? d.items.map(mapRow) : [])
  }
  useEffect(() => { load() }, [])

  // Ask the AI for a fresh topic title and create a real draft row.
  async function handleGenerateTopic() {
    setGenerating(true)
    try {
      const res = await fetch('/api/freehold/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Suggest ONE fresh, specific blog topic title for a Dubai real-estate audience (investors/buyers). Reply with the title only, no quotes, max 12 words.' }),
      })
      const data = await res.json().catch(() => null) as { text?: string } | null
      const title = (data?.text || '').split('\n')[0].replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 90)
      if (!res.ok || !title) { toast.error(t('paim.topics.flash.generateFailed')); return }
      const cr = await fetch('/api/freehold/web-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'topic', name: title, status: 'draft' }),
      })
      if (!cr.ok) { toast.error(t('paim.topics.flash.generateFailed')); return }
      toast.success(t('paim.topics.flash.newTopic', { title: title.slice(0, 45) }))
      load()
    } catch { toast.error(t('paim.topics.flash.generateFailed')) }
    finally { setGenerating(false) }
  }

  // Generate a real article body for a topic and save it.
  async function handleWrite(topic: Topic) {
    setBusyId(topic.id)
    try {
      const res = await fetch('/api/freehold/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Write a publication-ready blog article (400-600 words) for ${BRAND.legalName} UAE titled "${topic.title}". Specific to Dubai real estate, no placeholders.` }),
      })
      const data = await res.json().catch(() => null) as { text?: string } | null
      if (!res.ok || !data?.text) { toast.error(t('paim.topics.flash.generateFailed')); return }
      const up = await fetch('/api/freehold/web-content', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: topic.id, body: data.text }),
      })
      if (!up.ok) { toast.error(t('paim.topics.flash.generateFailed')); return }
      toast.success(t('paim.topics.flash.generatedDraft', { title: topic.title.slice(0, 40) }))
      load()
    } catch { toast.error(t('paim.topics.flash.generateFailed')) }
    finally { setBusyId(null) }
  }

  async function handlePublish(topic: Topic) {
    setBusyId(topic.id)
    try {
      const up = await fetch('/api/freehold/web-content', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: topic.id, status: 'published' }),
      })
      if (!up.ok) { toast.error(t('paim.topics.flash.generateFailed')); return }
      toast.success(t('paim.topics.flash.published', { title: topic.title.slice(0, 45) }))
      load()
    } catch { toast.error(t('paim.topics.flash.generateFailed')) }
    finally { setBusyId(null) }
  }

  const rows = items ?? []
  const filtered = useMemo(
    () => rows.filter((r) => activeFilter === 'all' || r.status === activeFilter),
    [rows, activeFilter],
  )

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        <BookOpen className="h-3.5 w-3.5" />
        {t('paim.topics.breadcrumb')}
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('paim.topics.title')}</h1>
        <button
          disabled={generating}
          onClick={handleGenerateTopic}
          className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-60"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {generating ? t('paim.topics.generating') : t('paim.topics.generateTopic')}
        </button>
      </div>

      {/* Status filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition border ${
              activeFilter === f
                ? 'bg-rose-500/10 border-rose-500/30 text-slate-300'
                : 'border-line-strong bg-surface-2 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t(filterKey[f])}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span className="text-slate-500">{t('paim.topics.stat.total')} </span>
          <span className="font-semibold text-slate-100">{rows.length}</span>
        </div>
        <div className="rounded-xl border border-gold/20 bg-gold/10 px-4 py-2.5 text-sm">
          <span className="text-slate-500">{t('paim.topics.stat.published')} </span>
          <span className="font-semibold text-gold">{rows.filter((r) => r.status === 'published').length}</span>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span className="text-slate-500">{t('paim.topics.stat.draft')} </span>
          <span className="font-semibold text-slate-400">{rows.filter((r) => r.status === 'draft').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface-2">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-line">
              {colKey.map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-500">
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items == null ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">{t('paim.topics.empty')}</td></tr>
            ) : filtered.map((topic) => (
              <tr key={topic.id} className="group transition hover:bg-surface-2">
                <td className="px-4 py-3.5">
                  <span className="text-sm font-medium leading-snug text-slate-300">{topic.title}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium ${topic.status === 'published' ? 'text-gold bg-gold/10 border-gold/20' : 'text-slate-400 bg-surface-2 border-line-strong'}`}>
                    {topic.status === 'published' && <Check className="h-3 w-3" />}
                    {t(statusKey[topic.status])}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-400">
                  {topic.body ? wordCount(topic.body).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    {topic.status === 'published' ? (
                      <span className="flex items-center gap-1 text-sm text-gold"><CheckCircle className="h-3 w-3" /> {t('paim.topics.live')}</span>
                    ) : (
                      <button
                        disabled={busyId === topic.id}
                        onClick={() => (topic.body ? handlePublish(topic) : handleWrite(topic))}
                        className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-60"
                      >
                        {busyId === topic.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {busyId === topic.id ? t('paim.topics.generating') : topic.body ? t('paim.topics.publish') : t('paim.topics.generate')}
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
