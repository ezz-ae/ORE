/**
 * Upload-feedback rules, locked.
 *
 * The complaint was "it's been forever" — a spinner that looks the same at 2%
 * and 98%. The fix is only a fix if the numbers it shows are true, so every
 * rule here is about refusing to state what is not known: no rate from one
 * sample, no ETA while stalled, no "0s left" that sits there.
 *
 * Pure — no network, no DOM.
 */
import {
  transferStatus, trimSamples, formatBytes, formatRate, formatEta, WINDOW_MS,
  type ProgressSample,
} from '../lib/freehold/upload-progress'
import { planCompress, looksLikeVideo } from '../lib/freehold/video-compress'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const MB = 1024 * 1024
const s = (loaded: number, atMs: number): ProgressSample => ({ loaded, atMs })

console.log('\n── never state a rate it does not know ──')
{
  const one = transferStatus([s(5 * MB, 1000)], 100 * MB)
  check('one sample gives no rate', one.bytesPerSec === null, String(one.bytesPerSec))
  check('one sample gives no ETA', one.etaSecs === null, String(one.etaSecs))
  check('but the percentage is still real', Math.round(one.percent) === 5, String(one.percent))
  const none = transferStatus([], 100 * MB)
  check('no samples is 0%, not NaN', none.percent === 0, String(none.percent))
  const unknownTotal = transferStatus([s(1 * MB, 0), s(2 * MB, 1000)], 0)
  check('an unknown total yields no ETA', unknownTotal.etaSecs === null, String(unknownTotal.etaSecs))
}

console.log('\n── a stall is reported as a stall ──')
{
  // The connection dropped: position is real, rate is not.
  const stalled = transferStatus([s(40 * MB, 0), s(40 * MB, 4000)], 100 * MB)
  check('no bytes moved → no rate', stalled.bytesPerSec === null, String(stalled.bytesPerSec))
  check('no bytes moved → no ETA, not "0s"', stalled.etaSecs === null, String(stalled.etaSecs))
  check('and the bar does not jump back', Math.round(stalled.percent) === 40, String(stalled.percent))
}

console.log('\n── the maths is right when it is knowable ──')
{
  // 20MB in 4s = 5MB/s; 60MB left → 12s.
  const st = transferStatus([s(20 * MB, 0), s(40 * MB, 4000)], 100 * MB)
  check('rate is bytes moved over the window', Math.round((st.bytesPerSec ?? 0) / MB) === 5,
    String((st.bytesPerSec ?? 0) / MB))
  check('ETA is the remainder at that rate', st.etaSecs === 12, String(st.etaSecs))
  check('percent tracks the last sample', Math.round(st.percent) === 40, String(st.percent))
}

console.log('\n── the window follows the connection, not the average ──')
{
  // Fast for a long time, then slow. A whole-transfer average would keep
  // promising a finish it will miss; only the recent window may count.
  const all: ProgressSample[] = [
    s(0, 0), s(50 * MB, 5000),           // 10MB/s early
    s(51 * MB, 9000), s(52 * MB, 10000), // 1MB/s now
  ]
  const recent = trimSamples(all, 10_000, WINDOW_MS)
  check('old samples fall out of the window', recent[0].atMs >= 5000, String(recent[0].atMs))
  const st = transferStatus(recent, 100 * MB)
  const rate = (st.bytesPerSec ?? 0) / MB
  check('the reported rate is the slow one, not the average', rate < 3, `${rate.toFixed(2)} MB/s`)
  check('so the ETA is honest about the slowdown', (st.etaSecs ?? 0) > 20, String(st.etaSecs))
}

console.log('\n── trimming never leaves too little to compute ──')
{
  const old: ProgressSample[] = [s(1 * MB, 0), s(2 * MB, 100)]
  const kept = trimSamples(old, 60_000, WINDOW_MS)
  check('two stale samples are kept rather than dropped to zero', kept.length === 2, String(kept.length))
}

