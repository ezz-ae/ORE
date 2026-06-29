import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Brain,
  AlertTriangle, Clock, User, Target, Zap,
  PhoneCall, FileText, ArrowLeftRight, Bell, MessageSquare,
  BarChart3, Globe, ArrowUpRight,
} from 'lucide-react'
import { cookies } from 'next/headers'
import { crmActivityLog, type CRMLeadIntelligence } from '@/src/features/freehold-intelligence/server-session'
import { leadMachineListings, leadMachineLandings } from '@/src/features/freehold-intelligence/lead-machine'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { getLandingAttribution, type LandingAttribution } from '@/lib/landing-pages'
import { getDealByLeadId } from '@/lib/deals'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getServerT } from '@/lib/i18n/server'
import { LeadExpertStrip } from '@/components/freehold/lead-expert-strip'

// Tries to fetch live lead from DB; maps it to the CRM shape used by the rest of this page.
// Brokers may only read their own leads — pass their brokerId to scope the query.
async function getLiveLead(id: string, ownerId: string | null): Promise<CRMLeadIntelligence | null> {
  try {
    await ensureLeadsTable()
    const queryParams: unknown[] = [id]
    let ownerFilter = ''
    if (ownerId) { queryParams.push(ownerId); ownerFilter = ' AND assigned_broker_id = $2' }
    const rows = await query<{
      id: string; name: string | null; phone: string | null; email: string | null;
      source: string | null; project_slug: string | null; assigned_broker_id: string | null;
      status: string | null; priority: string | null; budget_aed: number | null;
      interest: string | null; message: string | null; created_at: string;
      landing_slug: string | null; lead_code: string | null;
      utm_source: string | null; utm_campaign: string | null; utm_id: string | null;
    }>(
      `SELECT id, name, phone, email, source, project_slug, assigned_broker_id,
              status, priority, budget_aed, interest, message, created_at::text, landing_slug, lead_code,
              utm_source, utm_campaign, utm_id
       FROM freehold_site_leads WHERE id = $1${ownerFilter} LIMIT 1`,
      queryParams
    )
    if (!rows.length) return null
    const r = rows[0]
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
      duplicateRisk: false, wrongNumberRisk: false, assignedAgent: r.assigned_broker_id ?? '',
      lastContactAt: r.created_at, nextBestAction: 'Follow up', suggestedMessage: '',
      aiSummary: r.message ?? '', hasViewingScheduled: false, viewingDate: null,
      viewingProperty: null, notes: [], taggedProjects: r.project_slug ? [r.project_slug] : [],
      leadCode: r.lead_code ?? null,
    } as unknown as CRMLeadIntelligence
  } catch { return null }
}
import { CopyButton, SuggestedMessageActions, QuickActions } from './_components/LeadClientActions'

