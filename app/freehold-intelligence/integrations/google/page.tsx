'use client'

import { useState, useEffect } from 'react'
import { Search, Eye, EyeOff, CheckCircle2, AlertCircle, XCircle, Copy, Info, BarChart2, MousePointerClick, TrendingUp, DollarSign } from 'lucide-react'

const KEYS = {
  devToken:   'fh_gads_dev_token',
  clientId:   'fh_gads_client_id',
  clientSec:  'fh_gads_client_secret',
  refresh:    'fh_gads_refresh_token',
  customerId: 'fh_gads_customer_id',
}

type Phase = 'idle' | 'saved' | 'error'

type Creds = {
  devToken:   string
  clientId:   string
  clientSec:  string
  refresh:    string
  customerId: string
}

const EMPTY: Creds = { devToken: '', clientId: '', clientSec: '', refresh: '', customerId: '' }

const FIELDS: { key: keyof Creds; label: string; placeholder: string; mono?: boolean; hint: string; secret?: boolean }[] = [
  {
    key: 'devToken',
    label: 'Developer Token',
    placeholder: 'ABcDEFgHiJkLmNoPqRsTuV',
    mono: true,
    secret: true,
    hint: 'Google Ads → Tools → API Center. Takes 1–2 days for Basic access approval.',
  },
  {
    key: 'clientId',
    label: 'OAuth Client ID',
    placeholder: '123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com',
    mono: true,
    hint: 'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.',
  },
  {
    key: 'clientSec',
    label: 'OAuth Client Secret',
    placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxxxx',
    mono: true,
    secret: true,
    hint: 'Paired with Client ID. Found in the same OAuth credentials card.',
  },
  {
    key: 'refresh',
    label: 'Refresh Token',
    placeholder: '1//0xxxxxxxxxxxxxxxxxxxxxxxx',
    mono: true,
    secret: true,
    hint: 'Generated via the OAuth 2.0 Playground (developers.google.com/oauthplayground). Select Google Ads API scope.',
  },
  {
    key: 'customerId',
    label: 'Customer ID',
    placeholder: '1234567890',
    hint: 'Top-right of Google Ads Manager (10-digit, no dashes). Use Manager Account ID if using MCC.',
  },
]

const MOCK_CAMPAIGNS = [
  { name: 'Dubai Marina — Lead Gen',    status: 'ENABLED',  budget: 3000, spend: 2187, clicks: 1842, impressions: 84200, conversions: 23 },
  { name: 'Downtown Luxury Listings',   status: 'ENABLED',  budget: 2000, spend: 1940, clicks: 921,  impressions: 61300, conversions: 14 },
  { name: 'JVC Off-Plan Brand',         status: 'PAUSED',   budget: 1500, spend: 0,    clicks: 0,     impressions: 0,     conversions: 0  },
  { name: 'Waterfront — Search Max',    status: 'ENABLED',  budget: 2500, spend: 1670, clicks: 2340,  impressions: 98100, conversions: 31 },
]

function pct(v: number, t: number) { return t > 0 ? Math.round((v / t) * 100) : 0 }

