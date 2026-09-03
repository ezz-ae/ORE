/**
 * WHICH POOL BOUGHT THIS LEAD.
 *
 * "know each lead coming from which interest pool — analyse a full interest
 *  and behaviour signal — understand where the delivery is working now."
 *
 * The product already knows what every ad's leads were rated (ad-ratings.ts),
 * and it already knows which named audience it launched from
 * (audience-outcomes.ts). Neither answers this, and the second one cannot:
 * it keys on OUR saved-audience id, so it sees only campaigns this system
 * launched — which is none of the spend currently running. Every live
 * campaign in the account was built by hand in Ads Manager, and to
 * audience-outcomes they do not exist.
 *
 * The join that works on anything is the one Meta itself holds:
 *
 *     lead.meta_ad_id → ad.adset_id → adset.targeting → the pool
 *
 * Read from the live account, so a hand-built ad set is measured exactly like
 * a launched one.
 *
 * ── WHAT A "POOL" HONESTLY IS ────────────────────────────────────────────
 *
 * META NEVER SAYS WHICH INTEREST PRODUCED A LEAD. Inside an ad set the
 * interests are an OR and the delivery is one auction; there is no per-node
 * attribution and there never has been. Anyone claiming otherwise is
 * inferring it.
 *
 * So the unit of measurement is the AD SET'S WHOLE STACK — every interest and
 * behaviour it targets, as one pool. That is the finest grain the platform
 * actually supports, and it is honest at that grain.
 *
 * The way to get finer resolution is structural, not analytical: run ONE pool
 * per ad set. Then the pool and the ad set are the same thing and the
 * attribution is exact. `poolResolution` says which of the two a given ad set
 * is giving you, so a screen can tell an operator that splitting would buy
 * them an answer.
 *
 * ── THE KEY IS THE STACK, NOT THE AD SET ─────────────────────────────────
 *
 * Two ad sets with the same interests are the same pool and their results
 * belong together — that is the whole reason to key on the definition rather
 * than the id. It is also how a pool accumulates enough rated leads to clear
 * MIN_ATTRIBUTED_FOR_QUALITY when no single ad set would.
 *
 * Pure — the live specs and the ratings are passed in. Runs in `pnpm guards`.
 */
import { MIN_ATTRIBUTED_FOR_QUALITY } from '@/lib/freehold/min-evidence'

/** One targeting entity as Meta returns it. */
interface Entity { id?: unknown; name?: unknown }

export interface AdSetPool {
  adSetId: string
  adSetName: string
  /** Ad ids delivering inside it. */
  adIds: string[]
  /** The ad set's live targeting spec, straight from Meta. */
  targeting?: Record<string, unknown> | null
}

export interface PoolLeads {
  /** Rated leads attributed to this pool, and their mean. */
  rated: number
  meanRating: number
  /** Every lead attributed, rated or not. */
  leads: number
}

export interface PoolReading extends PoolLeads {
  key: string
  /** The interest and behaviour names, in the order a person should read them. */
  signals: string[]
  adSetIds: string[]
  adIds: string[]
  /** 'exact' when one ad set carries this pool alone — the pool and the ad set
   *  are then the same thing and the attribution has no inference in it.
   *  'shared' when several ad sets target the same stack. */
  resolution: 'exact' | 'shared'
  /** Enough rated leads for the mean to be a fact rather than a coin flip. */
  decided: boolean
}

const str = (v: unknown) => String(v ?? '').trim()

/**
 * Every interest and behaviour name in an ad set's spec, deduplicated and
 * sorted.
 *
 * Sorted because the key must not change when Meta returns the same stack in
 * a different order — an ad set that "became a new pool" overnight would
 * reset its own evidence and start the sample from zero.
 *
 * Reads the base group AND every flexible_spec layer AND the top-level
 * interests/behaviors fields, because Meta uses all three shapes and an ad set
 * built in Ads Manager uses different ones from an ad set built by an API.
 * Missing a layer would silently merge two different pools into one key.
 */
