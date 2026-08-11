/**
 * VIDEO ADS — the three rules that decide whether one can be launched at all.
 *
 * A Meta video ad is not "an ad with a video in it". It is a four-step
 * negotiation, and every step has a way to produce an ad that Meta accepts and
 * nobody can watch:
 *
 *  1. UPLOAD. `POST /act_<id>/advideos` returns an id IMMEDIATELY, before the
 *     file has been transcoded. The id is real; the video is not yet.
 *
 *  2. WAIT. `status.video_status` walks processing → ready | error. A creative
 *     built against a processing video is accepted by the Graph API and then
 *     fails to deliver — the worst shape of failure this product has, because
 *     everything reports success and the money simply does not move.
 *
 *  3. THUMBNAIL. A video ad with no cover frame renders as a black rectangle
 *     in the feed. Meta generates thumbnails itself and marks one preferred;
 *     if none has arrived, the ad is not ready to launch, and saying so is the
 *     honest answer rather than shipping a black ad.
 *
 *  4. CREATIVE. `video_data` is a different object from `link_data` — `title`
 *     rather than `name`, `link_description` rather than `description`, and
 *     the picture arrives as `image_url` / `image_hash` rather than
 *     `picture` / `image_hash`. Reusing the link shape silently drops the
 *     headline.
 *
 * The CTA shaping is SHARED with the image path (`callToActionSpec` below) and
 * not re-derived here, because a video ad in a lead-form ad set must carry the
 * same `lead_gen_form_id` as its image siblings. Two copies of that rule is
 * how a video variant quietly becomes a link-click ad in a form campaign.
 *
 * Pure — no network, no token. The client does the I/O; the rules live here so
 * they can be asserted. Runs in `pnpm guards`.
 */
import type { AdDestination, MetaCta } from './types'

/** Meta's own vocabulary for `status.video_status`, plus our reading of an
 *  absent/unrecognised value. Walkable — the UI renders a word per state. */
export type VideoStatus = 'processing' | 'ready' | 'error'
export const VIDEO_STATUSES: VideoStatus[] = ['processing', 'ready', 'error']

/**
 * UNKNOWN IS PROCESSING, NEVER READY.
 *
 * Meta has shipped `ready`, `processing`, `error` and — on some accounts —
 * nothing at all for a few seconds after upload. Reading a missing status as
 * ready is the step-2 failure exactly: an ad built on a video that is not
 * there. The only safe default is "not yet", which costs a poll.
 */
export function videoStatusOf(raw: unknown): VideoStatus {
  const s = String(
    (raw as { status?: { video_status?: unknown } })?.status?.video_status
    ?? (raw as { video_status?: unknown })?.video_status
    ?? '',
  ).toLowerCase()
  if (s === 'ready') return 'ready'
  if (s === 'error' || s === 'failed') return 'error'
  return 'processing'
}

/**
 * HOW LONG TO WAIT, AND HOW OFTEN.
 *
 * A 30-second vertical reel at 1080p transcodes in a few seconds; a two-minute
 * property tour can take a minute or more. The schedule starts tight so the
 * common case returns fast, then backs off so a slow file does not cost fifty
 * round trips. It is a fixed array rather than a loop with a multiplier so the
 * total wait is a number anyone can read, and so the guard can assert it.
 */
export const VIDEO_POLL_DELAYS_MS = [1500, 2000, 3000, 4000, 5000, 7000, 10_000, 12_000, 15_000, 20_000]
export const VIDEO_POLL_BUDGET_MS = VIDEO_POLL_DELAYS_MS.reduce((n, x) => n + x, 0)

/** Meta's own ceiling is far higher, but a file this size is a download the
 *  server has to hold in memory before forwarding it. Above this the honest
 *  answer is to compress first — which the video editor already does. */
export const VIDEO_MAX_BYTES = 200_000_000

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']

/** A URL Meta will accept as a video source. Extension-based, because Meta
 *  fetches it itself and we never see the content type until it fails. */
export function isVideoUrl(url: string): boolean {
  const path = String(url ?? '').split('?')[0].split('#')[0].toLowerCase()
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))
}

