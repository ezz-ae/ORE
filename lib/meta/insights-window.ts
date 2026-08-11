/**
 * WHICH WINDOW A NUMBER IS FROM — one rule, so two screens cannot disagree.
 *
 * The failure this answers to, seen on a live account:
 *
 *   Lead Machine home        cash offer new audiences · AED 204 · 1 lead
 *   Campaign page            cash offer new audiences · AED 501 · 2 leads
 *   …and every other campaign on the home screen · AED 0 · 0 leads
 *
 * Same account, same minute, three different stories. Neither screen was
 * lying; they were asking Meta different questions and printing both answers
 * in the same typeface.
 *
 * TWO WINDOWS, AND THEY ARE NOT INTERCHANGEABLE:
 *
 *  · RECENT (rolling 30 days) is the right read for JUDGING a live campaign.
 *    It is what an ads operator means by "how is it doing", and every
 *    comparison in this product — pace, frequency, placement, cost per lead —
 *    is against it.
 *
 *  · HEADLINE (lifetime) is the right read for REPORTING what a campaign
 *    brought. A rolling window drains after a campaign is switched off:
 *    thirty days past its last lead it reads zero, as though the campaign
 *    never ran. "How many leads did this bring?" is a question about the whole
 *    life of the campaign, and its answer must never go down.
 *
 * A list of campaigns is a REPORT, not a judgement, so it takes the headline
 * window — the same one the campaign page's headline numbers take. That is the
 * whole of the fix, and `headlineInsights` is where it is written down once.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import type { MetaInsights } from './types'

/** Meta's `date_preset` for everything a campaign ever did. */
export const HEADLINE_WINDOW = 'maximum'
/** Meta's `date_preset` for the rolling window every judgement is made on.
 *  NOT `this_month`: a calendar window erases every campaign's history at
 *  midnight on the 1st, which froze the Ads Machine for the first days of
 *  every month and made this product read as "everything is dead". */
export const RECENT_WINDOW = 'last_30d'

/**
 * The numbers a screen PRINTS for a campaign.
 *
 * Lifetime when it exists, the rolling window when it does not — never the
 * other way round, and never one screen's choice. A campaign too new for a
 * lifetime row (Meta backfills within the hour) still shows its recent
 * numbers rather than a blank.
 */
export function headlineInsights(
  lifetime: MetaInsights | null | undefined,
  recent: MetaInsights | null | undefined,
): MetaInsights | null {
  return lifetime ?? recent ?? null
}

/** A campaign-level insights row as Meta returns it from the ACCOUNT edge. */
export type CampaignInsightRow = MetaInsights & { campaign_id?: string }

/**
 * ONE CALL FOR THE WHOLE LIST, keyed by campaign.
 *
 * The list route used to fetch insights per campaign, and only for the ones
 * whose status was ACTIVE — so every paused campaign printed AED 0 and zero
 * leads on the home screen, whatever it had actually spent and brought. The
 * account-level insights edge answers for all of them at once
 * (`level=campaign`), which is both correct and one Graph call instead of a
 * hundred.
 *
 * A campaign ABSENT from the result is a campaign that has never delivered.
 * It maps to null, not to a zeroed row: zero spend is a measurement, and this
 * is the absence of one. The screens already know how to print null.
 */
export function indexInsightsByCampaign(
  rows: CampaignInsightRow[] | null | undefined,
): Map<string, MetaInsights> {
  const map = new Map<string, MetaInsights>()
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = String(row?.campaign_id ?? '').trim()
    if (!id) continue
    // Meta returns one row per campaign at this level; if it ever returns two,
    // the first wins rather than the last, so the order Meta chose is kept.
    if (!map.has(id)) map.set(id, row)
  }
  return map
}
