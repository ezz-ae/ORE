import type { LucideIcon } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold-soft'
export type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:     'bg-gold text-ink hover:opacity-90 border border-transparent',
  secondary:   'border border-line-strong bg-surface-2 text-slate-200 hover:bg-surface-3 hover:text-white',
  ghost:       'border border-transparent text-slate-300 hover:bg-surface-2 hover:text-white',
  danger:      'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  'gold-soft': 'border border-gold/25 bg-gold/[0.08] text-gold hover:bg-gold/15',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
}

/** Shared class string for buttons — also usable on <Link>/<a> for consistency. */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className = '',
) {
  return `inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`
}

export function Button({
  variant = 'secondary',
  size = 'md',
  Icon,
  className = '',
  children,
  ...props
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  Icon?: LucideIcon
  children?: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  )
}
