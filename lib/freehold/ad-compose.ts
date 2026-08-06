'use client'

/**
 * AD COMPOSE — the shared canvas render engine behind the Creative Suite.
 * One design language, used by the Ad Designer (full generative flow) and the
 * suite's template gallery (live thumbnails). Compositions are resolution-aware:
 * horizontal type scales with width, vertical anchors are fractions of height,
 * so the same layout reads right in 4:5, 1:1 and 9:16. Everything is real
 * pixels — what you download is what Meta gets.
 */

export type LayoutKey =
  | 'heroPrice' | 'frame' | 'statFooter' | 'splitCard' | 'badge'
  // ── The Dubai payment-plan family ──
  // Modelled on ads running in this market right now, which sell on TERMS
  // rather than lifestyle: the finance hook is the first thing read, the total
  // price is the largest thing on the page, and the down payment sits in a
  // badge over the render. English lifestyle copy ("discover a vibrant
  // community") is a different pitch entirely, and these layouts exist because
  // the engine could not produce this one at all.
  | 'payBands' | 'payBadge' | 'payReturn'
export type Palette = { bg: string; bg2: string; ink: string; accent: string; chip: string }
export const PALETTES: Palette[] = [
  { bg: '#D9C6A0', bg2: '#CBB488', ink: '#231d12', accent: '#8a6f3c', chip: '#EBDDBE' }, // sand
  { bg: '#0F172A', bg2: '#1E293B', ink: '#F8FAFC', accent: '#D4AF37', chip: '#26334A' }, // ink/gold
  { bg: '#F3EFE6', bg2: '#E7E0D0', ink: '#173B2C', accent: '#C69B3E', chip: '#FFFFFF' }, // ivory/green
  { bg: '#0C2621', bg2: '#14382F', ink: '#ECFDF5', accent: '#D4AF37', chip: '#1D4A3E' }, // emerald/gold
  { bg: '#F5F7FA', bg2: '#E4EAF2', ink: '#152238', accent: '#B48A2C', chip: '#FFFFFF' }, // pearl/navy
  // Taken from ads running in Dubai now — the payment-plan family reads at a
  // glance because the bands are high-contrast, not because they are subtle.
  { bg: '#C8102E', bg2: '#F2C230', ink: '#111111', accent: '#1B2A5B', chip: '#F7E7A6' }, // red/gold — offer
  { bg: '#125B57', bg2: '#8A7B3C', ink: '#FFFFFF', accent: '#C9A227', chip: '#0E3F3C' }, // teal/olive — plan
  { bg: '#6E7A4E', bg2: '#1E88C7', ink: '#FFFFFF', accent: '#D8B45A', chip: '#123A57' }, // olive/blue — return
]
export const LAYOUTS: LayoutKey[] = [
  'heroPrice', 'frame', 'statFooter', 'splitCard', 'badge',
  'payBands', 'payBadge', 'payReturn',
]

export interface Overlay {
  eyebrow: string
  headline: string
  price: string
  priceUnit: string
  footnote: string
  // ── Payment-plan fields ──
  // Optional so every existing layout is untouched; REQUIRED by the pay*
  // layouts, which refuse to render rather than print an ad with a blank
  // where the price should be. See `missingPayFields`.
  /** The band across the top — "80% on handover, bank finance over 25 years". */
  financeHook?: string
  /** Total price, already formatted — "2,830,000". */
  totalPrice?: string
  /** Label above it — "Total price" / "أجمالي السعر". */
  totalLabel?: string
  /** The badge figure — "20%". */
  downPct?: string
  /** Badge caption — "down payment" / "دفعة أولى". */
  downLabel?: string
  /** Second column on payReturn — "75,000". */
  returnvalue?: string
  /** Its label — "Annual return" / "استرد سنوياً". */
  returnLabel?: string
  /** The thin strip at the very bottom — remaining terms, or a phone number. */
  terms?: string
}

