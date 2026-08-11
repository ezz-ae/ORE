/**
 * THE CREATIVE POOL — every piece of media this campaign could run, in one
 * place, with the one fact that decides what to do with it: has it run yet.
 *
 * The need is concrete and it arrived from a live campaign. One ad set was
 * switched off, the other's budget went up, and the remaining ad set now had
 * ONE design carrying the whole spend. It was buying impressions cheaply and
 * still short of the fifty weekly events that end the learning phase. The
 * answer at that moment is not a new campaign, not a new audience, and not
 * more budget on the same picture — it is MORE ADS IN THE ADS SET THAT WORKS,
 * because each one is another entry in the auction and another chance for
 * someone to stop scrolling.
 *
 * Doing that by hand meant: find a photo, open the designer, export, download,
 * re-upload at launch, retype the caption, re-pick the form. Six screens for
 * something the account already had the material for.
 *
 * FOUR RULES, each with the failure it answers to:
 *
 *  1. ONE TILE PER PICTURE. The same hero photo arrives from the project row
 *     AND from the Library the day someone saved it there. Two tiles of the
 *     same image is how an operator launches the same ad twice and then reads
 *     a split test that never happened. Deduped by URL, and the more specific
 *     source wins the tile.
 *
 *  2. "UNUSED" MEANS UNUSED. An image already running in this campaign is
 *     shown — an operator looking for what exists wants to see it — but it is
 *     marked, sorted last, and NEVER counted as new material. Every number
 *     this module reports about "what you could add" is about media the
 *     campaign has not run, or it is a lie that produces duplicate ads.
 *
 *  3. WHAT CAN BECOME AN AD IS A PROPERTY OF THE FILE, and the pool says so
 *     rather than offering a button that fails at the far end. Images and
 *     videos launch; a brochure does not, because a PDF is not a creative —
 *     it is where a design's NUMBERS come from, so it routes to the ad
 *     designer instead of to a launch that would 400.
 *
 *     Video ads are a four-step negotiation with Meta (upload, transcode,
 *     cover frame, a `video_data` creative that shares no field names with
 *     the image one). Those rules live in lib/meta/video-ad.ts; what matters
 *     here is that a video tile is a real launch, not a link to a tool.
 *
 *  4. THE POOL NEVER INVENTS MEDIA. Everything here has a URL that already
 *     exists in this account. The generative half of this feature composes a
 *     DESIGN over one of these photos (the same `composeVariant` engine every
 *     other surface uses) — it does not generate a photograph of a building
 *     that was never built. A rendered ad for a real project must show that
 *     project.
 *
 * Pure — no I/O, no model, no network. The assembly of the inputs is the API
 * route's job; the rules about what the collection MEANS live here, so they
 * can be asserted. Runs in `pnpm guards`.
 */

/**
 * Where a piece of media came from. Ordered by how specific it is to THIS
 * campaign — a project photo is about the thing being sold, a library file is
 * about the account. The order is load-bearing: it decides which source owns
 * a tile when the same URL arrives twice, and it decides the sort.
 */
export type PoolSource = 'live' | 'project' | 'brochure' | 'library'
export const POOL_SOURCES: PoolSource[] = ['live', 'project', 'brochure', 'library']

/** What the file IS, which decides what can be done with it. See rule 3. */
export type PoolKind = 'image' | 'video' | 'pdf'
export const POOL_KINDS: PoolKind[] = ['image', 'video', 'pdf']

export interface PoolItem {
  /** Stable across reloads: source-prefixed, so two sources of one file still
   *  collapse to one tile by URL rather than by a random id. */
  id: string
  source: PoolSource
  kind: PoolKind
  /** The real, already-hosted location. Never a placeholder. */
  url: string
  title: string
  /** Meta's own hash, when this file has already been uploaded to the ad
   *  account — lets an ad reuse it without a re-upload round trip. */
  imageHash?: string
  /** Already running as an ad in this campaign. See rule 2. */
  inUse?: boolean
  /** ISO date, when the source knows one. Sorts the library half. */
  createdAt?: string
}

/**
 * WHAT CAN ACTUALLY BECOME AN AD. Stated as a function rather than inlined at
 * each call site so the reason travels with the rule and there is one place to
 * change it.
 *
 * A brochure is excluded on purpose and permanently: a PDF is not a creative
 * in any ad system, and pretending otherwise would put a document-shaped tile
 * behind a Create button. It is a SOURCE — the ad designer reads its numbers.
 */
export const isLaunchable = (item: PoolItem): boolean => item.kind === 'image' || item.kind === 'video'

/** A video ad takes an upload, a transcode wait and a cover frame before Meta
 *  will show it — so the panel warns, and the write budgets for it. */
export const needsProcessing = (item: PoolItem): boolean => item.kind === 'video'

