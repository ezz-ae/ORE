/**
 * The colours a creative is actually made of.
 *
 * Used to light the gallery behind whatever is on screen: a Damac Lagoons
 * sunset ad glows warm, a marina night ad glows blue. It is the difference
 * between a file listing and something you would show a client — the design is
 * presented in its own light rather than dropped on a grey page.
 *
 * The quantising and the picking live here, apart from the canvas, because
 * that is the part with judgement in it and the part that can be tested:
 *
 *   · Near-black and near-white are excluded from the ACCENTS. Nearly every
 *     photograph is mostly dark sky or bright wall, so the honest "most common
 *     colour" is a grey that makes every ad look identical.
 *   · Colours too close to one already chosen are skipped, or three shades of
 *     the same orange come back and the background has no depth.
 *   · Fully transparent pixels are ignored — a PNG's empty corner is not a
 *     colour, and counting it would tint every logo's backdrop the same.
 */

export interface Rgb { r: number; g: number; b: number }

/** Coarseness of the colour buckets. 32 → 8 levels per channel, 512 buckets. */
const BUCKET = 32
/** Below this luminance a pixel is "shadow" — real, but not an accent. */
const DARK_LUMA = 0.14
/** Above this it is "highlight". */
const LIGHT_LUMA = 0.92
/** Squared RGB distance under which two accents count as the same colour. */
const MIN_SEPARATION = 60 * 60
/** Alpha below this is transparent enough to ignore. */
const MIN_ALPHA = 16

/** Perceptual-ish luminance, 0–1. */
export function luma({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

const dist2 = (a: Rgb, b: Rgb) =>
  (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2

export function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/**
 * Dominant colours, most common first.
 *
 * @param rgba   flat RGBA bytes, as `getImageData().data` gives them
 * @param count  how many to return
 * @param fallback used when the image yields nothing usable (all transparent,
 *                 or a pure black frame) — never an empty array, because the
 *                 caller is styling a background and cannot use nothing.
 */
export function dominantColors(
  rgba: Uint8ClampedArray | Uint8Array | number[],
  count = 3,
  fallback: string[] = ['#1f2937', '#111827', '#0b1220'],
): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3]
    if (a < MIN_ALPHA) continue
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
    // Key on the coarse bucket, but average the REAL values inside it — the
    // bucket centre would quantise every colour to a flat, posterised version.
    const key = ((r / BUCKET) | 0) * 4096 + ((g / BUCKET) | 0) * 64 + ((b / BUCKET) | 0)
    const cur = buckets.get(key)
    if (cur) { cur.n++; cur.r += r; cur.g += g; cur.b += b }
    else buckets.set(key, { n: 1, r, g, b })
  }

  if (buckets.size === 0) return fallback.slice(0, count)

  const ranked = [...buckets.values()]
    .map((v) => ({ n: v.n, rgb: { r: v.r / v.n, g: v.g / v.n, b: v.b / v.n } }))
    .sort((x, y) => y.n - x.n)

  const midtones = ranked.filter((c) => {
    const l = luma(c.rgb)
    return l > DARK_LUMA && l < LIGHT_LUMA
  })

  const picked: Rgb[] = []
  // Midtones first — they carry the character of the image. Then anything, so
  // a genuinely monochrome creative still fills its slots.
  for (const pool of [midtones, ranked]) {
    for (const c of pool) {
      if (picked.length >= count) break
      if (picked.some((p) => dist2(p, c.rgb) < MIN_SEPARATION)) continue
      picked.push(c.rgb)
    }
    if (picked.length >= count) break
  }

  const out = picked.map(toHex)
  // Top up rather than returning a short list the caller has to guard.
  for (let i = 0; out.length < count; i++) out.push(fallback[i % fallback.length])
  return out
}

/**
 * Sample an already-loaded image and read its colours.
 *
 * Sampling is done at a small size on purpose: a 1080×1350 ad is 1.4M pixels,
 * and reading all of them to choose three colours would stall the gallery on
 * every slide. 48px is plenty to find what an image is made of.
 */
export function colorsFromImage(
  img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  count = 3,
): string[] {
  const SAMPLE = 48
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE
    canvas.height = SAMPLE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return dominantColors([], count)
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
    return dominantColors(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, count)
  } catch {
    // A cross-origin image taints the canvas and getImageData throws. The
    // gallery still has to render, so fall back rather than break the page.
    return dominantColors([], count)
  }
}