/** Layouts that sell on terms and therefore need the payment numbers. */
export const PAY_LAYOUTS: LayoutKey[] = ['payBands', 'payBadge', 'payReturn']
export const isPayLayout = (l: LayoutKey): boolean => PAY_LAYOUTS.includes(l)

/**
 * Which required fields are empty for a payment layout.
 *
 * Returned rather than thrown so the UI can name them before anyone clicks
 * generate. An ad that renders with a blank where the price belongs is worse
 * than no ad: it looks finished, and it goes out.
 */
export function missingPayFields(layout: LayoutKey, o: Overlay): string[] {
  if (!isPayLayout(layout)) return []
  const missing: string[] = []
  if (!o.headline?.trim()) missing.push('headline')
  if (!o.financeHook?.trim()) missing.push('financeHook')
  if (!o.totalPrice?.trim()) missing.push('totalPrice')
  if (!o.downPct?.trim()) missing.push('downPct')
  if (layout === 'payReturn' && !o.returnvalue?.trim()) missing.push('returnValue')
  return missing
}

// Ad formats — real Meta placement resolutions.
export type FormatKey = 'feed' | 'square' | 'story'
export const FORMATS: Record<FormatKey, { w: number; h: number }> = {
  feed:   { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  story:  { w: 1080, h: 1920 },
}

export const isRtl = (s: string) => /[؀-ۿ]/.test(s)

/**
 * The ad engine's canvas font stack.
 *
 * Canvas text renders with whatever font the MACHINE has — so an Arabic ad
 * composed on one agent's laptop and the same ad composed on another's came
 * out in different faces, and neither was chosen. `--font-ad-ar` is the Cairo
 * webfont loaded in app/layout.tsx; it leads the stack so Arabic gets a real
 * Gulf-advertising face, with installed Arabic fonts and then the system sans
 * behind it. Latin copy is unaffected — Cairo carries Latin too, and the
 * system stack still backs it up.
 */
export function adFontStack(): string {
  const webfont = typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--font-ad-ar').trim()
    : ''
  return [
    webfont,
    '"Noto Sans Arabic"', '"Noto Kufi Arabic"', 'Tahoma',
    'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif',
  ].filter(Boolean).join(', ')
}

/**
 * Resolve the ad fonts before composing. Without this the FIRST render of a
 * design uses the fallback face and silently bakes it into the exported
 * pixels — the font arrives a beat later and only the next render looks right.
 */
export async function ensureAdFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    const stack = adFontStack()
    // Load the weights the engine actually draws with, at a nominal size.
    await Promise.all([
      document.fonts.load(`800 64px ${stack}`, 'أب Ab'),
      document.fonts.load(`600 32px ${stack}`, 'أب Ab'),
      document.fonts.load(`500 28px ${stack}`, 'أب Ab'),
    ])
    await document.fonts.ready
  } catch {
    // Font loading is best-effort: a failure must never block composing.
  }
}

/**
 * What each layout actually gives the headline. Kept beside the layouts it
 * describes so the editor can warn about truncation using the SAME numbers the
 * renderer uses, instead of a guessed character count.
 */
const HEADLINE_SPEC: Record<LayoutKey, { px: number; pad: number; maxLines: (f: FormatKey) => number }> = {
  heroPrice:  { px: 58, pad: 128, maxLines: (f) => (f === 'square' ? 2 : 3) },
  frame:      { px: 56, pad: 128, maxLines: () => 2 },
  statFooter: { px: 52, pad: 120, maxLines: () => 2 },
  splitCard:  { px: 56, pad: 128, maxLines: () => 2 },
  badge:      { px: 52, pad: 128, maxLines: () => 2 },
  // The pay family puts the headline in a full-width band, so it gets the
  // whole width less a thin gutter, and two lines before it truncates —
  // matching the real ads, where the headline is one or two dense lines.
  payBands:   { px: 54, pad: 72, maxLines: () => 2 },
  payBadge:   { px: 58, pad: 72, maxLines: () => 3 },
  payReturn:  { px: 50, pad: 72, maxLines: () => 2 },
}

let fitCanvas: HTMLCanvasElement | null = null

