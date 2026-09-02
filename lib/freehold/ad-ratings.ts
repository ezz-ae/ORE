/**
 * WHAT EACH AD'S LEADS WERE ACTUALLY WORTH, ACCORDING TO THE PEOPLE WHO
 * PHONED THEM.
 *
 * One reader, because two would drift. The CRM list uses this to forecast an
 * arriving lead (lead-forecast.ts) and the campaign advisor uses it to decide
 * whether an ad should keep spending — and those two must not be able to
 * disagree about the same ad on the same day. A number that means one thing on
 * the leads screen and another on the campaign screen is worse than no number,
 * because both look authoritative.
 *
 * This is the return path of the loop. Meta knows an ad produced a form
 * submission. Only the CRM knows whether the person on the other end was worth
 * calling, and until that travelled back to the ad, "quality" was a column in
 * a report rather than an input to anything.
 *
 * Fail-soft to an empty map everywhere: an ad with no ratings yet is an ad
 * nothing is claimed about, which is the honest state for a new one.
 */
import { query } from '@/lib/db'

export interface AdRating {
  /** Rated leads from this ad. The sample every claim is gated on. */
  rated: number
  /** Mean broker rating, 0–10. */
  meanRating: number
}

/**
 * Mean rating per Meta ad id, across every rated lead in the account.
 *
 * Deliberately NOT scoped to one campaign or one page: an ad's record is a
 * fact about the ad. An ad reused in a second campaign carries what it earned
 * in the first, which is the whole point of measuring ads rather than
 * campaigns.
 */
export async function adRatings(): Promise<Map<string, AdRating>> {
  const out = new Map<string, AdRating>()
  try {
    const rows = await query<{ ad: string; n: string; avg: string }>(
      `SELECT meta_ad_id AS ad, COUNT(*)::text AS n, AVG(value_rating)::text AS avg
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND value_rating IS NOT NULL
          AND meta_ad_id IS NOT NULL AND meta_ad_id <> ''
        GROUP BY meta_ad_id`,
    )
    for (const r of rows) {
      const rated = Number(r.n) || 0
      const meanRating = Number(r.avg)
      if (rated > 0 && Number.isFinite(meanRating)) out.set(String(r.ad), { rated, meanRating })
    }
  } catch {
    // No ratings is a weaker decision, never a failed request.
  }
  return out
}