function urgencyTone(u: string) {
  if (u === 'critical') return { ring: 'ring-red-400/40',     bg: 'bg-red-400/10',     text: 'text-red-300',     dot: 'bg-red-400',     labelKey: 'crm.urgency.critical' }
  if (u === 'high')     return { ring: 'ring-gold/35',  bg: 'bg-gold/10',  text: 'text-[#F8E7AE]',  dot: 'bg-gold',  labelKey: 'crm.urgency.high' }
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
  const ownerId = sessionUser?.role === 'broker' ? (sessionUser.brokerId ?? sessionUser.email) : null
  // Real DB leads only — no seed/mock fallback.
  const lead = await getLiveLead(id, ownerId)
  if (!lead) notFound()

  const tone = urgencyTone(lead.urgency)
  const dateLocale = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'

  // Landing-page attribution: which campaign page produced this lead (live data).
  const landingSlug = lead.landingId && lead.landingId !== 'direct_whatsapp' ? lead.landingId : ''
  const landingAttribution: LandingAttribution | null = landingSlug ? await getLandingAttribution(landingSlug) : null

  // A lead can be converted to a deal only once.
  const existingDeal = await getDealByLeadId(lead.id)

  // Activity timeline is populated from real lead events only (no seed log).
  const leadActivity: typeof crmActivityLog = []

  // Resolve attribution. Campaign attribution comes from live landing data
  // (landingAttribution above) and the lead's own fields; no seed campaign
  // benchmark is consulted, so these stay null and the live fallback renders.
  const sourceCampaign = ((): { name: string; platform: 'meta' | 'google'; spendAED: number; cpl: number } | null => null)()
  const sourceLanding  = leadMachineLandings.find((l) => l.id === lead.landingId) ?? null
  const sourceListing = ((): { id: string; projectName: string; area: string; developer: string } | null => null)()

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
        <ArrowLeft className="h-3.5 w-3.5" /> {t('crm.crmIntelligence')}
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
          <span className="text-sm text-slate-500">{lead.source}</span>
          {lead.leadCode && (
            <span className="rounded-full border border-gold/20 bg-gold/[0.06] px-2.5 py-0.5 font-mono text-xs text-gold/80">
              {lead.leadCode}
            </span>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
          {lead.name}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {t('crm.assignedToHubspot', { agent: lead.assignedAgent, id: lead.hubspotLeadId })}
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* Main column */}
        <div className="space-y-5">

          {/* Ask the Expert about this lead */}
          <LeadExpertStrip name={lead.name} />

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
            <p className="mt-3 text-sm leading-[1.7] text-slate-300">{lead.nextBestAction}</p>
          </div>

          {/* Suggested WhatsApp */}
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                <Bell className="h-3.5 w-3.5" /> {t('crm.suggestedMessage')}
              </div>
              <CopyButton text={lead.suggestedMessage} />
            </div>
            <div className="mt-4 rounded-[14px] border border-emerald-400/15 bg-gold/[0.04] p-4">
              <p className="text-[14px] leading-[1.7] text-slate-300 italic">"{lead.suggestedMessage}"</p>
            </div>
            <SuggestedMessageActions message={lead.suggestedMessage} phone={lead.phone} leadId={lead.id} />
          </div>

        </div>

        {/* Sidebar */}
        <aside className="space-y-4">

          {/* Lead metadata */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('crm.leadDetails')}</p>
            <div className="space-y-3">
              {[
                { label: t('crm.source'),      value: lead.source },
                { label: t('crm.stage'),       value: lead.stage },
                { label: t('crm.agent'),       value: lead.assignedAgent },
                { label: t('crm.lastContact'), value: new Date(lead.lastContactAt).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <span className="text-xs text-slate-500 shrink-0">{label}</span>
                  <span className="text-xs text-slate-300 text-right">{value}</span>
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
                <Link href={`/lp/${landingAttribution.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-400 transition hover:text-slate-200">
                  {t('crm.viewPage')} <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Attribution card */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <BarChart3 className="h-3 w-3" /> {t('crm.attribution')}
            </div>

            {sourceCampaign ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-[0.15em] mb-1.5">{t('crm.campaign')}</div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300 leading-snug">{sourceCampaign.name}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-px text-xs font-medium ${
                      sourceCampaign.platform === 'meta'
                        ? 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300'
                        : 'border-gold/25 bg-gold/10 text-gold'
                    }`}>
                      {sourceCampaign.platform === 'meta' ? 'Meta' : 'Google'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
                    <span>{t('crm.spent', { amount: `AED ${sourceCampaign.spendAED.toLocaleString()}` })}</span>
                    <span>·</span>
                    <span>{t('crm.cpl', { amount: `AED ${sourceCampaign.cpl.toFixed(0)}` })}</span>
                  </div>
                </div>

                {sourceListing && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-[0.15em] mb-1.5">{t('crm.property')}</div>
                    <Link
                      href={`/freehold-intelligence/lead-machine/listings/${sourceListing.id}`}
                      className="group flex items-center justify-between gap-2 text-xs text-gold/65 transition hover:text-gold"
                    >
                      <span className="leading-snug">{sourceListing.projectName}</span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">{sourceListing.area} · {sourceListing.developer}</div>
                  </div>
                )}

                {sourceLanding && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-[0.15em] mb-1.5">{t('crm.landingPage')}</div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 shrink-0 text-slate-500" />
                      <span className="font-mono text-xs text-slate-400">{sourceLanding.landingUrl}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{sourceLanding.status} · {t('crm.complete', { percent: sourceLanding.completion })}</div>
                  </div>
                )}

                <Link
                  href="/freehold-intelligence/lead-machine/campaigns/attribution"
                  className="flex items-center gap-1 text-xs text-gold/45 transition hover:text-gold"
                >
                  {t('crm.viewFullAttribution')} <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-400">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">{t('crm.campaign')}</span>
                  <span className="flex items-center gap-1.5 text-right">
                    {campaignPlatform && realCampaign && (
                      <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${
                        campaignPlatform === 'meta'
                          ? 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300'
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
            )}
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
            />
          </div>

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
                        <p className="mt-0.5 text-xs text-slate-500">{event.actor} · {new Date(event.createdAt).toLocaleDateString(dateLocale, { dateStyle: 'medium' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <div>
                    <p className="text-slate-300">{t('crm.leadCreatedVia', { source: lead.source })}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{new Date(lead.lastContactAt).toLocaleDateString(dateLocale, { dateStyle: 'medium' })}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-surface-3" />
                  <div>
                    <p className="text-slate-400">{t('crm.assignedTo', { agent: lead.assignedAgent })}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{t('crm.autoAssigned')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}
