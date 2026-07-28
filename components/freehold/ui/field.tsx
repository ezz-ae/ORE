/**
 * The ONE form-control recipe (audited plurality winners: rounded-lg,
 * border-line, bg-surface-2, py-2, gold/40 focus). Use fieldClass on
 * input/select/textarea; the global .fi-root select rule supplies the chevron.
 */
export type FieldSize = 'sm' | 'md' | 'lg'

const SIZES: Record<FieldSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-3.5 py-2.5 text-sm',
}

export function fieldClass(size: FieldSize = 'md', className = '') {
  return `w-full rounded-lg border border-line bg-surface-2 text-white placeholder:text-slate-500 outline-none transition focus:border-gold/40 ${SIZES[size]} ${className}`
}
