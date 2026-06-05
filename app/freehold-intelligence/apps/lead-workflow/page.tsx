'use client'

import { useState, useMemo } from 'react'
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, GitBranch, CheckCircle2, AlertCircle, ArrowUpRight, Zap, Clock } from 'lucide-react'
import { crmInboxLeads, crmFollowUpQueue } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type RuleStatus = 'active' | 'pending' | 'planned'

type Rule = {
  id: string
  trigger: string
  action: string
  status: RuleStatus
  note?: string
}

type StatusFilter = 'All' | 'active' | 'pending' | 'planned'
type StepFilter   = 'All' | 'intake' | 'routing' | 'followup'

const INTAKE_RULES: Rule[] = [
  { id: 'ir1', trigger: 'Landing page form submission', action: 'Create CRM lead with source tag, score intent, assign urgency', status: 'active' },
  { id: 'ir2', trigger: 'WhatsApp inbound message', action: 'Create inbox lead, flag for manual assignment, notify sales manager', status: 'active' },
  { id: 'ir3', trigger: 'Meta Ads lead form', action: 'Create lead with source + campaign tag, auto-assign to next available agent', status: 'pending', note: 'Pending Meta Ads integration' },
  { id: 'ir4', trigger: 'Agent referral submission', action: 'Create lead with referral tag, assign to referring agent automatically', status: 'active' },
  { id: 'ir5', trigger: 'Duplicate detected on intake', action: 'Hold lead in review queue, flag both records for manager resolution', status: 'active' },
]

const ROUTING_RULES: Rule[] = [
  { id: 'rr1', trigger: 'Intent score ≥ 85', action: 'Assign to Noura or Ahmad K. (senior advisors)', status: 'active' },
  { id: 'rr2', trigger: 'Source = Golden Visa inquiry', action: 'Route to Sara M. (GV + beachfront specialist)', status: 'active' },
  { id: 'rr3', trigger: 'Source = Palm investor landing', action: 'Route to Noura (Palm specialist)', status: 'active' },
  { id: 'rr4', trigger: 'Agent utilization > 90%', action: 'Skip overloaded agents, assign to next available in specialty match', status: 'active' },
  { id: 'rr5', trigger: 'No specialty match + all agents at capacity', action: 'Hold in inbox, alert sales manager for manual assignment', status: 'active' },
]

const FOLLOWUP_RULES: Rule[] = [
  { id: 'fu1', trigger: '24h since intake — no first contact logged', action: 'Escalate urgency to high, notify sales manager via alert', status: 'active' },
  { id: 'fu2', trigger: '48h no contact — critical or high-intent lead', action: 'Auto-send WhatsApp template if approved, reassign if no response', status: 'pending', note: 'Pending WhatsApp integration + template approval' },
  { id: 'fu3', trigger: '72h no contact — any lead', action: 'Move to review queue, flag for manager decision', status: 'active' },
  { id: 'fu4', trigger: 'Wrong number flag raised by agent', action: 'Move to verification queue, pause follow-up automation', status: 'active' },
  { id: 'fu5', trigger: 'Duplicate flag raised', action: 'Pause follow-up on both records until resolution', status: 'active' },
]

const RULE_STATUS_CONFIG: Record<RuleStatus, { label: string; icon: React.ElementType; classes: string }> = {
  active:  { label: 'Active',   icon: CheckCircle2, classes: 'text-[#D4AF37] border-[#D4AF37]/20 bg-[#D4AF37]/[0.07]' },
  pending: { label: 'Pending',  icon: Clock,        classes: 'text-[#D4AF37] border-[#D4AF37]/20 bg-[#D4AF37]/[0.07]'      },
  planned: { label: 'Planned',  icon: AlertCircle,  classes: 'text-white/55 border-sky-400/20 bg-sky-400/[0.07]'            },
}

