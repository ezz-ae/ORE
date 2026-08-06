/**
 * GIF planning rules, locked.
 *
 * A GIF has no interframe compression and a fresh 256-colour palette per
 * frame. The failure mode is therefore not a crash — it is a file nobody can
 * send, produced after a long silent wait. Every rule here exists to keep the
 * output sendable and to make the cost knowable BEFORE the wait.
 *
 * Pure — `planGif` is arithmetic, no canvas required.
 */
// Default import, not named: see the note in types/gifenc.d.ts — under plain
// Node this resolves the CJS build, which exposes no named ESM bindings.
import gifenc from 'gifenc'
import {
  planGif, formatBytes, GIF_MAX_EDGE, GIF_MAX_FRAMES, GIF_DEFAULT_FPS,
} from '../lib/freehold/gif-encode'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

// The real case: a 9:16 story reel.
const STORY = { sourceWidth: 1080, sourceHeight: 1920 }

console.log('\n── the output is always sendable ──')
{
  const p = planGif({ ...STORY, durationSecs: 12 })
  check('the long edge is capped', Math.max(p.width, p.height) <= GIF_MAX_EDGE, `${p.width}×${p.height}`)
  check('frames are capped', p.frames <= GIF_MAX_FRAMES, String(p.frames))
  check('a 12s reel is reported as truncated, not silently cut', p.truncated)
  check('and the covered length says how much made it', p.coveredSecs < 12 && p.coveredSecs > 0,
    String(p.coveredSecs))
  // The whole point of the caps.
  check('a full-length story stays under ~10MB', p.estimatedBytes < 10 * 1024 * 1024,
    formatBytes(p.estimatedBytes))
}

console.log('\n── aspect ratio is never distorted ──')
{
  const p = planGif({ ...STORY, durationSecs: 3 })
  const srcRatio = 1080 / 1920
  const outRatio = p.width / p.height
  check('9:16 survives the downscale', Math.abs(srcRatio - outRatio) < 0.02,
    `${srcRatio.toFixed(3)} vs ${outRatio.toFixed(3)}`)
  const sq = planGif({ sourceWidth: 1080, sourceHeight: 1080, durationSecs: 3 })
  check('1:1 stays square', sq.width === sq.height, `${sq.width}×${sq.height}`)
  const feed = planGif({ sourceWidth: 1080, sourceHeight: 1350, durationSecs: 3 })
  check('4:5 survives', Math.abs(feed.width / feed.height - 1080 / 1350) < 0.02,
    `${feed.width}×${feed.height}`)
}

console.log('\n── never upscale ──')
{
  // A small source must not be blown up into a blurry, heavier file.
  const p = planGif({ sourceWidth: 200, sourceHeight: 200, durationSecs: 2 })
  check('a 200px source stays 200px', p.width === 200 && p.height === 200, `${p.width}×${p.height}`)
  check('and is cheaper than a full-size one',
    p.estimatedBytes < planGif({ ...STORY, durationSecs: 2 }).estimatedBytes)
}

console.log('\n── dimensions stay even ──')
{
  for (const [w, h] of [[1081, 1921], [999, 333], [777, 1111]] as const) {
    const p = planGif({ sourceWidth: w, sourceHeight: h, durationSecs: 1 })
    check(`${w}×${h} → even output`, p.width % 2 === 0 && p.height % 2 === 0, `${p.width}×${p.height}`)
  }
}

console.log('\n── short reels are not padded ──')
{
  const p = planGif({ ...STORY, durationSecs: 1, fps: 8 })
  check('a 1s reel is 8 frames, not the maximum', p.frames === 8, String(p.frames))
  check('and is not marked truncated', !p.truncated)
  check('covered length matches the source', Math.abs(p.coveredSecs - 1) < 0.001, String(p.coveredSecs))
}