/** Does this headline fit the layout, or will the renderer cut it? */
export function fitHeadline(text: string, layout: LayoutKey, fmt: FormatKey): { lines: number; truncated: boolean } {
  const spec = HEADLINE_SPEC[layout]
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!spec || words.length === 0) return { lines: 0, truncated: false }
  if (typeof document === 'undefined') return { lines: 1, truncated: false }
  fitCanvas = fitCanvas ?? document.createElement('canvas')
  const ctx = fitCanvas.getContext('2d')
  if (!ctx) return { lines: 1, truncated: false }
  ctx.font = `800 ${spec.px}px ${adFontStack()}`
  const maxWidth = FORMATS[fmt].w - spec.pad
  const maxLines = spec.maxLines(fmt)
  let lines = 0
  let cur = ''
  let consumed = 0
  for (const w of words) {
    const probe = cur ? `${cur} ${w}` : w
    if (ctx.measureText(probe).width > maxWidth && cur) { lines++; cur = w }
    else cur = probe
    consumed++
    if (lines === maxLines) { consumed--; break }
  }
  if (cur && lines < maxLines) lines++
  return { lines, truncated: consumed < words.length }
}

/**
 * Set ctx.font to the largest size ≤ px at which `text` fits `maxWidth`, and
 * return the size chosen. Prices are the one field whose LENGTH varies wildly
 * — "1.4M" and "95,000" with "AED/month" or "درهم/سنة" are not the same
 * object — and a fixed size made long ones collide or run past the design.
 * NOTE: this deliberately LEAVES ctx.font set to the fitted size; callers draw
 * with it immediately.
 */
export function fitFontOn(
  ctx: CanvasRenderingContext2D, text: string, px: number, weight: number,
  maxWidth: number, min = 22,
): number {
  const stack = adFontStack()
  let size = px
  ctx.font = `${weight} ${size}px ${stack}`
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = `${weight} ${size}px ${stack}`
  }
  return size
}

/**
 * Draw ONE line of text that is guaranteed to stay inside `maxWidth`: shrink
 * to fit, and if it still doesn't fit at the floor size, end it with an
 * ellipsis. Every single-line field on an ad (eyebrow, footnote) goes through
 * this — their content is unbounded in practice, since a listing's area name
 * or payment plan is whatever the inventory says, and the editor's character
 * counters are guidance, not a limit.
 */
