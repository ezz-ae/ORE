/**
 * THE CREATIVE POOL, ASSEMBLED — and the one write that makes it worth having.
 *
 * GET  gathers everything this campaign could run from the three places it
 *      already lives: the project's own photographs and brochure, the account
 *      Library, and the images already on the campaign's ads.
 *
 * POST turns the chosen ones into REAL ADS in a named ad set.
 *
 * THE INHERITANCE RULE IS THE POINT OF THE WRITE.
 *
 * A new ad in a lead-form ad set that does not carry the same
 * lead_gen_form_id is not a variant of the working ad — it is a different,
 * broken ad that sends people to a landing page nobody set up, or is rejected
 * outright. So a new ad is built by reading the ad set's OWN best existing ad
 * and changing exactly one thing: the picture. Destination, form id, phone,
 * landing URL, CTA and copy all come from the ad that is already working,
 * unless the operator deliberately overrides the copy.
 *
 * WHAT IT REFUSES, AND WHY:
 *
 *  · An ad set with no readable ad to inherit from. Guessing a destination is
 *    how a form campaign quietly becomes a link-click campaign.
 *  · An ad set whose only ad uses asset_feed_spec (per-placement creative).
 *    There is no single creative to copy — the same refusal
 *    updateAdCreativeContent already makes, for the same reason.
 *  · Anything that is not an image. Meta video ads need /advideos, an encoding
 *    poll and a thumbnail; none of that exists in this client, and a button
 *    that 400s at the far end is worse than no button.
 *
 * NEW ADS ARE CREATED PAUSED BY DEFAULT. The operator chose the pictures, not
 * the spend — switching three new ads live inside an ad set that is mid-
 * learning is a decision, and it stays theirs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import {
  isMetaConfigured, MetaApiError, listAdSets, listAds, listCampaignAds,
  getAdWithCreative, createAdCreative, createAd, ingestImageFromUrl,
} from '@/lib/meta/client'
import { getProjectSlugForCampaign } from '@/lib/meta/campaign-structure'
import { getProjectBySlug } from '@/lib/data'
import { listLibrary } from '@/lib/freehold/library'
import { buildPool, poolReadiness, type PoolItem, type PoolKind } from '@/lib/freehold/creative-pool'
import type { MetaCta } from '@/lib/meta/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/** Ads cost money the moment they are switched on, so the number of them one
 *  press can create is bounded. Six is Meta's own upper end for a rotation. */
const MAX_ADS_PER_PRESS = 6

const httpUrl = (v: unknown): string => {
  const s = String(v ?? '').trim()
  return /^https?:\/\//i.test(s) ? s : ''
}

/** Library kinds map straight onto pool kinds; everything else is not media. */
const LIBRARY_KIND_TO_POOL: Record<string, PoolKind> = { image: 'image', video: 'video', pdf: 'pdf' }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params

  const raw: PoolItem[] = []

  // ── The project this campaign sells ──────────────────────────────────────
  // Its photographs are the most specific material there is: an ad for a
  // named tower must show that tower. Read through the launch-time link
  // table, which is the only record Meta itself does not keep.
  //
  // The project's FACTS travel with its photographs, because the generative
  // half of this panel composes a designed ad over one of them — the price
  // band, the payment plan, the handover year. Every number on a rendered ad
  // comes from this row or the field stays empty; nothing is filled in to
  // complete a layout.
  let project: {
    name: string; slug: string; area: string; developer: string
    startingPriceAED: number | null; paymentPlan: string | null; handoverYear: number | null
  } | null = null
  const slug = await getProjectSlugForCampaign(id).catch(() => null)
  if (slug) {
    const p = await getProjectBySlug(slug).catch(() => null)
    if (p) {
      const rec = p as unknown as Record<string, unknown>
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
      project = {
        name: String(p.name ?? slug),
        slug,
        area: str(rec.area) ?? '',
        developer: str(rec.developerName) ?? str((rec.developer as Record<string, unknown>)?.name) ?? '',
        startingPriceAED: num(rec.priceFrom) ?? num(rec.priceFromAed) ?? num(rec.startingPriceAED),
        paymentPlan: str(rec.paymentPlan),
        handoverYear: num(rec.handoverYear),
      }
      const gallery = Array.isArray(rec.gallery) ? rec.gallery : []
      const seen = new Set<string>()
      for (const g of [rec.heroImage, ...gallery]) {
        const url = httpUrl(g)
        if (!url || seen.has(url)) continue
        seen.add(url)
        raw.push({
          id: `project:${slug}:${seen.size}`, source: 'project', kind: 'image',
          url, title: String(p.name ?? slug),
        })
      }
      const media = (rec.media && typeof rec.media === 'object' ? rec.media : {}) as Record<string, unknown>
      const brochure = httpUrl(rec.brochureUrl) || httpUrl(media.brochure)
      if (brochure) {
        raw.push({
          id: `brochure:${slug}`, source: 'brochure', kind: 'pdf',
          url: brochure, title: String(p.name ?? slug),
        })
      }
    }
  }

  // ── The account's own shelf ──────────────────────────────────────────────
  const library = await listLibrary(auth.user.email, auth.user.role).catch(() => [])
  for (const it of library) {
    const kind = LIBRARY_KIND_TO_POOL[it.kind]
    const url = httpUrl(it.url)
    if (!kind || !url) continue
    raw.push({
      id: `library:${it.id}`, source: 'library', kind, url,
      title: it.title, createdAt: it.createdAt,
    })
  }

  // ── What this campaign is already running ────────────────────────────────
  // Not to offer again — to MARK, so "unused" is a fact rather than a hope.
  // See rule 2 of lib/freehold/creative-pool.ts.
  if (await isMetaConfigured()) {
    const live = await listCampaignAds(id).catch(() => [])
    for (const ad of live) {
      const url = httpUrl(ad.creative?.imageUrl)
      const hash = String(ad.creative?.imageHash ?? '')
      // A Meta CDN URL is what identifies the picture across sources; a hash
      // alone still earns a tile, keyed on the hash so it dedupes with itself.
      if (!url && !hash) continue
      raw.push({
        id: `live:${ad.id}`, source: 'live', kind: 'image',
        url: url || `meta://adimage/${hash}`, title: ad.name || ad.id,
        imageHash: hash || undefined, inUse: true,
      })
    }
  }

  const pool = buildPool(raw)
  return NextResponse.json({
    pool, readiness: poolReadiness(pool), project,
  })
}