export function poolSignals(targeting?: Record<string, unknown> | null): string[] {
  if (!targeting) return []
  const names = new Set<string>()
  const take = (v: unknown) => {
    if (!Array.isArray(v)) return
    for (const e of v as Entity[]) {
      const n = str(e?.name)
      if (n) names.add(n)
    }
  }
  take(targeting.interests)
  take(targeting.behaviors)
  const flexible = Array.isArray(targeting.flexible_spec) ? targeting.flexible_spec : []
  for (const g of flexible) {
    const grp = (g ?? {}) as Record<string, unknown>
    take(grp.interests)
    take(grp.behaviors)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** The pool's identity: its signals, joined. Empty stack → 'broad', which is
 *  a real pool and the most important one to be able to name — an ad set with
 *  no interests at all is buying everybody, and it must not disappear from
 *  this analysis for lack of a label. */
export function poolKey(targeting?: Record<string, unknown> | null): string {
  const s = poolSignals(targeting)
  return s.length === 0 ? 'broad' : s.join(' | ')
}

/**
 * Roll every ad set's leads up by pool.
 *
 * `ratingsByAd` is what ad-ratings.ts already produces — one reader for what
 * an ad's leads were worth, so the pool view and the ad view can never
 * disagree about the same ad on the same day.
 */
export function rollupPools(
  adSets: readonly AdSetPool[],
  ratingsByAd: ReadonlyMap<string, { rated: number; meanRating: number }>,
  leadsByAd: ReadonlyMap<string, number> = new Map(),
): PoolReading[] {
  const byKey = new Map<string, {
    signals: string[]; adSetIds: Set<string>; adIds: Set<string>
    rated: number; ratingSum: number; leads: number
  }>()

  for (const set of adSets) {
    const key = poolKey(set.targeting)
    let e = byKey.get(key)
    if (!e) {
      e = { signals: poolSignals(set.targeting), adSetIds: new Set(), adIds: new Set(), rated: 0, ratingSum: 0, leads: 0 }
      byKey.set(key, e)
    }
    e.adSetIds.add(set.adSetId)
    for (const adId of set.adIds) {
      if (e.adIds.has(adId)) continue
      e.adIds.add(adId)
      const r = ratingsByAd.get(adId)
      if (r && r.rated > 0) {
        e.rated += r.rated
        // WEIGHTED BY SAMPLE. Averaging the per-ad means would let an ad with
        // one rated lead count as much as one with forty, which is how a
        // single broker's Tuesday becomes a fact about a pool.
        e.ratingSum += r.meanRating * r.rated
      }
      e.leads += leadsByAd.get(adId) ?? 0
    }
  }

  return [...byKey.entries()]
    .map(([key, e]) => ({
      key,
      signals: e.signals,
      adSetIds: [...e.adSetIds],
      adIds: [...e.adIds],
      rated: e.rated,
      meanRating: e.rated > 0 ? e.ratingSum / e.rated : 0,
      leads: e.leads,
      resolution: e.adSetIds.size === 1 ? ('exact' as const) : ('shared' as const),
      decided: e.rated >= MIN_ATTRIBUTED_FOR_QUALITY,
    }))
    // Decided pools first, then by what they were worth: the question this
    // answers is "which pool do I buy more of", and an undecided pool is not
    // an answer to it however good its provisional mean looks.
    .sort((a, b) =>
      Number(b.decided) - Number(a.decided)
      || b.meanRating - a.meanRating
      || b.rated - a.rated)
}

/**
 * How much finer the answer would get by splitting.
 *
 * An ad set carrying N signals gives one verdict for all N. Running them as
 * N ad sets gives N verdicts — and this is the only way to learn which of them
 * works, because Meta will not tell you.
 *
 * Reported, never done automatically: splitting an ad set restarts its
 * learning and costs real delivery, and that is the operator's call.
 */
export function poolResolution(reading: PoolReading): {
  signals: number
  wouldSplitInto: number
  worthSplitting: boolean
} {
  const signals = reading.signals.length
  return {
    signals,
    wouldSplitInto: signals,
    // Only worth saying once the pool has produced enough to show it matters.
    // Suggesting a split on a pool nobody has rated is asking somebody to pay
    // for resolution on a question they have not yet asked.
    worthSplitting: signals > 1 && reading.decided,
  }
}
