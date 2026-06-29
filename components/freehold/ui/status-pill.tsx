export type StatusTone = 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral'

const TONES: Record<StatusTone, string> = {
  gold:    'border-gold/30 bg-gold/10 text-gold',
  green:   'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  red:     'border-red-500/30 bg-red-500/10 text-red-300',
  amber:   'border-amber-500/30 bg-amber-500/10 text-amber-300',
  // 'blue' kept as a tone name for back-compat but mapped to brand teal (no cold blue).
  blue:    'border-teal-400/30 bg-teal-400/10 text-teal-300',
  violet:  'border-violet-400/30 bg-violet-400/10 text-violet-300',
  neutral: 'border-line-strong bg-surface-2 text-slate-300',
}

const DOT: Record<StatusTone, string> = {
  gold: 'bg-gold', green: 'bg-emerald-400', red: 'bg-red-400',
  amber: 'bg-amber-400', blue: 'bg-teal-400', violet: 'bg-violet-400', neutral: 'bg-slate-400',
}

/** A small status badge with a consistent tonal palette. */
export function StatusPill({
  tone = 'neutral',
  dot = false,
  children,
  className = '',
}: {
  tone?: StatusTone
  dot?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  )
}
