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
}

/** CRM statuses that count as "qualified or deeper" — shared with the Ads
 * Machine's verdict logic so both judge lead depth identically. */
export const QUALIFIED_STATUSES = new Set(['qualified', 'viewing', 'negotiation', 'converted', 'closed'])
const WON = new Set(['converted', 'closed'])
/** An unusable phone (missing or too short to dial) — the "junk" half of the
 * lost+badPhone signal. Exported for the Ads Machine's suggested verdicts. */
export const badPhone = (p: string | null) => !p || p.replace(/\D/g, '').length < 7

export async function getCampaignQuality(campaignId: string, campaignName: string): Promise<CampaignQuality> {
  type Row = { id: string; status: string | null; blocked: boolean | null; phone: string | null; behaviour_score: number | null }
  let rows: Row[] = []
  try {
    rows = await query<Row>(
      `SELECT id, status, blocked, phone, behaviour_score
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
      [campaignId || '', campaignName || ''],
    )
  } catch {
    // Never let a schema/DB hiccup break the campaign surface. (Also the
    // fallback when behaviour_score doesn't exist yet — that column is added
    // by the landing intake route on first scored lead.)
    try {
      rows = await query<Row>(
        `SELECT id, status, blocked, phone, NULL::int AS behaviour_score
           FROM freehold_site_leads
          WHERE archived IS NOT TRUE
            AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
        [campaignId || '', campaignName || ''],
      )
    } catch { rows = [] }
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

  // Weighted toward the real objective event (won), then qualification, then
  // basic reachability; junk drags it down. Clamped 0–100.
  const score = attributed === 0 ? null : Math.max(0, Math.min(100, Math.round(
    rate(reached) * 20 + rate(qualified) * 35 + rate(won) * 45 - rate(junk) * 20 + behaviourAdj,
  )))

  const pct = (n: number) => (attributed > 0 ? Math.round((n / attributed) * 100) : 0)
  const funnel: CampaignQuality['funnel'] = [
    { key: 'reached', count: reached, pct: pct(reached) },
    { key: 'qualified', count: qualified, pct: pct(qualified) },
    { key: 'won', count: won, pct: pct(won) },
    { key: 'junk', count: junk, pct: pct(junk) },
  ]

  return { campaignId, attributed, reached, qualified, won, junk, duplicates, score, funnel, avgBehaviour, behaviourCount }
}
