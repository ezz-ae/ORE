/**
 * EVERYTHING THIS SYSTEM KNOWS ABOUT A LEAD, IN ONE READ.
 *
 * The rating loop shipped reading one column. `SELECT ... WHERE value_rating
 * >= 6` built the seed, `<= 2` built the exclusion, and that was the whole of
 * it — while the same database held, on the same rows, the CRM status, whether
 * the deal closed, what it closed for, whether the person was blocked, whether
 * their phone was dialable, and how thoroughly they read the landing page.
 *
 * The cost of that was not theoretical. A lead who BOUGHT and whom nobody got
 * round to rating was in no audience at all — the single most valuable row in
 * the account, invisible to the thing whose entire job is finding more people
 * like it. And a lead rated 9 in the first phone call who was later blocked
 * stayed in the seed, teaching Meta to find more of him.
 *
 * So this is the one read, and `splitCohorts` in seed-cohort.ts is the one
 * judgment. Every audience this product builds automatically goes through
 * both, which is the only way the rule "outcomes outrank opinions" can be
 * true everywhere instead of true in the module that happens to remember it.
 *
 * TWO THINGS DELIBERATELY NOT READ HERE.
 *
 *   Duplicates. The same person delivered twice is a campaign-quality fact
 *   (spend paid twice) and NOT a reason to exclude anybody — they may be a
 *   perfectly good buyer. "Already in your CRM" exclusion is crm-exclusion.ts
 *   and it is a different audience with a different purpose.
 *
 *   Anything about origin or nationality. Not read, not stored, not a lever.
 *   See lib/freehold/audience-pattern.ts.
 */
import { query } from '@/lib/db'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'
import type { SeedLead } from '@/lib/freehold/seed-cohort'

/**
 * Every unarchived lead with every signal that bears on whether it was worth
 * having.
 *
 * The lazily-created columns are handled by degrading one at a time rather
 * than all at once: a tenant whose brokers rate leads but who never ran
 * landing-behaviour scoring must not be told "nobody rated". That exact
 * failure already happened once in campaign-quality.ts and the fix is the
 * same shape here.
 */
export async function loadLeadEvidence(): Promise<SeedLead[]> {
  const base = `id, email, phone, status, blocked,
                value_rating AS "valueRating",
                behaviour_score AS "behaviourScore"`
  let rows: SeedLead[] = []
  try {
    rows = await query<SeedLead>(
      `SELECT ${base}, deal_value_aed AS "dealValueAed"
         FROM freehold_site_leads WHERE archived IS NOT TRUE`,
    )
  } catch {
    // deal_value_aed is created by the deals feature; behaviour_score and
    // value_rating by two others. Ensure them, then retry with the REAL data
    // before degrading — a seed with no deal weights is still a seed, and
    // returning [] here would read as "you have no buyers".
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS behaviour_score int`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    try {
      rows = await query<SeedLead>(
        `SELECT ${base}, NULL::numeric AS "dealValueAed"
           FROM freehold_site_leads WHERE archived IS NOT TRUE`,
      )
    } catch { return [] }
  }

  // A lead caught in a queue-purge burst carries a terminal status nobody
  // meant (see training-integrity.ts). It must not become a seed member or an
  // exclusion: both are permanent-ish instructions to Meta built on a status
  // this system already knows it cannot trust.
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
  return untrusted.size > 0 ? rows.filter((r) => !untrusted.has(r.id)) : rows
}