console.log('\n── formatting says nothing it should not ──')
{
  check('MB', formatBytes(182 * MB) === '182 MB', formatBytes(182 * MB))
  check('GB with one decimal', formatBytes(1.4 * 1024 * MB) === '1.4 GB', formatBytes(1.4 * 1024 * MB))
  check('KB below a megabyte', formatBytes(940 * 1024) === '940 KB', formatBytes(940 * 1024))
  check('a null rate is an em dash, never "0 B/s"', formatRate(null) === '—', formatRate(null))
  check('a zero rate is also an em dash', formatRate(0) === '—', formatRate(0))
  check('a real rate reads naturally', formatRate(2.5 * MB) === '3 MB/s', formatRate(2.5 * MB))
  check('a null ETA renders nothing at all', formatEta(null) === null, String(formatEta(null)))
  check('a few seconds is words, not digits', formatEta(4) === 'a few seconds', String(formatEta(4)))
  check('minutes are coarse', formatEta(130) === '2m 10s', String(formatEta(130)))
  check('hours do not become 214m', /^\d+h/.test(formatEta(7800) ?? ''), String(formatEta(7800)))
}

console.log('\n── compression is only offered when it helps ──')
{
  // A 400MB 4K clip: worth it.
  const big = planCompress({ sourceWidth: 3840, sourceHeight: 2160, durationSecs: 120, sourceBytes: 400 * MB })
  check('a 4K clip is downscaled', Math.max(big.width, big.height) === 1080, `${big.width}×${big.height}`)
  check('and is worth compressing', big.worthDoing)
  check('the estimate is well under the source', big.estimatedBytes < 400 * MB,
    `${Math.round(big.estimatedBytes / MB)} MB`)

  // Already small and efficient: offering a 2-minute wait to save nothing is worse than not offering.
  const lean = planCompress({ sourceWidth: 1080, sourceHeight: 1920, durationSecs: 120, sourceBytes: 40 * MB })
  check('an already-lean clip is not worth compressing', !lean.worthDoing,
    `${Math.round(lean.estimatedBytes / MB)} MB vs 40 MB`)

  check('aspect ratio survives', Math.abs((big.width / big.height) - (3840 / 2160)) < 0.02,
    `${big.width}×${big.height}`)
  const small = planCompress({ sourceWidth: 640, sourceHeight: 360, durationSecs: 10, sourceBytes: 50 * MB })
  check('a small source is never upscaled', small.width === 640 && small.height === 360,
    `${small.width}×${small.height}`)
  check('dimensions stay even', big.width % 2 === 0 && big.height % 2 === 0, `${big.width}×${big.height}`)
  check('the wait equals the clip length, and is not hidden', big.estimatedSecs === 120,
    String(big.estimatedSecs))
  const zero = planCompress({ sourceWidth: 0, sourceHeight: 0, durationSecs: 0, sourceBytes: 0 })
  check('degenerate input cannot produce a zero canvas', zero.width >= 2 && zero.height >= 2,
    `${zero.width}×${zero.height}`)
}

console.log('\n── what counts as a video ──')
{
  // The bug: `file.type.startsWith('video/')` refused perfectly good footage.
  // Browsers routinely report an EMPTY mime for .mov and .mkv, and for files
  // arriving from Android pickers, network shares and cloud drives.
  const f = (name: string, type: string) => ({ name, type } as File)
  check('a normal mp4 passes', looksLikeVideo(f('clip.mp4', 'video/mp4')))
  check('a .mov with NO mime still passes', looksLikeVideo(f('IMG_4021.MOV', '')),
    'this is the iPhone case that was being rejected')
  check('.mkv with no mime passes', looksLikeVideo(f('a.mkv', '')))
  check('.m4v passes', looksLikeVideo(f('a.m4v', '')))
  check('uppercase extensions pass', looksLikeVideo(f('CLIP.MP4', '')))
  check('an unknown extension with no mime is left to the server',
    looksLikeVideo(f('recording.bin', '')))
  // But something that clearly announces itself as another kind is a real no.
  check('an image is refused', !looksLikeVideo(f('hero.png', 'image/png')))
  check('a PDF is refused', !looksLikeVideo(f('brochure.pdf', 'application/pdf')))
  check('a spreadsheet is refused', !looksLikeVideo(f('leads.csv', 'text/csv')))
}

if (failures > 0) {
  console.error(`\n${failures} upload rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll upload rules hold.\n')