export default function GoogleAdsPage() {
  const [creds,  setCreds]  = useState<Creds>(EMPTY)
  const [shows,  setShows]  = useState<Record<keyof Creds, boolean>>({ devToken: false, clientId: false, clientSec: false, refresh: false, customerId: false })
  const [phase,  setPhase]  = useState<Phase>('idle')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const loaded: Creds = { ...EMPTY }
    let any = false
    Object.entries(KEYS).forEach(([k, lk]) => {
      const v = localStorage.getItem(lk)
      if (v) { (loaded as any)[k] = v; any = true }
    })
    if (any) { setCreds(loaded); setPhase('saved') }
  }, [])

  function save() {
    const allFilled = Object.values(creds).every((v) => v.trim())
    if (!allFilled) { setPhase('error'); return }
    Object.entries(KEYS).forEach(([k, lk]) => localStorage.setItem(lk, (creds as any)[k].trim()))
    setPhase('saved')
  }

  function clear() {
    Object.values(KEYS).forEach((lk) => localStorage.removeItem(lk))
    setCreds(EMPTY)
    setPhase('idle')
  }

  function toggleShow(key: keyof Creds) {
    setShows((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const totalSpend       = MOCK_CAMPAIGNS.reduce((s, c) => s + c.spend, 0)
  const totalClicks      = MOCK_CAMPAIGNS.reduce((s, c) => s + c.clicks, 0)
  const totalImpressions = MOCK_CAMPAIGNS.reduce((s, c) => s + c.impressions, 0)
  const totalConversions = MOCK_CAMPAIGNS.reduce((s, c) => s + c.conversions, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue-500/10">
              <Search className="h-4 w-4 text-blue-400" />
            </div>
            <h1 className="text-[20px] font-semibold text-white">Google Ads</h1>
          </div>
          <p className="mt-1 text-[12px] text-white/30">Store your credentials — syncs via the Freehold backend</p>
        </div>
        {phase === 'saved' && (
          <button onClick={clear}
            className="shrink-0 flex items-center gap-1.5 rounded-full border border-red-400/20 px-3 py-1.5 text-[12px] text-red-400/70 transition hover:border-red-400/40 hover:text-red-400">
            <XCircle className="h-3 w-3" /> Clear credentials
          </button>
        )}
      </div>

      {/* Info banner — explain why credentials are stored not used live */}
      <div className="mb-5 flex items-start gap-3 rounded-[14px] border border-blue-400/15 bg-blue-400/[0.04] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400/70" />
        <p className="text-[12px] text-white/40 leading-relaxed">
          Google Ads API requires a <strong className="text-white/60">Developer Token</strong> and server-side OAuth — browser calls are blocked.
          Your credentials are saved here and used by the Freehold backend to pull live campaign data.
          Nothing is sent to any third party.
        </p>
      </div>

      {/* Credentials form */}
      <div className="mb-6 space-y-3">
        {FIELDS.map(({ key, label, placeholder, mono, secret, hint }) => (
          <div key={key} className="rounded-[14px] border border-white/[0.07] bg-[#131B2B] p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-white/60">{label}</span>
              {creds[key] && (
                <button onClick={() => copy(creds[key], key)}
                  className="flex items-center gap-1 text-[11px] text-white/20 hover:text-white/50 transition">
                  {copied === key ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copied === key ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={secret && !shows[key] ? 'password' : 'text'}
                placeholder={placeholder}
                value={creds[key]}
                onChange={(e) => setCreds((prev) => ({ ...prev, [key]: e.target.value }))}
                className={`w-full rounded-[9px] border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/15 outline-none focus:border-blue-400/30 ${mono ? 'font-mono pr-9' : ''} ${secret ? 'pr-9' : ''}`}
              />
              {secret && (
                <button onClick={() => toggleShow(key)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50">
                  {shows[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-white/25 leading-relaxed">{hint}</p>
          </div>
        ))}
      </div>

      {phase === 'error' && (
        <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-red-400/20 bg-red-400/[0.05] px-3 py-2.5 text-[12px] text-red-400/90">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          All five credentials are required.
        </div>
      )}

      {phase !== 'saved' && (
        <button onClick={save}
          className="w-full rounded-[12px] bg-blue-500 py-3 text-[14px] font-semibold text-white transition hover:bg-blue-400">
          Save credentials
        </button>
      )}

      {phase === 'saved' && (
        <>
          {/* Saved banner */}
          <div className="mb-6 flex items-center gap-2 rounded-[12px] border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[13px] text-emerald-400/90">Credentials saved — backend will sync on next run</span>
            <button onClick={() => setPhase('idle')}
              className="ml-auto text-[11px] text-white/25 underline underline-offset-2 hover:text-white/50">
              Edit
            </button>
          </div>

          {/* Preview dashboard */}
          <div className="mb-3 flex items-center gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/25">Campaign preview</div>
            <span className="rounded-full border border-amber-400/25 px-2 py-0.5 text-[10px] text-amber-400/70">Sample data</span>
          </div>

          {/* Summary tiles */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total spend',   value: `AED ${totalSpend.toLocaleString()}`,       Icon: DollarSign,        color: 'text-blue-400'    },
              { label: 'Clicks',        value: totalClicks.toLocaleString(),                Icon: MousePointerClick, color: 'text-sky-400'     },
              { label: 'Impressions',   value: `${(totalImpressions / 1000).toFixed(1)}K`, Icon: BarChart2,         color: 'text-violet-400'  },
              { label: 'Conversions',   value: totalConversions.toString(),                 Icon: TrendingUp,        color: 'text-emerald-400' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-[14px] border border-white/[0.07] bg-[#131B2B] p-4">
                <Icon className={`h-4 w-4 ${color}`} />
                <div className="mt-2 text-[18px] font-semibold text-white">{value}</div>
                <div className="mt-0.5 text-[11px] text-white/25">{label}</div>
              </div>
            ))}
          </div>

          {/* Campaigns table */}
          <div className="rounded-[16px] border border-white/[0.07] bg-[#131B2B] divide-y divide-white/[0.04] overflow-hidden">
            {MOCK_CAMPAIGNS.map((c) => {
              const budgetPct = pct(c.spend, c.budget)
              const ctr       = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00'
              const cpl       = c.conversions > 0 ? Math.round(c.spend / c.conversions) : 0
              return (
                <div key={c.name} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.status === 'ENABLED' ? 'bg-emerald-400' : 'bg-white/20'}`} />
                        <span className="text-[13px] font-medium text-white/80 truncate">{c.name}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/25">
                        <span>CTR {ctr}%</span>
                        <span>CPC AED {c.clicks > 0 ? (c.spend / c.clicks).toFixed(2) : '—'}</span>
                        {c.conversions > 0 && <span>CPL AED {cpl}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-medium text-white/70">AED {c.spend.toLocaleString()}</div>
                      <div className="text-[11px] text-white/25">of AED {c.budget.toLocaleString()}</div>
                    </div>
                  </div>
                  {c.status === 'ENABLED' && (
                    <div className="mt-2.5 h-1 w-full rounded-full bg-white/[0.06]">
                      <div
                        className={`h-1 rounded-full transition-all ${budgetPct >= 90 ? 'bg-red-400' : budgetPct >= 75 ? 'bg-amber-400' : 'bg-blue-400'}`}
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-center text-[11px] text-white/20">
            Sample data shown. Live data syncs once the backend connects with your credentials.
          </p>
        </>
      )}

    </div>
  )
}
