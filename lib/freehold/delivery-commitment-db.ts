/**
 * The delivery promise, read from the CRM.
 *
 * The rules are pure and live in lib/freehold/delivery-commitment.ts. This file
 * only fetches, and it fetches through the SAME attribution clause
 * `getCampaignQuality` uses — utm_id, utm_campaign, or the campaign's name.
 * A promise counted by one rule and a quality score computed by another would
 * put two different numbers for the same campaign on the same screen, which is
 * the failure this product keeps having to fix.
 *
 * Archived and blocked rows are SELECTED rather than filtered in SQL, because
 * the pure counter has to be the thing that decides they deliver nothing — one
 * rule, in one place, testable without a database.
 */
import { query } from '@/lib/db'
import {
  countAll, forecast, unratedCount, isValuable, passes,
  type CountableLead, type DeliveryBar, type BarCount, type Forecast,
} from '@/lib/freehold/delivery-commitment'

export interface CommitmentRead {
  campaignId: string
  campaignName: string
  target: number
  /** Every bar, counted over the same leads. */
  bars: BarCount[]
  /** Leads bought and attributed, whatever they turned out to be. */
  leadsBought: number
  /** Leads nobody has rated. Never folded into a failure. */
  unrated: number
  spentAed: number
  /** Forecast for the recommended bar, or a named refusal to give one. */
  forecast: Forecast
}

/**
 * Leads attributed to one campaign, in the shape the counter needs.
 *
 * The lazy-column retry mirrors `getCampaignQuality`: `value_rating` is created
 * by one feature and the row may predate it. Getting this wrong once already
 * made a tenant whose brokers HAD rated leads report that nobody had.
 */
async function leadsFor(campaignId: string, campaignName: string): Promise<CountableLead[]> {
  type Row = {
    phone: string | null; email: string | null; status: string | null
    value_rating: number | null; archived: boolean | null; blocked: boolean | null
  }
  const sql =
    `SELECT phone, email, status, value_rating, archived, blocked
       FROM freehold_site_leads
      WHERE ( ($1 <> '' AND utm_id = $1)
              OR ($1 <> '' AND utm_campaign = $1)
              OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`
  const params = [campaignId || '', campaignName || '']
  let rows: Row[] = []
  try {
    rows = await query<Row>(sql, params)
  } catch {
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    try { rows = await query<Row>(sql, params) } catch { return [] }
  }
  return rows.map((r) => ({
    phone: r.phone,
    email: r.email,
    status: r.status,
    valueRating: r.value_rating,
    archived: r.archived === true,
    blocked: r.blocked === true,
  }))
}

/**
 * Read the promise for one campaign.
 *
 * `judged` for the recommended bar is the RATED count, not the total. An
 * unrated lead has not failed the bar, it has not been shown to anybody — and
 * dividing by the total would report a good rate far worse than the truth,
 * which on this screen means asking for a bigger budget to fix a problem that
 * is actually "nobody has opened the CRM".
 */
export async function readCommitment(input: {
  campaignId: string
  campaignName: string
  target: number
  spentAed: number
  bar: DeliveryBar
}): Promise<CommitmentRead> {
  const leads = await leadsFor(input.campaignId, input.campaignName)
  const live = leads.filter((l) => l.archived !== true && l.blocked !== true)
  const bars = countAll(leads, input.target)
  const met = bars.find((b) => b.bar === input.bar)?.met ?? 0

  const judged = input.bar === 'valuable'
    ? live.filter((l) => l.valueRating != null).length
    : live.length

  return {
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    target: input.target,
    bars,
    leadsBought: live.length,
    unrated: unratedCount(leads),
    spentAed: input.spentAed,
    forecast: forecast({
      bar: input.bar,
      target: input.target,
      met,
      judged,
      leadsBought: live.length,
      spentAed: input.spentAed,
    }),
  }
}

export { isValuable, passes }
