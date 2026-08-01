import { query } from '@/lib/db'

/**
 * Behaviour scoring from a landing-page session — turns how a visitor
 * actually read the page (scroll depth, dwell, CTA/gallery interaction,
 * which sections they opened, whether they started the form) into four
 * fields that travel with the lead it produces.
 *
 * Two honesty rules:
 * 1. No linked session, no numbers — nulls, not defaults.
 * 2. purchaseProbability is a documented, fixed-weight HEURISTIC, not a
 *    model trained on outcomes — there isn't yet enough closed-deal volume
 *    to calibrate one. Never describe this field as trained on outcomes
 *    (that claim is gated by scripts/guards.ts until real cycles exist).
 */

export interface LeadIntelligence {
  /** 0–100 — how thoroughly the page was read. */
  behaviourScore: number | null
  buyerIntent: 'investor' | 'end_user' | 'investor_end_user' | null
  /** 0–100 heuristic, floored at 5 and capped at 90 — never certainty. */
  purchaseProbability: number | null
  budgetConfidence: 'engaged' | 'not_engaged' | null
}

type EventRow = { event_name: string; event_value: string | null }

const NULLED: LeadIntelligence = {
  behaviourScore: null,
  buyerIntent: null,
  purchaseProbability: null,
  budgetConfidence: null,
}

export async function scoreLeadSession(sessionId: string | null | undefined): Promise<LeadIntelligence> {
  const sid = (sessionId || '').trim()
  if (!sid) return NULLED

  let rows: EventRow[] = []
  try {
    rows = await query<EventRow>(
      `SELECT event_name, event_value
         FROM freehold_site_lp_analytics
        WHERE session_id = $1
        ORDER BY created_at ASC
        LIMIT 200`,
      [sid],
    )
  } catch {
    // Scoring must never block a lead from being captured.
    return NULLED
  }
  if (rows.length === 0) return NULLED

  const has = (name: string, value?: string) =>
    rows.some((r) => r.event_name === name && (value === undefined || r.event_value === value))
  const maxNumeric = (name: string) =>
    rows.reduce((m, r) => (r.event_name === name ? Math.max(m, Number(r.event_value) || 0) : m), 0)
  const sections = new Set(
    rows.filter((r) => r.event_name === 'section_view' && r.event_value).map((r) => r.event_value as string),
  )

  // Fixed, documented weights (maxima sum to 100):
  //   reading depth        up to 30  (scroll 25/50/75/100)
  //   time invested        up to 25  (dwell 15s/45s/120s)
  //   material engagement  up to 25  (gallery, brochure, any section opened)
  //   action signals       up to 20  (direct-contact CTA, form started)
  let score = 0
  score += (maxNumeric('scroll_depth') / 100) * 30
  if (has('dwell', '15')) score += 8
  if (has('dwell', '45')) score += 8
  if (has('dwell', '120')) score += 9
  if (has('gallery_view')) score += 8
  if (has('cta_click', 'brochure')) score += 9
  if (sections.size > 0) score += 8
  if (has('cta_click', 'whatsapp') || has('cta_click', 'call')) score += 10
  if (has('form_start')) score += 10
  const behaviourScore = Math.max(0, Math.min(100, Math.round(score)))

  const financial =
    sections.has('payment-plan') || sections.has('roi') || sections.has('price') || has('cta_click', 'brochure')
  const lifestyle = sections.has('gallery') || sections.has('amenities') || sections.has('location') || has('gallery_view')
  const buyerIntent = financial && lifestyle ? 'investor_end_user' : financial ? 'investor' : lifestyle ? 'end_user' : null

  // Monotone in the behaviour score, lifted by direct-contact signals,
  // floored and capped so it never reads as certainty in either direction.
  let p = behaviourScore * 0.6
  if (has('cta_click', 'whatsapp') || has('cta_click', 'call')) p += 15
  if (has('form_start')) p += 10
  if (financial) p += 10
  const purchaseProbability = Math.max(5, Math.min(90, Math.round(p)))

  const budgetConfidence: LeadIntelligence['budgetConfidence'] = financial ? 'engaged' : 'not_engaged'

  return { behaviourScore, buyerIntent, purchaseProbability, budgetConfidence }
}
