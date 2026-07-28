import type { LucideIcon } from 'lucide-react'

/**
 * In-page FILTER pill (never navigation). One selected treatment everywhere:
 * gold ring + soft gold fill. Works as a button; pass Icon for a leading glyph.
 */
export function SegmentPill({
  selected = false,
  Icon,
  className = '',
  children,
  ...props
}: {
  selected?: boolean
  Icon?: LucideIcon
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        selected
          ? 'border-gold/40 bg-gold/10 text-gold'
          : 'border-line bg-surface-2 text-slate-300 hover:text-white',
        className,
      ].join(' ')}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  )
}
