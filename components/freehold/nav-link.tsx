'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

export function NavLink({
  href,
  label,
  icon: Icon,
  exact = false,
  badge,
}: {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badge?: number
}) {
  const pathname = usePathname()
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 border px-3 py-2.5 text-sm transition ${
        isActive
          ? 'border-gold/40 bg-gold/[0.08] text-white'
          : 'border-transparent text-slate-400 hover:border-gold/25 hover:bg-surface-2 hover:text-white'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-gold' : 'text-gold/60'}`} />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`shrink-0 text-xs font-semibold tabular-nums ${isActive ? 'text-gold' : 'text-gold/70'}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}

export function SmallNavLink({
  href,
  label,
  badge,
}: {
  href: string
  label: string
  badge?: number
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`flex items-center justify-between border px-3 py-2 text-xs transition ${
        isActive
          ? 'border-gold/30 bg-gold/[0.07] text-white'
          : 'border-white/5 bg-surface-2 text-slate-400 hover:border-gold/20 hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-2 shrink-0 tabular-nums text-gold">{badge}</span>
      )}
    </Link>
  )
}
