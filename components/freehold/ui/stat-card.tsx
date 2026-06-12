import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export type StatDelta = { value: string; direction: 'up' | 'down' | 'flat' }

/** A single KPI tile — one consistent metric card used across the product. */
export function StatCard({
  label,
  value,
  delta,
  hint,
  Icon,
  accent,
  className = '',
}: {
  label: string
  value: React.ReactNode
  delta?: StatDelta
  hint?: string
  Icon?: LucideIcon
  /** optional accent colour for the icon chip (defaults to muted) */
  accent?: string
  className?: string
}) {
  const dirColor =
    delta?.direction === 'up' ? 'text-emerald-400'
    : delta?.direction === 'down' ? 'text-red-400'
    : 'text-slate-400'
  const DirIcon = delta?.direction === 'down' ? ArrowDownRight : ArrowUpRight

  return (
    <div className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm text-slate-400">{label}</span>
        {Icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-slate-400"
            style={accent ? { color: accent } : undefined}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white tabular-nums">{value}</div>
      {(delta || hint) && (
        <div className="mt-1.5 flex items-center gap-2">
          {delta && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${dirColor}`}>
              {delta.direction !== 'flat' && <DirIcon className="h-3 w-3" />}
              {delta.value}
            </span>
          )}
          {hint && <span className="truncate text-xs text-slate-500">{hint}</span>}
        </div>
      )}
    </div>
  )
}
