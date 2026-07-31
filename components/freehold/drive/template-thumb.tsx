'use client'

import { useEffect, useState } from 'react'
import {
  PALETTES, FORMATS, composeVariant,
  type FormatKey, type LayoutKey, type Overlay,
} from '@/lib/freehold/ad-compose'

/**
 * A LIVE template preview — rendered by the same canvas engine that composes
 * the real ads, at thumbnail scale. When the caller passes a real listing
 * photo (`img`) the preview composes WITH it — the gallery shows the user's
 * own inventory in the designs; otherwise the engine draws its styled photo
 * ghost. Either way, what you see is exactly what the Ad Designer produces.
 */
export function TemplateThumb({
  layout, palette, format, overlay, img = null, className = '',
}: {
  layout: LayoutKey
  palette: number
  format: FormatKey
  overlay: Overlay
  /** A pre-loaded (CORS-clean) listing photo; null → styled ghost. */
  img?: HTMLImageElement | null
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    // Compose off the paint path; 0.3× keeps the canvas cheap and crisp.
    const id = window.requestAnimationFrame(() => {
      try { setUrl(composeVariant(img, layout, PALETTES[palette] ?? PALETTES[0], overlay, format, 0.3)) }
      catch {
        // A tainted/broken image must not kill the preview — fall back to the ghost.
        try { setUrl(composeVariant(null, layout, PALETTES[palette] ?? PALETTES[0], overlay, format, 0.3)) }
        catch { setUrl(null) }
      }
    })
    return () => window.cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, palette, format, img, overlay.eyebrow, overlay.headline, overlay.price, overlay.priceUnit, overlay.footnote])

  const { w, h } = FORMATS[format]
  if (!url) {
    return <div className={`w-full animate-pulse rounded-lg bg-surface-3/80 ${className}`} style={{ aspectRatio: `${w} / ${h}` }} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`w-full rounded-lg object-cover ${className}`} style={{ aspectRatio: `${w} / ${h}` }} />
  )
}
