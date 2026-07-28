import type { LucideIcon } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold-soft' | 'icon'
export type ButtonSize = 'sm' | 'md' | 'icon-sm' | 'icon-md'

// The ONE button canon (pill shape — the most-used treatment in the app).
// primary text uses text-ink (the on-gold token) and hovers to gold-bright;
// never hard-code #F8E7AE / text-black in surfaces.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:     'bg-gold text-ink hover:bg-gold-bright border border-transparent',
  secondary:   'border border-line-strong bg-surface-2 text-slate-200 hover:bg-surface-3 hover:text-white',
  ghost:       'border border-transparent text-slate-300 hover:bg-surface-2 hover:text-white',
  danger:      'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  'gold-soft': 'border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20',
  icon:        'border border-transparent text-slate-400 hover:bg-surface-2 hover:text-white',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3.5 text-xs',
  md: 'h-10 gap-2 px-5 text-sm',
  'icon-sm': 'h-8 w-8',
  'icon-md': 'h-10 w-10',
}

/** Shared class string for buttons — also usable on <Link>/<a> for consistency. */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className = '',
) {
  return `inline-flex items-center justify-center rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`
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
