/**
 * VIDEO ADS — locked.
 *
 * A video ad has one failure mode worse than every other in this product: the
 * Graph API ACCEPTS a creative built on a video that has not finished
 * transcoding, the ad is created, the response is 200, and the ad never
 * delivers. Everything reports success and the money does not move. There is
 * no error to read and nothing on any screen to notice.
 *
 * So the assertions here are almost entirely about refusing to proceed:
 * unknown status is not ready, a missing cover frame is not launchable, and
 * the CTA a video carries is the SAME object the image path builds — because a
 * video variant in a lead-form ad set without the form id is a different,
 * broken ad that looks fine in Ads Manager.
 *
 * Pure — no network, no token. Runs in `pnpm guards`.
 */
import {
  videoStatusOf, pickThumbnail, callToActionSpec, videoDataSpec, whyNotLaunchable,
  isVideoUrl, VIDEO_POLL_DELAYS_MS, VIDEO_POLL_BUDGET_MS, VIDEO_STATUSES,
  VIDEO_BLOCK_REASONS,
} from '../lib/meta/video-ad'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── unknown is processing, never ready ──')
{
  // The step-2 failure: Meta returns the video id immediately and, on some
  // accounts, no status at all for the first few seconds. Reading that as
  // ready builds an ad on a video that is not there.
  check('a ready video reads ready', videoStatusOf({ status: { video_status: 'ready' } }) === 'ready')
  check('an absent status is PROCESSING, not ready', videoStatusOf({}) === 'processing',
    videoStatusOf({}))
  check('a null response is processing', videoStatusOf(null) === 'processing')
  check('an unrecognised word is processing, not ready',
    videoStatusOf({ status: { video_status: 'transcoding_soon' } }) === 'processing')
  check('error is error', videoStatusOf({ status: { video_status: 'error' } }) === 'error')
  check('…and so is Meta\'s other word for it',
    videoStatusOf({ status: { video_status: 'failed' } }) === 'error')
  check('a flat video_status is read too', videoStatusOf({ video_status: 'ready' }) === 'ready')
  check('READY is not case-sensitive', videoStatusOf({ status: { video_status: 'READY' } }) === 'ready')
}

console.log('\n── no cover frame, no ad ──')
{
  // A video ad with no thumbnail renders as a black rectangle in the feed.
  check('the frame Meta prefers wins', pickThumbnail([
    { uri: 'https://x/a.jpg' },
    { uri: 'https://x/b.jpg', is_preferred: true },
  ]) === 'https://x/b.jpg')
  check('…and without a preference, the first real one',
    pickThumbnail([{ uri: 'https://x/a.jpg' }, { uri: 'https://x/b.jpg' }]) === 'https://x/a.jpg')
  check('an empty thumbnail list is null, never an empty string',
    pickThumbnail([]) === null)
  check('a list of blanks is null too',
    pickThumbnail([{ uri: '' }, { uri: '   ' }]) === null)
  check('undefined is null', pickThumbnail(undefined) === null)

  check('a ready video WITH a cover frame is launchable',
    whyNotLaunchable({ status: 'ready', thumbnailUrl: 'https://x/a.jpg' }) === null)
  check('a ready video with NO cover frame is not',
    whyNotLaunchable({ status: 'ready' }) === 'noThumbnail')
  check('a processing video is not, cover frame or otherwise',
    whyNotLaunchable({ status: 'processing', thumbnailUrl: 'https://x/a.jpg' }) === 'processing')
  check('a failed video is not', whyNotLaunchable({ status: 'error' }) === 'error')
  check('an uploaded cover hash counts as a cover',
    whyNotLaunchable({ status: 'ready', thumbnailHash: 'abc' }) === null)
}

