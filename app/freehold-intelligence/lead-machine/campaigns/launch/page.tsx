'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, ChevronRight, ChevronLeft, Check, Zap, Target,
  DollarSign, Users, FileText, Rocket, Edit2, RefreshCw,
  Building2, TrendingUp, Globe, Shield, MapPin, ArrowLeft,
  CheckCircle2, AlertCircle, X, Plus,
} from 'lucide-react'
import { leadMachineListings, leadMachineLandings } from '@/src/features/freehold-intelligence/lead-machine'

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'meta' | 'google' | 'both'
type StrategyId = 'investor' | 'lifestyle' | 'golden_visa' | 'off_plan'
type BudgetPreset = 5000 | 10000 | 15000 | 25000 | 0
type Duration = 14 | 30 | 60

interface WizardState {
  propertyId:  string
  strategy:    StrategyId
  channel:     Channel
  budget:      number
  duration:    Duration
  locations:   string[]
  interests:   string[]
  useLookalike: boolean
  headline:    string
  body:        string
  cta:         string
  landingId:   string
  campaignName: string
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const STRATEGIES: {
  id: StrategyId; label: string; description: string
  cplRange: string; bestFor: string; icon: typeof Target
}[] = [
  {
    id: 'investor',
    label: 'Investor ROI Focus',
    description: 'Lead with yield %, payment plan, and capital appreciation. Best for HNW investors comparing opportunities.',
    cplRange: 'AED 70–90',
    bestFor: 'Off-plan & high-ROI ready units',
    icon: TrendingUp,
  },
  {
    id: 'lifestyle',
    label: 'End-User Lifestyle',
    description: 'Highlight community, amenities, and quality of life. Targets families and self-use buyers.',
    cplRange: 'AED 85–110',
    bestFor: 'Ready & villa communities',
    icon: Building2,
  },
  {
    id: 'golden_visa',
    label: 'Golden Visa Pathway',
    description: 'Position as a residency play — AED 2M+ properties with long-term UAE residency angle.',
    cplRange: 'AED 60–80',
    bestFor: 'Properties AED 2M+ across all types',
    icon: Shield,
  },
  {
    id: 'off_plan',
    label: 'Off-Plan Early Buyer',
    description: 'Emphasise low entry price, payment plan, and pre-handover capital appreciation.',
    cplRange: 'AED 55–75',
    bestFor: 'Under-construction and off-plan',
    icon: Globe,
  },
]

const LOCATIONS = [
  { key: 'uae',    label: 'UAE' },
  { key: 'gcc',    label: 'GCC' },
  { key: 'uk',     label: 'UK' },
  { key: 'europe', label: 'Europe' },
  { key: 'india',  label: 'India' },
  { key: 'usa',    label: 'USA' },
  { key: 'russia', label: 'Russia' },
  { key: 'china',  label: 'China' },
]

const INTERESTS = [
  { key: 'investors',   label: 'Real Estate Investors' },
  { key: 'expats',      label: 'UAE Expats' },
  { key: 'hnw',         label: 'High Net Worth' },
  { key: 'luxury',      label: 'Luxury Lifestyle' },
  { key: 'business',    label: 'Business Owners' },
  { key: 'mortgage',    label: 'Mortgage Seekers' },
  { key: 'goldenVisa',  label: 'Visa & Residency' },
  { key: 'offplan',     label: 'Off-Plan Buyers' },
]

const CTAS = ['Learn More', 'Get Details', 'Book Viewing', 'Download Brochure', 'Contact Us', 'Get Pricing']

const BUDGET_PRESETS: { value: BudgetPreset; label: string }[] = [
  { value: 5000,  label: 'AED 5K' },
  { value: 10000, label: 'AED 10K' },
  { value: 15000, label: 'AED 15K' },
  { value: 25000, label: 'AED 25K' },
]

// ─── Headline variants by strategy ────────────────────────────────────────────

const HEADLINES: Record<StrategyId, string[]> = {
  investor: [
    'Dubai Real Estate — 7% Annual Returns',
    'Invest in Dubai Property from AED 1.2M',
    'High-Yield Investment Opportunity in Dubai',
  ],
  lifestyle: [
    'Your Dream Home Awaits in Dubai',
    'Live in One of Dubai\'s Most Sought-After Communities',
    'Premium Living — Minutes from Everything',
  ],
  golden_visa: [
    'Own Dubai Property & Get 10-Year UAE Residency',
    'UAE Golden Visa Through Real Estate — AED 2M+',
    'Live, Work & Invest in Dubai — Golden Visa Ready',
  ],
  off_plan: [
    'Secure Your Unit Before Prices Rise',
    'Dubai Off-Plan — 20% Down, Move In 2026',
    'Early Buyer Pricing — Limited Units Available',
  ],
}

const BODY_COPIES: Record<StrategyId, string[]> = {
  investor: [
    'Freehold Property Dubai offers exclusive investment opportunities with proven ROI. Our portfolio spans Palm Jumeirah, Dubai Hills, and Business Bay — all with competitive payment plans and post-handover options.',
    'Generate consistent rental income from day one. Dubai\'s rental market is outperforming global benchmarks with zero income tax and long-term capital growth across all premium areas.',
  ],
  lifestyle: [
    'Discover homes designed around your lifestyle — championship golf, private beaches, world-class dining, and international schools all within your community. Freehold Property is your trusted guide.',
    'More than a home — a community. Dubai\'s master developments offer everything a family needs within minutes. Explore our exclusive selection of ready and off-plan properties.',
  ],
  golden_visa: [
    'The UAE Golden Visa grants 5 or 10-year renewable residency to property investors. Own AED 2M+ in Dubai real estate and secure your future in the UAE — no employer sponsorship required.',
    'Join thousands of global investors who call Dubai home. With the UAE Golden Visa, your property investment becomes a gateway to world-class living, business freedom, and long-term residency.',
  ],
  off_plan: [
    'Lock in today\'s launch price before handover appreciation. Our off-plan selection features transparent payment plans, RERA-regulated developers, and prime locations across Dubai\'s fastest-growing areas.',
    'Start with as little as 20% and pay the rest over 3–5 years. Dubai\'s off-plan market has consistently delivered 20–40% capital appreciation from launch to handover.',
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return 'AED ' + n.toLocaleString('en-US')
}

function estimateLeads(budget: number, strategy: StrategyId): { leads: number; cpl: number } {
  const cplMap: Record<StrategyId, number> = {
    investor: 80, lifestyle: 97, golden_visa: 70, off_plan: 65,
  }
  const cpl = cplMap[strategy]
  return { leads: Math.round(budget / cpl), cpl }
}

// ─── Inline editable text ─────────────────────────────────────────────────────

function EditableField({
  value, onChange, rows = 1, placeholder, className = '',
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  useEffect(() => { setDraft(value) }, [value])

  if (!editing) {
    return (
      <div
        className={`group relative cursor-text rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[13px] leading-[1.65] text-white/80 transition hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/[0.03] ${className}`}
        onClick={() => setEditing(true)}
      >
        {value || <span className="text-white/25">{placeholder}</span>}
        <button
          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-white/65"
          onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        >
          <Edit2 className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/[0.04] ${className}`}>
      <textarea
        ref={ref}
        rows={rows}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-[1.65] text-white/85 focus:outline-none"
      />
      <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2">
        <button
          onClick={() => { onChange(draft); setEditing(false) }}
          className="rounded-lg bg-[#D4AF37]/15 px-3 py-1 text-[12px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/25"
        >
          Apply
        </button>
        <button
          onClick={() => { setDraft(value); setEditing(false) }}
          className="rounded-lg px-3 py-1 text-[12px] text-white/35 transition hover:text-white/65"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Step header ─────────────────────────────────────────────────────────────

const STEP_LABELS = ['Property', 'Strategy', 'Budget', 'Audience', 'Creative', 'Landing', 'Launch']

function StepHeader({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1
          const done = n < step
          const active = n === step
          return (
            <div key={n} className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition',
                  done   ? 'bg-[#D4AF37] text-[#0B0F1A]' :
                  active ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37]' :
                           'bg-white/[0.06] text-white/30',
                ].join(' ')}>
                  {done ? <Check className="h-3 w-3" /> : n}
                </div>
                <span className={[
                  'text-[13px] font-medium whitespace-nowrap',
                  active ? 'text-white/90' : done ? 'text-white/50' : 'text-white/25',
                ].join(' ')}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-8 shrink-0 ${n < step ? 'bg-[#D4AF37]/40' : 'bg-white/[0.07]'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 h-0.5 w-full rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-[#D4AF37] transition-all duration-500"
          style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── AI Badge ─────────────────────────────────────────────────────────────────

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[11px] font-medium text-[#D4AF37]">
      <Sparkles className="h-2.5 w-2.5" /> AI Pick
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const AI_RECOMMENDED_PROPERTY = 'lm_hills_002'
const AI_RECOMMENDED_STRATEGY: StrategyId = 'investor'
const AI_RECOMMENDED_CHANNEL: Channel = 'both'
const AI_RECOMMENDED_BUDGET = 15000
const AI_RECOMMENDED_DURATION: Duration = 30
const AI_RECOMMENDED_LOCATIONS = ['uae', 'gcc', 'uk']
const AI_RECOMMENDED_INTERESTS = ['investors', 'hnw', 'luxury']

export default function CampaignLaunchPage() {
  const [step, setStep] = useState(1)
  const [launched, setLaunched] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [headlineIdx, setHeadlineIdx] = useState(0)
  const [bodyIdx, setBodyIdx] = useState(0)

  const [state, setState] = useState<WizardState>({
    propertyId:   AI_RECOMMENDED_PROPERTY,
    strategy:     AI_RECOMMENDED_STRATEGY,
    channel:      AI_RECOMMENDED_CHANNEL,
    budget:       AI_RECOMMENDED_BUDGET,
    duration:     AI_RECOMMENDED_DURATION,
    locations:    AI_RECOMMENDED_LOCATIONS,
    interests:    AI_RECOMMENDED_INTERESTS,
    useLookalike: true,
    headline:     HEADLINES[AI_RECOMMENDED_STRATEGY][0],
    body:         BODY_COPIES[AI_RECOMMENDED_STRATEGY][0],
    cta:          'Learn More',
    landingId:    '',
    campaignName: '',
  })

  function set<K extends keyof WizardState>(key: K, val: WizardState[K]) {
    setState((s) => ({ ...s, [key]: val }))
  }

  const selectedProperty = leadMachineListings.find((l) => l.id === state.propertyId)
  const selectedLanding  = leadMachineLandings.find((l) => l.id === state.landingId)
  const est = estimateLeads(state.budget, state.strategy)

  // When strategy changes, update copy accordingly
  function changeStrategy(id: StrategyId) {
    set('strategy', id)
    setState((s) => ({
      ...s,
      strategy: id,
      headline: HEADLINES[id][0],
      body:     BODY_COPIES[id][0],
    }))
    setHeadlineIdx(0)
    setBodyIdx(0)
  }

  function nextHeadline() {
    const next = (headlineIdx + 1) % HEADLINES[state.strategy].length
    setHeadlineIdx(next)
    set('headline', HEADLINES[state.strategy][next])
  }

  function nextBody() {
    const next = (bodyIdx + 1) % BODY_COPIES[state.strategy].length
    setBodyIdx(next)
    set('body', BODY_COPIES[state.strategy][next])
  }

  function toggleLocation(key: string) {
    set('locations', state.locations.includes(key)
      ? state.locations.filter((k) => k !== key)
      : [...state.locations, key])
  }

  function toggleInterest(key: string) {
    set('interests', state.interests.includes(key)
      ? state.interests.filter((k) => k !== key)
      : [...state.interests, key])
  }

  function handleLaunch() {
    if (launching) return
    const prop = selectedProperty
    const name = state.campaignName.trim() ||
      `${prop?.projectName ?? 'Campaign'} — ${STRATEGIES.find((s) => s.id === state.strategy)?.label} — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    set('campaignName', name)
    setLaunching(true)
    setTimeout(() => { setLaunching(false); setLaunched(true) }, 1800)
  }

  // ── Launched state ──────────────────────────────────────────────────────────
  if (launched) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10">
          <Rocket className="h-7 w-7 text-[#D4AF37]" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white/90">Campaign Launched</h2>
        <p className="mt-2 text-[13px] text-white/45 max-w-sm">
          {state.campaignName} is now live and running on {state.channel === 'both' ? 'Meta & Google Ads' : state.channel === 'meta' ? 'Meta Ads' : 'Google Ads'}.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Daily Budget',     value: fmt(Math.round(state.budget / state.duration)) },
            { label: 'Est. Monthly Leads', value: `~${est.leads}` },
            { label: 'Target CPL',        value: `AED ${est.cpl}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/30">{label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[#D4AF37]">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <Link
            href="/freehold-intelligence/lead-machine/campaigns"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] font-medium text-white/65 transition hover:border-white/20 hover:text-white"
          >
            View Campaigns
          </Link>
          <button
            onClick={() => { setLaunched(false); setStep(1); setState({ propertyId: AI_RECOMMENDED_PROPERTY, strategy: AI_RECOMMENDED_STRATEGY, channel: AI_RECOMMENDED_CHANNEL, budget: AI_RECOMMENDED_BUDGET, duration: AI_RECOMMENDED_DURATION, locations: AI_RECOMMENDED_LOCATIONS, interests: AI_RECOMMENDED_INTERESTS, useLookalike: true, headline: HEADLINES[AI_RECOMMENDED_STRATEGY][0], body: BODY_COPIES[AI_RECOMMENDED_STRATEGY][0], cta: 'Learn More', landingId: '', campaignName: '' }) }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-5 py-2.5 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15"
          >
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </button>
        </div>
      </div>
    )
  }

  // ── Step panels ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Back link */}
      <Link
        href="/freehold-intelligence/lead-machine/campaigns"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/35 transition hover:text-white/65"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white/90">Launch Campaign</h1>
        <p className="mt-1 text-[13px] text-white/40">AI-guided setup — review each step and adjust if needed</p>
      </div>

      <StepHeader step={step} />

      {/* ── Step 1: Property ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <SectionLabel icon={Building2} label="Which property are you launching for?" />
          <div className="space-y-3">
            {leadMachineListings.map((listing) => {
              const isSelected = state.propertyId === listing.id
              const isRecommended = listing.id === AI_RECOMMENDED_PROPERTY
              const canLaunch = listing.adReadinessScore >= 50
              return (
                <button
                  key={listing.id}
                  onClick={() => canLaunch && set('propertyId', listing.id)}
                  disabled={!canLaunch}
                  className={[
                    'w-full rounded-2xl border p-4 text-left transition',
                    isSelected
                      ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]'
                      : canLaunch
                      ? 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
                      : 'border-white/[0.04] bg-white/[0.01] opacity-45 cursor-not-allowed',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white/90 text-[14px]">{listing.projectName}</span>
                        {isRecommended && <AIBadge />}
                        {!canLaunch && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/[0.06] px-2 py-0.5 text-[11px] text-red-400">
                            <AlertCircle className="h-2.5 w-2.5" /> Not ready
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[13px] text-white/40">{listing.area} · {listing.developer}</div>
                      {!canLaunch && listing.missingRequirements.length > 0 && (
                        <div className="mt-1.5 text-[12px] text-white/30">
                          Missing: {listing.missingRequirements.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="text-right">
                        <div className="text-[12px] text-white/30">Ad Readiness</div>
                        <div className={`text-[15px] font-semibold tabular-nums ${listing.adReadinessScore >= 70 ? 'text-[#D4AF37]' : listing.adReadinessScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {listing.adReadinessScore}%
                        </div>
                      </div>
                      {listing.startingPrice && (
                        <div className="text-[12px] text-white/35">from {fmt(listing.startingPrice)}</div>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#D4AF37]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Strategy ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <SectionLabel icon={Target} label="What's the campaign strategy?" sub="AI has selected the highest-converting angle for this property." />
          <div className="space-y-3">
            {STRATEGIES.map((s) => {
              const Icon = s.icon
              const isSelected = state.strategy === s.id
              const isRecommended = s.id === AI_RECOMMENDED_STRATEGY
              return (
                <button
                  key={s.id}
                  onClick={() => changeStrategy(s.id)}
                  className={[
                    'w-full rounded-2xl border p-4 text-left transition',
                    isSelected
                      ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${isSelected ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10' : 'border-white/[0.08] bg-white/[0.04]'}`}>
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-[#D4AF37]' : 'text-white/40'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-[14px] ${isSelected ? 'text-white' : 'text-white/80'}`}>{s.label}</span>
                        {isRecommended && <AIBadge />}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/45">{s.description}</p>
                      <div className="mt-2.5 flex items-center gap-4 text-[12px] text-white/35">
                        <span>Est. CPL: <span className="text-white/55 font-medium">{s.cplRange}</span></span>
                        <span className="h-3 w-px bg-white/[0.10]" />
                        <span>{s.bestFor}</span>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-[#D4AF37] shrink-0" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Budget & Channels ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Channels */}
          <div>
            <SectionLabel icon={Zap} label="Which channels?" sub="AI recommends running both for optimal coverage." />
            <div className="mt-3 grid grid-cols-3 gap-3">
              {([
                { key: 'meta',   label: 'Meta Ads',    sub: 'Instagram + Facebook' },
                { key: 'google', label: 'Google Ads',  sub: 'Search + Performance Max' },
                { key: 'both',   label: 'Meta + Google', sub: 'Recommended · best coverage' },
              ] as const).map((c) => {
                const isSelected = state.channel === c.key
                const isRec = c.key === AI_RECOMMENDED_CHANNEL
                return (
                  <button
                    key={c.key}
                    onClick={() => set('channel', c.key)}
                    className={[
                      'rounded-2xl border p-3.5 text-center transition',
                      isSelected
                        ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    <div className={`text-[13px] font-medium ${isSelected ? 'text-white' : 'text-white/70'}`}>{c.label}</div>
                    <div className="mt-0.5 text-[12px] text-white/35">{c.sub}</div>
                    {isRec && <div className="mt-1.5 flex justify-center"><AIBadge /></div>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Budget */}
          <div>
            <SectionLabel icon={DollarSign} label="Monthly budget" sub="AI recommends AED 15K based on historical CPL performance." />
            <div className="mt-3 flex flex-wrap gap-2">
              {BUDGET_PRESETS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => set('budget', value)}
                  className={[
                    'rounded-xl border px-4 py-2 text-[13px] font-medium transition',
                    state.budget === value
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white/75',
                  ].join(' ')}
                >
                  {label}
                  {value === AI_RECOMMENDED_BUDGET && <span className="ml-1.5 text-[11px] text-[#D4AF37]/60">AI</span>}
                </button>
              ))}
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2">
                <span className="text-[13px] text-white/30">AED</span>
                <input
                  type="number"
                  value={state.budget}
                  onChange={(e) => set('budget', Number(e.target.value))}
                  className="w-20 bg-transparent text-[13px] text-white/75 focus:outline-none"
                  placeholder="Custom"
                />
              </div>
            </div>
          </div>

          {/* Duration */}
          <div>
            <SectionLabel icon={Target} label="Campaign duration" />
            <div className="mt-3 flex gap-2">
              {([14, 30, 60] as Duration[]).map((d) => (
                <button
                  key={d}
                  onClick={() => set('duration', d)}
                  className={[
                    'rounded-xl border px-4 py-2 text-[13px] font-medium transition',
                    state.duration === d
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white/75',
                  ].join(' ')}
                >
                  {d} days
                  {d === AI_RECOMMENDED_DURATION && <span className="ml-1.5 text-[11px] text-[#D4AF37]/60">AI</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Live estimate */}
          <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#D4AF37]/70">
              <Sparkles className="h-3.5 w-3.5" /> Projection
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label: 'Total Budget',  value: fmt(state.budget) },
                { label: 'Est. Leads',    value: `~${est.leads}` },
                { label: 'Target CPL',    value: `AED ${est.cpl}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-white/30">{label}</div>
                  <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-white/85">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Audience ─────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Locations */}
          <div>
            <SectionLabel icon={Globe} label="Target locations" sub="AI targets UAE + GCC first, expand to UK/Europe for luxury properties." />
            <div className="mt-3 flex flex-wrap gap-2">
              {LOCATIONS.map((loc) => {
                const on = state.locations.includes(loc.key)
                return (
                  <button
                    key={loc.key}
                    onClick={() => toggleLocation(loc.key)}
                    className={[
                      'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
                      on
                        ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70',
                    ].join(' ')}
                  >
                    {loc.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interests */}
          <div>
            <SectionLabel icon={Users} label="Audience interests" sub="Layered targeting increases lead quality and reduces wasted spend." />
            <div className="mt-3 flex flex-wrap gap-2">
              {INTERESTS.map((int) => {
                const on = state.interests.includes(int.key)
                return (
                  <button
                    key={int.key}
                    onClick={() => toggleInterest(int.key)}
                    className={[
                      'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
                      on
                        ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70',
                    ].join(' ')}
                  >
                    {int.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lookalike */}
          <div>
            <SectionLabel icon={Users} label="CRM lookalike audience" sub="Build a lookalike from your existing 415 CRM leads." />
            <button
              onClick={() => set('useLookalike', !state.useLookalike)}
              className={[
                'mt-3 flex items-center gap-3 rounded-2xl border p-4 w-full text-left transition',
                state.useLookalike
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.04]'
                  : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]',
              ].join(' ')}
            >
              <div className={[
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition',
                state.useLookalike ? 'border-[#D4AF37] bg-[#D4AF37]' : 'border-white/[0.20] bg-transparent',
              ].join(' ')}>
                {state.useLookalike && <Check className="h-3 w-3 text-[#0B0F1A]" />}
              </div>
              <div>
                <div className="text-[13px] font-medium text-white/80">Use CRM Lookalike Audience</div>
                <div className="mt-0.5 text-[12px] text-white/40">Based on 415 existing leads · 1% similarity · est. 180K reach</div>
              </div>
              {state.useLookalike && <AIBadge />}
            </button>
          </div>

          {/* Reach estimate */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="text-[12px] text-white/35">Estimated Audience Reach</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-white/85">
              {(180000 + state.locations.length * 22000 + state.interests.length * 8500).toLocaleString()}
            </div>
            <div className="mt-1 text-[12px] text-white/30">{state.locations.length} locations · {state.interests.length} interests{state.useLookalike ? ' · lookalike' : ''}</div>
          </div>
        </div>
      )}

      {/* ── Step 5: Creative ─────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-6">
          {/* Headline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel icon={FileText} label="Ad headline" />
              <button
                onClick={nextHeadline}
                className="inline-flex items-center gap-1.5 text-[12px] text-white/35 transition hover:text-[#D4AF37]"
              >
                <RefreshCw className="h-3 w-3" /> Next option
              </button>
            </div>
            <div className="space-y-2">
              {HEADLINES[state.strategy].map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setHeadlineIdx(i); set('headline', h) }}
                  className={[
                    'w-full rounded-xl border px-4 py-3 text-left text-[13px] font-medium transition',
                    state.headline === h
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.06] text-white'
                      : 'border-white/[0.07] text-white/55 hover:border-white/[0.14] hover:text-white/75',
                  ].join(' ')}
                >
                  <span className="mr-2 text-[11px] text-white/25">{i + 1}</span>{h}
                  {i === 0 && <span className="ml-2 text-[11px] text-[#D4AF37]/60">AI Pick</span>}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <EditableField
                value={state.headline}
                onChange={(v) => set('headline', v)}
                rows={1}
                placeholder="or type a custom headline…"
                className="!py-2"
              />
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel icon={FileText} label="Ad body copy" />
              <button
                onClick={nextBody}
                className="inline-flex items-center gap-1.5 text-[12px] text-white/35 transition hover:text-[#D4AF37]"
              >
                <RefreshCw className="h-3 w-3" /> Rephrase
              </button>
            </div>
            <EditableField
              value={state.body}
              onChange={(v) => set('body', v)}
              rows={4}
              placeholder="Ad body text…"
            />
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-white/25">
              <Sparkles className="h-3 w-3 text-[#D4AF37]/50" />
              AI-generated · click to edit inline · hit Rephrase for another version
            </div>
          </div>

          {/* CTA */}
          <div>
            <SectionLabel icon={Target} label="Call-to-action button" />
            <div className="mt-3 flex flex-wrap gap-2">
              {CTAS.map((cta) => (
                <button
                  key={cta}
                  onClick={() => set('cta', cta)}
                  className={[
                    'rounded-xl border px-3.5 py-1.5 text-[13px] font-medium transition',
                    state.cta === cta
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : 'border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70',
                  ].join(' ')}
                >
                  {cta}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="border-b border-white/[0.05] bg-white/[0.02] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-white/30">
              Ad Preview
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                </div>
                <div>
                  <div className="text-[12px] font-medium text-white/80">Freehold Property</div>
                  <div className="text-[11px] text-white/30">Sponsored</div>
                </div>
              </div>
              <div className="h-24 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
                <span className="text-[12px] text-white/20">Property image</span>
              </div>
              <div className="text-[13px] font-semibold text-white/90 leading-tight">{state.headline}</div>
              <div className="mt-1 text-[12px] text-white/50 leading-snug line-clamp-2">{state.body}</div>
              <div className="mt-2.5 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white">{state.cta}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 6: Landing Page ─────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-4">
          <SectionLabel icon={Globe} label="Select landing page" sub="The destination for all ad clicks. Must be live before launch." />

          {/* Existing landings for selected property */}
          {leadMachineLandings.filter((l) => !state.propertyId || l.projectId === selectedProperty?.projectId).map((landing) => {
            const isSelected = state.landingId === landing.id
            const isLive = landing.status === 'Landing Active' || landing.status === 'Approved'
            return (
              <button
                key={landing.id}
                onClick={() => set('landingId', landing.id)}
                className={[
                  'w-full rounded-2xl border p-4 text-left transition',
                  isSelected
                    ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white/85 text-[13px]">{landing.landingUrl}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        isLive
                          ? 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]'
                          : 'border-amber-400/20 bg-amber-400/10 text-amber-400'
                      }`}>
                        {landing.status}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${landing.completion}%` }} />
                      </div>
                      <span className="text-[12px] text-white/40">{landing.completion}% complete</span>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-[#D4AF37] shrink-0" />}
                </div>
              </button>
            )
          })}

          {/* No landing found for this property */}
          {leadMachineLandings.filter((l) => l.projectId === selectedProperty?.projectId).length === 0 && (
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-5 text-center">
              <AlertCircle className="h-5 w-5 text-amber-400 mx-auto mb-2" />
              <div className="text-[13px] font-medium text-amber-300">No landing page found for this property</div>
              <div className="mt-1 text-[12px] text-white/40">Generate one first, then return to launch the campaign.</div>
              <Link
                href={`/freehold-intelligence/inventory/${state.propertyId}/generate`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-2 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate Landing Page
              </Link>
            </div>
          )}

          {/* Use external URL */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
            <div className="text-[13px] font-medium text-white/55 mb-2">Or use an external URL</div>
            <input
              type="text"
              placeholder="https://freeholdproperty.ae/..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/75 placeholder:text-white/25 focus:border-[#D4AF37]/30 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* ── Step 7: Review & Launch ───────────────────────────────────────────── */}
      {step === 7 && (
        <div className="space-y-6">
          {/* Campaign name */}
          <div>
            <SectionLabel icon={Rocket} label="Campaign name" sub="Auto-generated — click to edit." />
            <div className="mt-3">
              <EditableField
                value={state.campaignName || `${selectedProperty?.projectName ?? 'Campaign'} — ${STRATEGIES.find((s) => s.id === state.strategy)?.label} — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                onChange={(v) => set('campaignName', v)}
                rows={1}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05] overflow-hidden">
            {[
              { label: 'Property',   value: selectedProperty?.projectName ?? '—' },
              { label: 'Strategy',   value: STRATEGIES.find((s) => s.id === state.strategy)?.label ?? '—' },
              { label: 'Channels',   value: state.channel === 'both' ? 'Meta Ads + Google Ads' : state.channel === 'meta' ? 'Meta Ads' : 'Google Ads' },
              { label: 'Budget',     value: `${fmt(state.budget)} / ${state.duration} days` },
              { label: 'Locations',  value: LOCATIONS.filter((l) => state.locations.includes(l.key)).map((l) => l.label).join(', ') || '—' },
              { label: 'Interests',  value: INTERESTS.filter((i) => state.interests.includes(i.key)).map((i) => i.label).slice(0, 3).join(', ') + (state.interests.length > 3 ? ` +${state.interests.length - 3}` : '') },
              { label: 'Lookalike',  value: state.useLookalike ? 'Yes — from CRM leads' : 'No' },
              { label: 'Headline',   value: state.headline },
              { label: 'CTA',        value: state.cta },
              { label: 'Landing',    value: selectedLanding ? selectedLanding.landingUrl : 'External URL' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 px-5 py-3">
                <span className="text-[13px] text-white/35 shrink-0 w-24">{label}</span>
                <span className="text-[13px] text-white/75 text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Projection */}
          <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-5">
            <div className="flex items-center gap-1.5 mb-4 text-[12px] font-medium text-[#D4AF37]/70">
              <Sparkles className="h-3.5 w-3.5" /> AI Projection
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Total Budget',     value: fmt(state.budget) },
                { label: 'Est. Leads',       value: `~${est.leads}` },
                { label: 'Target CPL',       value: `AED ${est.cpl}` },
                { label: 'Daily Spend',      value: fmt(Math.round(state.budget / state.duration)) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-white/30">{label}</div>
                  <div className="mt-1 text-[15px] font-semibold tabular-nums text-white/85">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch button */}
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/15 py-4 text-[15px] font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/20 disabled:opacity-60"
          >
            {launching ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#D4AF37]/40 border-t-[#D4AF37]" />
                Launching…
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" /> Launch Campaign
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1) as typeof step)}
          disabled={step === 1}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-white/45 transition hover:border-white/20 hover:text-white/75 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {step < 7 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as typeof step)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-5 py-2.5 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ─── Shared section label ────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label, sub }: { icon: typeof Target; label: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#D4AF37]/70" />
        <span className="text-[14px] font-semibold text-white/85">{label}</span>
      </div>
      {sub && <p className="mt-0.5 pl-6 text-[12px] text-white/35">{sub}</p>}
    </div>
  )
}
