import { query } from '@/lib/db'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'

/**
 * Live lead-QUALITY score for a Meta campaign — computed from OUR CRM funnel
 * outcomes, not from Meta. Meta only knows a lead was submitted; we know whether
 * that lead was reachable, qualified, and closed in the real world. That gap is
 * the whole point: a campaign can look great in Ads Manager (cheap leads) while
 * delivering junk, and only the downstream funnel reveals it.
 *
 * Attribution: when a campaign is launched its landing links carry
 * utm_campaign=<name> / utm_id=<id>, and Meta instant-form leads carry the
 * Graph lead's campaign_id stored as utm_id at sync time. We match either
 * (case-insensitive). No attribution → score is null (honest "not enough
 * signal yet", never a fabricated number).
 */

export interface CampaignQuality {
  campaignId: string
  attributed: number
  reached: number       // progressed past 'new' (someone actually engaged)
  qualified: number     // qualified or deeper
  won: number           // converted / closed — the real objective event
  junk: number          // blocked, unusable phone on a lost lead, or a duplicate
  /** Attributed leads that repeat an earlier lead's phone — the same person
   *  delivered more than once, i.e. spend paid twice. Included in `junk`. */
  duplicates: number
  /** 0–100, or null when there is no attributed lead yet. */
  score: number | null
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
}

/** CRM statuses that count as "qualified or deeper" — shared with the Ads
 * Machine's verdict logic so both judge lead depth identically. */
export const QUALIFIED_STATUSES = new Set(['qualified', 'viewing', 'negotiation', 'converted', 'closed'])
const WON = new Set(['converted', 'closed'])
/** An unusable phone (missing or too short to dial) — the "junk" half of the
 * lost+badPhone signal. Exported for the Ads Machine's suggested verdicts. */
export const badPhone = (p: string | null) => !p || p.replace(/\D/g, '').length < 7

export async function getCampaignQuality(campaignId: string, campaignName: string): Promise<CampaignQuality> {
  type Row = { id: string; status: string | null; blocked: boolean | null; phone: string | null; behaviour_score: number | null; value_rating: number | null }
  let rows: Row[] = []
  try {
    rows = await query<Row>(
      `SELECT id, status, blocked, phone, behaviour_score, value_rating
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
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
    try {
      rows = await query<Row>(
        `SELECT id, status, blocked, phone, behaviour_score, value_rating
           FROM freehold_site_leads
          WHERE archived IS NOT TRUE
            AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
        [campaignId || '', campaignName || ''],
      )
    } catch {
      try {
        rows = await query<Row>(
          `SELECT id, status, blocked, phone, NULL::int AS behaviour_score, NULL::int AS value_rating
             FROM freehold_site_leads
            WHERE archived IS NOT TRUE
              AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
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
  let reached = 0, qualified = 0, won = 0
  // Junk is collected as a SET of lead ids, not a counter, because one lead can
  // trip several junk signals at once and must only be counted once.
  const junkIds = new Set<string>()
  for (const r of rows) {
    const s = r.status
    if (s && s !== 'new') reached++
    if (s && QUALIFIED_STATUSES.has(s)) qualified++
    if (s && WON.has(s)) won++
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

  // Weighted toward the real objective event (won), then qualification, then
  // basic reachability; junk drags it down. Clamped 0–100.
  const score = attributed === 0 ? null : Math.max(0, Math.min(100, Math.round(
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

  return {
    campaignId, attributed, reached, qualified, won, junk, duplicates, score, funnel,
    avgBehaviour, behaviourCount,
    valueRated, avgValue, valueValuable, valueAvoid, whoTheyAre,
  }
}