const ALL_RULES = [...INTAKE_RULES, ...ROUTING_RULES, ...FOLLOWUP_RULES]
const activeRules  = ALL_RULES.filter((r) => r.status === 'active').length
const pendingRules = ALL_RULES.filter((r) => r.status === 'pending').length
const unassigned   = crmInboxLeads.filter((l) => l.status === 'unassigned').length
const overdue      = crmFollowUpQueue.filter((f) => f.overdueHours > 0).length

function RuleRow({ rule }: { rule: Rule }) {
  const conf = RULE_STATUS_CONFIG[rule.status]
  const Icon = conf.icon
  return (
    <div className={`flex items-start gap-4 rounded-[16px] border p-5 ${rule.status === 'active' ? 'border-white/[0.08] bg-[#131B2B]' : rule.status === 'pending' ? 'border-[#D4AF37]/15 bg-[#D4AF37]/[0.03]' : 'border-white/[0.04] bg-white/[0.01]'}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${conf.classes.split(' ')[0]}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-white/80">{rule.trigger}</div>
        <p className="mt-1 text-[12px] text-white/50">{rule.action}</p>
        {rule.note && (
          <p className="mt-1.5 text-[13px] italic text-white/30">{rule.note}</p>
        )}
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${conf.classes}`}>{conf.label}</span>
    </div>
  )
}

