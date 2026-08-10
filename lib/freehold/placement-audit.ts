/**
 * PLACEMENT AUDIT — where the money went, and whether the ad survived getting
 * there.
 *
 * Placements are one of the few things Meta still lets an advertiser control
 * outright, and two very different problems hide inside a campaign-level
 * rollup that look identical from above:
 *
 *  1. OVERFLOW INVENTORY. Audience Network and in-stream surplus are bundled
 *     into every advertiser's delivery. Meta will push a large share of
 *     impressions there, priced in your own currency so it reads as ordinary
 *     spend. A campaign can sit at a perfectly normal cost per lead while most
 *     of its impressions went to inventory nobody else bid for.
 *
 *  2. CREATIVE DESTRUCTION. A 1:1 or 4:5 image dropped into a 9:16 surface is
 *     cropped, letterboxed, or buried under UI chrome — headline gone, price
 *     panel cut, logo half off-screen. The ad that ran in Feed is not the ad
 *     that ran in Stories. They share a creative id and nothing else, and a
 *     blended number judges the average of two different ads.
 *
 * Both are fixable and neither is visible above this file.
 *
 * Every verdict here is evidence-gated the same way the rest of the system is:
 * a placement is only condemned when its conversion gap against the rest of
 * the campaign is significant on impressions. A placement that is merely young
 * is "undecided", never "bad" — killing a placement in week one on forty
 * impressions is the mistake this whole layer exists to avoid.
 *
 * Pure — no I/O. The Meta call lives in `lib/meta/client.ts`.
 */
import { samePace, read, SIGNIFICANT_P, type Arm, type ArmReading } from '@/lib/freehold/inventory-quality'

export interface PlacementRow {
  platform: string
  position: string
  impressions: number
  clicks: number
  spend: number
  leads: number
}

/** The shape a surface actually renders. Everything else follows from this. */
export type SurfaceShape = 'feed' | 'vertical' | 'video' | 'other'

/** Creative aspect ratios we can produce, in the vocabulary the studio uses. */
export type CreativeAspect = '1:1' | '4:5' | '9:16' | '16:9'

/**
 * Off-platform inventory: third-party apps and sites, not Facebook or
 * Instagram. Not automatically bad — but it is where cheap impressions come
 * from, and it deserves to be named rather than blended in.
 */
const OFF_PLATFORM = new Set(['audience_network', 'unknown'])

/** Positions that render full-screen vertical, where a non-vertical creative
 *  is cropped rather than fitted. */
const VERTICAL_POSITIONS = new Set([
  'story', 'stories', 'instagram_stories', 'facebook_stories',
  'reels', 'facebook_reels', 'instagram_reels', 'reels_overlay',
])

/** Positions that play inside someone else's video. The creative is not the
 *  point of the session there, whatever its aspect ratio. */
const INSTREAM_POSITIONS = new Set(['instream_video', 'rewarded_video', 'video_feeds', 'an_classic'])

export function shapeOf(platform: string, position: string): SurfaceShape {
  const p = position.toLowerCase()
  if (VERTICAL_POSITIONS.has(p)) return 'vertical'
  if (INSTREAM_POSITIONS.has(p)) return 'video'
  if (p.includes('feed') || p === 'stream' || p === 'explore' || p === 'search') return 'feed'
  return OFF_PLATFORM.has(platform) ? 'video' : 'other'
}

/** Does this creative survive this surface intact? A 9:16 asset fits a
 *  vertical surface; a square or landscape one is cropped to fit it. */
export function fits(shape: SurfaceShape, aspect: CreativeAspect | null): boolean | null {
  if (!aspect) return null                       // unknown creative — claim nothing
  if (shape === 'vertical') return aspect === '9:16'
  if (shape === 'feed') return aspect !== '9:16' // a 9:16 asset is letterboxed in feed
  return null                                    // video/other: not an aspect question
}