interface PoolAdRequest {
  /** Meta image hash — present when the browser composed and uploaded first. */
  imageHash?: string
  /** A hosted picture the server ingests into the ad account instead. */
  imageUrl?: string
  /** Optional copy overrides; anything omitted is inherited from the ad set's
   *  working ad, which is the whole point of the inheritance rule. */
  headline?: string
  primaryText?: string
  description?: string
  /** Shown in Ads Manager. Falls back to a numbered variant name. */
  name?: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const { id: campaignId } = await params

  if (!(await isMetaConfigured())) {
    return NextResponse.json({ error: 'Connect the Meta ad account first.' }, { status: 400 })
  }

  let body: { adSetId?: string; ads?: PoolAdRequest[]; status?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const adSetId = String(body.adSetId ?? '').trim()
  const requested = Array.isArray(body.ads) ? body.ads.slice(0, MAX_ADS_PER_PRESS) : []
  // PAUSED unless the operator explicitly asked otherwise. See the header.
  const status = body.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'

  if (!adSetId) return NextResponse.json({ error: 'Pick the ad set the new ads belong to.' }, { status: 400 })
  if (requested.length === 0) return NextResponse.json({ error: 'Pick at least one design.' }, { status: 400 })

  // The ad set must belong to THIS campaign. Without this check the campaign
  // id in the URL is decoration and any ad set in the account is writable
  // from any campaign page.
  const adSets = await listAdSets(campaignId).catch(() => [])
  const target = adSets.find((a) => a.id === adSetId)
  if (!target) {
    return NextResponse.json({ error: 'That ad set is not part of this campaign.' }, { status: 400 })
  }

  // ── THE AD TO INHERIT FROM ───────────────────────────────────────────────
  // The ad set's own ads, read for the first one carrying a plain editable
  // creative. An ad set whose ads all use per-placement creative has no single
  // creative to copy, and inventing one would silently rebuild a form ad as a
  // link click — the refusal updateAdCreativeContent already makes.
  const existing = await listAds(adSetId).catch(() => [])
  let source: Awaited<ReturnType<typeof getAdWithCreative>> | null = null
  for (const ad of existing) {
    const snap = await getAdWithCreative(ad.id).catch(() => null)
    if (snap?.creative && !snap.usesAssetFeedSpec) { source = snap; break }
  }
  if (!source?.creative) {
    return NextResponse.json({
      error: existing.length === 0
        ? 'This ad set has no ad yet, so there is nothing to copy the form and destination from. Launch its first ad from the campaign launcher.'
        : 'This ad set\'s ads use a different image per placement, so there is no single ad to copy. Relaunch to change its creative.',
    }, { status: 400 })
  }

  const base = source.creative
  const created: Array<{ adId: string; creativeId: string; name: string }> = []
  const failed: Array<{ name: string; error: string }> = []

  for (const [i, want] of requested.entries()) {
    const name = String(want.name ?? '').trim().slice(0, 100)
      || `${target.name} — design ${existing.length + i + 1}`
    try {
      // A hash launches directly; a hosted URL is ingested into the ad
      // account first, which is the same path the wizard's preview uses and
      // the reliable one — Meta renders an external `picture` inconsistently.
      let imageHash = String(want.imageHash ?? '').trim()
      const imageUrl = httpUrl(want.imageUrl)
      if (!imageHash && imageUrl) {
        imageHash = (await ingestImageFromUrl(imageUrl)) ?? ''
      }
      if (!imageHash && !imageUrl) {
        failed.push({ name, error: 'No picture — an ad without an image is not an ad.' })
        continue
      }

      const { id: creativeId } = await createAdCreative({
        name,
        creative: {
          primaryText: String(want.primaryText ?? '').trim() || base.primaryText,
          headline:    String(want.headline ?? '').trim() || base.headline,
          description: String(want.description ?? '').trim() || base.description,
          landingUrl:  base.landingUrl,
          cta:         base.ctaType as MetaCta,
          imageHash:   imageHash || undefined,
          imageUrl:    imageHash ? undefined : imageUrl,
        },
        // Inherited, never defaulted — see the header.
        destination:      source.destination,
        leadFormId:       source.leadFormId,
        destinationPhone: source.destinationPhone,
      })
      const { id: adId } = await createAd({ adSetId, name, creativeId, status })
      created.push({ adId, creativeId, name })
    } catch (error) {
      // One bad picture must not lose the ads that worked — each result is
      // reported on its own rather than the whole press failing.
      failed.push({
        name,
        error: error instanceof MetaApiError ? error.message : 'Meta refused this design.',
      })
    }
  }

  return NextResponse.json({
    created, failed, status,
    adSet: { id: target.id, name: target.name },
    inherited: {
      destination: source.destination ?? 'landing',
      fromAdId: source.id,
      headline: base.headline,
    },
  }, { status: created.length > 0 ? 201 : 502 })
}
