import { query, ensureOnce } from '@/lib/db'
import { QUALIFIED_STATUSES, WON_STATUSES } from '@/lib/freehold/lead-stages'

/**
 * WHICH AUDIENCE ACTUALLY PRODUCES BUYERS.
 *
 * The system launches from a named audience — "Arabic investors in UAE",
 * "Egyptians in UAE", one of twenty-one — and then forgets which one it was.
 * Campaigns kept a fingerprint of the targeting, which is enough to spot a
 * duplicate and useless for the only question that matters when picking the
 * next one: of the audiences we have run, which brought people who bought?
 *
 * Without that, every audience is chosen by its name. A name is a hypothesis.
 * After a few campaigns it should not have to be.
 *
 * So the launch now remembers the audience it launched from, and the CRM's own
 * outcome travels back up: leads, how many qualified, how many closed. Meta's
 * cost per lead says what a form submission cost; this says what it was worth.
 */

export interface AudienceOutcome {
  /** Saved-audience id or ready-buyer preset id. */
  key: string
  name: string
  campaigns: number
  leads: number
  qualified: number
  won: number
  /**
   * A few of the actual people this audience brought.
   *
   * "34 leads, 6 real" is a number; "it brought Ahmed, who is now viewing"
   * is the thing a broker can judge. Real leads out of their own CRM, best
   * ones first — a targeting choice is easier to make against faces than
   * against a percentage.
   */
  samples: Array<{ name: string; status: string | null; interest: string | null }>
}

/** DDL runs once per tenant schema, not once per process — a module-level
 *  memo would let the second tenant on a warm server query a table that was
 *  only ever created in the first one's schema. */
async function ensureTable(): Promise<void> {
  await ensureOnce('freehold_campaign_audience', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_campaign_audience (
        campaign_id   text PRIMARY KEY,
        audience_key  text NOT NULL,
        audience_name text NOT NULL,
        campaign_name text NOT NULL DEFAULT '',
        created_at    timestamptz NOT NULL DEFAULT now()
      )
    `)
  })
}

/**
 * Remember which audience a campaign was launched from.
 *
 * Best-effort by design: this is bookkeeping that runs after money has already
 * moved, and a failure here must never look like a failed launch.
 */
export async function rememberCampaignAudience(input: {
  campaignId: string
  campaignName: string
  audienceKey: string
  audienceName: string
}): Promise<void> {
  if (!input.campaignId || !input.audienceKey) return
  try {
    await ensureTable()
    await query(
      `INSERT INTO freehold_campaign_audience (campaign_id, audience_key, audience_name, campaign_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (campaign_id) DO UPDATE
         SET audience_key = $2, audience_name = $3, campaign_name = $4`,
      [input.campaignId, input.audienceKey, input.audienceName, input.campaignName ?? ''],
    )
  } catch { /* bookkeeping never fails a launch */ }
}

/** One CRM lead, attributed to the audience its campaign was launched from. */
export interface AttributedLead {
  audienceKey: string
  audienceName: string
  campaignId: string
  status: string | null
  name?: string | null
  interest?: string | null
}

/** How many real people to show per audience. Enough to recognise a pattern,
 *  few enough that the card stays a card. */
export const SAMPLE_LEADS = 3

/**
 * Fold attributed leads into one row per audience.
 *
 * Pure, and the counting rules match the rest of the system exactly — a lead
 * that is "qualified" here is qualified on the campaign page and qualified to
 * the optimiser. Split out from the query so those rules are testable without
 * a database.
 */
export function rollupAudienceLeads(
  leads: AttributedLead[],
  campaignsPerAudience: Map<string, number>,
): AudienceOutcome[] {
  const byKey = new Map<string, AudienceOutcome>()
  for (const lead of leads) {
    const row = byKey.get(lead.audienceKey) ?? {
      key: lead.audienceKey,
      name: lead.audienceName,
      campaigns: campaignsPerAudience.get(lead.audienceKey) ?? 0,
      leads: 0, qualified: 0, won: 0, samples: [],
    }
    row.leads++
    const status = String(lead.status ?? '').toLowerCase()
    if (QUALIFIED_STATUSES.has(status)) row.qualified++
    if (WON_STATUSES.has(status)) row.won++
    // The examples are the ones that went somewhere. A card showing three
    // leads that all went nowhere would misrepresent an audience that also
    // produced buyers — so the best are shown, and the count above already
    // says how many there were in total.
    if (lead.name && QUALIFIED_STATUSES.has(status) && row.samples.length < SAMPLE_LEADS) {
      row.samples.push({ name: lead.name, status: lead.status, interest: lead.interest ?? null })
    }
    byKey.set(lead.audienceKey, row)
  }
  // An audience that has been run but produced nothing yet is still worth
  // showing — "we tried this and it brought nobody" is an answer, and hiding
  // it would make the list read as if only the winners had ever been tried.
  for (const [key, campaigns] of campaignsPerAudience) {
    if (!byKey.has(key)) continue
    byKey.get(key)!.campaigns = campaigns
  }
  // An audience that brought only raw leads still deserves an example — the
  // second pass fills from whatever it has rather than showing nothing.
  for (const lead of leads) {
    const row = byKey.get(lead.audienceKey)
    if (!row || !lead.name || row.samples.length >= SAMPLE_LEADS) continue
    if (row.samples.some((s) => s.name === lead.name)) continue
    row.samples.push({ name: lead.name, status: lead.status, interest: lead.interest ?? null })
  }
  return [...byKey.values()].sort((a, b) =>
    b.won - a.won || b.qualified - a.qualified || b.leads - a.leads)
}

/** Every audience that has ever been launched, with what it brought back. */
export async function audienceOutcomes(): Promise<AudienceOutcome[]> {
  try {
    await ensureTable()
    const campaigns = await query<{ audience_key: string; audience_name: string; n: string }>(
      `SELECT audience_key, min(audience_name) AS audience_name, count(*)::text AS n
         FROM freehold_campaign_audience GROUP BY audience_key`,
    )
    const perAudience = new Map(campaigns.map((c) => [c.audience_key, Number(c.n) || 0]))
    const names = new Map(campaigns.map((c) => [c.audience_key, c.audience_name]))

    // Attribution matches getCampaignQuality exactly: Meta instant-form leads
    // carry the campaign id as utm_id, landing-page leads carry the campaign
    // name as utm_campaign. Matching only one of the two would silently drop
    // an entire channel's leads and make an audience look barren.
    const leads = await query<{ audience_key: string; campaign_id: string; status: string | null; name: string | null; interest: string | null }>(
      `SELECT ca.audience_key, ca.campaign_id, l.status, l.name, l.interest
         FROM freehold_campaign_audience ca
         JOIN freehold_site_leads l
           ON (l.utm_id = ca.campaign_id)
           OR (ca.campaign_name <> '' AND lower(l.utm_campaign) = lower(ca.campaign_name))
        WHERE l.archived IS NOT TRUE`,
    )

    const rows = rollupAudienceLeads(
      leads.map((l) => ({
        audienceKey: l.audience_key,
        audienceName: names.get(l.audience_key) ?? l.audience_key,
        campaignId: l.campaign_id,
        status: l.status,
        name: l.name,
        interest: l.interest,
      })),
      perAudience,
    )

    // Audiences launched but with no lead yet — reported at zero rather than
    // omitted, so "tried, brought nothing" is visible.
    for (const [key, n] of perAudience) {
      if (rows.some((r) => r.key === key)) continue
      rows.push({ key, name: names.get(key) ?? key, campaigns: n, leads: 0, qualified: 0, won: 0, samples: [] })
    }
    return rows
  } catch {
    return []
  }
}
