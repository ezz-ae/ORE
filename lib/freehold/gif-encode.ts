/**
 * Animated GIF from the reel renderer.
 *
 * Why a GIF at all, when a reel already exists: Meta accepts GIF for ad
 * creative, and a GIF plays inline in places a video does not — a WhatsApp
 * broadcast, an email, a listing portal that will not take an MP4. It sits
 * between a static ad and a full reel: cheaper to produce, no encoder, and it
 * loops on its own.
 *
 * It is deliberately NOT a second design. The frames come from the same
 * `drawReelFrame` the reel records, so a GIF and a reel from one listing are
 * the same piece of work at two lengths — same palette, same type scale, same
 * RTL handling. Anything else would mean two design languages to keep in step.
 *
 * The honest part is the size. A GIF has no interframe compression worth the
 * name and one 256-colour palette per frame: 1080×1350 at 30fps for 12 seconds
 * would be hundreds of megabytes and nobody could send it. So the plan is
 * computed first — downscaled, frame-budgeted — and the estimate is shown
 * BEFORE the user waits, rather than after.
 *
 * gifenc rather than gif.js: gif.js needs a separate worker script served as
 * its own file, which fights bundling and the CSP. gifenc is plain JS in-thread.
 */

/** Longest edge of the output. GIF size grows with the square of this. */
export const GIF_MAX_EDGE = 480
/** Smooth enough for a Ken Burns push; every extra frame is a whole image. */
export const GIF_DEFAULT_FPS = 8
/** Hard ceiling — beyond this the file stops being sendable. */
export const GIF_MAX_FRAMES = 32

export interface GifPlan {
  /** Output size, downscaled from the source and rounded to even pixels. */
  width: number
  height: number
  fps: number
  /** Total frames to draw. */
  frames: number
  /** Seconds of source covered — may be less than the reel's full length. */
  coveredSecs: number
  /** Milliseconds per frame, as written into the GIF. */
  frameDelayMs: number
  /** Rough encoded size. Honest enough to warn with, not a promise. */
  estimatedBytes: number
  /** True when the plan had to shorten the reel to stay sendable. */
  truncated: boolean
}

export interface GifPlanInput {
  sourceWidth: number
  sourceHeight: number
  durationSecs: number
  fps?: number
  maxEdge?: number
  maxFrames?: number
}

/** Even dimensions keep the quantiser and most decoders happy. */
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/**
 * Work out what can actually be produced. Pure — the whole reason this is
 * separate from the encoder is that the arithmetic (downscale, frame budget,
 * truncation) is where the bugs live, and it is testable without a canvas.
 */
export function planGif(input: GifPlanInput): GifPlan {
  const maxEdge = input.maxEdge ?? GIF_MAX_EDGE
  const maxFrames = input.maxFrames ?? GIF_MAX_FRAMES
  const fps = Math.max(1, Math.min(input.fps ?? GIF_DEFAULT_FPS, 24))

  const sw = Math.max(1, input.sourceWidth)
  const sh = Math.max(1, input.sourceHeight)
  // Never upscale: a 200px source must not become a blurry 480px GIF.
  const scale = Math.min(1, maxEdge / Math.max(sw, sh))
  const width = even(sw * scale)
  const height = even(sh * scale)

  const duration = Math.max(0, input.durationSecs)
  const wanted = Math.ceil(duration * fps)
  const frames = Math.max(1, Math.min(wanted, maxFrames))
  const truncated = wanted > maxFrames

  // Each frame is a palettised image: ~1 byte per pixel before LZW, and LZW on
  // photographic content lands around 55-70%. 0.6 is the middle of that, which
  // is close enough to warn with and deliberately not presented as exact.
  const estimatedBytes = Math.round(width * height * frames * 0.6)

  return {
    width,
    height,
    fps,
    frames,
    coveredSecs: frames / fps,
    frameDelayMs: Math.round(1000 / fps),
    estimatedBytes,
    truncated,
  }
}

/** "1.4 MB" — for warning someone before they wait. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Encode. `draw` paints the frame for time `t` onto the supplied context, which
 * is exactly the contract `drawReelFrame` already has.
 *
 * Browser-only — it needs a canvas. `onProgress` is called per frame because
 * encoding thirty-two 480×600 frames in-thread is visibly slow and a silent
 * wait reads as a hang.
 */
export async function encodeGif(
  plan: GifPlan,
  draw: (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')

  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is unavailable')

  const gif = GIFEncoder()
  const step = plan.coveredSecs / plan.frames

  for (let i = 0; i < plan.frames; i++) {
    draw(ctx, i * step, plan.width, plan.height)
    const { data } = ctx.getImageData(0, 0, plan.width, plan.height)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, plan.width, plan.height, { palette, delay: plan.frameDelayMs })
    onProgress?.(i + 1, plan.frames)
    // Yield so the tab stays alive and the progress actually paints.
    if (i % 4 === 3) await new Promise<void>((r) => setTimeout(r, 0))
  }

  gif.finish()
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' })
}
