'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users2, AlertCircle, CheckCircle2, ArrowUpRight, XCircle, RefreshCw, GitMerge } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const REQUIREMENTS = [
  { id: 'private-app-token', label: 'Private App token',                met: false, critical: true,  note: 'HubSpot Private App token with contacts, deals and companies scopes.' },
  { id: 'portal-id',         label: 'Portal ID',                        met: false, critical: true,  note: 'Identifies the HubSpot account — found under Settings → Account Information.' },
  { id: 'contacts-scope',    label: 'Contacts read & write',            met: false, critical: true,  note: 'Required to sync leads as HubSpot contacts and write intent score updates.' },
  { id: 'deals-scope',       label: 'Deals pipeline access',            met: false, critical: true,  note: 'Maps Freehold pipeline stages (New → Hot → Closed) to HubSpot deal stages.' },
  { id: 'companies-scope',   label: 'Companies scope',                  met: false, critical: false, note: 'Optional firm-level mapping for corporate or multi-property buyers.' },
  { id: 'custom-props',      label: 'Custom properties configured',     met: false, critical: false, note: 'Maps source, intent_score and assigned_agent to custom HubSpot contact fields.' },
  { id: 'webhook',           label: 'Webhook endpoint active',          met: false, critical: false, note: 'Real-time contact updates from HubSpot to Freehold when stage changes occur.' },
]

const CHECKLIST = [
  'Log in to HubSpot and go to Settings → Integrations → Private Apps',
  'Create a new Private App — give it the name "Freehold Intelligence"',
  'Enable scopes: crm.objects.contacts (read+write), crm.objects.deals (read+write), crm.objects.companies (read)',
  'Generate the app token and copy it',
  'Copy your Portal ID from Settings → Account → Account Information',
  'Paste both values into the Freehold integration settings under HubSpot',
  'Map Freehold stages: New → Lead In, Follow-up → Attempting Contact, Hot → Contract Sent, Closed → Closed Won',
]

const SYNC_SCHEMA = [
  { freehold: 'CRM Lead',      hubspot: 'Contact',        fields: 'Name, phone, email, source, intent_score, assigned_agent' },
  { freehold: 'Pipeline stage', hubspot: 'Deal stage',     fields: 'New → Hot → Qualified → Closed' },
  { freehold: 'Activity log',  hubspot: 'Contact timeline', fields: 'Calls, notes, WhatsApp events, stage changes' },
  { freehold: 'Agent',         hubspot: 'Contact owner',   fields: 'Agent name maps to HubSpot owner by email' },
]

export default function HubSpotIntegrationPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(REQUIREMENTS.map((r) => [r.id, r.met]))
  )
  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
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
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Users2 className="h-3.5 w-3.5" /> HubSpot CRM
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-0.5 text-[10px] font-medium text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Not connected
          </span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          HubSpot CRM<br /><span className="text-white/35">blocked by {criticalUnmet} item{criticalUnmet !== 1 ? 's' : ''}.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          HubSpot is the lead sync backbone. Without it, lead data lives only inside Freehold — no contact timeline, no pipeline history, no cross-channel attribution.
        </p>
      </section>

      {/* Critical blocker banner */}
      {criticalUnmet > 0 && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Lead sync is disabled</div>
              <p className="mt-1 text-[13px] text-white/60">
                All CRM data is currently mocked inside Freehold only. No leads are being written to HubSpot, no stage changes are syncing, and no activity history is building in the contact timeline.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requirements */}
      <section className="mt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Access requirements</div>
        <h2 className="mt-2 text-xl font-semibold text-white">{metCount}/{REQUIREMENTS.length} requirements met</h2>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
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
                  ? 'border-emerald-400/15 bg-emerald-400/[0.03]'
                  : req.critical
                    ? 'border-red-400/15 bg-red-400/[0.03]'
                    : 'border-white/[0.06] bg-[#0A0D10]'
              }`}
            >
              {checked[req.id]
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                : req.critical
                  ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
              }
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-white">{req.label}</div>
                <p className="mt-0.5 text-[12px] text-white/50">{req.note}</p>
              </div>
              <span className={`shrink-0 text-[11px] font-medium ${
                checked[req.id] ? 'text-emerald-300' : req.critical ? 'text-red-300' : 'text-white/35'
              }`}>
                {checked[req.id] ? 'Met' : req.critical ? 'Critical' : 'Optional'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Setup guide */}
      <section className="mt-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Setup guide</div>
        <h2 className="mt-2 text-xl font-semibold text-white">How to connect</h2>
        <div className="mt-5 space-y-2">
          {CHECKLIST.map((step, i) => (
            <div key={i} className="flex items-start gap-4 rounded-[16px] border border-white/[0.05] bg-[#0A0D10] px-5 py-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-white/40">
                {i + 1}
              </span>
              <p className="text-[13px] leading-relaxed text-white/70">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sync schema */}
      <section className="mt-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Data mapping</div>
        <h2 className="mt-2 text-xl font-semibold text-white">What syncs once connected</h2>
        <div className="mt-5 overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">Freehold</th>
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">HubSpot</th>
                <th className="hidden px-6 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 sm:table-cell">Fields synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {SYNC_SCHEMA.map((row) => (
                <tr key={row.freehold} className="transition hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-medium text-white/85">{row.freehold}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <GitMerge className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/50" />
                      <span className="text-[#D4AF37]/75">{row.hubspot}</span>
                    </div>
                  </td>
                  <td className="hidden px-6 py-4 text-[12px] text-white/45 sm:table-cell">{row.fields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-4 py-3">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-white/30" />
          <p className="text-[12px] text-white/45">
            Sync will run every 15 minutes bidirectionally once the token and portal ID are confirmed. Stage changes in HubSpot will update Freehold CRM within one sync cycle.
          </p>
        </div>
      </section>

      {/* CRM link */}
      <section className="mt-10 flex items-center justify-between rounded-[20px] border border-white/[0.06] bg-[#0A0D10] px-5 py-4">
        <div>
          <div className="text-[13px] font-semibold text-white">View CRM leads affected</div>
          <p className="mt-0.5 text-[12px] text-white/45">6 active leads are tracked in Freehold only — no HubSpot record yet.</p>
        </div>
        <Link
          href="/freehold-intelligence/crm"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.08] px-3 py-1.5 text-[12px] text-[#D4AF37]/80 transition hover:bg-[#D4AF37]/15 hover:text-[#D4AF37]"
        >
          Open CRM <ArrowUpRight className="h-3 w-3" />
        </Link>
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about HubSpot setup, sync, data mapping…"
          suggestions={[
            'What happens to existing leads when HubSpot connects?',
            'How do I create a Private App in HubSpot?',
            'What pipeline stages should I map to Freehold?',
          ]}
        />
      </section>

    </div>
  )
}
