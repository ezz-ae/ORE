/**
 * RUNNING THE HARVEST — one path, shared by the button and the machine.
 *
 * The judgement lives in search-harvest.ts and is pure. This is the part that
 * talks to Google and to the company's own records: what the target cost per
 * lead is, which names must never be blocked, what is already in the account,
 * and which campaign carries the negatives.
 *
 * It exists as its own module because TWO callers need it — the screen where
 * an operator presses a button, and the machine cycle that runs unattended.
 * A second copy would drift, and the drift would be invisible: the button and
 * the nightly run would quietly start blocking different things.
 *
 * WHICH CONVERSIONS COUNT, and why this one place uses Google's.
 *
 * The Ads Machine deliberately does NOT trust Google's conversion count for
 * budget decisions — it judges Google trials on ATTRIBUTED CRM LEADS, real
 * people who arrived with utm_id set to the campaign id, because Google counts
 * conversions on its own terms and a budget rotation on that number would move
 * real money on someone else's arithmetic.
 *
 * A SEARCH TERM cannot be attributed that way. The query is not in the landing
 * URL; nothing downstream knows which phrase a lead typed. Google's per-term
 * conversion count is the only per-term signal that exists at all.
 *
 * So the target this module measures against is computed from GOOGLE's own
 * totals, not from the CRM. Not a preference — a consistency requirement. A
 * per-term numerator counted by Google against a denominator counted by the
 * CRM compares two different things, and the error goes straight into a
 * decision to block a phrase permanently.
 *
 * The safe consequence of that choice: an account with no Google conversion
 * tracking has zero conversions, targetCplFrom returns null, and NOTHING is
 * blocked. The module fails closed.
 */
import {
  getReportSummary, listCampaigns, listNegativeKeywords, listKeywords,
  addNegativeKeywords,
} from '@/lib/google/client'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { harvest, targetCplFrom, type SearchTerm, type HarvestContext, type Harvest } from '@/lib/google/search-harvest'

export type HarvestRange = '7d' | '30d' | '90d'

export const asRange = (v: string | null | undefined): HarvestRange =>
  v === '7d' || v === '90d' ? v : '30d'

export interface HarvestRun {
  result: Harvest
  ctx: HarvestContext
  /** The campaign the negatives would be attached to, when there is one. */
  campaignId: string | null
  termsRead: number
}

/**
 * Read everything the judgement needs. No writes.
 *
 * The already-known list is read from the LIVE account rather than from our
 * own record of what we intended to add: somebody adding a negative by hand in
 * Google's own interface is a decision this machine must respect, and a
 * record of our own intentions cannot see it.
 */
export async function gatherHarvest(range: HarvestRange): Promise<HarvestRun> {
  const [report, campaigns, props] = await Promise.all([
    getReportSummary(range),
    listCampaigns().catch(() => []),
    getInventoryPropertiesFromDB().catch(() => []),
  ])

  const terms: SearchTerm[] = report.searchTerms.map((s) => ({
    term: s.searchTerm,
    status: s.status,
    impressions: s.impressions,
    clicks: s.clicks,
    costAed: s.costMicros / 1_000_000,
    conversions: s.conversions,
    adGroupName: s.adGroupName,
  }))

  // The biggest-spending Search campaign carries the negatives. CAMPAIGN
  // level, not ad group: a query wasting money in one group wastes it in every
  // other group of the same campaign, and a negative added only where it was
  // noticed leaves the leak open everywhere else.
  const campaignId = campaigns
    .filter((c) => c.type === 'SEARCH')
    .sort((a, b) => (b.metrics?.costMicros ?? 0) - (a.metrics?.costMicros ?? 0))[0]?.id ?? null

  const [negs, kws] = await Promise.all([
    listNegativeKeywords().catch(() => []),
    listKeywords().catch(() => []),
  ])

  const ctx: HarvestContext = {
    targetCplAed: targetCplFrom(report.totalCostMicros / 1_000_000, report.totalConversions),
    // Project and developer names this company actually sells. Nothing
    // containing one is ever blocked — a brand query with no conversion yet is
    // still the best traffic in the account.
    brandTerms: props.flatMap((p) => [p.name, p.developer].filter(Boolean) as string[]),
    known: [...negs.map((n) => n.text), ...kws.map((k) => k.text)],
  }

  return { result: harvest(terms, ctx), ctx, campaignId, termsRead: terms.length }
}

/**
 * Apply the blocking half.
 *
 * ONLY the negatives, on both callers' behalf. A negative stops spend and
 * undoes in one click; a new keyword starts spend on a forecast rather than a
 * measurement, and that difference is the whole reason an unattended machine
 * is allowed to touch this at all.
 */
export async function applyHarvestNegatives(run: HarvestRun): Promise<{ blocked: number; wasteStoppedAed: number }> {
  if (!run.campaignId || run.result.negatives.length === 0) {
    return { blocked: 0, wasteStoppedAed: 0 }
  }
  const blocked = await addNegativeKeywords(
    run.campaignId,
    run.result.negatives.map((n) => ({ text: n.term, matchType: 'PHRASE' as const })),
  )
  return { blocked, wasteStoppedAed: run.result.wasteFoundAed }
}
