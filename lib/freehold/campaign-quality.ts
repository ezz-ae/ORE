import { query } from '@/lib/db'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'
import { scoreLeads, badPhone, type ScorableLead } from '@/lib/freehold/campaign-score'
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
  /** Attributed leads that have moved at all — reached, qualified, won,
   *  judged junk, OR value-rated. Zero means the score is withheld and the
   *  card says why. */
  worked: number
  /**
   * WHICH JUDGMENT THE SCORE WAS BUILT FROM.
   *
   * Carried because the alternative is a panel that disagrees with itself: an
   * 82 in large type above a funnel row reading "qualified 0" invites exactly
   * the question this whole change came from — "how can we trust those?". The
   * screen states its basis instead, so the two halves are one statement.
   *
   * 'funnel'  — the CRM funnel moved; the score is built from it.
   * 'ratings' — nobody has moved a card, but brokers have judged the leads.
   * null      — nothing to score, and the card says why.
   */
  scoreBasis: 'funnel' | 'ratings' | null
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
  /**
   * LEADS A HUMAN HAS SAID ARE WORTH PURSUING — by either route.
   *
   * A lead can be judged two ways in this product and only one of them was
   * ever counted. `qualified` reads the STATUS column: somebody dragged the
   * card through the funnel. The 0–10 value rating reads a broker's direct
   * verdict on the lead, one click, and this file's own comment calls it "the
   * strongest signal in the product".
   *
   * A team that rates diligently and lets the status column lag therefore
   * produced: 176 leads, 0 qualified, 0 worth calling, score withheld —
   * "nothing to score" printed above 75 leads a broker had rated 8 or better.
   * The money panel priced the best campaign in the account at "over AED 8k
   * per lead worth calling" and the advisor proposed pausing it.
   *
   * The product had already settled this question elsewhere and in the other
   * direction: `writeBackDecision` in lead-stages.ts sends `qualified` to Meta
   * on `rating >= VALUABLE_RATING`, reason 'rating'. So the optimiser was
   * being told these leads were qualified while the operator was being told
   * none of them were. One rule, two answers.
   *
   * This is the union, deduplicated — a lead that is both status-qualified and
   * rated well is one lead, not two.
   */
  worthCalling: number
  /** Of `worthCalling`, how many got there ONLY by rating. Named so a screen
   *  can say which judgment it is leaning on rather than blending them. */
  worthCallingByRating: number
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
/** Re-exported from campaign-score.ts, where the scoring rules now live, so
 *  the Ads Machine's existing import keeps working from one definition. */
export { badPhone }

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

  // THE ARITHMETIC LIVES IN lib/freehold/campaign-score.ts, pure.
  //
  // It was inline here, wrapped in three layers of SQL and a fallback ladder,
  // so the only way to assert any of it was to scan this file for regexes —
  // which proves a string is present, not that a campaign with 176 leads and
  // 75 good ratings comes out right. That distinction stopped being academic
  // the day this read reported the account's best campaign as "0 leads worth
  // calling" with a Pause button beside it.
  const c = scoreLeads(rows)
  const {
    attributed, reached, qualified, viewings, won, revenueAed, junk, duplicates,
    worked, worthCalling, worthCallingByRating, score, scoreBasis,
    avgBehaviour, behaviourCount, valueRated, avgValue, valueValuable, valueAvoid,
  } = c

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
    valueRated, avgValue, valueValuable, valueAvoid, worthCalling, worthCallingByRating,
    scoreBasis, whoTheyAre,
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