export type PlacementVerdict =
  /** Proven to convert worse than the rest of the campaign, and taking real spend. */
  | 'drain'
  /** The creative does not fit this surface — it is being cropped to run here. */
  | 'mismatch'
  /** Proven to convert better than the rest. */
  | 'strong'
  /**
   * Nobody is clicking, and that is already decidable.
   *
   * The lead verdict waits on leads, which are rare — a placement can burn
   * weeks of budget before enough of them exist to prove anything. Clicks are
   * plentiful, so a placement that is clicked significantly less than the rest
   * of the campaign separates from the field FAR sooner. This is that earlier
   * read, and it defers the moment the lead evidence arrives: it is only ever
   * reported while the lead verdict is still undecided.
   */
  | 'noClicks'
  /** Not enough delivery to say anything. */
  | 'undecided'

export interface PlacementReading extends ArmReading {
  platform: string
  position: string
  shape: SurfaceShape
  offPlatform: boolean
  /** Share of the campaign's impressions and spend, 0–1. */
  impressionShare: number
  spendShare: number
  verdict: PlacementVerdict
  /** Probability this placement converts at the same rate as everything else. */
  p: number
  /** True when the creative is cropped to run here; null when unknown. */
  creativeFits: boolean | null
  /** One line an operator can act on. */
  sentence: string
}

