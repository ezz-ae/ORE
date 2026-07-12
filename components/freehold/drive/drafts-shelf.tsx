'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Monitor, Image as ImageIcon, Video, FileType2, Megaphone, Upload, X, Clock } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Draft = { id: string; kind: string; refKey: string; title: string; href: string; updatedAt: string }

const ICON: Record<string, React.ElementType> = {
  doc: FileText, landing: Monitor, image: ImageIcon, video: Video, pdf: FileType2, campaign: Megaphone, upload: Upload,
}

// "Continue editing" — resumable drafts of in-progress work (a document, a
// landing, an uploaded image opened in the editor, a half-built campaign) that
// were autosaved when the tab closed. Hidden entirely when there are none.
export function DraftsShelf() {
  const t = useT()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/drafts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.drafts)) setDrafts(d.drafts) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function dismiss(id: string) {
    setDrafts((p) => p.filter((d) => d.id !== id))
    try { await fetch(`/api/freehold/drafts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
  }

  if (!loaded || drafts.length === 0) return null

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-400/15 text-amber-300"><Clock className="h-3.5 w-3.5" /></span>
        <h2 className="text-[13px] font-semibold text-slate-200">{t('drive.drafts.title')}</h2>
        <span className="text-[11px] text-slate-500">{drafts.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {drafts.map((d) => {
          const Icon = ICON[d.kind] ?? FileText
          return (
            <div key={d.id} className="group relative">
              <Link href={d.href}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 p-3 transition hover:border-amber-400/30 hover:bg-amber-400/[0.05]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-amber-300/80"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-100">{d.title}</span>
                  <span className="block text-[10px] text-slate-500">{t('drive.drafts.resume')}</span>
                </span>
              </Link>
              <button type="button" onClick={() => dismiss(d.id)} title={t('common.delete')}
                className="absolute end-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-300">
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
