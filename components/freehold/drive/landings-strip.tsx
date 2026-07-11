'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Monitor, Pencil, ExternalLink } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { landingEditHref } from '@/lib/freehold/drive'

type Landing = { slug: string; title: string; status: string; updatedAt: string | null }

// Landing pages on the Drive home — the one non-Library asset type, opening in
// its own existing editor. Empty (hidden) for roles without landings.
export function LandingsStrip() {
  const t = useT()
  const [landings, setLandings] = useState<Landing[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/drive/landings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.landings)) setLandings(d.landings) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || landings.length === 0) return null

  const statusColor = (s: string) => (s === 'published' ? '#34D399' : s === 'pending' ? '#FBBF24' : '#94A3B8')

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <div className="mb-3 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-teal-400" />
        <h2 className="text-sm font-semibold text-white">{t('drive.landings.title')}</h2>
        <span className="text-xs text-slate-500">{landings.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {landings.map((l) => (
          <div key={l.slug} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-teal-400"><Monitor className="h-4 w-4" /></span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${statusColor(l.status)}22`, color: statusColor(l.status) }}>{l.status}</span>
            </div>
            <p className="line-clamp-2 text-xs font-medium text-slate-200">{l.title}</p>
            <div className="mt-auto flex items-center gap-1.5">
              <Link href={landingEditHref(l.slug)} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold transition hover:bg-gold/20">
                <Pencil className="h-3 w-3" /> {t('drive.edit')}
              </Link>
              <a href={`/lp/${encodeURIComponent(l.slug)}`} target="_blank" rel="noopener noreferrer" className="ms-auto text-slate-500 transition hover:text-white" title={t('drive.open')}><ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
