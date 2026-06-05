import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, ArrowUpRight, Phone, Mail, MessageSquare, Brain,
  AlertTriangle, Clock, User, Target, Zap, Copy, BookOpen,
  PhoneCall, FileText, ArrowLeftRight, Bell,
} from 'lucide-react'
import { crmLeads, crmActivityLog } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function urgencyTone(u: string) {
  if (u === 'critical') return { ring: 'ring-red-400/40',     bg: 'bg-red-400/10',     text: 'text-red-300',     dot: 'bg-red-400',     label: 'Critical' }
  if (u === 'high')     return { ring: 'ring-[#D4AF37]/35',  bg: 'bg-[#D4AF37]/10',  text: 'text-[#F8E7AE]',  dot: 'bg-[#D4AF37]',  label: 'High' }
  if (u === 'medium')   return { ring: 'ring-sky-400/30',    bg: 'bg-sky-400/10',    text: 'text-sky-200',    dot: 'bg-sky-400',    label: 'Medium' }
  return                       { ring: 'ring-white/10',      bg: 'bg-white/[0.04]',  text: 'text-white/50',   dot: 'bg-white/30',   label: 'Low' }
}

function scoreBar(n: number) {
  if (n >= 85) return 'bg-emerald-400'
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

  function activityIcon(type: string) {
    if (type === 'call')         return { Icon: PhoneCall,      color: 'text-emerald-300', bg: 'bg-emerald-400/10' }
    if (type === 'whatsapp')     return { Icon: MessageSquare,  color: 'text-[#D4AF37]',   bg: 'bg-[#D4AF37]/10' }
    if (type === 'note')         return { Icon: FileText,       color: 'text-sky-300',     bg: 'bg-sky-400/10' }
    if (type === 'stage_change') return { Icon: ArrowLeftRight, color: 'text-violet-300',  bg: 'bg-violet-400/10' }
    if (type === 'assignment')   return { Icon: User,           color: 'text-rose-300',    bg: 'bg-rose-400/10' }
    if (type === 'follow_up')    return { Icon: Bell,           color: 'text-orange-300',  bg: 'bg-orange-400/10' }
    return { Icon: Zap, color: 'text-white/45', bg: 'bg-white/[0.04]' }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">
      <Link href="/freehold-intelligence/crm" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> CRM Intelligence
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.bg} border-current/20 ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {tone.label} urgency
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/50">
            {lead.stage}
          </span>
          <span className="text-[11px] text-white/30">{lead.source}</span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[52px]">
          {lead.name}
        </h1>
        <p className="mt-3 text-[15px] text-white/50">
          Assigned to <span className="text-white/70">{lead.assignedAgent}</span> · HubSpot #{lead.hubspotLeadId}
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">

        {/* Main column */}
        <div className="space-y-5">

          {/* Contact + intent score */}
          <div className="grid gap-3 sm:grid-cols-3">
            <a href={`tel:${lead.phone}`} className="group flex items-center gap-3 rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 transition hover:border-[#D4AF37]/25">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37]">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-[0.14em]">Phone</p>
                <p className="mt-0.5 text-[13px] font-medium text-white group-hover:text-[#D4AF37] transition-colors">{lead.phone}</p>
              </div>
            </a>
            <a href={`mailto:${lead.email}`} className="group flex items-center gap-3 rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4 transition hover:border-sky-400/25">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 text-sky-400">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-[0.14em]">Email</p>
                <p className="mt-0.5 text-[13px] font-medium text-white group-hover:text-sky-300 transition-colors truncate">{lead.email}</p>
              </div>
            </a>
            <div className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-4">
              <div className="flex items-center gap-2 text-[10px] text-white/35 uppercase tracking-[0.14em]">
                <Target className="h-3 w-3" /> Intent score
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-[32px] font-semibold leading-none tabular-nums text-white">{lead.intentScore}</span>
                <span className="text-[13px] text-white/35 mb-0.5">/100</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full ${scoreBar(lead.intentScore)}`} style={{ width: `${lead.intentScore}%` }} />
              </div>
            </div>
          </div>

          {/* Risk warnings */}
          {(lead.duplicateRisk || lead.wrongNumberRisk) && (
            <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.05] p-5">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-red-300/80">
                <AlertTriangle className="h-3.5 w-3.5" /> Risk flags
              </div>
              <ul className="mt-3 space-y-1.5">
                {lead.duplicateRisk && <li className="text-[13px] text-red-200/80">Duplicate risk — another record shares this phone number. Merge before assigning.</li>}
                {lead.wrongNumberRisk && <li className="text-[13px] text-red-200/80">Wrong number risk — AI flagged potential contact mismatch.</li>}
              </ul>
            </div>
          )}

          {/* AI Summary */}
          <div className="rounded-[22px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-6">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/80">
              <Brain className="h-3.5 w-3.5" /> AI intelligence summary
            </div>
            <p className="mt-3 text-[15px] leading-[1.7] text-white/85">{lead.aiSummary}</p>
          </div>

          {/* Next best action */}
          <div className="rounded-[22px] border border-emerald-400/15 bg-emerald-400/[0.04] p-6">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/80">
              <Zap className="h-3.5 w-3.5" /> Next best action
            </div>
            <p className="mt-3 text-[15px] leading-[1.7] text-white/85">{lead.nextBestAction}</p>
          </div>

          {/* Suggested WhatsApp */}
          <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
                <MessageSquare className="h-3.5 w-3.5" /> Suggested message
              </div>
              <button className="flex items-center gap-1 text-[11px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="mt-4 rounded-[14px] border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
              <p className="text-[14px] leading-[1.7] text-white/80 italic">"{lead.suggestedMessage}"</p>
            </div>
            <div className="mt-4 flex gap-3">
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-500 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-emerald-500/90"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Send on WhatsApp
              </a>
              <Link
                href={`/freehold-intelligence/notebook?lead=${lead.id}`}
                className="inline-flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[12px] text-white/65 transition hover:border-[#D4AF37]/30 hover:text-white"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Save to Notebook
              </Link>
            </div>
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
          />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">

          {/* Lead metadata */}
          <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Lead details</p>
            <div className="space-y-3">
              {[
                { label: 'Source', value: lead.source },
                { label: 'Stage', value: lead.stage },
                { label: 'Agent', value: lead.assignedAgent },
                { label: 'Campaign', value: lead.campaignId || 'Organic' },
                { label: 'Landing', value: lead.landingId || 'Direct' },
                { label: 'Last contact', value: new Date(lead.lastContactAt).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <span className="text-[12px] text-white/35 shrink-0">{label}</span>
                  <span className="text-[12px] text-white/75 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Actions</p>
            <div className="space-y-2">
              {[
                { label: 'Move to Hot', icon: Zap, accent: 'hover:border-[#D4AF37]/30 hover:text-[#F8E7AE]' },
                { label: 'Reassign agent', icon: User, accent: 'hover:border-sky-400/30 hover:text-sky-200' },
                { label: 'View in pipeline', icon: ArrowUpRight, accent: 'hover:border-white/20 hover:text-white' },
              ].map((action) => {
                const Icon = action.icon
                return (
                  <button key={action.label} className={`flex w-full items-center gap-2.5 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[13px] text-white/55 transition ${action.accent}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Activity */}
          <div className="rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                <Clock className="h-3 w-3" /> Activity
              </div>
              <Link href="/freehold-intelligence/crm/activity" className="text-[10px] text-[#D4AF37]/50 transition hover:text-[#D4AF37]">
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
                        <p className="text-[12px] text-white/70 leading-snug">{event.content}</p>
                        <p className="mt-0.5 text-[10px] text-white/30">{event.actor} · {new Date(event.createdAt).toLocaleDateString('en-AE', { dateStyle: 'medium' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 text-[13px]">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]" />
                  <div>
                    <p className="text-white/70">Lead created via {lead.source}</p>
                    <p className="mt-0.5 text-[11px] text-white/30">{new Date(lead.lastContactAt).toLocaleDateString('en-AE', { dateStyle: 'medium' })}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[13px]">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                  <div>
                    <p className="text-white/50">Assigned to {lead.assignedAgent}</p>
                    <p className="mt-0.5 text-[11px] text-white/30">Auto-assigned</p>
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
