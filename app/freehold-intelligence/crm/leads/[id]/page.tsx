import Link from 'next/link'
import { formatInstant, formatInstantZoned } from '@/lib/freehold/clock'
import { leadOriginLabel } from '@/lib/freehold/lead-origin'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Brain,
  AlertTriangle, Clock, User, Target, Zap,
  PhoneCall, FileText, ArrowLeftRight, Bell, MessageSquare,
  BarChart3, Globe, ArrowUpRight, Activity,
} from 'lucide-react'
import { cookies } from 'next/headers'
import type { CRMLeadIntelligence, CRMActivityEvent } from '@/src/features/freehold-intelligence/server-session'
import { query } from '@/lib/db'
import { ensureLeadsTable, getLeadActivity } from '@/lib/data'
import { getLandingAttribution, type LandingAttribution } from '@/lib/landing-pages'
import { getDealByLeadId } from '@/lib/deals'
import { listLeadViewings } from '@/lib/calendar'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { getServerT } from '@/lib/i18n/server'
import { LeadExpertStrip } from '@/components/freehold/lead-expert-strip'
import { MachineVerdictLeadChip } from '@/components/freehold/machine-verdict-notifier'

// Tries to fetch live lead from DB; maps it to the CRM shape used by the rest of this page.
// Brokers may only read their own leads — pass their ownership keys (id + email)
// to scope the query. A broker's lead can be stored under either, so we match both.
async function getLiveLead(id: string, ownerKeys: string[] | null): Promise<CRMLeadIntelligence | null> {
  try {
    await ensureLeadsTable()
    // click_intent is written by /api/leads on submit; ensure it exists before
    // selecting so a fresh deploy (no LP submits yet) doesn't 404 every lead.
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS click_intent text`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamptz`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)
    // meta-lead-sync writes these; a workspace read before its first sync must
    // still open a lead rather than 404 on a missing column.
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_form_name text`).catch(() => undefined)
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_ad_name text`).catch(() => undefined)
    const queryParams: unknown[] = [id]
    let ownerFilter = ''
    if (ownerKeys && ownerKeys.length) { queryParams.push(ownerKeys); ownerFilter = ' AND assigned_broker_id = ANY($2)' }
    const rows = await query<{
      id: string; name: string | null; phone: string | null; email: string | null;
      source: string | null; project_slug: string | null; assigned_broker_id: string | null;
      status: string | null; priority: string | null; budget_aed: number | null;
      interest: string | null; message: string | null; created_at: string;
      landing_slug: string | null; lead_code: string | null;
      utm_source: string | null; utm_campaign: string | null; utm_id: string | null;
      last_contact_at: string | null; snooze_until: string | null;
      behaviour_score: number | null; buyer_intent: string | null;
      purchase_probability: number | null; budget_confidence: string | null;
      click_intent: string | null;
      duplicate_dismissed_at: string | null;
      value_rating: number | null;
      meta_form_name: string | null;
      meta_ad_name: string | null;
      buyer_eligibility: string | null;
      meta_answers: unknown;
    }>(
      `SELECT id, name, phone, email, source, project_slug, assigned_broker_id,
              status, priority, budget_aed, interest, message, created_at::text, landing_slug, lead_code,
              utm_source, utm_campaign, utm_id, last_contact_at::text, snooze_until::text,
              behaviour_score, buyer_intent, purchase_probability, budget_confidence, click_intent,
              duplicate_dismissed_at::text, value_rating, meta_form_name, meta_ad_name, buyer_eligibility, meta_answers
       FROM freehold_site_leads WHERE id = $1${ownerFilter} LIMIT 1`,
      queryParams
    )
    if (!rows.length) return null
    const r = rows[0]
    // Real risk flags (were hardcoded false — the detail banner could never
    // show). Same rules as the list API and the Duplicates page.
    const digits = (r.phone ?? '').replace(/\D/g, '')
    let dupCount = 0
    if (digits.length >= 7 && !r.duplicate_dismissed_at) {
      const [c] = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM freehold_site_leads
          WHERE archived IS NOT TRUE AND id <> $1
            AND regexp_replace(phone, '\\D', '', 'g') = $2`,
        [r.id, digits],
      ).catch(() => [{ n: '0' }])
      dupCount = Number(c?.n) || 0
    }
    const stage = (r.status ?? 'new') as CRMLeadIntelligence['pipelineStage']
    const temperature = (r.priority === 'hot' ? 'hot' : r.priority === 'priority' ? 'priority' : r.priority === 'cold' ? 'cold' : 'warm') as CRMLeadIntelligence['temperature']
    return {
      id: r.id, hubspotLeadId: '', name: r.name ?? 'Unknown',
      phone: r.phone ?? '', email: r.email ?? '', source: r.source ?? 'direct',
      landingId: r.landing_slug ?? (r.source?.startsWith('lp:') ? r.source.slice(3) : ''),
      campaignId: r.utm_campaign || r.utm_id || '', stage: stage.charAt(0).toUpperCase() + stage.slice(1),
      pipelineStage: stage, temperature,
      budgetAED: r.budget_aed ? `AED ${r.budget_aed.toLocaleString()}` : 'Unknown',
      projectInterest: r.interest ?? r.project_slug ?? 'General enquiry',
      intentScore: temperature === 'priority' ? 90 : temperature === 'hot' ? 75 : 55,
      urgency: temperature === 'priority' ? 'critical' : temperature === 'hot' ? 'high' : 'medium',
      duplicateRisk: dupCount > 0, wrongNumberRisk: digits.length < 7, assignedAgent: r.assigned_broker_id ?? '',
      lastContactAt: r.last_contact_at ?? r.created_at, nextBestAction: '', suggestedMessage: '',
      aiSummary: r.message ?? '', hasViewingScheduled: false, viewingDate: null,
      viewingProperty: null, notes: [], taggedProjects: r.project_slug ? [r.project_slug] : [],
      createdAt: r.created_at,
      leadCode: r.lead_code ?? null, snoozeUntil: r.snooze_until ?? null,
      valueRating: r.value_rating ?? null,
      behaviourScore: r.behaviour_score, buyerIntent: r.buyer_intent,
      purchaseProbability: r.purchase_probability, budgetConfidence: r.budget_confidence,
      clickIntent: r.click_intent,
      // THE FORM AND THE AD, BY NAME. `source` is `meta_form:120251…` — a
      // number nobody can read, and the wrong answer anyway when two ads in one
      // campaign carry a form each on purpose.
      formName: r.meta_form_name ?? '',
      adName: r.meta_ad_name ?? '',
      // The buyer's own answer to the ownership-eligibility question, when the
      // form asked it. The broker reads it BEFORE the first call — asking a
      // person to repeat an answer they already gave is how forms teach people
      // not to answer forms.
      buyerEligibility: r.buyer_eligibility ?? '',
      // Everything else they answered, already resolved to words at sync.
      formAnswers: answersForCard(
        Array.isArray(r.meta_answers) ? (r.meta_answers as FormAnswer[]) : [],
      ),
    } as unknown as CRMLeadIntelligence
  } catch { return null }
}
import { QuickActions } from './_components/LeadClientActions'
import { answersForCard, type FormAnswer } from '@/lib/freehold/form-answers'
import { SmartProfile } from './_components/SmartProfile'
import { listProfileFacts } from '@/lib/freehold/lead-profile'
import { LeadViewingsCard } from './_components/LeadViewingsCard'

function urgencyTone(u: string) {
  if (u === 'critical') return { ring: 'ring-red-400/40',     bg: 'bg-red-400/10',     text: 'text-red-300',     dot: 'bg-red-400',     labelKey: 'crm.urgency.critical' }
  if (u === 'high')     return { ring: 'ring-gold/35',  bg: 'bg-gold/10',  text: 'text-gold-bright',  dot: 'bg-gold',  labelKey: 'crm.urgency.high' }
  if (u === 'medium')   return { ring: 'ring-teal-400/30',    bg: 'bg-teal-400/10',    text: 'text-teal-200',    dot: 'bg-teal-400',    labelKey: 'crm.urgency.medium' }
  return                       { ring: 'ring-line-strong',     bg: 'bg-surface-2',  text: 'text-slate-400',  dot: 'bg-slate-500',  labelKey: 'crm.urgency.low' }
}

function scoreBar(n: number) {
  if (n >= 85) return 'bg-gold'
  if (n >= 65) return 'bg-gold'
  return 'bg-red-400'
}

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { t, locale } = await getServerT()
  // Scope to the broker's own leads; management/marketing see any lead.
  const cookieStore = await cookies()
  const sessionUser = await verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  const ownerKeys = sessionUser?.role === 'broker' ? brokerOwnerKeys(sessionUser) : null
  // Real DB leads only — no seed/mock fallback.
  const lead = await getLiveLead(id, ownerKeys)
  if (!lead) notFound()

  const tone = urgencyTone(lead.urgency)
  // One sentence for the whole page — the header and the details card must
  // never disagree about where this person came from.
  const leadOrigin = leadOriginLabel(
    { source: lead.source, formName: lead.formName, adName: lead.adName },
    t('crm.source.instantForm'),
  )
  const dateLocale = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'

  // Landing-page attribution: which campaign page produced this lead (live data).
  const landingSlug = lead.landingId && lead.landingId !== 'direct_whatsapp' ? lead.landingId : ''
  const landingAttribution: LandingAttribution | null = landingSlug ? await getLandingAttribution(landingSlug) : null

  // A lead can be converted to a deal only once.
  const existingDeal = await getDealByLeadId(lead.id)

  // Viewings are real calendar events linked to this lead (kind 'viewing').
  // Access is gated by lead access above — whoever can open the lead sees them.
  const viewings = await listLeadViewings(lead.id)

  // Next best action — a simple, honest heuristic from real lead state.
  const snoozedUntil = lead.snoozeUntil && new Date(lead.snoozeUntil).getTime() > Date.now()
    ? new Date(lead.snoozeUntil) : null
  const nextBestAction = snoozedUntil
    ? t('crm.nba.snoozedUntil', { date: formatInstant(snoozedUntil, dateLocale) })
    : lead.pipelineStage === 'new'
    ? t('crm.nba.firstContact')
    : lead.pipelineStage === 'qualified'
    ? t('crm.nba.bookViewing')
    : t('crm.nba.followUp')

  // Smart-profile facts the research agent has verified for this lead — an
  // empty array renders the "complete profile" invitation, never fake cells.
  const profileFacts = await listProfileFacts(lead.id).catch(() => [])

  // Activity timeline: real logged events for this lead (no seed log).
  const activityRows = await getLeadActivity(lead.id).catch(() => [])
  const activityTypeMap = (raw: string): CRMActivityEvent['type'] => {
    const v = raw.toLowerCase()
    if (v.includes('call')) return 'call'
    if (v.includes('whatsapp') || v.includes('message')) return 'whatsapp'
    if (v.includes('stage') || v.includes('status')) return 'stage_change'
    if (v.includes('assign')) return 'assignment'
    if (v.includes('follow') || v.includes('viewing')) return 'follow_up'
    if (v.includes('offer')) return 'note'
    if (v.includes('note')) return 'note'
    return 'system'
  }
  const leadActivity: CRMActivityEvent[] = activityRows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    leadName: lead.name,
    type: activityTypeMap(r.activity_type ?? ''),
    actor: r.created_by ?? '—',
    content: r.description ?? r.activity_type ?? '',
    createdAt: r.created_at,
  }))

  // Real campaign attribution from the lead's captured UTM data (no seed). The
  // platform is inferred from the source string; the campaign drill-down links to
  // marketing analytics, which is operator/marketing-gated — so brokers see the
  // campaign name as plain text, management/marketing get the clickable link.
  const realCampaign = lead.campaignId && lead.campaignId !== 'organic' ? lead.campaignId : ''
  const campaignPlatform: 'meta' | 'google' | null =
    /face|meta|insta|fb/i.test(lead.source) ? 'meta' : /google|adwords|gads|ppc/i.test(lead.source) ? 'google' : null
  const canSeeMarketing = !!sessionUser && ['admin', 'ceo', 'director', 'sales_manager', 'marketing'].includes(sessionUser.role)

  function activityIcon(type: string) {
    if (type === 'call')         return { Icon: PhoneCall,      color: 'text-gold',   bg: 'bg-gold/10' }
    if (type === 'whatsapp')     return { Icon: MessageSquare,  color: 'text-gold',   bg: 'bg-gold/10' }
    if (type === 'note')         return { Icon: FileText,       color: 'text-slate-400',   bg: 'bg-teal-400/10' }
    if (type === 'stage_change') return { Icon: ArrowLeftRight, color: 'text-slate-400',   bg: 'bg-violet-400/10' }
    if (type === 'assignment')   return { Icon: User,           color: 'text-slate-400',   bg: 'bg-rose-400/10' }
    if (type === 'follow_up')    return { Icon: Bell,           color: 'text-orange-300',  bg: 'bg-orange-400/10' }
    return { Icon: Zap, color: 'text-slate-400', bg: 'bg-surface-2' }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/crm" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {t('crm.crmIntelligence')}
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.bg} border-current/20 ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {t('crm.urgencyLabel', { label: t(tone.labelKey) })}
          </span>
          <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-sm text-slate-400">
            {lead.stage}
          </span>
          {/* WHERE THEY CAME FROM, BY NAME. This printed `meta_form:120251…`
              — the id of the form, which nobody can read and nobody can act
              on. The names are on the row (see lib/freehold/lead-origin.ts);
              when neither has been resolved yet the answer is what kind of
              thing it was, never which number. */}
          <span className="text-sm text-slate-500">{leadOrigin}</span>
          {lead.leadCode && (
            <span className="rounded-full border border-gold/20 bg-gold/[0.06] px-2.5 py-0.5 font-mono text-xs text-gold/80">
              {lead.leadCode}
            </span>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
          {lead.name}
        </h1>
        {/* WHEN THIS PERSON ACTUALLY ARRIVED, with the zone said out loud.
            It used to be absent from this screen, and everywhere it did appear
            it was rendered in whatever zone the reader's browser was set to —
            so "12:32" meant a different moment to a broker in Dubai than to
            the same page rendered on a UTC server. Naming the zone costs one
            word and settles it against Ads Manager. */}
        <p className="mt-1.5 text-xs text-slate-500">
          {t('crm.registeredAt', {
            when: formatInstantZoned(lead.createdAt, dateLocale),
          })}
        </p>
        <p className="mt-3 text-sm text-slate-400">
          {lead.assignedAgent ? t('crm.assignedTo', { agent: lead.assignedAgent }) : t('crm.unassigned')}
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* Main column */}
        <div className="space-y-5">

          {/* Ask the Expert about this lead */}
          <LeadExpertStrip id={lead.id} name={lead.name} />

          {/* The Ads Machine's open feedback question about THIS lead, if the
              viewer owns it (or is management) — answered inline. */}
          <MachineVerdictLeadChip leadId={lead.id} />

          {/* Contact + intent score */}
          <div className="grid gap-3 sm:grid-cols-3">
            <a href={`tel:${lead.phone}`} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-gold/25">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.phone')}</p>
                <p className="mt-0.5 text-sm font-medium text-white group-hover:text-gold transition-colors">{lead.phone}</p>
              </div>
            </a>
            <a href={`mailto:${lead.email}`} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-teal-400/25">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400/10 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.email')}</p>
                <p className="mt-0.5 text-sm font-medium text-white group-hover:text-slate-400 transition-colors truncate">{lead.email}</p>
              </div>
            </a>
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-[0.14em]">
                <Target className="h-3 w-3" /> {t('crm.intentScore')}
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-[32px] font-semibold leading-none tabular-nums text-white">{lead.intentScore}</span>
                <span className="text-sm text-slate-500 mb-0.5">/100</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${scoreBar(lead.intentScore)}`} style={{ width: `${lead.intentScore}%` }} />
              </div>
            </div>
          </div>

          {/* Smart profile — the research agent's verified findings. Cells are
              dynamic: a fact not found does not exist here, and every fact
              carries its public source. */}
          <SmartProfile leadId={lead.id} initialFacts={profileFacts} />

          {/* Risk warnings */}
          {(lead.duplicateRisk || lead.wrongNumberRisk) && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-5">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-red-300/80">
                <AlertTriangle className="h-3.5 w-3.5" /> {t('crm.riskFlags')}
              </div>
              <ul className="mt-3 space-y-1.5">
                {lead.duplicateRisk && <li className="text-sm text-red-200/80">{t('crm.duplicateRiskMsg')}</li>}
                {lead.wrongNumberRisk && <li className="text-sm text-red-200/80">{t('crm.wrongNumberRiskMsg')}</li>}
              </ul>
            </div>
          )}

          {/* Layer 8/9 — behavioural intelligence, read from the landing session.
              Zero-protection: no session, no block — never a defaulted number.
              Layer 4 — click_intent (declared by the ad clicked) shows even
              without a behaviour score: both honest, both labelled by source. */}
          {(lead.behaviourScore !== null && lead.behaviourScore !== undefined) || lead.clickIntent || lead.buyerEligibility ? (
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                <Activity className="h-3.5 w-3.5 text-gold" /> {t('crm.intelligence')}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {lead.behaviourScore !== null && lead.behaviourScore !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.behaviourScore')}</p>
                    <p className="mt-0.5 text-lg font-semibold text-white">{lead.behaviourScore}<span className="text-xs text-slate-500"> / 100</span></p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-gold/70" style={{ width: `${lead.behaviourScore}%` }} />
                    </div>
                  </div>
                )}
                {lead.buyerIntent && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.buyerIntent')}</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{t(`crm.intent.${lead.buyerIntent}`)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{t('crm.buyerIntentSource')}</p>
                  </div>
                )}
                {lead.clickIntent && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.clickIntent')}</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{t(`crm.clickIntent.${lead.clickIntent}`)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{t('crm.clickIntentSource')}</p>
                  </div>
                )}
                {lead.purchaseProbability !== null && lead.purchaseProbability !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.purchaseProbability')}</p>
                    <p className="mt-0.5 text-lg font-semibold text-white">{lead.purchaseProbability}%</p>
                  </div>
                )}
                {lead.budgetConfidence && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.budgetConfidence')}</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{t(`crm.budget.${lead.budgetConfidence}`)}</p>
                  </div>
                )}
                {/* The buyer's OWN answer, labelled as such. It renders only
                    when the form asked — an absent answer is not a field
                    showing "unknown", it is a question that was never put. */}
                {lead.buyerEligibility && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{t('crm.eligibility')}</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{t(`crm.eligibility.${lead.buyerEligibility}`)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{t('crm.eligibilitySource')}</p>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">{t('crm.intelligenceNote')}</p>
            </div>
          ) : null}

          {/* What they answered on the form — the operator designed each
              question to filter a segment; this is where the broker reads the
              result. Values are stored resolved (words, never opt_2), in the
              form's own language, so they render verbatim. */}
          {(lead.formAnswers?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                <FileText className="h-3.5 w-3.5 text-gold" /> {t('crm.formAnswers')}
              </div>
              <div className="mt-4 space-y-3">
                {lead.formAnswers!.map((a) => (
                  <div key={a.key}>
                    <p className="text-xs text-slate-500">{a.question}</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{a.answer}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">{t('crm.formAnswersNote')}</p>
            </div>
          )}

          {/* AI Summary */}
          <div className="rounded-xl border border-gold/15 bg-gold/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-gold/80">
              <Brain className="h-3.5 w-3.5" /> {t('crm.aiSummaryTitle')}
            </div>
            <p className="mt-3 text-sm leading-[1.7] text-slate-300">{lead.aiSummary}</p>
          </div>

          {/* Next best action */}
          <div className="rounded-xl border border-emerald-400/15 bg-gold/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-gold/80">
              <Zap className="h-3.5 w-3.5" /> {t('crm.nextBestAction')}
            </div>
            <p className="mt-3 text-sm leading-[1.7] text-slate-300">{nextBestAction}</p>
          </div>

        </div>

        {/* Sidebar */}
        <aside className="space-y-4">

          {/* Lead metadata */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('crm.leadDetails')}</p>
            <div className="space-y-3">
              {[
                { label: t('crm.source'),      value: leadOrigin },
                { label: t('crm.stage'),       value: lead.stage },
                { label: t('crm.agent'),       value: lead.assignedAgent },
                { label: t('crm.lastContact'), value: formatInstant(lead.lastContactAt, dateLocale, { dateStyle: 'medium', timeStyle: 'short' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <span className="text-xs text-slate-500 shrink-0">{label}</span>
                  <span className="text-xs text-slate-300 text-end">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Landing page attribution (live) */}
          {landingAttribution && (
            <div className="rounded-xl border border-gold/15 bg-gold/[0.03] p-5">
              <div className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-gold/70">
                <Globe className="h-3 w-3" /> {t('crm.sourceLandingPage')}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-200">{landingAttribution.headline}</div>
                  <div className="mt-0.5 font-mono text-xs text-slate-500">/lp/{landingAttribution.slug}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-1.5 py-px text-xs font-medium ${landingAttribution.isLiveNow ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-line-strong bg-surface-2 text-slate-400'}`}>
                  {landingAttribution.isLiveNow ? t('crm.live') : landingAttribution.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: t('crm.views'), value: landingAttribution.pageViews },
                  { label: t('crm.submits'), value: landingAttribution.formSubmissions },
                  { label: t('crm.leads'), value: landingAttribution.leadCount },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-line bg-surface-2/50 px-2 py-2 text-center">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">{m.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <a href={`/lp/${landingAttribution.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold/70 transition hover:text-gold">
                  {t('crm.viewPage')} <ArrowUpRight className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          )}

          {/* Attribution card */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <BarChart3 className="h-3 w-3" /> {t('crm.attribution')}
            </div>

              <div className="space-y-3 text-xs text-slate-400">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">{t('crm.campaign')}</span>
                  <span className="flex items-center gap-1.5 text-end">
                    {campaignPlatform && realCampaign && (
                      <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${
                        campaignPlatform === 'meta'
                          ? 'border-violet-400/30 bg-violet-400/10 text-violet-300'
                          : 'border-gold/25 bg-gold/10 text-gold'
                      }`}>
                        {campaignPlatform === 'meta' ? 'Meta' : 'Google'}
                      </span>
                    )}
                    {realCampaign && canSeeMarketing ? (
                      <Link href="/freehold-intelligence/analytics/marketing" className="group inline-flex items-center gap-1 text-gold/65 transition hover:text-gold">
                        {realCampaign}<ArrowUpRight className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    ) : (
                      <span className="text-slate-400">{lead.campaignId === 'organic' ? t('crm.organic') : realCampaign || t('crm.direct')}</span>
                    )}
                  </span>
                </div>
                {lead.landingId && lead.landingId !== 'direct_whatsapp' && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">{t('crm.landing')}</span>
                    <span className="font-mono text-xs text-slate-400">{lead.landingId}</span>
                  </div>
                )}
              </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('crm.actions')}</p>
            <QuickActions
              leadId={lead.id}
              leadName={lead.name}
              currentStage={lead.stage}
              existingDeal={existingDeal ? { id: existingDeal.id, status: existingDeal.status } : null}
              lead={{
                phone: lead.phone,
                email: lead.email,
                projectInterest: lead.projectInterest,
                budgetAED: lead.budgetAED,
              }}
              valueRating={(lead as unknown as { valueRating?: number | null }).valueRating ?? null}
            />
          </div>

          {/* Viewings + offers — first-class objects, no new pipeline stage */}
          <LeadViewingsCard
            leadId={lead.id}
            leadName={lead.name}
            brokerId={lead.assignedAgent}
            // taggedProjects carries the raw project_slug (set in getLiveLead)
            // but is not part of the shared CRMLeadIntelligence type.
            projectSlug={(lead as unknown as { taggedProjects?: string[] }).taggedProjects?.[0] ?? ''}
            dateLocale={dateLocale}
            viewings={viewings.map((v) => ({
              id: v.id, startsAt: v.startsAt, status: v.status, outcome: v.outcome,
              note: v.note, location: v.location,
            }))}
          />

          {/* Activity */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Clock className="h-3 w-3" /> {t('crm.activity')}
              </div>
              <Link href="/freehold-intelligence/crm/activity" className="text-xs text-gold/50 transition hover:text-gold">
                {t('crm.allActivity')}
              </Link>
            </div>
            {leadActivity.length > 0 ? (
              <div className="space-y-3">
                {leadActivity.slice(0, 5).map((event) => {
                  const { Icon, color, bg } = activityIcon(event.type)
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                        <Icon className={`h-3 w-3 ${color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-300 leading-snug">{event.content}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{event.actor} · {formatInstant(event.createdAt, dateLocale, { dateStyle: 'medium' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{t('crm.noActivityYet')}</p>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}
