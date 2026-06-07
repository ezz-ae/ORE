'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, ChevronDown, Check, Zap, AlertCircle, ArrowRight } from 'lucide-react'
import { leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'
import { UAE_REAL_ESTATE_KEYWORD_THEMES } from '@/lib/google/keyword-themes'
import type { GoogleCampaignType, GoogleBiddingStrategy, GoogleKeywordMatchType } from '@/lib/google/types'

type WizardStep = 1 | 2 | 3 | 4 | 5

const CAMPAIGN_TYPES: { value: GoogleCampaignType; label: string; desc: string; color: string }[] = [
  { value: 'SEARCH',          label: 'Search',           desc: 'Text ads on Google Search — highest intent buyers',       color: '#4285F4' },
  { value: 'PERFORMANCE_MAX', label: 'Performance Max',  desc: 'Automated across all Google channels — leads + awareness', color: '#FBBC04' },
  { value: 'DISPLAY',         label: 'Display',          desc: 'Image ads across the Google Display Network',              color: '#34A853' },
  { value: 'VIDEO',           label: 'Video',            desc: 'YouTube and video partner placements',                     color: '#EA4335' },
]

const BIDDING_STRATEGIES: { value: GoogleBiddingStrategy; label: string; desc: string; requiresCpa?: boolean }[] = [
  { value: 'MAXIMIZE_CONVERSIONS', label: 'Maximise Conversions',      desc: 'Automatically gets the most conversions within budget' },
  { value: 'TARGET_CPA',           label: 'Target CPA',                desc: 'Targets a specific cost-per-lead', requiresCpa: true },
  { value: 'TARGET_ROAS',          label: 'Target ROAS',               desc: 'Maximises conversion value at a target return on ad spend' },
  { value: 'MANUAL_CPC',           label: 'Manual CPC',                desc: 'Set max bids manually — full control, requires optimisation' },
]

interface FormState {
  listingId:        string
  campaignName:     string
  type:             GoogleCampaignType
  biddingStrategy:  GoogleBiddingStrategy
  dailyBudgetAED:   number
  targetCpaAED:     number
  finalUrl:         string
  selectedThemes:   string[]
  customKeywords:   string
  headlines:        string[]
  descriptions:     string[]
  startDate:        string
}

const DEFAULT_HEADLINES = [
  'Invest in Dubai Real Estate',
  'Premium Property — Register Now',
  'AED 2M+ Qualifies for Golden Visa',
]
const DEFAULT_DESCRIPTIONS = [
  'Freehold property in Dubai with flexible payment plans. Speak to a senior advisor today.',
  'Zero property tax. Strong rental yield. Register your interest now.',
]

const STEPS = ['Objective', 'Budget & Bid', 'Keywords', 'Ad Copy', 'Review']

export default function GoogleCampaignNewPage() {
  const [step, setStep]       = useState<WizardStep>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const listing0 = leadMachineListings[0]
  const [form, setForm] = useState<FormState>({
    listingId:       listing0?.id ?? '',
    campaignName:    listing0 ? `${listing0.projectName} — Search` : '',
    type:            'SEARCH',
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    dailyBudgetAED:  200,
    targetCpaAED:    150,
    finalUrl:        listing0?.landingUrl ? `https://freeholdproperty.ae${listing0.landingUrl}` : '',
    selectedThemes:  [],
    customKeywords:  '',
    headlines:       DEFAULT_HEADLINES,
    descriptions:    DEFAULT_DESCRIPTIONS,
    startDate:       '',
  })

  function patch(updates: Partial<FormState>) {
    setForm((f) => ({ ...f, ...updates }))
  }

  function onListingChange(id: string) {
    const l = leadMachineListings.find((x) => x.id === id)
    if (l) {
      patch({
        listingId:    id,
        campaignName: `${l.projectName} — ${form.type === 'PERFORMANCE_MAX' ? 'PMax' : 'Search'}`,
        // Auto-fill the landing URL when a listing with an active landing page is selected.
        // The user can still override it manually.
        finalUrl: l.landingUrl ? `https://freeholdproperty.ae${l.landingUrl}` : form.finalUrl,
      })
    }
  }

  function toggleTheme(id: string) {
    patch({
      selectedThemes: form.selectedThemes.includes(id)
        ? form.selectedThemes.filter((t) => t !== id)
        : [...form.selectedThemes, id],
    })
  }

  function updateHeadline(i: number, val: string) {
    const h = [...form.headlines]
    h[i] = val
    patch({ headlines: h })
  }
  function updateDescription(i: number, val: string) {
    const d = [...form.descriptions]
    d[i] = val
    patch({ descriptions: d })
  }

  async function handleLaunch() {
    setSubmitting(true)
    setError(null)
    try {
      const selectedThemeKeywords = UAE_REAL_ESTATE_KEYWORD_THEMES
        .filter((t) => form.selectedThemes.includes(t.id))
        .flatMap((t) => t.keywords)

      const customKws = form.customKeywords
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((text) => ({
          text,
          matchType: (text.startsWith('[') && text.endsWith(']')
            ? 'EXACT'
            : text.startsWith('"') && text.endsWith('"')
            ? 'PHRASE'
            : 'BROAD') as GoogleKeywordMatchType,
        }))

      const res = await fetch('/api/google/campaigns/launch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          listingId:       form.listingId,
          listingName:     leadMachineListings.find((l) => l.id === form.listingId)?.projectName ?? '',
          area:            leadMachineListings.find((l) => l.id === form.listingId)?.area ?? '',
          campaignName:    form.campaignName,
          type:            form.type,
          biddingStrategy: form.biddingStrategy,
          dailyBudgetAED:  form.dailyBudgetAED,
          targetCpaAED:    form.biddingStrategy === 'TARGET_CPA' ? form.targetCpaAED : undefined,
          keywords:        [...selectedThemeKeywords, ...customKws],
          finalUrl:        form.finalUrl,
          headlines:       form.headlines.filter(Boolean),
          descriptions:    form.descriptions.filter(Boolean),
          startDate:       form.startDate || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Launch failed')
      setSuccess(json.campaignId ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  const listing = leadMachineListings.find((l) => l.id === form.listingId)
  const selectedThemeKwCount = UAE_REAL_ESTATE_KEYWORD_THEMES
    .filter((t) => form.selectedThemes.includes(t.id))
    .reduce((s, t) => s + t.keywords.length, 0)

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#4285F4]/10 border border-[#4285F4]/25">
          <Check className="h-7 w-7 text-[#4285F4]" />
        </div>
        <h2 className="mt-5 text-[28px] font-semibold text-white">Campaign created</h2>
        <p className="mt-2 text-[14px] text-slate-400">
          Created in PAUSED state — review before activating in Google Ads Manager.
        </p>
        {success && (
          <p className="mt-1 font-mono text-xs text-slate-600">ID: {success}</p>
        )}
        <div className="mt-8 flex justify-center gap-3">
          {success && (
            <Link
              href={`/freehold-intelligence/lead-machine/google/campaigns/${success}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A97F5]"
            >
              Open this campaign
            </Link>
          )}
          <Link
            href="/freehold-intelligence/lead-machine/google/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-5 py-2.5 text-sm text-slate-300 transition hover:text-white"
          >
            All campaigns
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link
        href="/freehold-intelligence/lead-machine/google/campaigns"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#4285F4]/85">
          <Search className="h-3.5 w-3.5" /> New Campaign
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Google Ads campaign<br />
          <span className="text-slate-500">5 steps to launch.</span>
        </h1>
      </section>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = (i + 1) as WizardStep
          const done   = step > n
          const active = step === n
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-6 ${done ? 'bg-[#4285F4]/50' : 'bg-surface-2'}`} />}
              <div className="flex items-center gap-1.5">
                <div className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                  done   ? 'bg-[#4285F4] text-white'   :
                  active ? 'bg-[#4285F4]/20 text-[#4285F4] border border-[#4285F4]/40' :
                           'bg-surface-2 text-slate-500',
                ].join(' ')}>
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <span className={`hidden text-sm sm:inline ${active ? 'text-white' : 'text-slate-500'}`}>
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Objective ─────────────────────────────────────────────── */}
      {step === 1 && (
        <section className="mt-10 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Listing
            </label>
            <div className="relative">
              <select
                value={form.listingId}
                onChange={(e) => onListingChange(e.target.value)}
                className="w-full appearance-none rounded-[14px] border border-line bg-surface px-4 py-3 pr-10 text-sm text-white focus:border-[#4285F4]/40 focus:outline-none"
              >
                {leadMachineListings.map((l) => (
                  <option key={l.id} value={l.id}>{l.projectName}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
            </div>
            {listing && (
              <p className="mt-1 text-sm text-slate-500">
                {listing.area} · {listing.developer}
                {listing.startingPrice && <> · AED {(listing.startingPrice / 1_000_000).toFixed(1)}M from</>}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Campaign name
            </label>
            <input
              type="text"
              value={form.campaignName}
              onChange={(e) => patch({ campaignName: e.target.value })}
              placeholder="e.g. Palm Jumeirah Investor — Search"
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#4285F4]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Campaign type
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {CAMPAIGN_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    patch({
                      type: t.value,
                      campaignName: listing ? `${listing.projectName} — ${t.value === 'PERFORMANCE_MAX' ? 'PMax' : t.label}` : form.campaignName,
                    })
                  }}
                  className={[
                    'rounded-[14px] border p-4 text-left transition',
                    form.type === t.value
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/[0.07]'
                      : 'border-line bg-surface hover:border-white/20',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full`} style={{ backgroundColor: t.color }} />
                    <span className={`text-sm font-semibold ${form.type === t.value ? 'text-white' : 'text-slate-400'}`}>{t.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 leading-snug">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Landing URL
            </label>
            <input
              type="url"
              value={form.finalUrl}
              onChange={(e) => patch({ finalUrl: e.target.value })}
              placeholder="https://your-landing-page.com/property"
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-sm text-white placeholder-white/20 focus:border-[#4285F4]/40 focus:outline-none"
            />
          </div>
        </section>
      )}

      {/* ── Step 2: Budget & Bidding ──────────────────────────────────────── */}
      {step === 2 && (
        <section className="mt-10 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Daily budget (AED)
            </label>
            <input
              type="number"
              min={50}
              value={form.dailyBudgetAED}
              onChange={(e) => patch({ dailyBudgetAED: Number(e.target.value) })}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-sm text-white focus:border-[#4285F4]/40 focus:outline-none"
            />
            <p className="mt-1 text-sm text-slate-500">Minimum AED 50/day. Monthly cap = daily × 30.4</p>
            <div className="mt-3 flex gap-2">
              {[100, 200, 500, 1000].map((v) => (
                <button
                  key={v}
                  onClick={() => patch({ dailyBudgetAED: v })}
                  className={`rounded-[10px] border px-3 py-1.5 text-xs transition ${
                    form.dailyBudgetAED === v
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/10 text-white'
                      : 'border-line bg-surface text-slate-500 hover:text-slate-300'
                  }`}
                >
                  AED {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Bidding strategy
            </label>
            <div className="space-y-2">
              {BIDDING_STRATEGIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => patch({ biddingStrategy: s.value })}
                  className={[
                    'w-full rounded-[14px] border p-4 text-left transition',
                    form.biddingStrategy === s.value
                      ? 'border-[#4285F4]/40 bg-[#4285F4]/[0.07]'
                      : 'border-line bg-surface hover:border-white/20',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${form.biddingStrategy === s.value ? 'text-white' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                    {form.biddingStrategy === s.value && (
                      <Check className="h-4 w-4 text-[#4285F4]" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {form.biddingStrategy === 'TARGET_CPA' && (
            <div>
              <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Target CPA (AED)
              </label>
              <input
                type="number"
                min={10}
                value={form.targetCpaAED}
                onChange={(e) => patch({ targetCpaAED: Number(e.target.value) })}
                className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-sm text-white focus:border-[#4285F4]/40 focus:outline-none"
              />
              <p className="mt-1 text-sm text-slate-500">Target cost per lead acquisition in AED</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Start date (optional)
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => patch({ startDate: e.target.value })}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-sm text-white focus:border-[#4285F4]/40 focus:outline-none"
            />
            <p className="mt-1 text-sm text-slate-500">Leave blank to start from today</p>
          </div>
        </section>
      )}

      {/* ── Step 3: Keywords ─────────────────────────────────────────────── */}
      {step === 3 && (
        <section className="mt-10 space-y-6">
          {form.type !== 'SEARCH' && (
            <div className="rounded-[16px] border border-[#FBBC04]/20 bg-[#FBBC04]/[0.04] px-4 py-3.5 text-xs text-slate-400">
              Keywords are optional for {form.type.replace('_', ' ')} campaigns. Performance Max uses Google&apos;s signals automatically.
            </div>
          )}

          <div>
            <div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              UAE real estate keyword themes
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {UAE_REAL_ESTATE_KEYWORD_THEMES.filter((t) => t.id !== 'theme_negatives').map((theme) => {
                const selected = form.selectedThemes.includes(theme.id)
                return (
                  <button
                    key={theme.id}
                    onClick={() => toggleTheme(theme.id)}
                    className={[
                      'rounded-[14px] border p-4 text-left transition',
                      selected
                        ? 'border-[#4285F4]/40 bg-[#4285F4]/[0.07]'
                        : 'border-line bg-surface hover:border-white/20',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className={`text-xs font-semibold ${selected ? 'text-white' : 'text-slate-400'}`}>
                          {theme.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{theme.keywords.length} keywords</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium ${
                        theme.intent === 'high' ? 'bg-gold/10 text-[#F8E7AE] border-gold/20' : 'bg-sky-400/10 text-slate-400 border-sky-400/20'
                      }`}>
                        {theme.intent}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{theme.description}</p>
                  </button>
                )
              })}
            </div>
            {selectedThemeKwCount > 0 && (
              <p className="mt-2 text-sm text-[#4285F4]/70">{selectedThemeKwCount} keywords selected from themes</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Custom keywords (one per line)
            </label>
            <textarea
              value={form.customKeywords}
              onChange={(e) => patch({ customKeywords: e.target.value })}
              rows={6}
              placeholder={'[buy villa dubai]\n"off plan property"\nbuy apartment dubai hills'}
              className="w-full resize-none rounded-[14px] border border-line bg-surface px-4 py-3 text-xs font-mono text-white placeholder-white/20 focus:border-[#4285F4]/40 focus:outline-none"
            />
            <p className="mt-1 text-sm text-slate-500">
              [exact] · &quot;phrase&quot; · broad match. Google match type syntax.
            </p>
          </div>
        </section>
      )}

      {/* ── Step 4: Ad Copy ───────────────────────────────────────────────── */}
      {step === 4 && (
        <section className="mt-10 space-y-6">
          <div className="rounded-[16px] border border-line bg-surface px-4 py-3.5 text-xs text-slate-400">
            Google RSA: up to 15 headlines (30 chars each) and 4 descriptions (90 chars each). Google rotates them automatically.
            <Link
              href="/freehold-intelligence/lead-machine/google/ads/generate"
              className="ml-2 text-[#4285F4]/70 transition hover:text-[#4285F4]"
            >
              Use AI generator →
            </Link>
          </div>

          <div>
            <div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Headlines <span className="text-slate-600">(30 chars max each)</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const val = form.headlines[i] ?? ''
                const over = val.length > 30
                return (
                  <div key={i} className="relative">
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => updateHeadline(i, e.target.value)}
                      placeholder={`Headline ${i + 1}${i < 3 ? ' (recommended)' : ''}`}
                      maxLength={35}
                      className={`w-full rounded-[12px] border bg-surface px-4 py-2.5 pr-12 text-sm text-white placeholder-white/20 focus:outline-none ${
                        over ? 'border-red-400/40 focus:border-red-400/60' : 'border-line focus:border-[#4285F4]/40'
                      }`}
                    />
                    <span className={`absolute right-3 top-2.5 text-xs tabular-nums ${
                      over ? 'text-red-400' : val.length >= 27 ? 'text-[#FBBC04]' : 'text-slate-600'
                    }`}>
                      {val.length}/30
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Descriptions <span className="text-slate-600">(90 chars max each)</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => {
                const val = form.descriptions[i] ?? ''
                const over = val.length > 90
                return (
                  <div key={i} className="relative">
                    <textarea
                      value={val}
                      onChange={(e) => updateDescription(i, e.target.value)}
                      placeholder={`Description ${i + 1}`}
                      rows={2}
                      maxLength={95}
                      className={`w-full resize-none rounded-[12px] border bg-surface px-4 py-2.5 pr-12 text-sm text-white placeholder-white/20 focus:outline-none ${
                        over ? 'border-red-400/40' : 'border-line focus:border-[#4285F4]/40'
                      }`}
                    />
                    <span className={`absolute right-3 top-2.5 text-xs tabular-nums ${
                      over ? 'text-red-400' : val.length >= 82 ? 'text-[#FBBC04]' : 'text-slate-600'
                    }`}>
                      {val.length}/90
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Step 5: Review ───────────────────────────────────────────────── */}
      {step === 5 && (
        <section className="mt-10 space-y-4">
          {[
            { label: 'Listing',          value: listing?.projectName ?? '—' },
            { label: 'Campaign name',    value: form.campaignName            },
            { label: 'Type',             value: form.type.replace('_', ' ')  },
            { label: 'Bidding',          value: form.biddingStrategy.replace(/_/g, ' ') + (form.biddingStrategy === 'TARGET_CPA' ? ` · AED ${form.targetCpaAED} target` : '') },
            { label: 'Daily budget',     value: `AED ${form.dailyBudgetAED}` },
            { label: 'Keywords',         value: `${selectedThemeKwCount} from themes + ${form.customKeywords.split('\n').filter(Boolean).length} custom` },
            { label: 'Headlines',        value: `${form.headlines.filter(Boolean).length} headlines` },
            { label: 'Descriptions',     value: `${form.descriptions.filter(Boolean).length} descriptions` },
            { label: 'Landing URL',      value: form.finalUrl || '(none set)' },
          ].map((row) => (
            <div key={row.label} className="flex items-start gap-4 rounded-[14px] border border-line bg-surface px-4 py-3">
              <span className="w-28 shrink-0 text-sm text-slate-500">{row.label}</span>
              <span className="text-sm text-white font-medium truncate">{row.value}</span>
            </div>
          ))}

          <div className="rounded-[14px] border border-[#FBBC04]/15 bg-[#FBBC04]/[0.04] px-4 py-3 text-xs text-slate-400">
            Campaign will be created in <strong className="text-white">PAUSED</strong> state. Review in Google Ads Manager before activating to avoid unexpected spend.
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-[14px] border border-red-400/20 bg-red-400/[0.05] px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </section>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
          disabled={step === 1}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-slate-400 transition hover:text-white disabled:opacity-30"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {step < 5 ? (
          <button
            onClick={() => setStep((s) => Math.min(5, s + 1) as WizardStep)}
            disabled={
              (step === 1 && (!form.campaignName.trim() || !form.type)) ||
              (step === 2 && form.dailyBudgetAED < 50)
            }
            className="inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A97F5] disabled:opacity-50"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5A97F5] disabled:opacity-50"
          >
            {submitting ? 'Creating…' : <><Zap className="h-4 w-4" /> Launch campaign</>}
          </button>
        )}
      </div>

    </div>
  )
}
