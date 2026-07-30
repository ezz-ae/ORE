'use client'

import { useEffect, useState } from 'react'
import {
  PALETTES, FORMATS, composeVariant,
  type FormatKey, type LayoutKey, type Overlay,
} from '@/lib/freehold/ad-compose'

/**
 * A LIVE template preview — rendered by the same canvas engine that composes
 * the real ads, at thumbnail scale, with a styled photo ghost where the
 * listing image will go. What you see in the gallery is exactly the design
 * the Ad Designer will produce.
 */
export function TemplateThumb({
  layout, palette, format, overlay, className = '',
}: {
  layout: LayoutKey
  palette: number
  format: FormatKey
  overlay: Overlay
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    // Compose off the paint path; 0.3× keeps the canvas cheap and crisp.
    const id = window.requestAnimationFrame(() => {
      try { setUrl(composeVariant(null, layout, PALETTES[palette] ?? PALETTES[0], overlay, format, 0.3)) }
      catch { setUrl(null) }
    })
    return () => window.cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, palette, format, overlay.eyebrow, overlay.headline, overlay.price, overlay.priceUnit, overlay.footnote])

  const { w, h } = FORMATS[format]
  if (!url) {
    return <div className={`w-full animate-pulse rounded-lg bg-surface-3/80 ${className}`} style={{ aspectRatio: `${w} / ${h}` }} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`w-full rounded-lg object-cover ${className}`} style={{ aspectRatio: `${w} / ${h}` }} />
  )
}
