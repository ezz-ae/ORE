/**
 * THE DATABASE ROW → THE ROW A BROKER READS.
 *
 * This mapper lived inside app/api/freehold/crm/leads/route.ts, where nothing
 * could test it, and it cost us the two things a CRM list is for.
 *
 * `CRMLeadIntelligence.createdAt` was declared, documented, and read by three
 * filters — today, yesterday, last 7 days — and NO PRODUCER EVER SET IT. The
 * field is optional, so the compiler had nothing to say, and `Date.parse(
 * undefined)` is NaN, so each filter answered "no lead matched" rather than
 * failing. "the crm has nothing called today": it did, and the answer was
 * always empty.
 *
 * It is out here so the guard can run the real mapper into the real filters
 * and assert that a lead that arrived today is a lead Today can see. A field
 * the consumer reads and the producer never writes is not a bug a type check
 * can find; it is one only an end-to-end assertion can.
 *
 * Pure — no db, no network, no clock of its own. Runs in `pnpm guards`.
 */
import { leadSubject, leadBudgetLabel } from '@/lib/freehold/lead-display'
import { forecastLead } from '@/lib/freehold/lead-forecast'

/** Normalised phone digits — the duplicate/undialable rule's input. */
export const normPhone = (p: string | null) => (p ?? '').replace(/\D/g, '')

export interface DbLead {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  source: string | null
  project_slug: string | null
  assigned_broker_id: string | null
  status: string | null
  priority: string | null
  created_at: string
  last_contact_at: string | null
  country: string | null
  budget_aed: number | null
  interest: string | null
  message: string | null
  landing_slug: string | null
  updated_at: string | null
  snooze_until: string | null
  lead_code: string | null
  duplicate_dismissed_at: string | null
  utm_id: string | null
  utm_campaign: string | null
  value_rating: number | null
  behaviour_score?: number | null
  meta_ad_id?: string | null
  meta_form_name?: string | null
  meta_ad_name?: string | null
  archived: boolean | null
  blocked: boolean | null
}

