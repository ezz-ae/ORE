'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Megaphone, AlertCircle, CheckCircle2, ArrowUpRight, XCircle } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const REQUIREMENTS = [
  { id: 'app-id',        label: 'Meta App ID',                     met: false, critical: true,  note: 'Required to authenticate Freehold with Meta Business.' },
  { id: 'access-token',  label: 'Access token',                    met: false, critical: true,  note: 'Long-lived system user token with `ads_management` scope.' },
  { id: 'billing-owner', label: 'Billing owner confirmed',          met: false, critical: true,  note: 'An owner or admin must be assigned as the billing owner on the ad account.' },
  { id: 'ad-account',    label: 'Ad account ID linked',            met: false, critical: true,  note: 'Meta Business ad account ID must be mapped to this workspace.' },
  { id: 'pixel',         label: 'Meta Pixel installed on site',    met: false, critical: false, note: 'Pixel on property pages enables lead event matching.' },
  { id: 'capi',          label: 'Conversions API (CAPI) enabled',  met: false, critical: false, note: 'Server-side event sending for stronger signal matching.' },
  { id: 'catalog',       label: 'Property catalog created',        met: false, critical: false, note: 'Dynamic property catalog enables retargeting and DPA campaigns.' },
]

const CHECKLIST = [
  'Log in to Meta Business Manager',
  'Create or locate the Freehold ad account',
  'Add a billing payment method and confirm the billing owner',
  'Generate a system user token with `ads_management` + `ads_read` scopes',
  'Copy the token and App ID into the Freehold integration settings',
  'Verify the pixel fires on a property detail page',
]

export default function MetaIntegrationPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(REQUIREMENTS.map((r) => [r.id, r.met]))
  )
  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  const metCount  = Object.values(checked).filter(Boolean).length
  const criticalUnmet = REQUIREMENTS.filter((r) => r.critical && !checked[r.id]).length

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <Link href="/freehold-intelligence/integrations" className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Integrations
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <Megaphone className="h-3.5 w-3.5" /> Meta Ads
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-0.5 text-[10px] font-medium text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Not connected
          </span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          Meta Ads<br /><span className="text-white/35">blocked by {criticalUnmet} item{criticalUnmet !== 1 ? 's' : ''}.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          Meta & Instagram campaigns are the primary paid traffic channel. Connection is blocked until billing ownership and API credentials are confirmed.
        </p>
      </section>

      {/* Critical blocker banner */}
      {criticalUnmet > 0 && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">Campaign launch is blocked</div>
              <p className="mt-1 text-[13px] text-white/60">
                The Palm Jumeirah and Dubai Hills campaigns cannot launch until the Meta billing owner is confirmed and API credentials are connected. This is the highest-priority blocker in the system.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      <section className="mt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Access requirements</div>
        <h2 className="mt-2 text-xl font-semibold text-white">{metCount}/{REQUIREMENTS.length} requirements met</h2>
        {/* progress bar */}
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
              className={`flex w-full text-left items-start gap-4 rounded-[18px] border p-5 ${
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

      {/* Setup checklist */}
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

      {/* Campaign preview */}
      <section className="mt-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Pending campaigns</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Ready to launch once connected</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            { name: 'Palm Jumeirah Investor Pack', blocker: 'Meta billing owner + API', status: 'Blocked' },
            { name: 'Dubai Hills Yield Campaign',  blocker: 'API credentials only', status: 'Blocked' },
          ].map((campaign) => (
            <div key={campaign.name} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[14px] font-semibold text-white">{campaign.name}</div>
                <span className="shrink-0 rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-300">{campaign.status}</span>
              </div>
              <p className="mt-1.5 text-[12px] text-white/45">{campaign.blocker}</p>
              <Link
                href="/freehold-intelligence/lead-machine/ad-requests"
                className="mt-3 inline-flex items-center gap-1 text-[11px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
              >
                View ad request <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <AiPrompt
          placeholder="Ask about Meta Ads setup, campaigns, billing…"
          suggestions={[
            'What is blocking the Meta ad launch?',
            'How do I find my Meta App ID?',
            'Which campaigns are ready to launch once Meta is connected?',
          ]}
        />
      </section>

    </div>
  )
}
