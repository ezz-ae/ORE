'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, AlertCircle, CheckCircle2, XCircle, ArrowUpRight, Zap } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const REQUIREMENTS = [
  { id: 'waba-id',         label: 'WhatsApp Business Account ID',   met: false, critical: true,  note: 'The WABA ID from Meta Business Manager — links Freehold to your business account.' },
  { id: 'phone-number-id', label: 'Phone Number ID',                met: false, critical: true,  note: 'The specific phone number registered under your WABA for sending messages.' },
  { id: 'access-token',    label: 'Permanent system user token',    met: false, critical: true,  note: 'System user token from Meta Business Manager with `whatsapp_business_messaging` scope.' },
  { id: 'verified-number', label: 'Verified business phone number', met: false, critical: true,  note: 'The business phone number must pass Meta verification before messages can send.' },
  { id: 'biz-manager',     label: 'Meta Business Manager access',   met: false, critical: true,  note: 'Business Manager is the parent account — admin access is required to manage WABA.' },
  { id: 'templates',       label: 'Message templates approved',     met: false, critical: false, note: 'Pre-approved templates required for automated follow-up flows (1–2 day Meta review).' },
  { id: 'webhook',         label: 'Webhook endpoint configured',    met: false, critical: false, note: 'Receive delivery receipts and incoming messages in real time.' },
]

const CHECKLIST = [
  'Open Meta Business Manager and go to WhatsApp → Business Accounts',
  'Add or select the business phone number to use for Freehold messages',
  'Create a System User under Business Settings → Users → System Users',
  'Assign the System User to the WhatsApp account with Standard access',
  'Generate a permanent access token for the System User',
  'Copy the WABA ID, Phone Number ID, and token into Freehold integration settings',
  'Submit message templates for Meta approval — use the Freehold pre-built set',
  'Test a template message to confirm delivery before enabling automations',
]

const AUTOMATION_FLOWS = [
  {
    id: 'lead-follow-up',
    label: '24h lead follow-up',
    trigger: 'New lead arrives, no agent contact within 24h',
    template: 'Hi {{name}}, I saw your enquiry about {{area}}. I have the details ready — when is a good time to connect?',
    status: 'Pending template approval',
    statusColor: 'text-orange-300',
  },
  {
    id: 'payment-plan',
    label: 'Payment plan delivery',
    trigger: 'Agent marks lead stage as "Qualified"',
    template: 'Hi {{name}}, here is the {{project}} payment plan you requested. {{payment_plan_link}}',
    status: 'Pending template approval',
    statusColor: 'text-orange-300',
  },
  {
    id: 'appointment-confirm',
    label: 'Viewing confirmation',
    trigger: 'Viewing appointment logged in CRM',
    template: 'Hi {{name}}, confirming your viewing of {{project}} on {{date}} at {{time}}. Reply YES to confirm.',
    status: 'Pending template approval',
    statusColor: 'text-orange-300',
  },
  {
    id: 'hot-escalation',
    label: 'Hot-lead agent alert',
    trigger: 'Lead intent score crosses 85 threshold',
    template: 'Internal agent alert: {{name}} is now hot. Intent: {{score}}/100. Action: {{next_action}}',
    status: 'No template needed (agent-to-agent)',
    statusColor: 'text-[#D4AF37]',
  },
]

