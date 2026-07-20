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
  junk: number          // blocked, or lost with an unusable phone
  /** 0–100, or null when there is no attributed lead yet. */
  score: number | null
  funnel: { key: 'reached' | 'qualified' | 'won' | 'junk'; count: number; pct: number }[]
}

/** CRM statuses that count as "qualified or deeper" — shared with the Ads
 * Machine's verdict logic so both judge lead depth identically. */
export const QUALIFIED_STATUSES = new Set(['qualified', 'viewing', 'negotiation', 'converted', 'closed'])
const WON = new Set(['converted', 'closed'])
/** An unusable phone (missing or too short to dial) — the "junk" half of the
 * lost+badPhone signal. Exported for the Ads Machine's suggested verdicts. */
export const badPhone = (p: string | null) => !p || p.replace(/\D/g, '').length < 7

export async function getCampaignQuality(campaignId: string, campaignName: string): Promise<CampaignQuality> {
  let rows: { id: string; status: string | null; blocked: boolean | null; phone: string | null }[] = []
  try {
    rows = await query<{ id: string; status: string | null; blocked: boolean | null; phone: string | null }>(
      `SELECT id, status, blocked, phone
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
      [campaignId || '', campaignName || ''],
    )
  } catch {
    // Never let a schema/DB hiccup break the campaign surface.
    rows = []
  }

  // Layer 10 — a lead caught in a queue-purge burst (see training-integrity.ts)
  // has an untrustworthy terminal status; drop it from the signal this
  // campaign's quality score feeds into, rather than let it count as a real
  // per-lead judgment.
  const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
  if (untrusted.size > 0) rows = rows.filter((r) => !untrusted.has(r.id))

  const attributed = rows.length
  let reached = 0, qualified = 0, won = 0, junk = 0
  for (const r of rows) {
    const s = r.status
    if (s && s !== 'new') reached++
    if (s && QUALIFIED_STATUSES.has(s)) qualified++
    if (s && WON.has(s)) won++
    if (r.blocked || (s === 'lost' && badPhone(r.phone))) junk++
  }

  const rate = (n: number) => (attributed > 0 ? n / attributed : 0)
  // Weighted toward the real objective event (won), then qualification, then
  // basic reachability; junk drags it down. Clamped 0–100.
  const score = attributed === 0 ? null : Math.max(0, Math.min(100, Math.round(
    rate(reached) * 20 + rate(qualified) * 35 + rate(won) * 45 - rate(junk) * 20,
  )))

  const pct = (n: number) => (attributed > 0 ? Math.round((n / attributed) * 100) : 0)
  const funnel: CampaignQuality['funnel'] = [
    { key: 'reached', count: reached, pct: pct(reached) },
    { key: 'qualified', count: qualified, pct: pct(qualified) },
    { key: 'won', count: won, pct: pct(won) },
    { key: 'junk', count: junk, pct: pct(junk) },
  ]

  return { campaignId, attributed, reached, qualified, won, junk, score, funnel }
}
