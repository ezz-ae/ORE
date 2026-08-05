/**
 * Recording-container rules, locked.
 *
 * The regression this prevents is silent and expensive: someone reorders the
 * candidate list, or adds a WebM type above the MP4s, and the Reel maker goes
 * back to producing files Meta will not accept for ad creative — while
 * everything still "works" locally, because the file plays fine in Chrome.
 *
 * Pure: `pickRecorderMime` takes an injectable support predicate, so the
 * preference order is testable with no browser at all.
 */
import {
  pickRecorderMime, extForMime, isAdPlatformReady, MIME_CANDIDATES,
} from '../lib/freehold/video-export'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A browser that supports exactly the listed mimes. */
const browser = (...supported: string[]) => (m: string) => supported.includes(m)

console.log('\n── MP4 is asked for first, because Meta accepts MP4 ──')
{
  // A browser that can do both must be given MP4. This is the whole rule.
  const both = pickRecorderMime(browser('video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9'))
  check('MP4 wins when both are available', both?.ext === 'mp4', JSON.stringify(both))

  const firstWebmIdx = MIME_CANDIDATES.findIndex((m) => m.startsWith('video/webm'))
  const lastMp4Idx = MIME_CANDIDATES.map((m) => m.startsWith('video/mp4')).lastIndexOf(true)
  check('every MP4 candidate is listed before every WebM one', lastMp4Idx < firstWebmIdx,
    `last mp4 @${lastMp4Idx}, first webm @${firstWebmIdx}`)
}

console.log('\n── Safari: WebM-only was a total failure, MP4 fixes it ──')
{
  // Safari's MediaRecorder does MP4 and not WebM. Under the old WebM-only
  // picker this returned null and the user was told export was impossible.
  const safari = pickRecorderMime(browser('video/mp4;codecs=avc1'))
  check('Safari now gets a recorder', safari !== null, JSON.stringify(safari))
  check('and it is MP4', safari?.ext === 'mp4', JSON.stringify(safari))
  check('which Meta will accept', isAdPlatformReady(safari))
}

console.log('\n── WebM remains a real fallback, not a dead branch ──')
{
  const webmOnly = pickRecorderMime(browser('video/webm;codecs=vp8'))
  check('a WebM-only browser still records', webmOnly?.ext === 'webm', JSON.stringify(webmOnly))
  check('but is not reported as ad-ready', !isAdPlatformReady(webmOnly))
  check('preferring vp9 over vp8 when both exist',
    pickRecorderMime(browser('video/webm;codecs=vp9', 'video/webm;codecs=vp8'))?.mime === 'video/webm;codecs=vp9')
}

console.log('\n── a browser that records nothing says so ──')
{
  check('no supported type → null', pickRecorderMime(() => false) === null)
  check('and null is not ad-ready', !isAdPlatformReady(null))
}

console.log('\n── the file extension follows the real container ──')
{
  // The old code hardcoded ".webm" on both the download and the Drive save.
  // An MP4 written as .webm is a file the platform and the OS both mishandle.
  check('mp4 mime → mp4', extForMime('video/mp4;codecs=avc1.42E01E') === 'mp4')
  check('bare mp4 → mp4', extForMime('video/mp4') === 'mp4')
  check('webm mime → webm', extForMime('video/webm;codecs=vp9') === 'webm')
  check('case is not load-bearing', extForMime('VIDEO/MP4') === 'mp4')
  check('anything unknown falls back to webm, never to a wrong mp4',
    extForMime('video/x-matroska') === 'webm')
}

if (failures > 0) {
  console.error(`\n${failures} video-export rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll video-export rules hold.\n')
