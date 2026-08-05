'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HardDrive, LayoutGrid, FolderOpen, BookOpen, Wand2, Sparkles } from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { useT } from '@/lib/i18n/provider'

// Drive is open to every signed-in role (mirrors Notebook's openness). The
// Library API already scopes rows per-user; each editor re-guards its own route.
const ALLOWED_ROLES = ['admin', 'sales_manager', 'director', 'ceo', 'marketing', 'broker'] as const

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useSessionGuard([...ALLOWED_ROLES])
  const pathname = usePathname()
  const t = useT()

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )

  // The per-asset editor canvases bring their OWN full-height chrome
  // (DriveEditorFrame), so they render full-bleed under the top spine — no
  // Drive header/sidebar (the /drive/editor launcher keeps the shell).
  const isCanvas = /^\/freehold-intelligence\/drive\/editor\/(doc|pdf)\//.test(pathname)
  if (isCanvas) return <>{children}</>

  // Drive is about FILES — the design apps moved to the Creative Suite, so the
  // nav is home · editor (doc/PDF) · library · notebook.
  const items = [
    { label: t('drive.nav.all'),      href: '/freehold-intelligence/drive',          exact: true, Icon: LayoutGrid },
    { label: t('drive.nav.editor'),   href: '/freehold-intelligence/drive/editor',                Icon: Wand2 },
    { label: t('drive.nav.library'),  href: '/freehold-intelligence/drive/library',               Icon: FolderOpen },
    // Notebook lives under Drive — links out to its existing route (not moved).
    { label: t('drive.nav.notebook'), href: '/freehold-intelligence/notebook',                    Icon: BookOpen },
  ]
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="flex flex-col min-h-full">
      {/* App header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-chrome/97 px-5 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-teal-400/25 bg-teal-400/10">
            <HardDrive className="h-3.5 w-3.5 text-teal-400" />
          </div>
          <span className="text-sm font-semibold text-white">{t('drive.homeTitle')}</span>
          <span className="hidden text-xs text-slate-500 sm:block">· {t('drive.tag')}</span>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop hover sidebar */}
        <aside className="group/nav hidden lg:flex lg:flex-col sticky top-14 h-[calc(100vh-56px)] w-[52px] hover:w-56 shrink-0 transition-[width] duration-200 overflow-hidden border-e border-white/[0.07] bg-chrome">
          <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
            {items.map((item) => {
              const active = isActive(item.href, item.exact)
              const Icon = item.Icon
              return (
                <Link key={item.href} href={item.href}
                  className={['flex items-center rounded-lg px-[13px] py-2 text-sm font-medium transition-colors',
                    active ? 'bg-gold/10 text-white border border-gold/15' : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent'].join(' ')}>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-gold' : 'text-slate-500'}`} />
                  <span className="overflow-hidden whitespace-nowrap opacity-0 max-w-0 group-hover/nav:opacity-100 group-hover/nav:max-w-[160px] transition-all duration-150 ms-0 group-hover/nav:ms-2.5">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="lg:hidden sticky top-14 z-30 overflow-x-auto border-b border-white/[0.07] bg-chrome/95 backdrop-blur-xl">
            <nav className="flex min-w-max px-4">
              {items.map((tab) => {
                const active = isActive(tab.href, tab.exact)
                return (
                  <Link key={tab.href} href={tab.href}
                    className={['inline-flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      active ? 'border-gold text-white' : 'border-transparent text-slate-400 hover:text-slate-200'].join(' ')}>
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
