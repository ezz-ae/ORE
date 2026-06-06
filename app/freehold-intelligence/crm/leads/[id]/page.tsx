import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Brain,
  AlertTriangle, Clock, User, Target, Zap,
  PhoneCall, FileText, ArrowLeftRight, Bell, MessageSquare,
  BarChart3, Globe, ArrowUpRight,
} from 'lucide-react'
import { crmLeads, crmActivityLog } from '@/src/features/freehold-intelligence/server-session'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'
import { leadMachineListings, leadMachineLandings } from '@/src/features/freehold-intelligence/lead-machine'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import { CopyButton, SuggestedMessageActions, QuickActions } from './_components/LeadClientActions'

function urgencyTone(u: string) {
  if (u === 'critical') return { ring: 'ring-red-400/40',     bg: 'bg-red-400/10',     text: 'text-red-300',     dot: 'bg-red-400',     label: 'Critical' }
  if (u === 'high')     return { ring: 'ring-[#D4AF37]/35',  bg: 'bg-[#D4AF37]/10',  text: 'text-[#F8E7AE]',  dot: 'bg-[#D4AF37]',  label: 'High' }
  if (u === 'medium')   return { ring: 'ring-sky-400/30',    bg: 'bg-sky-400/10',    text: 'text-sky-200',    dot: 'bg-sky-400',    label: 'Medium' }
  return                       { ring: 'ring-slate-700',     bg: 'bg-slate-800/50',  text: 'text-slate-400',  dot: 'bg-slate-500',  label: 'Low' }
}

function scoreBar(n: number) {
  if (n >= 85) return 'bg-[#D4AF37]'
  if (n >= 65) return 'bg-[#D4AF37]'
  return 'bg-red-400'
}

