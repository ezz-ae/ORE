'use client'

import {
  FORMATS, PALETTES, roundRect, drawWrapped, drawCover, isRtl, adFontStack,
  type FormatKey, type Overlay, type Palette,
} from '@/lib/freehold/ad-compose'

/**
 * REEL COMPOSE — the motion half of the ad engine.
 *
 * Turns still listing photos into a real vertical video: each photo gets a
 * slow Ken Burns push, photos cross-fade into each other, an opening title
 * card carries the project name/area and a closing card carries the price and
 * call to action — all in the SAME design language (palettes, type scale,
 * RTL awareness) the static ad engine uses, so a reel and a feed ad from the
 * same listing look like one campaign.
 *
 * Everything is drawn per-frame onto a canvas the caller records with
 * MediaRecorder — the exported file is real video, not a slideshow of links.
 */

export interface ReelOptions {
  photos: HTMLImageElement[]
  overlay: Overlay
  palette: Palette
  format: FormatKey
  /** Seconds each photo holds (before cross-fade). */
  perPhoto: number
  /** Ken Burns push on/off — off = static frames, still cross-faded. */
  motion: boolean
  /** Opening title card seconds (0 = no title card). */
  titleSecs: number
  /** Closing card seconds (0 = no end card). */
  endSecs: number
}

export const REEL_DEFAULTS = { perPhoto: 3, motion: true, titleSecs: 2, endSecs: 2.5 }
export const REEL_FPS = 30
const FADE = 0.6 // cross-fade seconds between photos

/** Total reel length in seconds for a set of options. */
export function reelDuration(o: Pick<ReelOptions, 'photos' | 'perPhoto' | 'endSecs'>): number {
  const n = Math.max(o.photos.length, 1)
  return Math.max(1, n * o.perPhoto + o.endSecs)
}

const font = (px: number, weight = 700) => `${weight} ${px}px ${adFontStack()}`
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

/** Cover-draw with a Ken Burns transform: scale `s`, drifting by (dx, dy) fractions. */
function drawKenBurns(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  W: number, H: number, s: number, dx: number, dy: number,
) {
  const base = Math.max(W / img.width, H / img.height)
  const scale = base * s
  const dw = img.width * scale
  const dh = img.height * scale
  // Drift stays inside the overscan the zoom created — never reveals an edge.
  const slackX = Math.max(0, dw - W) / 2
  const slackY = Math.max(0, dh - H) / 2
  const x = (W - dw) / 2 + slackX * dx
  const y = (H - dh) / 2 + slackY * dy
  ctx.drawImage(img, x, y, dw, dh)
}

/**
 * Draw ONE frame of the reel at time `t` (seconds) into `ctx`.
 * The caller owns the canvas size (use FORMATS[format]).
 */
