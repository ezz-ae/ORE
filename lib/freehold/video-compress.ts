/**
 * Shrink a clip in the browser, so nobody has to leave to do it.
 *
 * The upload capped at 200MB and, when a phone clip went over, said so and
 * stopped. The only way forward was another website: upload there, compress,
 * download, come back, upload again. For a tool whose whole promise is that
 * the work happens in one place, that is the promise breaking.
 *
 * The method is the one already used to export a reel: play the source into a
 * canvas and re-record it with MediaRecorder at a smaller size and bitrate.
 * That means no FFmpeg WASM (~30MB plus cross-origin isolation), and it reuses
 * the MP4-first container choice from lib/freehold/video-export.ts, so what
 * comes out is a format Meta will accept.
 *
 * The cost is honest and has to be said in the UI: this runs in REAL TIME. A
 * four-minute clip takes about four minutes, because the video genuinely plays
 * through once. A progress bar without that sentence would look broken.
 *
 * Audio is deliberately not carried through: `captureStream` on a video element
 * gives the visual track reliably across browsers, and mixing audio back in
 * varies enough that it would sometimes silently drop. A listing reel is
 * scored later, and a compress step that sometimes loses sound without saying
 * so is worse than one that never has it and says so.
 */

import { pickRecorderMime } from './video-export'

/** Long edge of the compressed output. 1080 is still full HD for a story. */
export const COMPRESS_MAX_EDGE = 1080
/** Video bitrate. ~2.5 Mbps at 1080 long edge is a clean social-media clip. */
export const COMPRESS_BITRATE = 2_500_000

export interface CompressPlan {
  width: number
  height: number
  bitsPerSecond: number
  /** Roughly what will come out. Bitrate × duration, plus container overhead. */
  estimatedBytes: number
  /** Seconds this will take — the same as the clip, because it plays through. */
  estimatedSecs: number
  /** False when the source is already small enough to leave alone. */
  worthDoing: boolean
}

export interface CompressPlanInput {
  sourceWidth: number
  sourceHeight: number
  durationSecs: number
  sourceBytes: number
  maxEdge?: number
  bitrate?: number
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/**
 * What compressing would achieve — computed before anything runs, so the offer
 * can state a real number instead of "try it and see".
 *
 * Pure, which is the point: the arithmetic (downscale, size estimate, and the
 * "would this even help?" judgement) is where a wrong answer wastes minutes of
 * someone's time.
 */
export function planCompress(input: CompressPlanInput): CompressPlan {
  const maxEdge = input.maxEdge ?? COMPRESS_MAX_EDGE
  const bitrate = Math.max(200_000, input.bitrate ?? COMPRESS_BITRATE)

  const sw = Math.max(1, input.sourceWidth)
  const sh = Math.max(1, input.sourceHeight)
  // Never upscale — that would produce a bigger file that looks no better.
  const scale = Math.min(1, maxEdge / Math.max(sw, sh))
  const width = even(sw * scale)
  const height = even(sh * scale)

  const duration = Math.max(0, input.durationSecs)
  // 1.02 covers container overhead; the encoder tracks the target closely.
  const estimatedBytes = Math.round((bitrate / 8) * duration * 1.02)

  // Only worth the wait if it saves a meaningful fraction. Spending four
  // minutes to shave 5% is a worse outcome than not offering it.
  const worthDoing = input.sourceBytes > 0 && estimatedBytes < input.sourceBytes * 0.8

  return { width, height, bitsPerSecond: bitrate, estimatedBytes, estimatedSecs: duration, worthDoing }
}

/** Read a local file's dimensions and duration without uploading it. */
export function probeVideo(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    const done = (fn: () => void) => { URL.revokeObjectURL(url); fn() }
    v.onloadedmetadata = () => done(() =>
      resolve({
        width: v.videoWidth || 0,
        height: v.videoHeight || 0,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
      }))
    v.onerror = () => done(() => reject(new Error('That file could not be read as a video')))
    v.src = url
  })
}

export interface CompressResult {
  blob: Blob
  ext: 'mp4' | 'webm'
}

/**
 * Re-encode. Plays the source once into a canvas and records it.
 *
 * `onProgress` reports 0–1 by playback position — the only honest measure,
 * since the recorder finishes exactly when the clip does.
 */
export async function compressVideo(
  file: File,
  plan: CompressPlan,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<CompressResult> {
  const choice = pickRecorderMime()
  if (!choice) throw new Error('This browser cannot re-encode video')

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('That file could not be read as a video'))
    })

    const canvas = document.createElement('canvas')
    canvas.width = plan.width
    canvas.height = plan.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable')

    const stream = canvas.captureStream(30)
    const rec = new MediaRecorder(stream, {
      mimeType: choice.mime,
      videoBitsPerSecond: plan.bitsPerSecond,
    })
    const chunks: BlobPart[] = []
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    const finished = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: choice.mime }))
    })

    rec.start()
    await video.play()

    let raf = 0
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { cancelAnimationFrame(raf); video.pause(); reject(new Error('Compression cancelled')) }
      signal?.addEventListener('abort', onAbort, { once: true })
      const step = () => {
        if (video.ended || video.paused) { resolve(); return }
        ctx.drawImage(video, 0, 0, plan.width, plan.height)
        if (video.duration > 0) onProgress?.(Math.min(1, video.currentTime / video.duration))
        raf = requestAnimationFrame(step)
      }
      video.onended = () => resolve()
      raf = requestAnimationFrame(step)
    })

    rec.stop()
    stream.getTracks().forEach((tr) => tr.stop())
    const blob = await finished
    onProgress?.(1)
    return { blob, ext: choice.ext }
  } finally {
    URL.revokeObjectURL(url)
  }
}