export function drawFittedLine(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  maxWidth: number, px: number, weight: number, min = 18,
): void {
  if (!text) return
  fitFontOn(ctx, text, px, weight, maxWidth, min)
  let out = text
  if (ctx.measureText(out).width > maxWidth) {
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1)
    out = `${out}…`
  }
  ctx.fillText(out, x, y)
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Wrap text to maxWidth; returns drawn height. */
export function drawWrapped(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  maxWidth: number, lineHeight: number, maxLines = 3,
): number {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  let consumed = 0
  for (const w of words) {
    const probe = cur ? `${cur} ${w}` : w
    if (ctx.measureText(probe).width > maxWidth && cur) { lines.push(cur); cur = w }
    else cur = probe
    consumed++
    if (lines.length === maxLines) { consumed--; break }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  // Truncation is visible, never silent: overflow gets an ellipsis so the
  // preview admits text was cut instead of ending mid-sentence.
  if (consumed < words.length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}…`
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return lines.length * lineHeight
}

/** Cover-fit draw of an image into a rect. */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

/** Styled placeholder where the photo goes when composing without a source. */
function drawPhotoGhost(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, p.bg2)
  g.addColorStop(1, p.accent)
  ctx.save()
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  // Faint skyline strokes so the ghost reads as "your photo here", not a bug.
  ctx.globalAlpha = 0.18
  ctx.fillStyle = p.ink
  const bw = w / 9
  for (let i = 0; i < 9; i++) {
    const bh = h * (0.22 + 0.5 * Math.abs(Math.sin(i * 2.7)))
    ctx.fillRect(x + i * bw + bw * 0.15, y + h - bh, bw * 0.7, bh)
  }
  ctx.restore()
}

export function composeVariant(
  img: HTMLImageElement | null, layout: LayoutKey, p: Palette, o: Overlay, fmt: FormatKey,
  scale = 1, // < 1 renders a cheap preview (template thumbnails); 1 = export pixels
): string {
  const { w: W, h: H } = FORMATS[fmt]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  const rtl = isRtl(o.headline || o.eyebrow)
  ctx.direction = rtl ? 'rtl' : 'ltr'
  const ax = rtl ? W - 64 : 64            // aligned text x
  ctx.textAlign = rtl ? 'right' : 'left'
  const stack = adFontStack()
  const font = (px: number, weight = 700) => `${weight} ${px}px ${stack}`
  const fitFont = (text: string, px: number, weight: number, maxWidth: number, min = 22) =>
    fitFontOn(ctx, text, px, weight, maxWidth, min)
  // Vertical anchors are height fractions so 1:1 / 4:5 / 9:16 all read right.
  const Y = (f: number) => Math.round(H * f)

  if (layout === 'heroPrice') {
    // Gradient ground, eyebrow + headline, huge price in a soft blob, image bottom.
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, p.bg)
    g.addColorStop(1, p.bg2)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = p.ink
    if (o.eyebrow) drawFittedLine(ctx, o.eyebrow, ax, Y(0.07), W - 128, 34, 600)
    ctx.font = font(58, 800)
    const hh = o.headline ? drawWrapped(ctx, o.headline, ax, Y(0.07) + 80, W - 128, 72, fmt === 'square' ? 2 : 3) : 0
    if (o.price) {
      const py = Y(0.07) + 100 + hh + 60
      const blobW = 760
      ctx.fillStyle = p.chip
      roundRect(ctx, W / 2 - blobW / 2, py - 40, blobW, 220, 110)
      ctx.fill()
      ctx.fillStyle = p.ink
      ctx.textAlign = 'center'
      // Price and unit are laid out as ONE measured group, each shrunk to fit
      // its share of the blob. Fixed positions worked for "1.4M AED" and
      // collided the moment the copy said "4,900" + "AED/month".
      const inner = blobW - 88
      const priceSize = fitFont(o.price, 150, 800, o.priceUnit ? inner * 0.62 : inner)
      const priceW = ctx.measureText(o.price).width
      let unitW = 0
      let unitSize = 0
      if (o.priceUnit) {
        unitSize = fitFont(o.priceUnit, 44, 700, inner * 0.32)
        unitW = ctx.measureText(o.priceUnit).width
      }
      const gap = o.priceUnit ? 22 : 0
      // The unit sits left of the number in BOTH directions: Arabic reads it
      // after the (always-LTR) figure, and Dubai English writes "AED 1.4M".
      const startX = W / 2 - (priceW + gap + unitW) / 2
      if (o.priceUnit) {
        ctx.font = font(unitSize, 700)
        ctx.fillText(o.priceUnit, startX + unitW / 2, py + 105)
      }
      ctx.font = font(priceSize, 800)
      ctx.fillText(o.price, startX + unitW + gap + priceW / 2, py + 105)
      ctx.textAlign = rtl ? 'right' : 'left'
    }
    const imgTop = Y(fmt === 'square' ? 0.56 : 0.52)
    if (o.footnote) {
      ctx.fillStyle = p.ink
      // Never let the footnote ride on top of the price blob: at square with a
      // two-line headline the blob's bottom edge sits below imgTop - 36.
      const blobBottom = o.price ? Y(0.07) + 100 + hh + 60 + 180 : 0
      drawFittedLine(ctx, o.footnote, ax, Math.max(imgTop - 36, blobBottom + 44), W - 128, 28, 500)
    }
    if (img) drawCover(ctx, img, 0, imgTop, W, H - imgTop)
    else drawPhotoGhost(ctx, p, 0, imgTop, W, H - imgTop)
  } else if (layout === 'frame') {
    // Full-bleed image with top/bottom scrims and bands.
    ctx.fillStyle = p.bg2
    ctx.fillRect(0, 0, W, H)
    if (img) drawCover(ctx, img, 0, 0, W, H)
    else drawPhotoGhost(ctx, p, 0, 0, W, H)
    const top = ctx.createLinearGradient(0, 0, 0, Y(0.24))
    top.addColorStop(0, 'rgba(10,10,14,0.82)')
    top.addColorStop(1, 'rgba(10,10,14,0)')
    ctx.fillStyle = top
    ctx.fillRect(0, 0, W, Y(0.24))
    const bot = ctx.createLinearGradient(0, H - Y(0.27), 0, H)
    bot.addColorStop(0, 'rgba(10,10,14,0)')
    bot.addColorStop(1, 'rgba(10,10,14,0.88)')
    ctx.fillStyle = bot
    ctx.fillRect(0, H - Y(0.27), W, Y(0.27))
    ctx.fillStyle = p.accent
    if (o.eyebrow) drawFittedLine(ctx, o.eyebrow, ax, Y(0.065), W - 128, 32, 600)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = font(56, 800)
    if (o.headline) drawWrapped(ctx, o.headline, ax, Y(0.065) + 68, W - 128, 68, 2)
    if (o.price) {
      ctx.fillStyle = p.accent
      const line = `${o.price}${o.priceUnit ? ` ${o.priceUnit}` : ''}`
      fitFont(line, 88, 800, W - 128)
      ctx.fillText(line, ax, H - Y(0.115))
    }
    if (o.footnote) { ctx.fillStyle = '#E7E5E4'; drawFittedLine(ctx, o.footnote, ax, H - Y(0.055), W - 128, 30, 500) }
  } else if (layout === 'splitCard') {
    // splitCard: photo on top, a clean listing card below with an accent rule.
    const split = Y(fmt === 'story' ? 0.58 : 0.55)
    if (img) drawCover(ctx, img, 0, 0, W, split)
    else drawPhotoGhost(ctx, p, 0, 0, W, split)
    ctx.fillStyle = p.bg
    ctx.fillRect(0, split, W, H - split)
    ctx.fillStyle = p.accent
    ctx.fillRect(0, split, W, 8)
    if (o.eyebrow) drawFittedLine(ctx, o.eyebrow, ax, split + 78, W - 128, 30, 600)
    ctx.fillStyle = p.ink
    ctx.font = font(56, 800)
    if (o.headline) drawWrapped(ctx, o.headline, ax, split + 150, W - 128, 66, 2)
    if (o.price) {
      ctx.fillStyle = p.accent
      const line = `${o.price}${o.priceUnit ? ` ${o.priceUnit}` : ''}`
      fitFont(line, 96, 800, W - 128)
      ctx.fillText(line, ax, H - Y(0.095))
    }
    if (o.footnote) { ctx.fillStyle = p.ink; ctx.globalAlpha = 0.75; drawFittedLine(ctx, o.footnote, ax, H - Y(0.04), W - 128, 28, 500); ctx.globalAlpha = 1 }
  } else if (layout === 'badge') {
    // badge: full-bleed photo, a round price badge up top, a solid bottom band.
    if (img) drawCover(ctx, img, 0, 0, W, H)
    else drawPhotoGhost(ctx, p, 0, 0, W, H)
    const band = H - Y(0.24)
    ctx.fillStyle = p.bg
    ctx.fillRect(0, band, W, H - band)
    ctx.fillStyle = p.accent
    ctx.fillRect(0, band, W, 6)
    ctx.font = font(28, 600)
    if (o.eyebrow) { ctx.fillStyle = p.accent; drawFittedLine(ctx, o.eyebrow, ax, band + 60, W - 128, 28, 600) }
    ctx.fillStyle = p.ink
    ctx.font = font(52, 800)
    if (o.headline) drawWrapped(ctx, o.headline, ax, band + 126, W - 128, 62, 2)
    if (o.footnote) { ctx.fillStyle = p.ink; ctx.globalAlpha = 0.7; drawFittedLine(ctx, o.footnote, ax, H - 42, W - 128, 26, 500); ctx.globalAlpha = 1 }
    if (o.price) {
      const R = Math.round(W * 0.155)
      const bx = rtl ? 84 + R : W - 84 - R
      const by = 84 + R
      ctx.save()
      ctx.beginPath()
      ctx.arc(bx, by, R, 0, Math.PI * 2)
      ctx.fillStyle = p.chip
      ctx.fill()
      ctx.lineWidth = 8
      ctx.strokeStyle = p.accent
      ctx.stroke()
      ctx.fillStyle = p.ink
      ctx.textAlign = 'center'
      // The badge is a circle — both lines must fit its chord, not the frame.
      const chord = R * 1.5
      fitFont(o.price, 64, 800, chord)
      ctx.fillText(o.price, bx, by + (o.priceUnit ? 10 : 22))
      if (o.priceUnit) {
        fitFont(o.priceUnit, 30, 700, chord)
        ctx.fillText(o.priceUnit, bx, by + 58)
      }
      ctx.restore()
      ctx.textAlign = rtl ? 'right' : 'left'
    }
  } else {
    // statFooter: headline band, image middle, stat chips at the bottom band.
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = p.ink
    if (o.eyebrow) { ctx.textAlign = 'center'; drawFittedLine(ctx, o.eyebrow, W / 2, Y(0.055), W - 120, 30, 600) }
    ctx.font = font(52, 800)
    ctx.textAlign = 'center'
    if (o.headline) drawWrapped(ctx, o.headline, W / 2, Y(0.055) + 74, W - 120, 62, 2)
    ctx.textAlign = rtl ? 'right' : 'left'
    const imgTop = Y(0.22)
    const imgBottom = Y(0.785)
    if (img) drawCover(ctx, img, 0, imgTop, W, imgBottom - imgTop)
    else drawPhotoGhost(ctx, p, 0, imgTop, W, imgBottom - imgTop)
    ctx.fillStyle = p.bg2
    ctx.fillRect(0, imgBottom, W, H - imgBottom)
    // Footer cells. The eyebrow is NOT repeated here — it is already drawn at
    // the top of this layout, and a third cell only squeezed the two that
    // carry new information.
    const cells: string[] = []
    if (o.price) cells.push(`${o.price}${o.priceUnit ? ` ${o.priceUnit}` : ''}`)
    if (o.footnote) cells.push(o.footnote)
    const n = Math.max(cells.length, 1)
    const cellW = W / n
    cells.forEach((v, i) => {
      const cx = ((rtl ? n - 1 - i : i) + 0.5) * cellW
      ctx.textAlign = 'center'
      ctx.fillStyle = p.ink
      // Each cell fits ITS cell, not the frame: "95,000 AED/year" beside
      // "Tenant in place · contract running" overlapped by ~170px before.
      fitFont(v, v.length > 16 ? 34 : 54, 800, cellW - 32)
      ctx.fillText(v, cx, imgBottom + Math.round((H - imgBottom) * 0.62))
    })
  }

  // ── The Dubai payment-plan family ────────────────────────────────────────
  // Shared furniture first: a full-bleed band with one line of text fitted to
  // it, and the circular down-payment badge. Both appear in every variant, and
  // both are the parts that go wrong when hand-placed per layout.

  /** A full-width band. Returns the y where the next thing may start. */
  const band = (y: number, h: number, fill: string, text: string, ink: string, px: number, weight = 800) => {
    ctx.fillStyle = fill
    ctx.fillRect(0, y, W, h)
    if (text.trim()) {
      ctx.fillStyle = ink
      ctx.textAlign = 'center'
      // Fitted to the band, never clipped by it: Arabic finance lines run long
      // and a fixed size loses the last word — which is usually the term.
      const size = fitFont(text, px, weight, W - 56, 20)
      ctx.font = font(size, weight)
      ctx.fillText(text, W / 2, y + h / 2 + size * 0.35)
    }
    return y + h
  }

  /** The circular "20% down payment" badge that overlaps the render. */
  const payBadgeCircle = (cx: number, cy: number, r: number) => {
    if (!o.downPct?.trim()) return
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = p.accent
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    const pctSize = fitFont(o.downPct, r * 0.95, 900, r * 1.6)
    ctx.font = font(pctSize, 900)
    ctx.fillText(o.downPct, cx, cy + (o.downLabel ? 0 : pctSize * 0.35))
    if (o.downLabel?.trim()) {
      const lblSize = fitFont(o.downLabel, r * 0.30, 700, r * 1.6)
      ctx.font = font(lblSize, 700)
      ctx.fillText(o.downLabel, cx, cy + pctSize * 0.62)
    }
  }

  /** A price block: small label, very large figure. The figure is the point. */
  const priceBlock = (cx: number, y: number, maxW: number, label: string, value: string, ink: string) => {
    ctx.textAlign = 'center'
    if (label.trim()) {
      ctx.fillStyle = ink
      const ls = fitFont(label, 40, 600, maxW)
      ctx.font = font(ls, 600)
      ctx.fillText(label, cx, y)
    }
    if (!value.trim()) return
    ctx.fillStyle = ink
    // The number carries the ad, so it takes whatever width is left. Arabic
    // ads still print the figure in Western digits — the browser keeps it LTR.
    const vs = fitFont(value, 132, 900, maxW, 40)
    ctx.font = font(vs, 900)
    ctx.fillText(value, cx, y + vs * 0.86)
  }

  if (layout === 'payBands') {
    // Ad 1: hook band · headline band · render · price band · terms strip.
    const hookH = Math.round(H * 0.058)
    const headH = Math.round(H * 0.062)
    const termsH = o.terms?.trim() ? Math.round(H * 0.050) : 0
    const priceH = Math.round(H * 0.150)

    let y = band(0, hookH, p.bg, o.financeHook ?? '', '#ffffff', 40)
    y = band(y, headH, p.bg2, o.headline, p.ink, 42)

    const imgTop = y
    const imgBottom = H - priceH - termsH
    if (img) drawCover(ctx, img, 0, imgTop, W, imgBottom - imgTop)
    else { ctx.fillStyle = p.chip; ctx.fillRect(0, imgTop, W, imgBottom - imgTop) }

    ctx.fillStyle = p.bg2
    ctx.fillRect(0, imgBottom, W, priceH)
    // The badge is a square block at the trailing edge of the price band, the
    // way the reference ad sets it — not a circle here.
    const boxW = Math.round(W * 0.30)
    if (o.downPct?.trim()) {
      const bx = rtl ? 0 : W - boxW
      ctx.fillStyle = p.accent
      ctx.fillRect(bx, imgBottom, boxW, priceH)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      const ps = fitFont(o.downPct, 96, 900, boxW - 40)
      ctx.font = font(ps, 900)
      ctx.fillText(o.downPct, bx + boxW / 2, imgBottom + priceH * 0.52)
      if (o.downLabel?.trim()) {
        const ls = fitFont(o.downLabel, 32, 700, boxW - 40)
        ctx.font = font(ls, 700)
        ctx.fillText(o.downLabel, bx + boxW / 2, imgBottom + priceH * 0.78)
      }
    }
    const priceCx = o.downPct?.trim() ? (rtl ? (W + boxW) / 2 : (W - boxW) / 2) : W / 2
    const priceMaxW = (o.downPct?.trim() ? W - boxW : W) - 56
    priceBlock(priceCx, imgBottom + priceH * 0.30, priceMaxW, o.totalLabel ?? '', o.totalPrice ?? '', p.ink)

    if (termsH) band(H - termsH, termsH, p.bg, o.terms ?? '', '#ffffff', 34, 700)
  }

  if (layout === 'payBadge') {
    // Ad 2: headline band · hook band · render filling the rest, with the
    // circular badge and the price sitting ON the image.
    const headH = Math.round(H * 0.115)
    const hookH = Math.round(H * 0.055)
    let y = band(0, headH, p.bg, o.headline, p.ink, 52)
    y = band(y, hookH, p.bg2, o.financeHook ?? '', '#ffffff', 36)

    if (img) drawCover(ctx, img, 0, y, W, H - y)
    else { ctx.fillStyle = p.chip; ctx.fillRect(0, y, W, H - y) }

    // A scrim under the lower third, or white text on a bright render is gone.
    const scrim = ctx.createLinearGradient(0, H * 0.60, 0, H)
    scrim.addColorStop(0, 'rgba(0,0,0,0)')
    scrim.addColorStop(1, 'rgba(0,0,0,0.62)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, H * 0.60, W, H * 0.40)

    const r = Math.round(W * 0.115)
    payBadgeCircle(rtl ? W - r - 56 : r + 56, y + r + 56, r)
    priceBlock(W / 2, H - Math.round(H * 0.115), W - 120, o.totalLabel ?? '', o.totalPrice ?? '', '#ffffff')
  }

  if (layout === 'payReturn') {
    // Ad 3: two bands · render · a two-column footer (total + annual return).
    const b1 = Math.round(H * 0.055)
    const b2 = Math.round(H * 0.055)
    const footH = Math.round(H * 0.185)

    let y = band(0, b1, p.bg, o.headline, p.ink, 40)
    y = band(y, b2, p.bg2, o.financeHook ?? '', '#ffffff', 38)

    const imgBottom = H - footH
    if (img) drawCover(ctx, img, 0, y, W, imgBottom - y)
    else { ctx.fillStyle = p.chip; ctx.fillRect(0, y, W, imgBottom - y) }

    const r = Math.round(W * 0.10)
    payBadgeCircle(rtl ? W - r - 52 : r + 52, y + r + 52, r)

    const g2 = ctx.createLinearGradient(0, imgBottom, W, H)
    g2.addColorStop(0, p.bg)
    g2.addColorStop(1, p.accent)
    ctx.fillStyle = g2
    ctx.fillRect(0, imgBottom, W, footH)

    // Two columns, or one centred when there is no return figure — an empty
    // half is the thing that makes an ad look unfinished.
    const hasReturn = !!o.returnvalue?.trim()
    const colW = hasReturn ? W / 2 : W
    priceBlock(colW / 2, imgBottom + footH * 0.28, colW - 64, o.totalLabel ?? '', o.totalPrice ?? '', '#ffffff')
    if (hasReturn) {
      priceBlock(W - colW / 2, imgBottom + footH * 0.28, colW - 64,
        o.returnLabel ?? '', o.returnvalue ?? '', '#ffffff')
    }
  }

  return canvas.toDataURL('image/png')
}

/** Stamp a QR (with white rounded backing) onto a design's corner. */
export function stampQr(baseUrl: string, qrImg: HTMLImageElement, corner: 'tl' | 'tr' | 'bl' | 'br', sizePct: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const base = new Image()
    base.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = base.width
        canvas.height = base.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(base, 0, 0)
        const s = Math.round(base.width * (sizePct / 100))
        const pad = Math.round(s * 0.1)
        const m = Math.round(base.width * 0.035)
        const x = corner.includes('l') ? m : base.width - s - 2 * pad - m
        const y = corner.includes('t') ? m : base.height - s - 2 * pad - m
        // Trakhees-style white rounded backing so the code always scans.
        ctx.fillStyle = '#FFFFFF'
        roundRect(ctx, x, y, s + 2 * pad, s + 2 * pad, Math.round(s * 0.12))
        ctx.fill()
        ctx.drawImage(qrImg, x + pad, y + pad, s, s)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) { reject(e) }
    }
    base.onerror = () => reject(new Error('load failed'))
    base.src = baseUrl
  })
}

export function loadImage(src: string, cross = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cross) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

export const fmtPrice = (n: number) => (n >= 1_000_000 ? `${Math.round((n / 1_000_000) * 10) / 10}M` : n.toLocaleString())