/**
 * Meta's own guidance and the reason it holds: an ad set wants three to six
 * ads. Below three there is nothing for the delivery system to choose between,
 * so it shows the one design to everybody, frequency climbs, and the ad set
 * reaches the same people repeatedly instead of finding new ones. Above six it
 * splits the budget too thin for any single ad to gather a readable signal.
 */
export const MIN_ADS_FOR_ROTATION = 3
export const MAX_ADS_FOR_ROTATION = 6

/** More than this on one screen is a file browser, not a decision. */
export const POOL_DISPLAY_LIMIT = 60

/**
 * Two URLs are the same picture when they point at the same file. Query
 * strings are where CDN cache-busters, resize parameters and signed-URL
 * expiries live — none of which change the photograph — so they are dropped
 * before comparing. The protocol is dropped for the same reason: an http and
 * an https URL for one file are one file.
 */
export function mediaKey(url: string): string {
  const trimmed = String(url ?? '').trim()
  if (!trimmed) return ''
  const noQuery = trimmed.split('?')[0].split('#')[0]
  return noQuery.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase()
}

const sourceRank = (s: PoolSource): number => {
  const i = POOL_SOURCES.indexOf(s)
  return i === -1 ? POOL_SOURCES.length : i
}

/**
 * Collapse the raw collection into the pool an operator reads.
 *
 * The merge, not just a filter: when one file arrives from two sources the
 * surviving tile keeps the MOST SPECIFIC source and the UNION of the facts —
 * a project photo that is also already running keeps both "project" and
 * "in use", because losing either would mislead. Losing `inUse` in particular
 * would put a running ad's image back in the "new material" count, which is
 * rule 2's failure exactly.
 */
export function buildPool(items: PoolItem[]): PoolItem[] {
  const byKey = new Map<string, PoolItem>()

  for (const raw of items) {
    const url = String(raw?.url ?? '').trim()
    if (!url) continue                       // a tile with no file is not a tile
    if (!POOL_KINDS.includes(raw.kind)) continue
    const key = mediaKey(url)
    if (!key) continue

    const existing = byKey.get(key)
    if (!existing) { byKey.set(key, { ...raw, url }); continue }

    byKey.set(key, {
      ...existing,
      // Most specific source wins the tile and its id, so the id stays stable
      // for a file whose library copy appears later.
      ...(sourceRank(raw.source) < sourceRank(existing.source)
        ? { id: raw.id, source: raw.source, title: raw.title || existing.title }
        : {}),
      // Facts are unioned, never overwritten.
      inUse: existing.inUse || raw.inUse || undefined,
      imageHash: existing.imageHash || raw.imageHash,
      createdAt: existing.createdAt || raw.createdAt,
    })
  }

  return [...byKey.values()]
    .sort((a, b) => {
      // Unused before used: the reason someone opened this panel is to find
      // something the campaign has NOT run.
      if (!!a.inUse !== !!b.inUse) return a.inUse ? 1 : -1
      // Then what can actually become an ad right now.
      if (isLaunchable(a) !== isLaunchable(b)) return isLaunchable(a) ? -1 : 1
      // Then closeness to this campaign's product.
      const rank = sourceRank(a.source) - sourceRank(b.source)
      if (rank !== 0) return rank
      // Then newest, when the source knows.
      return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
    })
    .slice(0, POOL_DISPLAY_LIMIT)
}

/** What the pool can do for this campaign right now — the numbers the panel
 *  header and the recommendation both read, so they can never disagree. */
export interface PoolReadiness {
  /** Everything in the pool, after dedup. */
  total: number
  /** Launchable and not already running: the honest "you could add N ads
   *  today". Named `fresh` rather than `freshImages` since videos launch too —
   *  a count whose name says images while it counts videos is the kind of
   *  quiet lie that survives three refactors. */
  fresh: number
  /** How many of those are videos. Each costs an upload and a transcode wait,
   *  so the panel warns and the write budgets for it. */
  freshVideos: number
  /** Files that need a tool before they can be an ad (rule 3). */
  sources: number
  /** Already running in this campaign. */
  inUse: number
}

export function poolReadiness(pool: PoolItem[]): PoolReadiness {
  const fresh = pool.filter((p) => isLaunchable(p) && !p.inUse)
  return {
    total: pool.length,
    fresh: fresh.length,
    freshVideos: fresh.filter(needsProcessing).length,
    sources: pool.filter((p) => !isLaunchable(p)).length,
    inUse: pool.filter((p) => p.inUse).length,
  }
}

/**
 * HOW MANY ADS THIS AD SET IS SHORT.
 *
 * Not "how many can I make" — how many it needs to reach a rotation, capped by
 * what the pool can actually supply. An ad set at two ads with one fresh file
 * is short by one, not by two: offering the second would be offering a
 * duplicate, and a duplicate ad is not a second test.
 */
export function adsToAdd(currentAds: number, fresh: number): number {
  const short = Math.max(0, MIN_ADS_FOR_ROTATION - Math.max(0, currentAds))
  return Math.min(short, Math.max(0, fresh))
}