export default function WhatsAppIntegrationPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(REQUIREMENTS.map((r) => [r.id, r.met]))
  )
  function toggle(id: string) {
    setChecked((prev: Record<string, boolean>) => ({ ...prev, [id]: !prev[id] }))
  }
  const metCount      = Object.values(checked).filter(Boolean).length
  const criticalUnmet = REQUIREMENTS.filter((r) => r.critical && !checked[r.id]).length

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/integrations" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Integrations
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Business
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-0.5 text-[12px] font-medium text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Not connected
          </span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          WhatsApp Business<br /><span className="text-white/35">blocked by {criticalUnmet} item{criticalUnmet !== 1 ? 's' : ''}.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          WhatsApp is the primary follow-up channel. Without it, lead messages are sent manually — no automation, no delivery receipts, and no CRM activity logging on outbound messages.
        </p>
      </section>

      {/* Blocker banner */}
      {criticalUnmet > 0 && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Lead follow-up automation is disabled</div>
              <p className="mt-1 text-[13px] text-white/60">
                Agents are sending WhatsApp messages manually with no read receipt tracking, no delivery confirmation, and no activity sync to the CRM timeline. The 24h follow-up automation cannot run until this integration is live.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requirements */}
      <section className="mt-12">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Access requirements</div>
        <h2 className="mt-2 text-xl font-semibold text-white">{metCount}/{REQUIREMENTS.length} requirements met</h2>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-[#D4AF37] transition-all duration-300"
            style={{ width: `${(metCount / REQUIREMENTS.length) * 100}%` }}
          />
        </div>
        <div className="mt-5 space-y-2">
          {REQUIREMENTS.map((req) => (
            <button
              key={req.id}
              type="button"
              onClick={() => toggle(req.id)}
              className={`w-full text-left flex items-start gap-4 rounded-[18px] border p-5 ${
                checked[req.id]
                  ? 'border-emerald-400/15 bg-[#D4AF37]/[0.03]'
                  : req.critical
                    ? 'border-red-400/15 bg-red-400/[0.03]'
                    : 'border-white/[0.08] bg-[#1A1F2A]'
              }`}
            >
              {checked[req.id]
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                : req.critical
                  ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
              }
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-white">{req.label}</div>
                <p className="mt-0.5 text-[12px] text-white/50">{req.note}</p>
              </div>
              <span className={`shrink-0 text-[13px] font-medium ${
                checked[req.id] ? 'text-[#D4AF37]' : req.critical ? 'text-red-300' : 'text-white/35'
              }`}>
                {checked[req.id] ? 'Met' : req.critical ? 'Critical' : 'Optional'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Setup guide */}
      <section className="mt-14">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Setup guide</div>
        <h2 className="mt-2 text-xl font-semibold text-white">How to connect</h2>
        <div className="mt-5 space-y-2">
          {CHECKLIST.map((step, i) => (
            <div key={i} className="flex items-start gap-4 rounded-[16px] border border-white/[0.05] bg-[#1A1F2A] px-5 py-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[13px] font-semibold text-white/40">
                {i + 1}
              </span>
              <p className="text-[13px] leading-relaxed text-white/70">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[14px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-5 py-4">
          <p className="text-[12px] text-white/55">
            <span className="font-semibold text-[#D4AF37]/80">Note:</span> Meta Business Verification is separate from WhatsApp verification and may take up to 5 business days. Start this process first if your Business Manager account is newly created.
          </p>
        </div>
      </section>

      {/* Automation flows */}
      <section className="mt-14">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Automations</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Flows enabled once connected</h2>
        <div className="mt-5 space-y-3">
          {AUTOMATION_FLOWS.map((flow) => (
            <div key={flow.id} className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/50" />
                  <div>
                    <div className="text-[14px] font-semibold text-white">{flow.label}</div>
                    <p className="mt-0.5 text-[12px] text-white/45">{flow.trigger}</p>
                  </div>
                </div>
                <span className={`shrink-0 text-[13px] font-medium ${flow.statusColor}`}>{flow.status}</span>
              </div>
              <div className="mt-3 rounded-[10px] border border-white/[0.04] bg-white/[0.02] px-4 py-3">
                <p className="font-mono text-[13px] leading-relaxed text-white/40">{flow.template}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CRM link */}
      <section className="mt-10 flex items-center justify-between rounded-[20px] border border-white/[0.08] bg-[#1A1F2A] px-5 py-4">
        <div>
          <div className="text-[13px] font-semibold text-white">Leads waiting for automated follow-up</div>
          <p className="mt-0.5 text-[12px] text-white/45">3 leads in the overdue queue would receive automated messages once connected.</p>
        </div>
        <Link
          href="/freehold-intelligence/crm/follow-up"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.08] px-3 py-1.5 text-[12px] text-[#D4AF37]/80 transition hover:bg-[#D4AF37]/15 hover:text-[#D4AF37]"
        >
          View queue <ArrowUpRight className="h-3 w-3" />
        </Link>
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about WhatsApp setup, templates, automations…"
          suggestions={[
            'What message templates do I need to submit?',
            'How long does Meta Business Verification take?',
            'Which leads would get automated follow-ups first?',
          ]}
        />
      </section>

    </div>
  )
}