export async function generateStaticParams() {
  return crmLeads.map((l) => ({ id: l.id }))
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = crmLeads.find((l) => l.id === id)
  if (!lead) notFound()

  const tone = urgencyTone(lead.urgency)

  const leadActivity = crmActivityLog
    .filter((e) => e.leadId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Resolve attribution
  const sourceCampaign = financeSummary.topSpendCampaigns.find((c) => c.campaignId === lead.campaignId) ?? null
  const sourceLanding  = leadMachineLandings.find((l) => l.id === lead.landingId) ?? null
  const sourceListing  = sourceCampaign?.projectId
    ? leadMachineListings.find((l) => l.projectId === sourceCampaign.projectId) ?? null
    : null

  function activityIcon(type: string) {
    if (type === 'call')         return { Icon: PhoneCall,      color: 'text-[#D4AF37]',   bg: 'bg-[#D4AF37]/10' }
    if (type === 'whatsapp')     return { Icon: MessageSquare,  color: 'text-[#D4AF37]',   bg: 'bg-[#D4AF37]/10' }
    if (type === 'note')         return { Icon: FileText,       color: 'text-slate-400',   bg: 'bg-sky-400/10' }
    if (type === 'stage_change') return { Icon: ArrowLeftRight, color: 'text-slate-400',   bg: 'bg-violet-400/10' }
    if (type === 'assignment')   return { Icon: User,           color: 'text-slate-400',   bg: 'bg-rose-400/10' }
    if (type === 'follow_up')    return { Icon: Bell,           color: 'text-orange-300',  bg: 'bg-orange-400/10' }
    return { Icon: Zap, color: 'text-slate-400', bg: 'bg-slate-800/50' }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/crm" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> CRM Intelligence
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.bg} border-current/20 ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {tone.label} urgency
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-800/50 px-2.5 py-0.5 text-sm text-slate-400">
            {lead.stage}
          </span>
          <span className="text-sm text-slate-500">{lead.source}</span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
          {lead.name}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Assigned to <span className="text-slate-300">{lead.assignedAgent}</span> · HubSpot #{lead.hubspotLeadId}
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* Main column */}
        <div className="space-y-5">

          {/* Contact + intent score */}
          <div className="grid gap-3 sm:grid-cols-3">
            <a href={`tel:${lead.phone}`} className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-[#D4AF37]/25">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37]">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">Phone</p>
                <p className="mt-0.5 text-sm font-medium text-white group-hover:text-[#D4AF37] transition-colors">{lead.phone}</p>
              </div>
            </a>
            <a href={`mailto:${lead.email}`} className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-sky-400/25">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">Email</p>
                <p className="mt-0.5 text-sm font-medium text-white group-hover:text-slate-400 transition-colors truncate">{lead.email}</p>
              </div>
            </a>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-[0.14em]">
                <Target className="h-3 w-3" /> Intent score
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-[32px] font-semibold leading-none tabular-nums text-white">{lead.intentScore}</span>
                <span className="text-sm text-slate-500 mb-0.5">/100</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${scoreBar(lead.intentScore)}`} style={{ width: `${lead.intentScore}%` }} />
              </div>
            </div>
          </div>

          {/* Risk warnings */}
          {(lead.duplicateRisk || lead.wrongNumberRisk) && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-5">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-red-300/80">
                <AlertTriangle className="h-3.5 w-3.5" /> Risk flags
              </div>
              <ul className="mt-3 space-y-1.5">
                {lead.duplicateRisk && <li className="text-sm text-red-200/80">Duplicate risk — another record shares this phone number. Merge before assigning.</li>}
                {lead.wrongNumberRisk && <li className="text-sm text-red-200/80">Wrong number risk — AI flagged potential contact mismatch.</li>}
              </ul>
            </div>
          )}

          {/* AI Summary */}
          <div className="rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-[#D4AF37]/80">
              <Brain className="h-3.5 w-3.5" /> AI intelligence summary
            </div>
            <p className="mt-3 text-sm leading-[1.7] text-slate-300">{lead.aiSummary}</p>
          </div>

          {/* Next best action */}
          <div className="rounded-xl border border-emerald-400/15 bg-[#D4AF37]/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-[#D4AF37]/80">
              <Zap className="h-3.5 w-3.5" /> Next best action
            </div>
            <p className="mt-3 text-sm leading-[1.7] text-slate-300">{lead.nextBestAction}</p>
          </div>

          {/* Suggested WhatsApp */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                <Bell className="h-3.5 w-3.5" /> Suggested message
              </div>
              <CopyButton text={lead.suggestedMessage} />
            </div>
            <div className="mt-4 rounded-[14px] border border-emerald-400/15 bg-[#D4AF37]/[0.04] p-4">
              <p className="text-[14px] leading-[1.7] text-slate-300 italic">"{lead.suggestedMessage}"</p>
            </div>
            <SuggestedMessageActions message={lead.suggestedMessage} phone={lead.phone} leadId={lead.id} />
          </div>

          {/* AI Prompt */}
          <AiPrompt
            placeholder={`Ask about ${lead.name}…`}
            suggestions={[
              `Draft a follow-up for ${lead.name} about payment plan.`,
              `What project best matches ${lead.name}'s intent?`,
              `Compare options for ${lead.name}'s budget.`,
              `Write a re-engagement message for ${lead.name}.`,
            ]}
            context={{
              lead: {
                name: lead.name,
                phone: lead.phone,
                stage: lead.pipelineStage,
                temperature: lead.temperature,
                budget: lead.budgetAED,
                project: lead.projectInterest,
                intentScore: lead.intentScore,
                urgency: lead.urgency,
                source: lead.source,
                assignedAgent: lead.assignedAgent,
                aiSummary: lead.aiSummary,
                nextBestAction: lead.nextBestAction,
                suggestedMessage: lead.suggestedMessage,
                duplicateRisk: lead.duplicateRisk,
                wrongNumberRisk: lead.wrongNumberRisk,
              },
            }}
          />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">

          {/* Lead metadata */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Lead details</p>
            <div className="space-y-3">
              {[
                { label: 'Source',       value: lead.source },
                { label: 'Stage',        value: lead.stage },
                { label: 'Agent',        value: lead.assignedAgent },
                { label: 'Last contact', value: new Date(lead.lastContactAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <span className="text-xs text-slate-500 shrink-0">{label}</span>
                  <span className="text-xs text-slate-300 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attribution card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <BarChart3 className="h-3 w-3" /> Attribution
            </div>

            {sourceCampaign ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-[0.15em] mb-1.5">Campaign</div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300 leading-snug">{sourceCampaign.name}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-px text-xs font-medium ${
                      sourceCampaign.platform === 'meta'
                        ? 'border-blue-400/25 bg-blue-400/10 text-blue-300'
                        : 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]'
                    }`}>
                      {sourceCampaign.platform === 'meta' ? 'Meta' : 'Google'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
                    <span>AED {sourceCampaign.spendAED.toLocaleString()} spent</span>
                    <span>·</span>
                    <span>AED {sourceCampaign.cpl.toFixed(0)} CPL</span>
                  </div>
                </div>

                {sourceListing && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-[0.15em] mb-1.5">Property</div>
                    <Link
                      href={`/freehold-intelligence/lead-machine/listings/${sourceListing.id}`}
                      className="group flex items-center justify-between gap-2 text-xs text-[#D4AF37]/65 transition hover:text-[#D4AF37]"
                    >
                      <span className="leading-snug">{sourceListing.projectName}</span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">{sourceListing.area} · {sourceListing.developer}</div>
                  </div>
                )}

                {sourceLanding && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-[0.15em] mb-1.5">Landing page</div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 shrink-0 text-slate-500" />
                      <span className="font-mono text-xs text-slate-400">{sourceLanding.landingUrl}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{sourceLanding.status} · {sourceLanding.completion}% complete</div>
                  </div>
                )}

                <Link
                  href="/freehold-intelligence/lead-machine/campaigns/attribution"
                  className="flex items-center gap-1 text-xs text-[#D4AF37]/45 transition hover:text-[#D4AF37]"
                >
                  View full attribution <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-400">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">Campaign</span>
                  <span className="text-slate-400">{lead.campaignId === 'organic' ? 'Organic' : lead.campaignId || 'Direct'}</span>
                </div>
                {lead.landingId && lead.landingId !== 'direct_whatsapp' && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-500">Landing</span>
                    <span className="font-mono text-xs text-slate-400">{lead.landingId}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Actions</p>
            <QuickActions leadId={lead.id} leadName={lead.name} currentStage={lead.stage} />
          </div>

          {/* Activity */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Clock className="h-3 w-3" /> Activity
              </div>
              <Link href="/freehold-intelligence/crm/activity" className="text-xs text-[#D4AF37]/50 transition hover:text-[#D4AF37]">
                All activity
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
                        <p className="mt-0.5 text-xs text-slate-500">{event.actor} · {new Date(event.createdAt).toLocaleDateString('en-AE', { dateStyle: 'medium' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" />
                  <div>
                    <p className="text-slate-300">Lead created via {lead.source}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{new Date(lead.lastContactAt).toLocaleDateString('en-AE', { dateStyle: 'medium' })}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                  <div>
                    <p className="text-slate-400">Assigned to {lead.assignedAgent}</p>
                    <p className="mt-0.5 text-sm text-slate-500">Auto-assigned</p>
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
