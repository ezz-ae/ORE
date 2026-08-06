/**
 * What container the browser records into — and why MP4 is asked for first.
 *
 * The Reel maker and the video editor both record a canvas with MediaRecorder.
 * Both asked only for WebM, and that broke the feature at both ends of its own
 * purpose:
 *
 *   · **Meta rejects it.** Facebook and Instagram accept MP4, MOV and GIF for
 *     ad creative. WebM is not on that list. So the reel a broker made to run
 *     as an Instagram ad could not be uploaded as one — the single thing the
 *     feature exists for.
 *   · **Safari could not record at all.** Safari's MediaRecorder does not do
 *     WebM. The old picker looped over three WebM types, found none, and showed
 *     "your browser cannot export video" — on every Mac and every iPhone.
 *
 * So MP4 is preferred, and not because it is technically nicer: because it is
 * what the destination accepts. WebM stays as the fallback for browsers that
 * only do WebM (older Chrome and Firefox), where a file that plays and
 * downloads still beats no file at all.
 *
 * Everything is feature-detected through `MediaRecorder.isTypeSupported`, so
 * this makes no claim about any specific browser version — it asks, at runtime,
 * on the machine in front of the user.
 */

/** The container a recording landed in, and the extension its file must carry. */
export interface RecorderChoice {
  mime: string
  ext: 'mp4' | 'webm'
}

/**
 * Candidates in preference order. H.264 variants first — the codec Meta's
 * uploader and every phone can decode. The bare `video/mp4` entry is last of
 * the MP4s because a browser that accepts it without naming a codec gives us
 * no guarantee about what is inside.
 */
export const MIME_CANDIDATES: readonly string[] = [
  'video/mp4;codecs=avc1.42E01E', // H.264 baseline — the most portable
  'video/mp4;codecs=avc1',
  'video/mp4;codecs=h264',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

/** Extension for a mime string. Anything not MP4 is written as WebM. */
export function extForMime(mime: string): 'mp4' | 'webm' {
  return mime.toLowerCase().startsWith('video/mp4') ? 'mp4' : 'webm'
}

/**
 * The first container this browser will actually record, or null if it will
 * record none.
 *
 * `isSupported` is injectable so the preference ORDER — the part that matters
 * and the part that regressed — can be tested without a browser.
 */
export function pickRecorderMime(
  isSupported?: (mime: string) => boolean,
): RecorderChoice | null {
  const test =
    isSupported ??
    ((m: string) => {
      if (typeof MediaRecorder === 'undefined') return false
      try { return MediaRecorder.isTypeSupported(m) } catch { return false }
    })

  for (const mime of MIME_CANDIDATES) {
    if (test(mime)) return { mime, ext: extForMime(mime) }
  }
  return null
}

/** True when the chosen container is one Meta will accept for ad creative. */
export const isAdPlatformReady = (choice: RecorderChoice | null): boolean =>
  choice?.ext === 'mp4'