export function dbLeadToCRM(
  row: DbLead,
  dupPhones?: Set<string>,
  /** campaign id → campaign name, and campaign id → project name. Resolved
   *  once per request rather than per row — 571 leads share a handful of
   *  campaigns between them. */
  campaignNames: Map<string, string> = new Map(),
  campaignProjects: Map<string, string> = new Map(),
  /** lower(slug) → verified project name — see resolveProjectSlugNames. */
  projectSlugNames: Map<string, string> = new Map(),
  /** ad id → what that ad's leads have actually been rated. Appended LAST so
   *  the existing positional callers are untouched. See sourceHistoryByAd —
   *  this is what makes the forecast a loop rather than a score. */
  adHistory: Map<string, { rated: number; meanRating: number }> = new Map(),
) {
  const stage = (row.status as string | null) ?? 'new'
  const stageMap: Record<string, string> = {
    new: 'new', contacted: 'contacted', qualified: 'qualified',
    viewing: 'viewing', negotiation: 'negotiation', closed: 'closed', lost: 'lost',
  }
  const temperature = row.priority === 'hot' ? 'hot'
    : row.priority === 'cold' ? 'cold'
    : row.priority === 'priority' ? 'priority'
    : 'warm'
  return {
    // WHEN THEY ARRIVED. The type has declared this since it was written and
    // no producer ever set it, so every time filter in the CRM matched
    // nothing and the list had no arrival order to fall back on. It is the
    // first field on purpose: it is the first thing a work queue is sorted by.
    createdAt: row.created_at,
    id: row.id,
    hubspotLeadId: '',
    name: row.name ?? 'Unknown',
    phone: row.phone ?? '',
    email: row.email ?? '',
    source: row.source ?? 'direct',
    landingId: row.landing_slug ?? '',
    // utm_id carries the ad platform's campaign id (meta-lead-sync writes it on
    // every instant-form lead) — the join key Attribution and quality reads use.
    campaignId: row.utm_id ?? row.utm_campaign ?? '',
    // THE CAMPAIGN'S NAME, not an ad set's and not an id. A broker reading a
    // row wants to know which campaign brought this person, and the id is a
    // number nobody recognises.
    campaignName: campaignNames.get(String(row.utm_id ?? '')) ?? String(row.utm_campaign ?? ''),
    // WHICH AD THEY ACTUALLY SAW. meta-lead-sync has stored this on every
    // instant-form lead since it existed (freehold_site_leads.meta_ad_id) and
    // nothing has ever surfaced it — so "what did this person see before they
    // gave us their number" was unanswerable from the CRM.
    adId: row.meta_ad_id ?? '',
    // AND WHAT IT WAS CALLED. Two ads in one campaign, one lead form each, is
    // the correct way to run two offers without bidding against yourself — and
    // it is exactly the case the campaign name cannot describe. meta-lead-sync
    // freezes both names onto the row when the lead arrives, so this costs
    // nothing here and survives the form being deleted.
    formName: row.meta_form_name ?? '',
    adName: row.meta_ad_name ?? '',
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    pipelineStage: stageMap[stage] ?? 'new',
    temperature,
    // THE MOST SPECIFIC TRUE THING, never a category. Every one of these
    // leads arrived on a named campaign for a named project, and the row used
    // to print "General enquiry" 571 times because nothing resolved the id it
    // was already carrying. See lib/freehold/lead-display.ts.
    budgetAED: leadBudgetLabel(row.budget_aed) ?? '',
    projectInterest: leadSubject({
      interest: row.interest,
      // Never the raw column — only a slug that actually names a project in
      // freehold_site_projects earns the bold "project" line. An unverified
      // string (an ad set's name, a stray import value) falls through to the
      // campaign name below instead of being shown as a fact it isn't.
      projectName: campaignProjects.get(String(row.utm_id ?? ''))
        ?? projectSlugNames.get((row.project_slug ?? '').trim().toLowerCase()),
      campaignName: campaignNames.get(String(row.utm_id ?? '')) ?? row.utm_campaign,
    })?.label ?? '',
    // ── A REAL FORECAST, NOT A LOOKUP ─────────────────────────────────────
    //
    // This was `temperature === 'priority' ? 90 : … : 30` — a four-way lookup
    // off a field derived from the same row, so it carried no information
    // about the lead and every screen showed it anyway. "the intent level is
    // decoration and means nothing, now its 50 for everyone."
    //
    // It is now forecastLead: what THIS ad's leads have actually been rated,
    // adjusted by how thoroughly this person read the page, whether the number
    // can be dialled, and what they bothered to answer. Rendered 0–100 to keep
    // every existing screen working, and NULL when nothing is known — which is
    // the half the old number could never express.
    intentScore: (() => {
      const fc = forecastLead({
        behaviourScore: row.behaviour_score ?? null,
        phone: row.phone,
        email: row.email,
        sourceHistory: adHistory.get(String(row.meta_ad_id ?? '')) ?? null,
      })
      return fc.expected === null ? 0 : Math.round(fc.expected * 10)
    })(),
    urgency: temperature === 'priority' ? 'critical' : temperature === 'hot' ? 'high' : 'medium',
    // REAL now, not hardcoded false. The follow-up queue renders risk badges
    // and a risk counter from these two flags; with the server pinning them
    // false, that entire UI was dead weight that could never fire.
    //   duplicate  = another non-archived lead shares this normalised phone
    //                (the same rule the Duplicates page clusters by), unless
    //                the cluster was dismissed as "not a duplicate".
    //   wrong no.  = phone missing or too short to dial (<7 digits).
    duplicateRisk: !row.duplicate_dismissed_at && !!dupPhones?.has(normPhone(row.phone)),
    wrongNumberRisk: normPhone(row.phone).length < 7,
    assignedAgent: row.assigned_broker_id ?? '',
    lastContactAt: row.last_contact_at ?? row.created_at,
    nextBestAction: stage === 'new' ? 'Reach out and qualify' : 'Follow up',
    suggestedMessage: '',
    aiSummary: row.message ?? '',
    hasViewingScheduled: stage === 'viewing',
    viewingDate: null,
    viewingProperty: null,
    notes: [],
    taggedProjects: row.project_slug ? [row.project_slug] : [],
    snoozeUntil: row.snooze_until ?? null,
    leadCode: row.lead_code ?? null,
    duplicateDismissedAt: row.duplicate_dismissed_at ?? null,
    /** Human 0–10 value judgment; null = not yet rated. */
    valueRating: row.value_rating ?? null,
    // Both columns have existed and neither has ever left the server, so no
    // screen could act on them: a lead someone archived still appeared in the
    // working queue as though nothing had happened. The list itself still
    // returns those rows on purpose — team analytics count against them, and
    // dropping them here would quietly change every denominator — but a
    // consumer can now tell the difference.
    archived: row.archived === true,
    blocked: row.blocked === true,
  }
}
