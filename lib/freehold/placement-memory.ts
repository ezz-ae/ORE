/**
 * WHAT THE ACCOUNT ALREADY PAID TO LEARN ABOUT PLACEMENTS.
 *
 * The placement audit condemns a surface with an exact significance test —
 * and until now the verdict died in an activity log. Live campaigns stayed
 * untouched (rightly: editing a live ad set's placements changes what it buys
 * AND resets its learning phase), but the NEXT launch started from zero and
 * bought the same condemned inventory again. The machine was paying for the
 * same lesson every time it launched.
 *
 * This module is the memory between launches. It aggregates placement
 * delivery across the machine's own past campaigns and answers one question:
 * which launchable surfaces has this account already proven bad?
 *
 * THE SAFE MOMENT TO ACT is the only novelty here. Mid-flight exclusion
 * trades a known cost (a learning reset, plus a live spec silently different
 * from what the operator approved) for latency that does not matter at a
 * property campaign's cadence. A launch, by contrast, has no learning to
 * reset and no spec to betray — acting there is free. So: live campaigns are
 * reported, next launches are shaped.
 *
 * WHY CROSS-CAMPAIGN AGGREGATION IS LEGITIMATE: a placement verdict is about
 * inventory economics — what a surface's impressions cost and whether anyone
 * on it ever clicks — not about any one audience. Pooling also decides
 * sooner: surfaces too thin to judge inside one campaign clear the evidence
 * floor in aggregate.
 *
 * WHAT IS DELIBERATELY NOT REMEMBERED: 'mismatch' verdicts. A crop is a fact
 * about one creative's aspect ratio, and the next launch ships a different
 * creative. Only 'drain' (proven to convert worse) and 'noClicks' (proven to
 * be ignored) carry across campaigns.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import { auditPlacements, type PlacementRow } from './placement-audit'

/** The four surfaces a launch can actually name — the product's hardened set. */
export type LaunchablePlacement = 'igFeed' | 'igStory' | 'reels' | 'fbFeed'
export const LAUNCHABLE_PLACEMENTS: LaunchablePlacement[] = ['igFeed', 'igStory', 'reels', 'fbFeed']

/**
 * Insights vocabulary → launchable key. The buying API and the insights
 * breakdown disagree on names (an Instagram feed impression comes back as
 * `stream` OR `feed` depending on surface generation), so both spellings map.
 * Surfaces with no entry (audience_network, messenger, facebook story…) are
 * not launchable here and cannot be avoided-by-name — the launch spec already
 * never buys them.
 */
const SURFACE_KEY: Record<string, LaunchablePlacement> = {
  'facebook:feed': 'fbFeed',
  'instagram:stream': 'igFeed',
  'instagram:feed': 'igFeed',
  'instagram:story': 'igStory',
  'instagram:stories': 'igStory',
  'instagram:instagram_stories': 'igStory',
  'facebook:facebook_reels': 'reels',
  'instagram:reels': 'reels',
}

const keyOf = (r: { platform: string; position: string }): LaunchablePlacement | null =>
  SURFACE_KEY[`${r.platform}:${r.position}`.toLowerCase()] ?? null

/** Sum several campaigns' placement rows into one account-level view. */
export function aggregatePlacementRows(rowsets: PlacementRow[][]): PlacementRow[] {
  const acc = new Map<string, PlacementRow>()
  for (const rows of rowsets) {
    for (const r of rows) {
      const k = `${r.platform}:${r.position}`.toLowerCase()
      const prev = acc.get(k)
      if (prev) {
        prev.impressions += r.impressions
        prev.clicks += r.clicks
        prev.spend += r.spend
        prev.leads += r.leads
      } else {
        acc.set(k, { ...r })
      }
    }
  }
  return [...acc.values()]
}

export interface PlacementMemory {
  /** Launchable surfaces the account's history condemns. */
  avoid: LaunchablePlacement[]
  /** What the next launch should buy. NEVER empty — see allCondemned. */
  keep: LaunchablePlacement[]
  /**
   * True when history condemned every launchable surface. `keep` then holds
   * the full set: a memory that would leave a launch with nowhere to deliver
   * is a signal for a human, not a launch instruction.
   */
  allCondemned: boolean
  /** The audit's own sentences for what was condemned — the receipts. */
  reasons: string[]
}

/**
 * Read the aggregated history and say which surfaces the next launch should
 * skip. Null when there is nothing learned — no delivery, or nothing
 * condemned — so callers can distinguish "no memory" from "memory says all
 * clear".
 *
 * A key is avoided when at least one of its surfaces is CONDEMNED and none of
 * its surfaces is proven STRONG. The asymmetry is deliberate: `reels` buys
 * Facebook and Instagram Reels as one unit, so a proven-bad half condemns the
 * unit — unless the other half is proven good, in which case the honest state
 * is mixed and the memory keeps its hands off. Tiny undecided surfaces do not
 * rescue a key: absence of evidence is not a defence.
 */
export function learnedPlacements(rows: PlacementRow[]): PlacementMemory | null {
  const audit = auditPlacements(rows)
  if (audit.readings.length === 0) return null

  const condemned = audit.cut.filter((c) => c.verdict === 'drain' || c.verdict === 'noClicks')
  const strongKeys = new Set(
    audit.readings.filter((r) => r.verdict === 'strong').map(keyOf).filter(Boolean),
  )

  const avoid: LaunchablePlacement[] = []
  for (const c of condemned) {
    const key = keyOf(c)
    if (key && !strongKeys.has(key) && !avoid.includes(key)) avoid.push(key)
  }
  if (avoid.length === 0) return null

  const keep = LAUNCHABLE_PLACEMENTS.filter((k) => !avoid.includes(k))
  const allCondemned = keep.length === 0
  return {
    avoid,
    keep: allCondemned ? [...LAUNCHABLE_PLACEMENTS] : keep,
    allCondemned,
    reasons: condemned.filter((c) => keyOf(c)).map((c) => c.sentence),
  }
}