export function drawReelFrame(ctx: CanvasRenderingContext2D, t: number, o: ReelOptions): void {
  const { w: W, h: H } = FORMATS[o.format]
  const p = o.palette
  const photos = o.photos
  const rtl = isRtl(o.overlay.headline || o.overlay.eyebrow)
  const Y = (f: number) => Math.round(H * f)

  ctx.save()
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  const ax = rtl ? W - 72 : 72

  // ── Ground: the photo track (Ken Burns + cross-fade) ──
  ctx.fillStyle = p.bg2
  ctx.fillRect(0, 0, W, H)

  if (photos.length > 0) {
    const idx = Math.min(Math.floor(t / o.perPhoto), photos.length - 1)
    const local = t - idx * o.perPhoto           // seconds into this photo
    const prog = Math.min(1, Math.max(0, local / o.perPhoto))
    // Alternate the drift direction per photo so the motion never feels canned.
    const dir = idx % 2 === 0 ? 1 : -1
    const s = o.motion ? 1.04 + 0.1 * easeInOut(prog) : 1.06
    const drift = o.motion ? 0.55 * easeInOut(prog) * dir : 0
    drawKenBurns(ctx, photos[idx], W, H, s, drift, drift * 0.4)

    // Cross-fade the NEXT photo in over the tail of this one.
    const next = photos[idx + 1]
    if (next && local > o.perPhoto - FADE) {
      const a = (local - (o.perPhoto - FADE)) / FADE
      ctx.save()
      ctx.globalAlpha = Math.min(1, Math.max(0, a))
      drawKenBurns(ctx, next, W, H, o.motion ? 1.04 : 1.06, 0, 0)
      ctx.restore()
    }
  } else {
    // No photo: the palette gradient still carries the design language.
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, p.bg)
    g.addColorStop(1, p.bg2)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // Legibility scrims — top and bottom, always (text rides over live photos).
  const top = ctx.createLinearGradient(0, 0, 0, Y(0.34))
  top.addColorStop(0, 'rgba(8,10,14,0.78)')
  top.addColorStop(1, 'rgba(8,10,14,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, Y(0.34))
  const bot = ctx.createLinearGradient(0, H - Y(0.3), 0, H)
  bot.addColorStop(0, 'rgba(8,10,14,0)')
  bot.addColorStop(1, 'rgba(8,10,14,0.86)')
  ctx.fillStyle = bot
  ctx.fillRect(0, H - Y(0.3), W, Y(0.3))

  const total = reelDuration(o)
  const endStart = total - o.endSecs

  // ── Opening title card — fades out over its last 0.6s ──
  if (o.titleSecs > 0 && t < o.titleSecs) {
    const a = t > o.titleSecs - 0.6 ? 1 - (t - (o.titleSecs - 0.6)) / 0.6 : 1
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.max(0, a))
    if (o.overlay.eyebrow) {
      ctx.fillStyle = p.accent
      ctx.font = font(36, 600)
      ctx.fillText(o.overlay.eyebrow, ax, Y(0.1))
    }
    if (o.overlay.headline) {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = font(70, 800)
      drawWrapped(ctx, o.overlay.headline, ax, Y(0.1) + 90, W - 144, 84, 3)
    }
    ctx.restore()
  }

  // ── Persistent lower band: price rides the whole reel until the end card ──
  if (t < endStart && o.overlay.price) {
    ctx.save()
    ctx.fillStyle = p.accent
    ctx.font = font(64, 800)
    ctx.fillText(`${o.overlay.price}${o.overlay.priceUnit ? ` ${o.overlay.priceUnit}` : ''}`, ax, H - Y(0.115))
    if (o.overlay.footnote) {
      ctx.fillStyle = '#E7E5E4'
      ctx.font = font(30, 500)
      ctx.fillText(o.overlay.footnote, ax, H - Y(0.065))
    }
    ctx.restore()
  }

  // ── Closing card — the palette ground rises over the photo, then the offer ──
  if (o.endSecs > 0 && t >= endStart) {
    const a = Math.min(1, (t - endStart) / 0.5)
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    if (o.overlay.eyebrow) {
      ctx.fillStyle = p.accent
      ctx.font = font(34, 600)
      ctx.fillText(o.overlay.eyebrow, W / 2, Y(0.33))
    }
    if (o.overlay.headline) {
      ctx.fillStyle = p.ink
      ctx.font = font(64, 800)
      drawWrapped(ctx, o.overlay.headline, W / 2, Y(0.4), W - 160, 76, 2)
    }
    if (o.overlay.price) {
      ctx.fillStyle = p.chip
      roundRect(ctx, W / 2 - 340, Y(0.56), 680, 170, 85)
      ctx.fill()
      ctx.fillStyle = p.ink
      ctx.font = font(96, 800)
      ctx.fillText(`${o.overlay.price}${o.overlay.priceUnit ? ` ${o.overlay.priceUnit}` : ''}`, W / 2, Y(0.56) + 112)
    }
    if (o.overlay.footnote) {
      ctx.fillStyle = p.ink
      ctx.globalAlpha = 0.75
      ctx.font = font(32, 500)
      ctx.fillText(o.overlay.footnote, W / 2, Y(0.74))
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  ctx.restore()
}

/** A poster still for the reel (frame at 1s) — the Drive thumbnail/cover. */
export function reelPoster(o: ReelOptions): string {
  const { w: W, h: H } = FORMATS[o.format]
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  drawReelFrame(ctx, Math.min(1, o.titleSecs * 0.5), o)
  return c.toDataURL('image/png')
}

export { PALETTES, FORMATS }