export interface VideoThumbnail { uri?: string; is_preferred?: boolean; width?: number; height?: number }

/**
 * THE COVER FRAME, OR NOTHING.
 *
 * Meta marks one thumbnail preferred — it is the frame its own model picked,
 * and it is almost always better than frame zero, which on a property reel is
 * a fade-in from black. Falls back to the first thumbnail carrying a URI, and
 * to null when none does. Null means NOT LAUNCHABLE YET; it never means
 * "launch it without a cover", because that ad is a black rectangle.
 */
export function pickThumbnail(thumbs: VideoThumbnail[] | undefined | null): string | null {
  const list = Array.isArray(thumbs) ? thumbs.filter((t) => typeof t?.uri === 'string' && t.uri.trim()) : []
  if (list.length === 0) return null
  const preferred = list.find((t) => t.is_preferred)
  return String((preferred ?? list[0]).uri).trim()
}

/**
 * THE CALL TO ACTION, SHARED WITH THE IMAGE PATH.
 *
 * Extracted verbatim from createAdCreative rather than re-written, so a video
 * ad and an image ad in the same ad set point at the same place. The one piece
 * of shaping that is not obvious: a form destination cannot carry a WhatsApp
 * or call CTA — Meta rejects the pair — so those downgrade to SIGN_UP, which
 * is what the instant form actually does.
 */
export function callToActionSpec(params: {
  destination?: AdDestination
  cta: MetaCta
  landingUrl: string
  leadFormId?: string
  destinationPhone?: string
}): { type: string; value: Record<string, unknown> } {
  if (params.destination === 'form' && params.leadFormId) {
    const formCta = params.cta === 'WHATSAPP_MESSAGE' || params.cta === 'CALL_NOW' ? 'SIGN_UP' : params.cta
    return { type: formCta, value: { lead_gen_form_id: params.leadFormId } }
  }
  if (params.destination === 'whatsapp') {
    return { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } }
  }
  if (params.destination === 'phone' && params.destinationPhone) {
    return { type: 'CALL_NOW', value: { link: `tel:${params.destinationPhone.replace(/\s+/g, '')}` } }
  }
  return { type: params.cta, value: { link: params.landingUrl } }
}

/**
 * The `video_data` block, built once so the field names cannot drift from the
 * link path's by accident. See rule 4 in the header for why they differ.
 */
export function videoDataSpec(params: {
  videoId: string
  primaryText: string
  headline: string
  description: string
  landingUrl: string
  cta: MetaCta
  destination?: AdDestination
  leadFormId?: string
  destinationPhone?: string
  /** The cover frame. One of these MUST be present — see pickThumbnail. */
  thumbnailUrl?: string | null
  thumbnailHash?: string | null
}): Record<string, unknown> {
  const cover = params.thumbnailHash
    ? { image_hash: params.thumbnailHash }
    : params.thumbnailUrl
      ? { image_url: params.thumbnailUrl }
      : {}
  return {
    video_id:         params.videoId,
    message:          params.primaryText,
    title:            params.headline,
    link_description: params.description,
    ...cover,
    call_to_action: callToActionSpec({
      destination: params.destination,
      cta: params.cta,
      landingUrl: params.landingUrl,
      leadFormId: params.leadFormId,
      destinationPhone: params.destinationPhone,
    }),
  }
}

/** Everything that must be true before a video ad is worth sending to Meta.
 *  Returns the reason it is not, or null when it is. */
export function whyNotLaunchable(v: {
  status: VideoStatus
  thumbnailUrl?: string | null
  thumbnailHash?: string | null
}): 'processing' | 'error' | 'noThumbnail' | null {
  if (v.status === 'error') return 'error'
  if (v.status !== 'ready') return 'processing'
  if (!v.thumbnailUrl && !v.thumbnailHash) return 'noThumbnail'
  return null
}

/** Walkable for the i18n dynamic-key guard — each renders a sentence. */
export const VIDEO_BLOCK_REASONS = ['processing', 'error', 'noThumbnail'] as const
