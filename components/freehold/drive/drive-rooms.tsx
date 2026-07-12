'use client'

import Link from 'next/link'
import { Sparkles, Wand2, Monitor, FolderOpen, Cloud, ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// The Drive home as five clear rooms — each opens the real surface behind it.
// Generation lives in the Studio, editing in the Media Editor, landing pages in
// the Web Designer, your generated files in the Files Manager, and account-level
// raw files in the Cloud. One map instead of a crowded wall of tiles.
type Room = { key: string; href: string; Icon: React.ElementType; accent: string }

const ROOMS: Room[] = [
  { key: 'studio',   href: '/freehold-intelligence/drive/studio',           Icon: Sparkles,   accent: 'text-gold border-gold/25 bg-gold/[0.06]' },
  { key: 'editor',   href: '/freehold-intelligence/drive/library',          Icon: Wand2,      accent: 'text-violet-300 border-violet-400/25 bg-violet-400/[0.06]' },
  { key: 'web',      href: '/freehold-intelligence/drive/web',              Icon: Monitor,    accent: 'text-teal-300 border-teal-400/25 bg-teal-400/[0.06]' },
  { key: 'files',    href: '/freehold-intelligence/drive/files',            Icon: FolderOpen, accent: 'text-sky-300 border-sky-400/25 bg-sky-400/[0.06]' },
  { key: 'cloud',    href: '/freehold-intelligence/cloud',                  Icon: Cloud,      accent: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.06]' },
]

export function DriveRooms() {
  const t = useT()
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <div className="mb-1 flex items-baseline gap-2">
        <h1 className="text-lg font-semibold text-white">{t('drive.rooms.title')}</h1>
      </div>
      <p className="mb-4 text-xs text-slate-500">{t('drive.rooms.subtitle')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROOMS.map(({ key, href, Icon, accent }) => (
          <Link key={key} href={href}
            className="group relative flex items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 transition hover:border-line-strong hover:bg-surface-2">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${accent}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-100">
                {t(`drive.room.${key}.title`)}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-slate-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 rtl:-scale-x-100" />
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{t(`drive.room.${key}.desc`)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