export interface PlacementAudit {
  readings: PlacementReading[]
  /** Placements worth excluding, worst first — proven drains, then mismatches
   *  that are actually taking spend. */
  cut: PlacementReading[]
  /** Share of impressions and spend that went off-platform. */
  offPlatformImpressionShare: number
  offPlatformSpendShare: number
  headline: string
  /** The concrete next action, or the honest absence of one. */
  recommendation: string
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const label = (r: { platform: string; position: string }) =>
  `${r.platform.replace(/_/g, ' ')} · ${r.position.replace(/_/g, ' ')}`

/**
 * Audit a campaign's placements.
 *
 * `aspect` is the creative's aspect ratio when known. Without it the mismatch
 * half is simply skipped — a guess about what the ad looks like would be a
 * worse answer than no answer.
 *
 * `minSpendShare` is the floor below which a placement is not worth an
 * operator's attention even if it is statistically bad: cutting a placement
 * that took 0.4% of spend is busywork dressed as optimisation.
 */
export function auditPlacements(
  rows: PlacementRow[],
  aspect: CreativeAspect | null = null,
  minSpendShare = 0.05,
): PlacementAudit {
  const totalImp = rows.reduce((n, r) => n + r.impressions, 0)
  const totalSpend = rows.reduce((n, r) => n + r.spend, 0)
  const totalLeads = rows.reduce((n, r) => n + r.leads, 0)
  const totalClicks = rows.reduce((n, r) => n + r.clicks, 0)

  if (rows.length === 0 || totalImp === 0) {
    return {
      readings: [], cut: [], offPlatformImpressionShare: 0, offPlatformSpendShare: 0,
      headline: 'No placement delivery to read yet.',
      recommendation: 'Nothing to act on — this campaign has not delivered.',
    }
  }

  const readings: PlacementReading[] = rows.map((row) => {
    const arm: Arm = {
      id: `${row.platform}:${row.position}`, name: label(row),
      spend: row.spend, leads: row.leads, impressions: row.impressions, clicks: row.clicks,
    }
    const base = read(arm)
    const shape = shapeOf(row.platform, row.position)
    const offPlatform = OFF_PLATFORM.has(row.platform)
    const impressionShare = row.impressions / totalImp
    const spendShare = totalSpend > 0 ? row.spend / totalSpend : 0

    // Against the REST of the campaign, not against the whole — a placement
    // that dominates delivery would otherwise be compared largely with itself
    // and could never separate from the field.
    const restLeads = totalLeads - row.leads
    const restImp = totalImp - row.impressions
    const p = restImp > 0 ? samePace(row.leads, row.impressions, restLeads, restImp) : 1
    const rate = row.leads / row.impressions
    const restRate = restImp > 0 ? restLeads / restImp : 0

    // THE EARLIER READ, ON THE PLENTIFUL EVENT.
    //
    // Leads are rare, so the verdict above needs a lot of delivery before it
    // can say anything — and a placement buying nothing but cheap impressions
    // spends the whole of that wait. Clicks are common enough to separate from
    // the field in a fraction of the time, judged by the SAME significance
    // machinery rather than an invented threshold like "50,000 impressions in
    // two hours", which would condemn a genuinely expensive, slow, high-intent
    // audience for behaving exactly as it should.
    const restClicks = totalClicks - row.clicks
    const clickP = restImp > 0 ? samePace(row.clicks, row.impressions, restClicks, restImp) : 1
    const clickRate = row.clicks / row.impressions
    const restClickRate = restImp > 0 ? restClicks / restImp : 0

    const creativeFits = fits(shape, aspect)
    let verdict: PlacementVerdict = 'undecided'
    if (p < SIGNIFICANT_P && rate < restRate) verdict = 'drain'
    else if (p < SIGNIFICANT_P && rate > restRate) verdict = 'strong'
    else if (creativeFits === false) verdict = 'mismatch'
    // Only while the lead verdict is still open. A placement PROVEN to convert
    // better than the rest converts better whatever its click rate — some
    // audiences click little and buy anyway, and overriding a lead verdict
    // with a click one would be reading the shallower event as the truer one.
    else if (clickP < SIGNIFICANT_P && clickRate < restClickRate) verdict = 'noClicks'

    let sentence: string
    if (verdict === 'drain') {
      sentence = `${label(row)} takes ${pct(spendShare)} of spend and converts worse than the rest of the campaign (p=${p < 0.0001 ? p.toExponential(1) : p.toFixed(4)}).`
    } else if (verdict === 'strong') {
      sentence = `${label(row)} converts better than the rest of the campaign — ${Math.round((base.lpm ?? 0))} leads per million impressions.`
    } else if (verdict === 'noClicks') {
      sentence = `${label(row)} takes ${pct(spendShare)} of spend and is clicked far less than the rest of the campaign. Too few leads anywhere yet to judge it on leads — but nobody is engaging with it.`
    } else if (verdict === 'mismatch') {
      sentence = `${label(row)} is a ${shape === 'vertical' ? 'full-screen vertical' : 'feed'} surface carrying a ${aspect} creative — the ad is cropped to run here, and it is taking ${pct(spendShare)} of spend.`
    } else {
      sentence = `${label(row)} has not separated from the rest of the campaign yet (${row.impressions.toLocaleString()} impressions).`
    }

    return { ...base, platform: row.platform, position: row.position, shape, offPlatform, impressionShare, spendShare, verdict, p, creativeFits, sentence }
  })

  // Worth cutting: proven drains at any meaningful spend, plus mismatches that
  // are actually costing something. A mismatch on 2% of spend is a note, not
  // an action.
  const cut = readings
    .filter((r) => (r.verdict === 'drain' || r.verdict === 'mismatch') && r.spendShare >= minSpendShare)
    .sort((a, b) => (a.verdict === b.verdict ? b.spendShare - a.spendShare : a.verdict === 'drain' ? -1 : 1))

  const offImp = readings.filter((r) => r.offPlatform).reduce((n, r) => n + r.impressionShare, 0)
  const offSpend = readings.filter((r) => r.offPlatform).reduce((n, r) => n + r.spendShare, 0)

  const headline = offImp > 0.2
    ? `${pct(offImp)} of impressions went off-platform, for ${pct(offSpend)} of spend.`
    : `Delivery ran across ${readings.length} placement${readings.length === 1 ? '' : 's'}; ${pct(offImp)} of impressions went off-platform.`

  const recommendation = cut.length === 0
    ? readings.some((r) => r.verdict === 'undecided')
      ? 'No placement has proven itself worse than the others yet. Leave the split alone and let it deliver.'
      : 'Nothing to cut — every placement is pulling its weight.'
    : `Exclude ${cut.map((r) => label(r)).join(', ')} — together ${pct(cut.reduce((n, r) => n + r.spendShare, 0))} of spend.` +
      (cut.some((r) => r.verdict === 'mismatch')
        ? ' For the cropped surfaces, a 9:16 version of the creative is the alternative to excluding them.'
        : '')

  return { readings, cut, offPlatformImpressionShare: offImp, offPlatformSpendShare: offSpend, headline, recommendation }
}
