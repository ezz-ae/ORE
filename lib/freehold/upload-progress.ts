/**
 * "How long is this going to take?"
 *
 * The video uploader showed a spinner and the word "Uploading…", and nothing
 * else, for as long as the upload took. On a 180MB clip over a normal
 * connection that is several minutes of a screen that looks identical to a
 * hung one — which is exactly what it was reported as: "it's been forever."
 *
 * The upload SDK has always emitted `{ loaded, total, percentage }`; nothing
 * was listening. This turns that stream into the three things a person
 * actually wants: how far, how fast, and how much longer.
 *
 * The estimate is smoothed over a short window rather than computed from the
 * whole transfer. A single average makes the remaining time drift downward
 * long after the connection has slowed, so the number keeps promising a finish
 * it will miss — worse than no number, because it was believed.
 */

/** One reading from the upload stream. */
export interface ProgressSample {
  /** Bytes transferred so far. */
  loaded: number
  /** Milliseconds since the upload started. */
  atMs: number
}

export interface TransferStatus {
  /** 0–100, clamped. */
  percent: number
  /** Bytes per second over the recent window, or null before it is knowable. */
  bytesPerSec: number | null
  /** Seconds remaining, or null when it cannot honestly be estimated. */
  etaSecs: number | null
  loaded: number
  total: number
}

/**
 * Only the last few seconds count toward the rate. Long enough to survive one
 * stalled chunk, short enough to notice the connection actually changing.
 */
export const WINDOW_MS = 5_000
/** Below this, one sample's jitter dominates and the ETA is noise. */
const MIN_SAMPLES = 2
/** An ETA beyond this is not information, it is discouragement. */
const MAX_SENSIBLE_ETA = 24 * 60 * 60

/** Keep the samples inside the window; returns the trimmed list. */
export function trimSamples(samples: ProgressSample[], nowMs: number, windowMs = WINDOW_MS): ProgressSample[] {
  const cutoff = nowMs - windowMs
  const kept = samples.filter((s) => s.atMs >= cutoff)
  // Always retain at least two so a slow connection still yields a rate.
  return kept.length >= MIN_SAMPLES ? kept : samples.slice(-MIN_SAMPLES)
}

/**
 * Rate and remaining time from the recent window.
 *
 * Returns nulls rather than guesses. A "0 s left" that sits there, or an ETA
 * computed from one sample, is the same failure as the spinner — a display
 * that says something it does not know.
 */
export function transferStatus(samples: ProgressSample[], total: number): TransferStatus {
  const last = samples[samples.length - 1]
  const loaded = last?.loaded ?? 0
  const safeTotal = total > 0 ? total : 0
  const percent = safeTotal > 0 ? Math.min(100, Math.max(0, (loaded / safeTotal) * 100)) : 0

  if (samples.length < MIN_SAMPLES || safeTotal <= 0) {
    return { percent, bytesPerSec: null, etaSecs: null, loaded, total: safeTotal }
  }

  const first = samples[0]
  const elapsedMs = last.atMs - first.atMs
  const movedBytes = last.loaded - first.loaded
  if (elapsedMs <= 0 || movedBytes <= 0) {
    // Stalled inside the window: report the position, admit no rate.
    return { percent, bytesPerSec: null, etaSecs: null, loaded, total: safeTotal }
  }

  const bytesPerSec = (movedBytes / elapsedMs) * 1000
  const remaining = Math.max(0, safeTotal - loaded)
  const raw = remaining / bytesPerSec
  const etaSecs = Number.isFinite(raw) && raw <= MAX_SENSIBLE_ETA ? Math.ceil(raw) : null

  return { percent, bytesPerSec, etaSecs, loaded, total: safeTotal }
}

/** "1.4 GB" / "182 MB" / "940 KB". */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** "2.4 MB/s". Null in, em dash out — never a fabricated zero. */
export function formatRate(bytesPerSec: number | null): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '—'
  return `${formatBytes(bytesPerSec)}/s`
}

/**
 * "2m 10s left" — deliberately coarse. Second-by-second precision on a number
 * this uncertain reads as false confidence, and the digits flicker.
 */
export function formatEta(secs: number | null): string | null {
  if (secs == null || !Number.isFinite(secs) || secs < 0) return null
  if (secs < 10) return 'a few seconds'
  if (secs < 60) return `${Math.ceil(secs / 5) * 5}s`
  const m = Math.floor(secs / 60)
  const s = Math.round((secs % 60) / 10) * 10
  if (m < 60) return s > 0 && s < 60 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
