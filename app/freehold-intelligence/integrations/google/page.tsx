'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, AlertCircle, CheckCircle2, ArrowUpRight, XCircle, ExternalLink } from 'lucide-react'

const REQUIREMENTS = [
  { id: 'developer-token', label: 'Developer Token',          met: false, critical: true,  note: 'Required for all Google Ads API calls. Apply via the Google Ads API Center.' },
  { id: 'client-id',       label: 'OAuth Client ID',          met: false, critical: true,  note: 'Created in Google Cloud Console under APIs & Services → Credentials.' },
  { id: 'client-secret',   label: 'OAuth Client Secret',      met: false, critical: true,  note: 'Paired with Client ID. Keep secret — never expose in frontend code.' },
  { id: 'refresh-token',   label: 'Refresh Token',            met: false, critical: true,  note: 'Long-lived token obtained via OAuth consent flow. Used to refresh access tokens.' },
  { id: 'customer-id',     label: 'Customer ID (10-digit)',   met: false, critical: true,  note: 'The Google Ads account ID without dashes. Found in Google Ads Manager top-right.' },
  { id: 'conversion',      label: 'Conversion action set up', met: false, critical: false, note: 'Lead form submission event mapped as a conversion in Google Ads for smart bidding.' },
  { id: 'manager-account', label: 'Manager account (MCC)',    met: false, critical: false, note: 'Optional. Allows managing multiple accounts under one login.' },
]

const ENV_VARS = [
  { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', desc: 'Your approved developer token from Google Ads API Center' },
  { key: 'GOOGLE_ADS_CLIENT_ID',       desc: 'OAuth 2.0 client ID from Google Cloud Console' },
  { key: 'GOOGLE_ADS_CLIENT_SECRET',   desc: 'OAuth 2.0 client secret' },
  { key: 'GOOGLE_ADS_REFRESH_TOKEN',   desc: 'Long-lived refresh token from OAuth consent flow' },
  { key: 'GOOGLE_ADS_CUSTOMER_ID',     desc: '10-digit ad account ID (no dashes)' },
  { key: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', desc: 'Manager account ID if using MCC (optional)' },
]

const SETUP_STEPS = [
  'Go to Google Cloud Console — create a project or use an existing one',
  'Enable the Google Ads API under APIs & Services → Library',
  'Create OAuth 2.0 credentials (Web application type) — copy Client ID and Secret',
  'Apply for a Developer Token in Google Ads → Tools → API Center (takes 1–2 days for approval)',
  'Run the OAuth consent flow to generate a refresh token (use google-auth-library or OAuth Playground)',
  'Find your Customer ID in Google Ads Manager (top-right, 10-digit number)',
  'Add all five environment variables to your Vercel/host environment settings',
  'Create a Lead conversion action in Google Ads for smart bidding to work',
]

export default function GoogleIntegrationPage() {
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

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#4285F4]/85">
            <Search className="h-3.5 w-3.5" /> Google Ads
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-0.5 text-[10px] font-medium text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Not connected
          </span>
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          Google Ads<br />
          <span className="text-white/35">{metCount}/{REQUIREMENTS.length} requirements met.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-[1.65] text-white/55">
          Connect Google Ads to manage Search, Performance Max, Display and Video campaigns directly from Freehold. All campaign data, keyword performance, and search term reports sync automatically.
        </p>
      </section>

      {/* Critical blockers */}
      {criticalUnmet > 0 && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-[13px] font-semibold text-white">{criticalUnmet} critical requirement{criticalUnmet !== 1 ? 's' : ''} missing</div>
              <p className="mt-1 text-[13px] text-white/60">Google Ads campaigns cannot be created or managed until all critical items below are resolved.</p>
            </div>
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      <section className="mt-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40 mb-4">Requirements</div>
        <div className="space-y-2">
          {REQUIREMENTS.map((req) => (
            <div key={req.id} className="flex items-start gap-3 rounded-[16px] border border-white/[0.06] bg-[#0A0D10] p-4">
              <div className="mt-0.5 shrink-0">
                {req.met
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : req.critical
                    ? <XCircle className="h-4 w-4 text-red-400/70" />
                    : <AlertCircle className="h-4 w-4 text-white/20" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[13px] font-semibold ${req.met ? 'text-white' : 'text-white/70'}`}>{req.label}</span>
                  {req.critical && !req.met && (
                    <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[9px] font-medium text-red-400">Required</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-white/40">{req.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Setup steps */}
      <section className="mt-10">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40 mb-4">Setup guide</div>
        <div className="rounded-[22px] border border-white/[0.06] bg-[#0A0D10] p-6">
          <div className="space-y-3">
            {SETUP_STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[10px] font-semibold text-white/35">
                  {i + 1}
                </span>
                <p className="text-[13px] leading-relaxed text-white/60">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="https://console.cloud.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#4285F4]/70 transition hover:text-[#4285F4]"
            >
              Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://developers.google.com/google-ads/api/docs/first-call/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#4285F4]/70 transition hover:text-[#4285F4]"
            >
              Google Ads API docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Environment variables */}
      <section className="mt-10">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40 mb-4">
          Environment variables required
        </div>
        <div className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0A0D10]">
          <div className="divide-y divide-white/[0.04]">
            {ENV_VARS.map((v) => (
              <div key={v.key} className="flex items-start gap-4 px-5 py-3.5">
                <code className="shrink-0 rounded-[8px] bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-[#4285F4]/80">
                  {v.key}
                </code>
                <span className="text-[12px] text-white/40">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[12px] text-white/30">
          Add these to your Vercel project settings under Settings → Environment Variables, then redeploy.
        </p>
      </section>

      {/* What unlocks */}
      <section className="mt-10">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40 mb-4">What this unlocks</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: 'Campaign management',   body: 'Create and manage Search, PMax, Display, and Video campaigns directly from Freehold.' },
            { title: 'Keyword control',        body: '9 UAE real estate keyword themes. Full keyword management with Quality Score monitoring.' },
            { title: 'RSA copy generation',    body: 'AI-generated headlines and descriptions for Responsive Search Ads with character limit checks.' },
            { title: 'Search terms report',    body: 'See exactly what people searched to trigger your ads. Add top terms as keywords.' },
            { title: 'Audience management',    body: 'Customer Match lists, in-market segments, and remarketing audiences.' },
            { title: 'Ad extensions',          body: 'Sitelinks, callouts, call, location, and lead form extensions synced from your account.' },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <div className="text-[13px] font-semibold text-white">{title}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-white/40">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <Link
          href="/freehold-intelligence/lead-machine/google"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
        >
          Go to Google Ads <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </section>

    </div>
  )
}
