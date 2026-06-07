import type { LucideIcon } from 'lucide-react'

/**
 * A confident "nothing here yet" state — never leave a region blank.
 * Dashed surface, centred icon, title, supporting copy and an optional CTA.
 */
export function EmptyState({
  Icon,
  title,
  description,
  action,
  className = '',
}: {
  Icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center ${className}`}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-slate-500">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
