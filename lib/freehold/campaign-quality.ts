import { query } from '@/lib/db'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'
import { QUALIFIED_STATUSES, VIEWING_STATUSES, WON_STATUSES } from '@/lib/freehold/lead-stages'
import { bucketLeadsByCampaign, type CampaignRef, type LeadCounts } from '@/lib/freehold/lead-attribution'

/**
 * Live lead-QUALITY score for a Meta campaign — computed from OUR CRM funnel
 * outcomes, not from Meta. Meta only knows a lead was submitted; we know whether
 * that lead was reachable, qualified, and closed in the real world. That gap is
 * the whole point: a campaign can look great in Ads Manager (cheap leads) while
 * delivering junk, and only the downstream funnel reveals it.
 *
 * Attribution: when a campaign is launched its landing links carry
 * utm_id=<id> / utm_campaign=<name>, and Meta instant-form leads carry the
 * Graph lead's campaign_id stored as utm_id at sync time. We match either
 * (case-insensitive). No attribution → score is null (honest "not enough
 * signal yet", never a fabricated number).
 *
 * THE THIRD MATCH, `utm_campaign = <id>`, IS A RECOVERY. Until it was fixed
 * the launcher wrote `utm_campaign={{campaign.id}}` and no utm_id at all, so
 * every landing-page lead this account bought put its campaign id in the NAME
 * column — invisible to the id match, and compared by the name match against a
 * human campaign name. Those rows are real and were paid for. Matched exactly
 * (not lowered) because an id is not case-bearing, and listed after the two
 * genuine matches so it can never displace one.
 */

export interface CampaignQuality {
  campaignId: string
  attributed: number
  reached: number       // progressed past 'new' (someone actually engaged)
  qualified: number     // qualified or deeper
  /** Reached a viewing or deeper — the rung between "worth calling" and
   *  "sold", and the one a property team plans its week around. */
  viewings: number
  won: number           // converted / closed — the real objective event
  /**
   * Money recorded against those wins, in AED.
   *
   * The funnel counts a win as a RATE, so one closed deal in twenty-five leads
   * scored identically whether it was an AED 800k studio or an AED 12M villa —
   * and `deal_value_aed` was in the CRM the whole time, read by the seed
   * builder and by no advertising decision anywhere. Carried here so the money
   * layer (lib/freehold/money-truth.ts) can be built from one read.
   *
   * A FACT, NOT A RANKING BASIS. money-truth ranks on deal COUNTS, because the
   * spread of Dubai inventory means one villa does not prove a campaign
   * fifteen times better than one that closed a studio.
   */
  revenueAed: number
  junk: number          // blocked, unusable phone on a lost lead, or a duplicate
  /** Attributed leads that repeat an earlier lead's phone — the same person
   *  delivered more than once, i.e. spend paid twice. Included in `junk`. */
  duplicates: number
  /**
   * 0–100, or null when there is nothing to score — no attributed lead, OR no
   * attributed lead that anybody has moved past 'new'.
   *
   * The second case is the one that mattered: the formula is built out of
   * funnel progression, so an unworked funnel produced a small number that
   * read as a verdict on the campaign when it was a verdict on the queue.
   */
  score: number | null
  /** Attributed leads that have moved at all — reached, qualified, won or
   *  judged junk. Zero means the score is withheld and the card says why. */
  worked: number
  funnel: { key: 'reached' | 'qualified' | 'won' | 'junk'; count: number; pct: number }[]
  /** Landing-session behaviour (leading signal): average 0–100 score over the
   *  attributed leads that HAVE one, and how many that is. null/0 when none. */
  avgBehaviour: number | null
  behaviourCount: number
  /** The one-click human judgment: how many attributed leads are value-rated,
   *  their 0–10 average, and the zone counts. null avg = nobody judged yet. */
  valueRated: number
  avgValue: number | null
  valueValuable: number   // rated ≥ 6 — "buy more of this"
  valueAvoid: number      // rated ≤ 2 — "stop buying this"
  /** WHO this campaign actually brings — researched smart-profile facts over
   *  the attributed leads, aggregated to counts (industry/role/city/interests).
   *  Empty when no profiles exist; never guessed. */
  whoTheyAre: Array<{ kind: string; value: string; n: number }>
  /**
   * WHAT THIS LOOKED FOR, AND HOW MANY LEADS CARRY NO CAMPAIGN AT ALL.
   *
   * `attributed: 0` has two completely different causes and the panel said the
   * same sentence for both: the campaign genuinely produced no leads, or the
   * leads arrived and the tag that connects them to this campaign did not. The
   * second is a wiring fault on our side and looks, from the screen, exactly
   * like a campaign that failed — which is how "lead quality never knows
   * anything" becomes the operator's standing impression of the product.
   *
   * So the read reports its own terms. `matchedOn` is the id and name it
   * searched for; `untagged` counts leads in the table carrying NO campaign
   * tag of any kind. A large untagged count next to zero attributed is not an
   * empty campaign, it is a broken link, and it is the one number that tells
   * them apart.
   */
  matchedOn: { utmId: string; campaignName: string }
  untagged: number
}

