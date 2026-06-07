import type { LucideIcon } from 'lucide-react'

/**
 * The standard page header used at the top of every workspace page.
 * Title + optional eyebrow / subtitle / icon on the left, actions on the right.
 * Keeps every screen on the same vertical rhythm and typographic scale.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  Icon,
  actions,
  className = '',
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  eyebrow?: React.ReactNode
  Icon?: LucideIcon
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10">
            <Icon className="h-5 w-5 text-gold" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold">{eyebrow}</div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
