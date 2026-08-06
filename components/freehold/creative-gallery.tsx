'use client'

/**
 * Present a set of creatives, rather than list them.
 *
 * The generated ad kit was a row of 176px thumbnails. At that size you cannot
 * read the headline, judge the crop, or show it to anyone — it is a file
 * listing wearing the clothes of a preview. This is the other thing: one
 * creative large, its neighbours peeking either side, and the background lit by
 * the colours of whatever is on screen, so a Lagoons sunset ad glows warm and a
 * marina night ad glows blue.
 *
 * Deliberately generic. It takes items, not "an ad kit" — the ad set, a
 * template gallery, a folder of designs and a reel plus its GIF are all the
 * same problem, and a second viewer would drift from this one by the third
 * change.
 *
 * Navigation is every way someone will try: arrow keys, the on-screen arrows,
 * dragging, and a trackpad swipe. Escape closes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Download, Package } from 'lucide-react'
import { colorsFromImage } from '@/lib/freehold/palette-extract'
import { useT } from '@/lib/i18n/provider'

export interface GalleryItem {
  id: string
  /** Image data URL or https URL. For a video, the poster. */
  src: string
  /** Present for video items — rendered instead of the still. */
  videoSrc?: string
  /** Shown over the creative, e.g. "Story 9:16". */
  label?: string
  /** Aspect ratio, so the frame is right before the image decodes. */
  aspect?: number
}

const SWIPE_PX = 60
const FALLBACK = ['#1f2937', '#111827', '#0b1220']

export function CreativeGallery({
  items, startAt = 0, onClose, onDownloadOne, onDownloadAll,
}: {
  items: GalleryItem[]
  startAt?: number
  onClose: () => void
  /** Omit to hide the per-item download. */
  onDownloadOne?: (item: GalleryItem) => void
  /** Omit to hide the whole-set download. */
  onDownloadAll?: () => void
}) {
  const t = useT()
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startAt), Math.max(0, items.length - 1)))
  const [colors, setColors] = useState<Record<string, string[]>>({})
  const dragX = useRef(0)

  const count = items.length
  const current = items[index]

  const go = useCallback((delta: number) => {
    if (count === 0) return
    // Wraps, because reaching the end of three creatives and stopping dead is
    // a worse answer than continuing round.
    setIndex((i) => (i + delta + count) % count)
  }, [count])

  // Keyboard: arrows move, Escape closes. RTL is handled by meaning, not by
  // key name — Left always means "the one to the left of what I see".
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [go, onClose])

  /** Read the colours once per item, when its image is decoded. */
  const learnColors = useCallback((item: GalleryItem, el: HTMLImageElement | HTMLVideoElement) => {
    setColors((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: colorsFromImage(el, 3) }))
  }, [])

  const glow = useMemo(() => colors[current?.id ?? ''] ?? FALLBACK, [colors, current])

  if (count === 0 || !current) return null

  return (
    <div
      className="fixed inset-0 z-[160] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.title')}
    >
      {/* Ambient light, from the creative itself. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 28% 18%, ${glow[0]}55 0%, transparent 55%),
              radial-gradient(ellipse at 72% 82%, ${glow[1]}4d 0%, transparent 55%),
              radial-gradient(ellipse at 50% 50%, ${glow[2]}33 0%, transparent 70%),
              linear-gradient(180deg, #07090d 0%, #05070a 100%)`,
          }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 backdrop-blur-3xl" />

      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
        <span className="text-sm font-semibold text-white">{t('gallery.title')}</span>
        <span className="text-xs tabular-nums text-slate-400">{index + 1} / {count}</span>
        <div className="ms-auto flex items-center gap-2">
          {onDownloadAll && (
            <button onClick={onDownloadAll}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-gold/40 hover:text-white">
              <Package className="h-3.5 w-3.5" /> {t('gallery.downloadAll')}
            </button>
          )}
          {onDownloadOne && (
            <button onClick={() => onDownloadOne(current)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-bright">
              <Download className="h-3.5 w-3.5" /> {t('gallery.downloadOne')}
            </button>
          )}
          <button onClick={onClose} aria-label={t('gallery.close')}
            className="rounded-full p-1.5 text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Stage */}
      <div
        className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 sm:px-6"
        onPointerDown={(e) => { dragX.current = e.clientX }}
        onPointerUp={(e) => {
          const dx = e.clientX - dragX.current
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
        }}
      >
        {count > 1 && (
          <NavButton side="start" onClick={() => go(-1)} label={t('gallery.prev')} />
        )}

        <div className="flex h-full w-full items-center justify-center gap-4">
          {/* Neighbours, small and dimmed — they give the set a shape and make
              it obvious there is more than one thing here. */}
          {count > 1 && <Peek item={items[(index - 1 + count) % count]} onClick={() => go(-1)} />}

          <AnimatePresence mode="wait">
            <motion.figure
              key={current.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="relative flex max-h-full min-w-0 flex-col items-center"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.10] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
                {current.videoSrc ? (
                  <video
                    src={current.videoSrc}
                    poster={current.src}
                    controls
                    playsInline
                    className="max-h-[68vh] w-auto max-w-full"
                    onLoadedData={(e) => learnColors(current, e.currentTarget)}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.src}
                    alt={current.label ?? ''}
                    className="max-h-[68vh] w-auto max-w-full"
                    style={current.aspect ? { aspectRatio: String(current.aspect) } : undefined}
                    onLoad={(e) => learnColors(current, e.currentTarget)}
                  />
                )}
              </div>
              {current.label && (
                <figcaption className="mt-3 text-xs font-medium text-slate-300">{current.label}</figcaption>
              )}
            </motion.figure>
          </AnimatePresence>

          {count > 1 && <Peek item={items[(index + 1) % count]} onClick={() => go(1)} />}
        </div>

        {count > 1 && (
          <NavButton side="end" onClick={() => go(1)} label={t('gallery.next')} />
        )}
      </div>

      {/* Filmstrip — jump straight to one, and see the whole set at once. */}
      {count > 1 && (
        <div className="relative z-10 flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-4">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setIndex(i)}
              aria-label={item.label ?? `${i + 1}`}
              aria-current={i === index}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition ${
                i === index ? 'border-gold ring-1 ring-gold/40' : 'border-white/[0.12] opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NavButton({ side, onClick, label }: { side: 'start' | 'end'; onClick: () => void; label: string }) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`absolute ${side === 'start' ? 'start-2' : 'end-2'} top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/[0.12] bg-black/40 p-2.5 text-slate-200 backdrop-blur transition hover:border-gold/40 hover:text-white sm:block`}
    >
      <Icon className="h-5 w-5 rtl:rotate-180" />
    </button>
  )
}

/** A neighbour: visible enough to promise more, quiet enough not to compete. */
function Peek({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      tabIndex={-1}
      aria-hidden
      className="hidden w-[14vw] max-w-[180px] shrink-0 overflow-hidden rounded-xl border border-white/[0.08] opacity-35 blur-[1px] transition hover:opacity-60 lg:block"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.src} alt="" className="h-auto w-full" />
    </button>
  )
}