/** CRM statuses that count as "qualified or deeper" — shared with the Ads
 * Machine's verdict logic so both judge lead depth identically. */
// One definition, shared with the Meta write-back — a lead that is "qualified"
// for the funnel score and "qualified" for the optimiser must never be able to
// drift apart.
export { QUALIFIED_STATUSES } from '@/lib/freehold/lead-stages'
const WON = WON_STATUSES
/** An unusable phone (missing or too short to dial) — the "junk" half of the
 * lost+badPhone signal. Exported for the Ads Machine's suggested verdicts. */
export const badPhone = (p: string | null) => !p || p.replace(/\D/g, '').length < 7

export async function getCampaignQuality(campaignId: string, campaignName: string): Promise<CampaignQuality> {
  type Row = { id: string; status: string | null; blocked: boolean | null; phone: string | null; behaviour_score: number | null; value_rating: number | null; deal_value_aed: string | number | null }
  let rows: Row[] = []
  try {
    rows = await query<Row>(
      `SELECT id, status, blocked, phone, behaviour_score, value_rating, deal_value_aed
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND ( ($1 <> '' AND utm_id = $1)
                OR ($1 <> '' AND utm_campaign = $1)
                OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
      [campaignId || '', campaignName || ''],
    )
  } catch {
    // behaviour_score and value_rating are created lazily by two DIFFERENT
    // features. If only one is missing, the old fallback nulled BOTH — so a
    // tenant whose brokers HAVE rated leads (but never ran landing-behaviour
    // scoring) reported "nobody rated" and the ads_campaign_quality tool then
    // told the user something false. Ensure both columns, then retry with the
    // REAL data; only if that still fails do we degrade to nulls.
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS behaviour_score int`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    // deal_value_aed is created lazily by the deals feature (lead-writeback).
    // Same lesson as the other two: a tenant that HAS closed deals must not be
    // reported as having closed none because one column was missing.
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS deal_value_aed numeric`).catch(() => undefined)
    try {
      rows = await query<Row>(
        `SELECT id, status, blocked, phone, behaviour_score, value_rating, deal_value_aed
           FROM freehold_site_leads
          WHERE archived IS NOT TRUE
            AND ( ($1 <> '' AND utm_id = $1)
                OR ($1 <> '' AND utm_campaign = $1)
                OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
        [campaignId || '', campaignName || ''],
      )
    } catch {
      try {
        rows = await query<Row>(
          `SELECT id, status, blocked, phone, NULL::int AS behaviour_score, NULL::int AS value_rating, NULL::numeric AS deal_value_aed
             FROM freehold_site_leads
            WHERE archived IS NOT TRUE
              AND ( ($1 <> '' AND utm_id = $1)
                OR ($1 <> '' AND utm_campaign = $1)
                OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
          [campaignId || '', campaignName || ''],
        )
      } catch { rows = [] }
    }
  }

  // Layer 10 — a lead caught in a queue-purge burst (see training-integrity.ts)
  // has an untrustworthy terminal status; drop it from the signal this
  // campaign's quality score feeds into, rather than let it count as a real
  // per-lead judgment.
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
  if (untrusted.size > 0) rows = rows.filter((r) => !untrusted.has(r.id))

  const attributed = rows.length
  let reached = 0, qualified = 0, viewings = 0, won = 0, revenueAed = 0
  // Junk is collected as a SET of lead ids, not a counter, because one lead can
  // trip several junk signals at once and must only be counted once.
  const junkIds = new Set<string>()
  for (const r of rows) {
    const s = r.status
    if (s && s !== 'new') reached++
    if (s && QUALIFIED_STATUSES.has(s)) qualified++
    if (s && VIEWING_STATUSES.has(s)) viewings++
    if (s && WON.has(s)) {
      won++
      // Only money against a WON lead counts. A value stamped on a lead that
      // later went cold is a hope, not a receipt.
      const v = Number(r.deal_value_aed ?? 0)
      if (Number.isFinite(v) && v > 0) revenueAed += v
    }
    if (r.blocked || (s === 'lost' && badPhone(r.phone))) junkIds.add(r.id)
  }

  // DUPLICATES. A campaign that delivers the same person twice charged you
  // twice, so it is genuinely worse than its raw lead count suggests — and
  // nothing was counting that. Same rule the CRM's duplicates view uses:
  // leads sharing a normalised phone of 7+ digits, highest-intent kept.
  //
  // One deliberate difference from that view: it hides LOST leads, because a
  // merged duplicate gets marked lost and would otherwise reappear. Scoring
  // must not hide them — the money was spent whether or not someone later
  // tidied the record — so every attributed row counts here.
  const byPhone = new Map<string, string[]>()
  for (const r of rows) {
    const key = (r.phone ?? '').replace(/\D/g, '')
    if (key.length < 7) continue
    byPhone.set(key, [...(byPhone.get(key) ?? []), r.id])
  }
  let duplicates = 0
  for (const ids of byPhone.values()) {
    if (ids.length < 2) continue
    for (const id of ids.slice(1)) { duplicates++; junkIds.add(id) }
  }
  const junk = junkIds.size

  const rate = (n: number) => (attributed > 0 ? n / attributed : 0)

  // Landing-session behaviour — the LEADING signal. CRM outcomes take weeks;
  // how thoroughly the visitors read the page is known within minutes. It gets
  // a bounded ±10-point adjustment (never the driver, outcomes stay dominant),
  // and only with ≥3 scored leads so one session can't swing a campaign.
  const scored = rows.filter((r) => typeof r.behaviour_score === 'number' && r.behaviour_score !== null)
  const behaviourCount = scored.length
  const avgBehaviour = behaviourCount > 0
    ? Math.round(scored.reduce((s, r) => s + (r.behaviour_score as number), 0) / behaviourCount)
    : null
  const behaviourAdj = behaviourCount >= 3 && avgBehaviour !== null
    ? ((avgBehaviour - 50) / 50) * 10
    : 0

  // THE HUMAN JUDGMENT — one-click 0–10 value ratings on the attributed leads.
  // Direct answer to "does this campaign generate good leads": funnel outcomes
  // take weeks, a broker's rating lands the same day. Bounded ±15 adjustment
  // with ≥3 ratings (stronger than behaviour because it IS a judgment, still
  // never the sole driver — outcomes stay dominant).
  const rated = rows.filter((r) => typeof r.value_rating === 'number' && r.value_rating !== null)
  const valueRated = rated.length
  const avgValue = valueRated > 0
    ? Math.round((rated.reduce((s, r) => s + (r.value_rating as number), 0) / valueRated) * 10) / 10
    : null
  const valueValuable = rated.filter((r) => (r.value_rating as number) >= 6).length
  const valueAvoid = rated.filter((r) => (r.value_rating as number) <= 2).length
  const valueAdj = valueRated >= 3 && avgValue !== null
    ? ((avgValue - 5) / 5) * 15
    : 0

  // NOBODY HAS TOUCHED THESE LEADS YET, so there is nothing to score.
  //
  // The formula below is built almost entirely out of FUNNEL PROGRESSION, and
  // when nothing has progressed every one of those terms is zero. What came
  // out was a small number — a 7 — printed in large red type next to "25
  // attributed leads", which reads as "this campaign is terrible".
  //
  // It is not. Twenty-five leads that nobody has moved past 'new' is a CRM
  // backlog, and scoring it blames the campaign for the team's queue. On the
  // same screen the advisor was already saying "only 31 of 576 leads have been
  // rated, indicating a significant backlog" — the page was contradicting
  // itself in two boxes an inch apart.
  //
  // So a funnel with no progression at all returns null, exactly as an empty
  // one does. Withheld, not zero: min-evidence.ts states the rule for every
  // other number in this product facing a threshold, and a score is the most
  // consequential number on this page.
  const worked = reached + qualified + won + junk
  const score = attributed === 0 || worked === 0 ? null : Math.max(0, Math.min(100, Math.round(
    rate(reached) * 20 + rate(qualified) * 35 + rate(won) * 45 - rate(junk) * 20 + behaviourAdj + valueAdj,
  )))

  // WHO THEY ARE — the researched smart-profile facts over this campaign's
  // leads, aggregated to counts. "Campaign X brings finance directors in
  // Business Bay, campaign Y brings students" is the good-leads answer no
  // funnel number can give. Counts only; absent table (no enrichment run yet)
  // degrades to an empty list, never an error.
  let whoTheyAre: CampaignQuality['whoTheyAre'] = []
  if (rows.length > 0) {
    try {
      const factRows = await query<{ fact_key: string; v: string; n: string }>(
        `SELECT fact_key, lower(trim(fact_value)) AS v, COUNT(*)::text AS n
           FROM freehold_lead_profile_facts
          WHERE lead_id = ANY($1)
            AND fact_key IN ('company_industry','job_title','location_city','business_interests','workplace')
          GROUP BY fact_key, lower(trim(fact_value))
          ORDER BY COUNT(*) DESC, fact_key
          LIMIT 12`,
        [rows.map((r) => r.id)],
      )
      whoTheyAre = factRows.map((f) => ({ kind: f.fact_key, value: f.v, n: Number(f.n) || 0 }))
    } catch { /* profile table not created yet — nothing to aggregate */ }
  }

  const pct = (n: number) => (attributed > 0 ? Math.round((n / attributed) * 100) : 0)
  const funnel: CampaignQuality['funnel'] = [
    { key: 'reached', count: reached, pct: pct(reached) },
    { key: 'qualified', count: qualified, pct: pct(qualified) },
    { key: 'won', count: won, pct: pct(won) },
    { key: 'junk', count: junk, pct: pct(junk) },
  ]

  // Only asked when there is nothing to score — it is a diagnosis of an empty
  // panel, and running a second count on every healthy campaign page would be
  // a query for a sentence nobody reads.
  let untagged = 0
  if (attributed === 0) {
    try {
      const [u] = await query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM freehold_site_leads
          WHERE archived IS NOT TRUE
            AND coalesce(utm_id, '') = ''
            AND coalesce(utm_campaign, '') = ''`,
      )
      untagged = Number(u?.n ?? 0) || 0
    } catch { untagged = 0 }
  }

  return {
    campaignId, attributed, reached, qualified, viewings, won, revenueAed, junk, duplicates, score, worked, funnel,
    avgBehaviour, behaviourCount,
    valueRated, avgValue, valueValuable, valueAvoid, whoTheyAre,
    matchedOn: { utmId: campaignId || '', campaignName: campaignName || '' },
    untagged,
  }
}

/**
 * LEAD COUNTS FOR A WHOLE LIST, IN ONE QUERY.
 *
 * getCampaignQuality above is the deep read: one campaign, its funnel, its
 * duplicates, its behaviour scores, who the leads are. Right for a campaign
 * page, wrong for a list — ten campaigns meant ten round trips, so the live
 * screen never asked, and "2 leads, none rated" could not be said on the
 * screen where an operator actually stands.
 *
 * This is the shallow read: how many leads, and how many of them a person has
 * rated. One query for every campaign, bucketed by the rule in
 * lib/freehold/lead-attribution.ts — the id wins over the name, and a lead
 * belongs to exactly one campaign or to none.
 *
 * Returns an empty map rather than throwing: a live screen that loses its
 * rating counts still shows delivery, spend and leads, and the signal that
 * reads them is built to stay silent on an unknown rather than invent a fault.
 */
export async function getLeadCountsForCampaigns(
  campaigns: CampaignRef[],
): Promise<Map<string, LeadCounts>> {
  if (campaigns.length === 0) return new Map()
  const ids = campaigns.map((c) => String(c.id ?? '').trim()).filter(Boolean)
  const names = campaigns.map((c) => String(c.name ?? '').trim().toLowerCase()).filter(Boolean)
  if (ids.length === 0) return new Map()

  type Row = { id: string; utm_id: string | null; utm_campaign: string | null; value_rating: number | null }
  let rows: Row[] = []
  try {
    rows = await query<Row>(
      `SELECT id, utm_id, utm_campaign, value_rating
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND ( utm_id = ANY($1) OR utm_campaign = ANY($1) OR lower(utm_campaign) = ANY($2) )`,
      [ids, names],
    )
  } catch {
    // value_rating is created lazily by the rating feature. Ensure it and
    // retry once with the REAL data before degrading — the same failure that
    // once made a tenant with rated leads report "nobody rated".
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    try {
      rows = await query<Row>(
        `SELECT id, utm_id, utm_campaign, value_rating
           FROM freehold_site_leads
          WHERE archived IS NOT TRUE
            AND ( utm_id = ANY($1) OR utm_campaign = ANY($1) OR lower(utm_campaign) = ANY($2) )`,
        [ids, names],
      )
    } catch { return new Map() }
  }

  // Same integrity filter the deep read applies: a lead caught in a queue-purge
  // burst carries an untrustworthy status and must not count as a judgment.
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())

  return bucketLeadsByCampaign(
    rows
      .filter((r) => !untrusted.has(r.id))
      .map((r) => ({ id: r.id, utmId: r.utm_id, utmCampaign: r.utm_campaign, valueRating: r.value_rating })),
    campaigns,
  )
}
