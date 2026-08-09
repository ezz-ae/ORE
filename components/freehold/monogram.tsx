'use client'

import { blendCss, initialsOf } from '@/lib/freehold/monogram'

/**
 * A person, as a monogram on their own blend of the four colours.
 *
 * Replaces the flat tinted square that used to sit next to every name. The
 * colours arrive by being used rather than by repainting anything: the page
 * around this stays exactly as it was.
 *
 * White letters on a saturated blend read the same in dark and light mode, so
 * there is no per-theme handling here and nothing to keep in sync.
 */
export function Monogram({
  name,
  size = 40,
  round = 'full',
  className = '',
  title,
}: {
  name: string
  /** Pixel box. The letters scale with it. */
  size?: number
  round?: 'full' | 'lg' | 'xl' | '2xl'
  className?: string
  title?: string
}) {
  const radius = round === 'full' ? '9999px' : round === 'lg' ? '10px' : round === 'xl' ? '14px' : '18px'
  return (
    <span
      title={title ?? name}
      aria-hidden={false}
      role="img"
      aria-label={name}
      className={`inline-flex shrink-0 select-none items-center justify-center font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: blendCss(name),
        // The letters carry the weight; a hairline keeps the shape readable
        // where a blend's light end meets a light background.
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.16)',
        fontSize: Math.round(size * 0.38),
        lineHeight: 1,
        letterSpacing: '.01em',
      }}
    >
      {initialsOf(name)}
    </span>
  )
}
