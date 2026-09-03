/**
 * THE POOL VIEW, ASSEMBLED FROM THE LIVE ACCOUNT.
 *
 * lib/freehold/interest-pools.ts is the rule; this is the join that feeds it.
 * Kept apart because the rule has to be testable without Meta or a database,
 * and because every reader here is one that already exists — the pool view
 * must not be able to disagree with the ad view about the same ad on the same
 * day, so it uses adRatings() rather than its own SQL.
 *
 * Reads LIVE ad sets, so a campaign built by hand in Ads Manager is measured
 * exactly like one this system launched. That is the entire reason this
 * exists: audience-outcomes.ts keys on our saved-audience id and therefore
 * cannot see a single dirham of what is currently running.
 */
import { query } from '@/lib/db'
import { listCampaigns, listAdSets, listAds } from '@/lib/meta/client'
import { adRatings } from '@/lib/freehold/ad-ratings'
import { rollupPools, type AdSetPool, type PoolReading } from '@/lib/freehold/interest-pools'

/** Leads per Meta ad id — rated or not. The denominator the rated count is a
 *  fraction of, so a screen can say "9 of 34 rated" rather than implying the
 *  pool produced nine leads. Fail-soft to empty. */
async function leadsByAd(): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    const rows = await query<{ ad: string; n: string }>(
      `SELECT meta_ad_id AS ad, COUNT(*)::text AS n
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE AND meta_ad_id IS NOT NULL AND meta_ad_id <> ''
        GROUP BY meta_ad_id`,
    )
    for (const r of rows) out.set(String(r.ad), Number(r.n) || 0)
  } catch {
    // A missing denominator weakens the sentence; it does not fail the read.
  }
  return out
}

export interface PoolView {
  pools: PoolReading[]
  /** Ad sets whose targeting could not be read at all. Reported rather than
   *  dropped: a pool missing from this list because Meta timed out is
   *  indistinguishable, on screen, from a pool that produced nothing. */
  unreadable: string[]
}

export async function interestPoolView(): Promise<PoolView> {
  const unreadable: string[] = []
  const sets: AdSetPool[] = []

  const campaigns = await listCampaigns().catch(() => [])
  for (const c of campaigns) {
    const id = String((c as { id?: unknown }).id ?? '')
    if (!id) continue
    let adSets: Awaited<ReturnType<typeof listAdSets>> = []
    try {
      adSets = await listAdSets(id)
    } catch {
      unreadable.push(id)
      continue
    }
    for (const s of adSets) {
      const adSetId = String(s.id ?? '')
      if (!adSetId) continue
      let adIds: string[] = []
      try {
        adIds = (await listAds(adSetId)).map((a) => String(a.id ?? '')).filter(Boolean)
      } catch {
        // An ad set we cannot enumerate contributes no leads but is still a
        // pool that exists and is spending — recorded, not silently skipped.
        unreadable.push(adSetId)
      }
      sets.push({
        adSetId,
        adSetName: String(s.name ?? adSetId),
        adIds,
        targeting: (s.targeting ?? null) as Record<string, unknown> | null,
      })
    }
  }

  const [ratings, leads] = await Promise.all([adRatings(), leadsByAd()])
  return { pools: rollupPools(sets, ratings, leads), unreadable }
}
