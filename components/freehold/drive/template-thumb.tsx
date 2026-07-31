'use client'

import { useEffect, useState } from 'react'
import {
  PALETTES, FORMATS, composeVariant, ensureAdFonts,
  type FormatKey, type LayoutKey, type Overlay,
} from '@/lib/freehold/ad-compose'

// One font resolution shared by every thumb on the page.
let fontsPromise: Promise<void> | null = null
const fontsOnce = () => (fontsPromise = fontsPromise ?? ensureAdFonts())

/**
 * A LIVE template preview — rendered by the same canvas engine that composes
 * the real ads, at thumbnail scale. When the caller passes a real listing
 * photo (`img`) the preview composes WITH it — the gallery shows the user's
 * own inventory in the designs; otherwise the engine draws its styled photo
 * ghost. Either way, what you see is exactly what the Ad Designer produces.
 */
export function TemplateThumb({
  layout, palette, format, overlay, img = null, index = 0, scale = 0.3, className = '',
}: {
  layout: LayoutKey
  palette: number
  format: FormatKey
  overlay: Overlay
  /** A pre-loaded (CORS-clean) listing photo; null → styled ghost. */
  img?: HTMLImageElement | null
  /** Position in its gallery — used to stagger composing. */
  index?: number
  /** Compose scale. 0.3 suits a gallery card; a 64px strip needs far less. */
  scale?: number
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let timer = 0
    // Fonts first: composing before the Arabic face resolves bakes the
    // fallback into the preview the user judges the template by. One shared
    // promise — not one per thumb.
    fontsOnce().then(() => {
      if (!alive) return
      // Stagger by position so a gallery of 15 doesn't run 15 full canvas
      // composes and PNG encodes back-to-back on the main thread — that is a
      // multi-second freeze on a mid-range phone.
      timer = window.setTimeout(() => {
        if (!alive) return
        const p = PALETTES[palette] ?? PALETTES[0]
        try { setUrl(composeVariant(img, layout, p, overlay, format, scale)) }
        catch {
          // A tainted/broken image must not kill the preview — use the ghost.
          try { setUrl(composeVariant(null, layout, p, overlay, format, scale)) }
          catch { setUrl(null) }
        }
      }, Math.min(index, 24) * 24)
    })
    return () => { alive = false; if (timer) window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, palette, format, img, index, scale, overlay.eyebrow, overlay.headline, overlay.price, overlay.priceUnit, overlay.footnote])

  const { w, h } = FORMATS[format]
  if (!url) {
    return <div className={`w-full animate-pulse rounded-lg bg-surface-3/80 ${className}`} style={{ aspectRatio: `${w} / ${h}` }} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`w-full rounded-lg object-cover ${className}`} style={{ aspectRatio: `${w} / ${h}` }} />
  )
}