export default function LeadWorkflowPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [stepFilter,   setStepFilter]   = useState<StepFilter>('All')

  const filteredIntake = useMemo(() => {
    const base = (stepFilter === 'All' || stepFilter === 'intake') ? INTAKE_RULES : []
    return statusFilter === 'All' ? base : base.filter((r) => r.status === statusFilter)
  }, [statusFilter, stepFilter])

  const filteredRouting = useMemo(() => {
    const base = (stepFilter === 'All' || stepFilter === 'routing') ? ROUTING_RULES : []
    return statusFilter === 'All' ? base : base.filter((r) => r.status === statusFilter)
  }, [statusFilter, stepFilter])

  const filteredFollowup = useMemo(() => {
    const base = (stepFilter === 'All' || stepFilter === 'followup') ? FOLLOWUP_RULES : []
    return statusFilter === 'All' ? base : base.filter((r) => r.status === statusFilter)
  }, [statusFilter, stepFilter])

  const totalFiltered = filteredIntake.length + filteredRouting.length + filteredFollowup.length
  const totalRules = INTAKE_RULES.length + ROUTING_RULES.length + FOLLOWUP_RULES.length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All apps
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <GitBranch className="h-3.5 w-3.5" /> Lead Workflow
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[12px] font-medium text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Planned
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
          Intake, routing<br /><span className="text-white/35">and follow-up rules.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          Every lead goes through intake → routing → follow-up. {activeRules} rules are active now. {pendingRules} are pending external integrations.
        </p>
      </section>

      {/* Live status stats */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active rules',      value: activeRules,  color: 'text-[#D4AF37]' },
          { label: 'Pending rules',     value: pendingRules, color: 'text-[#D4AF37]' },
          { label: 'Unassigned leads',  value: unassigned,   color: unassigned > 0 ? 'text-red-300' : 'text-white' },
          { label: 'Overdue follow-ups', value: overdue,     color: overdue > 0 ? 'text-orange-300' : 'text-white' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4">
            <div className={`text-[28px] font-semibold leading-none ${stat.color}`}>{stat.value}</div>
            <div className="mt-1.5 text-[13px] text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([
          { key: 'All', label: 'All' }, { key: 'active', label: 'Active' },
          { key: 'pending', label: 'Pending' }, { key: 'planned', label: 'Planned' },
        ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={['rounded-full border px-3 py-1 text-[13px] font-medium transition',
              statusFilter === key
                ? key === 'active'  ? 'border-emerald-400/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : key === 'pending' ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : key === 'planned' ? 'border-sky-400/40 bg-sky-400/10 text-white/55'
                  : 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65',
            ].join(' ')}>{label}</button>
        ))}
        <span className="self-center text-white/15">|</span>
        {([
          { key: 'All', label: 'All steps' }, { key: 'intake', label: 'Intake' },
          { key: 'routing', label: 'Routing' }, { key: 'followup', label: 'Follow-up' },
        ] as { key: StepFilter; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setStepFilter(key)}
            className={['rounded-full border px-3 py-1 text-[13px] font-medium transition',
              stepFilter === key
                ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65',
            ].join(' ')}>{label}</button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-white/30">
        {totalFiltered === totalRules ? `${totalRules} rules` : `${totalFiltered} of ${totalRules} rules`}
      </p>

      {/* Pending blockers */}
      {pendingRules > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
          <div>
            <div className="text-[13px] font-semibold text-white">{pendingRules} workflow rules are waiting on integrations</div>
            <p className="mt-1 text-[12px] text-white/55">
              Meta Ads lead capture and WhatsApp automated follow-up require those integrations to be live first. Connect them under{' '}
              <Link href="/freehold-intelligence/integrations" className="text-[#D4AF37]/80 underline hover:text-[#D4AF37]">Integrations</Link>.
            </p>
          </div>
        </div>
      )}

      {/* Intake rules */}
      {(stepFilter === 'All' || stepFilter === 'intake') && (
        <section className="mt-12">
          <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Step 1</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Intake rules</h2>
          <p className="mt-1 text-[13px] text-white/45">What happens the moment a lead arrives from any channel.</p>
          {filteredIntake.length === 0 ? (
            <div className="mt-5 rounded-[16px] border border-white/[0.04] bg-white/[0.01] px-5 py-8 text-center text-[12px] text-white/30">
              No intake rules match these filters.
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {filteredIntake.map((rule) => <RuleRow key={rule.id} rule={rule} />)}
            </div>
          )}
        </section>
      )}

      {/* Routing rules */}
      {(stepFilter === 'All' || stepFilter === 'routing') && (
        <section className="mt-12">
          <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Step 2</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Routing logic</h2>
          <p className="mt-1 text-[13px] text-white/45">How leads are matched to agents based on intent, source, and availability.</p>
          {filteredRouting.length === 0 ? (
            <div className="mt-5 rounded-[16px] border border-white/[0.04] bg-white/[0.01] px-5 py-8 text-center text-[12px] text-white/30">
              No routing rules match these filters.
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {filteredRouting.map((rule) => <RuleRow key={rule.id} rule={rule} />)}
            </div>
          )}
        </section>
      )}

      {/* Follow-up automation */}
      {(stepFilter === 'All' || stepFilter === 'followup') && (
        <section className="mt-12">
          <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Step 3</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Follow-up automation</h2>
          <p className="mt-1 text-[13px] text-white/45">Time-based escalation and automated outreach rules.</p>
          {filteredFollowup.length === 0 ? (
            <div className="mt-5 rounded-[16px] border border-white/[0.04] bg-white/[0.01] px-5 py-8 text-center text-[12px] text-white/30">
              No follow-up rules match these filters.
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {filteredFollowup.map((rule) => <RuleRow key={rule.id} rule={rule} />)}
            </div>
          )}
        </section>
      )}

      {/* Live queue links */}
      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Unassigned inbox', count: unassigned, href: '/freehold-intelligence/crm/inbox', note: `${unassigned} leads waiting` },
          { label: 'Overdue follow-up', count: overdue, href: '/freehold-intelligence/crm/follow-up', note: `${overdue} leads overdue` },
          { label: 'Duplicate review', count: 1, href: '/freehold-intelligence/crm/duplicates', note: '1 cluster flagged' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-[16px] border border-white/[0.08] bg-[#131B2B] px-5 py-4 transition hover:border-[#D4AF37]/25"
          >
            <div>
              <div className="text-[13px] font-semibold text-white/85 transition group-hover:text-white">{item.label}</div>
              <div className="mt-0.5 text-[12px] text-white/40">{item.note}</div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:text-[#D4AF37]" />
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about intake rules, routing, follow-up automation…"
          suggestions={[
            'How does a Palm landing lead get assigned to an agent?',
            'What triggers the 48h follow-up automation?',
            'Which integrations are needed to complete the workflow?',
          ]}
        />
      </section>

    </div>
  )
}
