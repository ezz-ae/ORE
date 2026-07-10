import { query } from '@/lib/db'

/**
 * Live lead-QUALITY score for a Meta campaign — computed from OUR CRM funnel
 * outcomes, not from Meta. Meta only knows a lead was submitted; we know whether
 * that lead was reachable, qualified, and closed in the real world. That gap is
 * the whole point: a campaign can look great in Ads Manager (cheap leads) while
 * delivering junk, and only the downstream funnel reveals it.
 *
 * Attribution: when a campaign is launched its landing links carry
 * utm_campaign=<name> / utm_id=<id>, and Meta lead-form leads carry the campaign
 * name. We match either (case-insensitive). No attribution → score is null
 * (honest "not enough signal yet", never a fabricated number).
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

const QUALIFIED = new Set(['qualified', 'viewing', 'negotiation', 'converted', 'closed'])
const WON = new Set(['converted', 'closed'])
const badPhone = (p: string | null) => !p || p.replace(/\D/g, '').length < 7

export async function getCampaignQuality(campaignId: string, campaignName: string): Promise<CampaignQuality> {
  let rows: { status: string | null; blocked: boolean | null; phone: string | null }[] = []
  try {
    rows = await query<{ status: string | null; blocked: boolean | null; phone: string | null }>(
      `SELECT status, blocked, phone
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND ( ($1 <> '' AND utm_id = $1) OR ($2 <> '' AND lower(utm_campaign) = lower($2)) )`,
      [campaignId || '', campaignName || ''],
    )
  } catch {
    // Never let a schema/DB hiccup break the campaign surface.
    rows = []
  }

  const attributed = rows.length
  let reached = 0, qualified = 0, won = 0, junk = 0
  for (const r of rows) {
    const s = r.status
    if (s && s !== 'new') reached++
    if (s && QUALIFIED.has(s)) qualified++
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
