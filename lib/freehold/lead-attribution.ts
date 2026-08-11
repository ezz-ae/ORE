/**
 * WHICH CAMPAIGN A LEAD BELONGS TO — for a whole list at once.
 *
 * The per-campaign quality read (getCampaignQuality) asks the database one
 * campaign at a time, which is right for a campaign page and wrong for a list:
 * ten campaigns meant ten queries, so the live screen simply did not ask, and
 * "2 leads, none rated" — the cheapest lever in this product — could not be
 * said on the screen where an operator actually stands.
 *
 * The read becomes one query. The BUCKETING is here, pure, because the rule it
 * encodes is the part a SQL GROUP BY gets wrong:
 *
 *   THE ID WINS OVER THE NAME.
 *
 * A lead is attributed by `utm_id` (Meta's campaign id, exact, written by the
 * platform) or by `utm_campaign` (the campaign's name, typed by a person and
 * reused across relaunches). When both are present and they point at DIFFERENT
 * campaigns, the id is the truth and the name is a coincidence — most often
 * the second campaign somebody named the same thing. Counting the lead under
 * both would double it, and this product's whole claim is that a number traces
 * back to one thing.
 *
 * A LEAD BELONGS TO EXACTLY ONE CAMPAIGN, or to none. Never two.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

export interface AttributableLead {
  id: string
  /** Meta's campaign id, when the lead carries one. */
  utmId?: string | null
  /** The campaign NAME, as typed into the launcher. */
  utmCampaign?: string | null
  /** The broker's 0–10 judgment. Null means nobody has rated it. */
  valueRating?: number | null
}

export interface CampaignRef { id: string; name: string }

export interface LeadCounts {
  /** Leads this campaign brought. */
  attributed: number
  /** Of those, how many a person has actually rated. */
  rated: number
}

const norm = (v: unknown): string => String(v ?? '').trim().toLowerCase()

/**
 * Split a set of leads across a set of campaigns.
 *
 * Returns a count for EVERY campaign asked about, including zeros — a campaign
 * missing from the map would be indistinguishable from one nobody counted, and
 * the live screen treats "none" and "not asked" differently on purpose.
 */
export function bucketLeadsByCampaign(
  leads: AttributableLead[],
  campaigns: CampaignRef[],
): Map<string, LeadCounts> {
  const byId = new Map<string, string>()      // utm_id  → campaign id
  const byName = new Map<string, string>()    // name    → campaign id
  const out = new Map<string, LeadCounts>()

  for (const c of campaigns) {
    const id = String(c?.id ?? '').trim()
    if (!id) continue
    out.set(id, { attributed: 0, rated: 0 })
    byId.set(norm(id), id)
    const name = norm(c?.name)
    // First campaign to claim a name keeps it. Two campaigns sharing a name is
    // a real thing people do; the tie goes to the earlier one rather than to
    // whichever happened to sort last, so the answer is at least stable.
    if (name && !byName.has(name)) byName.set(name, id)
  }

  for (const lead of Array.isArray(leads) ? leads : []) {
    // THE ID WINS. See the header — a name match is only consulted when the
    // lead carries no id we recognise.
    const owner = byId.get(norm(lead?.utmId)) ?? byName.get(norm(lead?.utmCampaign)) ?? null
    if (!owner) continue
    const bucket = out.get(owner)
    if (!bucket) continue
    bucket.attributed += 1
    // A rating of ZERO is a rating — "this lead was worthless" is the most
    // useful thing a broker can say. Only null/undefined means unrated.
    if (lead.valueRating !== null && lead.valueRating !== undefined) bucket.rated += 1
  }

  return out
}