console.log('\n── the CTA is the image path\'s, not a second copy ──')
{
  // A video variant dropped into a lead-form ad set MUST carry the same
  // lead_gen_form_id. Two copies of this rule is how it quietly becomes a
  // link-click ad in a form campaign — which looks correct in Ads Manager.
  const form = callToActionSpec({
    destination: 'form', cta: 'SIGN_UP', landingUrl: 'https://x/lp', leadFormId: '123',
  })
  check('a form destination carries the form id',
    form.value.lead_gen_form_id === '123', JSON.stringify(form))
  check('…and never the landing link instead', form.value.link === undefined)

  const badPair = callToActionSpec({
    destination: 'form', cta: 'WHATSAPP_MESSAGE', landingUrl: 'https://x/lp', leadFormId: '123',
  })
  check('a WhatsApp CTA on a form ad downgrades to SIGN_UP — Meta rejects the pair',
    badPair.type === 'SIGN_UP' && badPair.value.lead_gen_form_id === '123', JSON.stringify(badPair))

  const wa = callToActionSpec({ destination: 'whatsapp', cta: 'LEARN_MORE', landingUrl: 'https://x/lp' })
  check('a WhatsApp destination is a WhatsApp CTA whatever the creative asked for',
    wa.type === 'WHATSAPP_MESSAGE' && wa.value.app_destination === 'WHATSAPP', JSON.stringify(wa))

  const call = callToActionSpec({
    destination: 'phone', cta: 'LEARN_MORE', landingUrl: 'https://x/lp', destinationPhone: '+971 50 123 4567',
  })
  check('a phone destination strips the spaces out of the tel: link',
    call.value.link === 'tel:+971501234567', JSON.stringify(call))

  const plain = callToActionSpec({ destination: 'landing', cta: 'LEARN_MORE', landingUrl: 'https://x/lp' })
  check('a landing destination is the link and the chosen CTA',
    plain.type === 'LEARN_MORE' && plain.value.link === 'https://x/lp', JSON.stringify(plain))
  check('no destination at all behaves as a landing click',
    callToActionSpec({ cta: 'BOOK_NOW', landingUrl: 'https://x/lp' }).value.link === 'https://x/lp')
}

console.log('\n── video_data is not link_data with a video in it ──')
{
  // Reusing the link field names silently drops the headline: video_data
  // calls it `title`, link_data calls it `name`.
  const spec = videoDataSpec({
    videoId: 'v1', primaryText: 'body', headline: 'HEAD', description: 'desc',
    landingUrl: 'https://x/lp', cta: 'SIGN_UP', destination: 'form', leadFormId: '9',
    thumbnailUrl: 'https://x/cover.jpg',
  })
  check('the headline rides on `title`, which is where a video ad reads it',
    spec.title === 'HEAD', JSON.stringify(spec))
  check('the description rides on `link_description`', spec.link_description === 'desc')
  check('the primary text rides on `message`', spec.message === 'body')
  check('the cover frame rides on `image_url`', spec.image_url === 'https://x/cover.jpg')
  check('…and never on `picture`, which is the link object\'s field',
    (spec as Record<string, unknown>).picture === undefined)
  check('the form id survives all the way into the spec',
    (spec.call_to_action as { value?: { lead_gen_form_id?: string } })?.value?.lead_gen_form_id === '9',
    JSON.stringify(spec.call_to_action))

  const hashed = videoDataSpec({
    videoId: 'v1', primaryText: '', headline: '', description: '', landingUrl: 'https://x',
    cta: 'LEARN_MORE', thumbnailHash: 'abc', thumbnailUrl: 'https://x/ignored.jpg',
  })
  check('an uploaded cover hash beats a URL — it is the native, reliable handle',
    hashed.image_hash === 'abc' && hashed.image_url === undefined, JSON.stringify(hashed))
}

console.log('\n── the wait is a number a person can read ──')
{
  check('the poll schedule only ever backs off, never speeds up',
    VIDEO_POLL_DELAYS_MS.every((d, i) => i === 0 || d >= VIDEO_POLL_DELAYS_MS[i - 1]),
    VIDEO_POLL_DELAYS_MS.join(','))
  check('it starts tight, so the common case returns fast',
    VIDEO_POLL_DELAYS_MS[0] <= 2000, String(VIDEO_POLL_DELAYS_MS[0]))
  check('the whole budget is between 30s and 3 minutes',
    VIDEO_POLL_BUDGET_MS > 30_000 && VIDEO_POLL_BUDGET_MS < 180_000,
    `${Math.round(VIDEO_POLL_BUDGET_MS / 1000)}s`)
  // The route declares maxDuration to cover this; a budget that outgrew the
  // ceiling would turn a good upload into a timeout with no ads.
  check('…and inside the route\'s declared 300s ceiling', VIDEO_POLL_BUDGET_MS < 300_000)
}

console.log('\n── what Meta will even accept as a video ──')
{
  check('an mp4 is a video', isVideoUrl('https://x/tour.mp4'))
  check('a query string does not hide it', isVideoUrl('https://x/tour.mp4?sig=abc'))
  check('a MOV in capitals is one too', isVideoUrl('https://x/TOUR.MOV'))
  check('a jpg is not', !isVideoUrl('https://x/shot.jpg'))
  check('a pdf is not', !isVideoUrl('https://x/book.pdf'))
  check('a URL with no extension is not guessed at', !isVideoUrl('https://x/watch/abc'))

  // Both catalogs are walked by the i18n dynamic-key guard.
  check('every status is named', VIDEO_STATUSES.length === 3)
  check('every block reason is named', VIDEO_BLOCK_REASONS.length === 3)
}

if (failures > 0) {
  console.error(`\n${failures} video-ad rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo ad is built on a video that is not there.\n')
