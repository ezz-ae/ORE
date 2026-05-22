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
          ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.08] text-white'
          : 'border-transparent text-white/60 hover:border-[#D4AF37]/25 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-[#D4AF37]/60'}`} />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${isActive ? 'text-[#D4AF37]' : 'text-[#D4AF37]/70'}`}>
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
          ? 'border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] text-white'
          : 'border-white/5 bg-white/[0.02] text-white/50 hover:border-[#D4AF37]/20 hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-2 shrink-0 tabular-nums text-[#D4AF37]">{badge}</span>
      )}
    </Link>
  )
}
