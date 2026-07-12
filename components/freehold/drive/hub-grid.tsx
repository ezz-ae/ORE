'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

export interface HubApp {
  key: string
  href: string
  Icon: React.ElementType
  accent: string
  /** true = opens a full app in this tab; shown with an arrow either way */
  external?: boolean
}

// A room = a launcher of standalone apps. These app tiles are one level DOWN
// from the Drive rooms, so they read as compact, utilitarian tiles (small icon
// chip, single line) — deliberately unlike the big gradient room cards.
// i18n keys: `${nsPrefix}.title/subtitle` and `${nsPrefix}.app.${key}.title/desc`.
export function HubGrid({ nsPrefix, apps, backHref = '/freehold-intelligence/drive' }: {
  nsPrefix: string
  apps: HubApp[]
  backHref?: string
}) {
  const t = useT()
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t('drive.rooms.title')}
      </Link>
      <h1 className="text-lg font-semibold text-white">{t(`${nsPrefix}.title`)}</h1>
      <p className="mb-5 mt-0.5 text-xs text-slate-500">{t(`${nsPrefix}.subtitle`)}</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {apps.map(({ key, href, Icon, accent }) => (
          <Link key={key} href={href}
            className="group flex items-center gap-3 rounded-xl border border-line bg-surface/50 p-3 transition hover:border-line-strong hover:bg-surface-2">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${accent}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                {t(`${nsPrefix}.app.${key}.title`)}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-slate-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 rtl:-scale-x-100" />
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">{t(`${nsPrefix}.app.${key}.desc`)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