console.log('\n── degenerate input cannot produce a broken plan ──')
{
  const zero = planGif({ ...STORY, durationSecs: 0 })
  check('a zero-length reel still yields one frame', zero.frames === 1, String(zero.frames))
  const tiny = planGif({ sourceWidth: 0, sourceHeight: 0, durationSecs: 1 })
  check('a zero-size source never yields a zero canvas', tiny.width >= 2 && tiny.height >= 2,
    `${tiny.width}×${tiny.height}`)
  const fast = planGif({ ...STORY, durationSecs: 5, fps: 999 })
  check('an absurd fps is clamped', fast.fps <= 24, String(fast.fps))
  const slow = planGif({ ...STORY, durationSecs: 5, fps: 0 })
  check('a zero fps is clamped up, not divided by', slow.fps >= 1 && Number.isFinite(slow.frameDelayMs),
    `fps ${slow.fps}, delay ${slow.frameDelayMs}`)
}

console.log('\n── frame delay matches the frame rate ──')
{
  const p = planGif({ ...STORY, durationSecs: 2, fps: 10 })
  check('10fps → 100ms per frame', p.frameDelayMs === 100, String(p.frameDelayMs))
  const d = planGif({ ...STORY, durationSecs: 2, fps: GIF_DEFAULT_FPS })
  check('the default rate gives a sane delay', d.frameDelayMs > 0 && d.frameDelayMs < 1000,
    String(d.frameDelayMs))
}

console.log('\n── the size estimate is usable ──')
{
  check('bytes format readably', formatBytes(1_572_864) === '1.5 MB', formatBytes(1_572_864))
  check('KB below a megabyte', formatBytes(2048) === '2 KB', formatBytes(2048))
  check('nothing is an em dash, not "0 B"', formatBytes(0) === '—', formatBytes(0))
  // More frames must cost more, or the warning is meaningless.
  const short = planGif({ ...STORY, durationSecs: 1 })
  const long = planGif({ ...STORY, durationSecs: 4 })
  check('a longer GIF estimates larger', long.estimatedBytes > short.estimatedBytes,
    `${formatBytes(short.estimatedBytes)} → ${formatBytes(long.estimatedBytes)}`)
}

console.log('\n── the encoder really writes a GIF ──')
{
  // gifenc is pure JS, so the encoding contract can be exercised for real here
  // with synthetic pixels — no canvas needed. This is what catches a wrong
  // writeFrame argument order, which the hand-written .d.ts could otherwise get
  // wrong silently and produce a corrupt file nobody opens until a client does.
  const { GIFEncoder, quantize, applyPalette } = gifenc
  const W = 8, H = 4
  const gif = GIFEncoder()
  for (let f = 0; f < 3; f++) {
    const rgba = new Uint8ClampedArray(W * H * 4)
    for (let i = 0; i < W * H; i++) {
      rgba[i * 4] = f === 0 ? 255 : 0        // vary the frames so it is a real animation
      rgba[i * 4 + 1] = f === 1 ? 255 : 0
      rgba[i * 4 + 2] = f === 2 ? 255 : 0
      rgba[i * 4 + 3] = 255
    }
    const palette = quantize(rgba, 256)
    const index = applyPalette(rgba, palette)
    check(`frame ${f}: one palette index per pixel`, index.length === W * H, String(index.length))
    gif.writeFrame(index, W, H, { palette, delay: 125 })
  }
  gif.finish()
  const bytes = gif.bytes()
  const header = String.fromCharCode(...bytes.slice(0, 6))
  check('the file starts with a real GIF89a header', header === 'GIF89a', header)
  // Little-endian logical screen width/height, right after the header.
  const lsWidth = bytes[6] | (bytes[7] << 8)
  const lsHeight = bytes[8] | (bytes[9] << 8)
  check('the dimensions written match what was passed', lsWidth === W && lsHeight === H,
    `${lsWidth}×${lsHeight}`)
  check('it ends with the GIF trailer', bytes[bytes.length - 1] === 0x3b, String(bytes[bytes.length - 1]))
  check('three frames produced a non-trivial file', bytes.length > 60, String(bytes.length))
}

if (failures > 0) {
  console.error(`\n${failures} GIF plan rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll GIF plan rules hold.\n')
