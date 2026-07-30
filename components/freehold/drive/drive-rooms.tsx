'use client'

import Link from 'next/link'
import { Sparkles, Wand2, Monitor, FolderOpen, Cloud, ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// The Drive home = five ROOMS. These are the top level, so they read as big,
// distinct entrances (icon tile + a soft accent glow) — deliberately unlike the
// compact app tiles inside a room (HubGrid) and the thumbnail file cards.
type Room = { key: string; href: string; Icon: React.ElementType; icon: string; glow: string; ring: string }

const ROOMS: Room[] = [
  { key: 'studio', href: '/freehold-intelligence/drive/create',  Icon: Sparkles,   icon: 'text-gold',        glow: 'from-gold/15',        ring: 'ring-gold/25' },
  { key: 'editor', href: '/freehold-intelligence/drive/media',   Icon: Wand2,      icon: 'text-violet-300',  glow: 'from-violet-500/15',  ring: 'ring-violet-400/25' },
  { key: 'web',    href: '/freehold-intelligence/drive/web',     Icon: Monitor,    icon: 'text-teal-300',    glow: 'from-teal-500/15',    ring: 'ring-teal-400/25' },
  { key: 'files',  href: '/freehold-intelligence/drive/files',   Icon: FolderOpen, icon: 'text-sky-300',     glow: 'from-sky-500/15',     ring: 'ring-sky-400/25' },
  { key: 'cloud',  href: '/freehold-intelligence/cloud',         Icon: Cloud,      icon: 'text-emerald-300', glow: 'from-emerald-500/15', ring: 'ring-emerald-400/25' },
]

export function DriveRooms() {
  const t = useT()
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <h1 className="text-xl font-semibold text-white">{t('drive.rooms.title')}</h1>
      <p className="mb-5 mt-0.5 text-sm text-slate-500">{t('drive.rooms.subtitle')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROOMS.map(({ key, href, Icon, icon, glow, ring }) => (
          <Link key={key} href={href}
            className="group relative min-h-[168px] overflow-hidden rounded-2xl border border-line bg-surface-2/40 p-6 transition hover:border-line-strong hover:bg-surface-2">
            <div className={`pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${glow} to-transparent blur-2xl opacity-70 transition group-hover:opacity-100`} />
            <span className={`relative grid h-14 w-14 place-items-center rounded-2xl bg-surface-3/80 ring-1 ${ring} ${icon}`}>
              <Icon className="h-7 w-7" />
            </span>
            <div className="relative mt-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                {t(`drive.room.${key}.title`)}
                <ArrowRight className="h-4 w-4 -translate-x-1 text-slate-500 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 rtl:-scale-x-100" />
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{t(`drive.room.${key}.desc`)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
