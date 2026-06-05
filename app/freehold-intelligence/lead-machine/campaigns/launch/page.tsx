'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, ChevronRight, ChevronLeft, Check, Zap, Target,
  DollarSign, Users, FileText, Rocket, Edit2, RefreshCw,
  Building2, TrendingUp, Globe, Shield, ArrowLeft,
  CheckCircle2, AlertCircle, Plus, Info,
} from 'lucide-react'
import { leadMachineListings, leadMachineLandings } from '@/src/features/freehold-intelligence/lead-machine'
import type { LeadMachineListing } from '@/src/features/freehold-intelligence/lead-machine'
import { financeSummary } from '@/src/features/freehold-intelligence/finance'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Channel    = 'meta' | 'google' | 'both'
type StrategyId = 'investor' | 'lifestyle' | 'golden_visa' | 'off_plan'
type Duration   = 14 | 30 | 60

interface WizardState {
  propertyId:   string
  strategy:     StrategyId
  channel:      Channel
  budget:       number
  duration:     Duration
  locations:    string[]
  interests:    string[]
  useLookalike: boolean
  headline:     string
  body:         string
  cta:          string
  landingId:    string
  landingUrl:   string
  campaignName: string
}

// ─── Static reference data ─────────────────────────────────────────────────────

const STRATEGIES: {
  id: StrategyId; label: string; description: string
  cplBase: number; bestFor: string; icon: typeof Target
}[] = [
  {
    id: 'investor',
    label: 'Investor ROI Focus',
    description: 'Lead with yield %, payment plan, and capital appreciation. Best for HNW investors comparing opportunities.',
    cplBase: 80, bestFor: 'High-ROI ready & off-plan',
    icon: TrendingUp,
  },
  {
    id: 'lifestyle',
    label: 'End-User Lifestyle',
    description: 'Highlight community, amenities, and quality of life. Targets families and self-use buyers.',
    cplBase: 97, bestFor: 'Ready & villa communities',
    icon: Building2,
  },
  {
    id: 'golden_visa',
    label: 'Golden Visa Pathway',
    description: 'Position as a residency play — AED 2M+ properties with long-term UAE residency angle.',
    cplBase: 70, bestFor: 'AED 2M+ any property type',
    icon: Shield,
  },
  {
    id: 'off_plan',
    label: 'Off-Plan Early Buyer',
    description: 'Emphasise low entry price, payment plan, and pre-handover capital appreciation.',
    cplBase: 65, bestFor: 'Under-construction & off-plan',
    icon: Globe,
  },
]

const LOCATIONS = [
  { key: 'uae',    label: 'UAE',     reach: 95_000 },
  { key: 'gcc',    label: 'GCC',     reach: 42_000 },
  { key: 'uk',     label: 'UK',      reach: 38_000 },
  { key: 'europe', label: 'Europe',  reach: 35_000 },
  { key: 'india',  label: 'India',   reach: 51_000 },
  { key: 'russia', label: 'Russia',  reach: 28_000 },
  { key: 'usa',    label: 'USA',     reach: 22_000 },
  { key: 'china',  label: 'China',   reach: 18_000 },
]

const INTERESTS = [
  { key: 'investors',  label: 'Real Estate Investors' },
  { key: 'expats',     label: 'UAE Expats' },
  { key: 'hnw',        label: 'High Net Worth' },
  { key: 'luxury',     label: 'Luxury Lifestyle' },
  { key: 'business',   label: 'Business Owners' },
  { key: 'mortgage',   label: 'Mortgage Seekers' },
  { key: 'goldenVisa', label: 'Visa & Residency' },
  { key: 'offplan',    label: 'Off-Plan Buyers' },
]

const CTAS = ['Learn More', 'Get Details', 'Book Viewing', 'Download Brochure', 'Contact Us', 'Get Pricing']

// ─── AI Intelligence Engine ────────────────────────────────────────────────────

/** Score each listing for launch readiness and pick the best */
function computeAIProperty(listings: LeadMachineListing[]): string {
  const launchable = listings.filter((l) => l.adReadinessScore >= 50 && l.blockerStatus !== 'Blocked')
  if (!launchable.length) return listings[0]?.id ?? ''
  return launchable.sort((a, b) => {
    const score = (l: LeadMachineListing) =>
      l.adReadinessScore * 0.45 +
      l.opportunityScore  * 0.35 +
      (l.blockerStatus === 'Clear'       ? 15 : 0) +
      (l.landingStatus  === 'Landing Active' ? 10 : 0)
    return score(b) - score(a)
  })[0].id
}

/** Derive best strategy from property characteristics */
function computeAIStrategy(listing: LeadMachineListing): StrategyId {
  const price = listing.startingPrice ?? 0
  const plan  = (listing.paymentPlan ?? '').toLowerCase()
  if (price >= 2_000_000 && listing.adReadinessScore >= 70) return 'golden_visa'
  if (plan.includes('off') || plan.includes('plan') || plan.includes('construction')) return 'off_plan'
  if (listing.opportunityScore >= 80) return 'investor'
  return 'lifestyle'
}

/** Recommend channel mix based on strategy + budget */
function computeAIChannel(strategy: StrategyId, budget: number): Channel {
  if (budget < 8_000) return 'meta'
  if (strategy === 'golden_visa' || strategy === 'investor') return 'both'
  return 'meta'
}

/** Recommend monthly budget targeting ~200 leads based on real CPL data */
function computeAIBudget(strategy: StrategyId): number {
  const accountCpl = financeSummary.avgCpl30d          // real historical average
  const stratCpl   = STRATEGIES.find((s) => s.id === strategy)?.cplBase ?? accountCpl
  const blendedCpl = (accountCpl + stratCpl) / 2
  const target     = Math.ceil((200 * blendedCpl) / 5000) * 5000 // round to nearest 5K
  return Math.min(Math.max(target, 5_000), 25_000)
}

/** Location set by strategy */
function computeAILocations(strategy: StrategyId): string[] {
  switch (strategy) {
    case 'golden_visa': return ['uae', 'india', 'russia', 'uk']
    case 'investor':    return ['uae', 'gcc', 'uk', 'europe']
    case 'lifestyle':   return ['uae', 'gcc']
    case 'off_plan':    return ['uae', 'gcc', 'india']
  }
}

/** Interest set by strategy */
function computeAIInterests(strategy: StrategyId): string[] {
  switch (strategy) {
    case 'golden_visa': return ['goldenVisa', 'hnw', 'investors']
    case 'investor':    return ['investors', 'hnw', 'luxury']
    case 'lifestyle':   return ['expats', 'luxury', 'business']
    case 'off_plan':    return ['offplan', 'investors', 'mortgage']
  }
}

/** Generate property-specific headline variants */
function generateHeadlines(listing: LeadMachineListing, strategy: StrategyId): string[] {
  const name  = listing.projectName
  const area  = listing.area
  const dev   = listing.developer
  const price = listing.startingPrice
    ? `AED ${(listing.startingPrice / 1_000_000).toFixed(1)}M`
    : null
  const plan  = listing.paymentPlan

  switch (strategy) {
    case 'investor':
      return [
        price
          ? `${name} — ${price} | High-Yield Dubai Investment`
          : `${name} — Premium Investment in ${area}`,
        price && plan
          ? `Invest in ${area} from ${price} — ${plan}`
          : `${dev}'s ${name} | Strong ROI in Dubai`,
        `${area} Property Investment — ${dev} | ${price ?? 'Premium Pricing'}`,
      ]
    case 'lifestyle':
      return [
        `Your Home in ${area} — ${name} by ${dev}`,
        price
          ? `Live in ${area} from ${price} — ${name}`
          : `${name} — Premium Living in ${area}`,
        `${dev}'s ${name} | ${area} Community Living`,
      ]
    case 'golden_visa':
      return [
        price
          ? `${price} Dubai Property + 10-Year UAE Residency`
          : `${name} — UAE Golden Visa Eligible Property`,
        `${name} in ${area} — Own & Get UAE Golden Visa`,
        `${dev}'s ${name} | UAE Residency Through Property Investment`,
      ]
    case 'off_plan':
      return [
        plan
          ? `${name} — ${plan} | ${area} Off-Plan`
          : `${name} — ${area} Off-Plan | Limited Units`,
        price
          ? `Secure ${area} Property from ${price} | ${dev}`
          : `Early Buyer Pricing — ${name} by ${dev}`,
        `${dev}'s ${name} | Pre-Handover Pricing in ${area}`,
      ]
  }
}

/** Generate property-specific body copy variants */
function generateBodyCopy(listing: LeadMachineListing, strategy: StrategyId): string[] {
  const name  = listing.projectName
  const area  = listing.area
  const dev   = listing.developer
  const price = listing.startingPrice
    ? `AED ${(listing.startingPrice / 1_000_000).toFixed(1)}M`
    : null
  const plan  = listing.paymentPlan

  switch (strategy) {
    case 'investor':
      return [
        `${name} by ${dev} offers a compelling investment case in ${area}${price ? `, starting from ${price}` : ''}${plan ? ` with a ${plan} payment plan` : ''}. Dubai's rental market continues to outperform global benchmarks with zero income tax and long-term capital growth across premium locations.`,
        `With ${dev}'s track record in ${area}, ${name} delivers consistent rental returns and strong capital appreciation. Freehold ownership, flexible payment plans, and a growing expat population make this one of Dubai's most active investment corridors.`,
      ]
    case 'lifestyle':
      return [
        `Discover ${name} — ${dev}'s signature development in ${area}. ${price ? `Starting from ${price}, it` : 'It'} combines premium design with the amenities and connectivity that define Dubai living. Whether for family, investment, or both — this is your next address.`,
        `${area} is one of Dubai's most sought-after addresses, and ${name} by ${dev} puts you right at the heart of it. ${price ? `From ${price}` : 'Competitively priced'}${plan ? ` with ${plan}` : ''} — find out why residents never want to leave.`,
      ]
    case 'golden_visa':
      return [
        `${name} by ${dev} in ${area}${price ? ` starts from ${price}` : ''} — qualifying for the UAE Golden Visa with 5 or 10-year renewable residency. No employer sponsorship, sponsor your family, and build long-term roots in the UAE's most dynamic city.`,
        `The UAE Golden Visa is your path to long-term residency — and ${name} in ${area} is your vehicle to get there. ${price ? `With properties from ${price}` : 'Competitively priced'}, Freehold Property will guide you from first enquiry to visa approval.`,
      ]
    case 'off_plan':
      return [
        `${name} by ${dev} in ${area}${price ? ` is available from ${price}` : ''} — lock in today's launch price before handover appreciation. ${plan ? `The ${plan} payment plan makes entry accessible` : 'Flexible payment plans available'}, with RERA-backed developer protections throughout construction.`,
        `Early investors in ${area} have consistently seen strong pre-handover appreciation, and ${name} by ${dev} follows that trend. ${price ? `From ${price}` : 'Competitive pricing'}${plan ? ` with ${plan}` : ''} — secure your unit before the next price adjustment.`,
      ]
  }
}

/** Per-step AI reasoning explaining the recommendation */
function getAIReason(step: number, state: WizardState, listing?: LeadMachineListing): string {
  switch (step) {
    case 1:
      if (!listing) return 'No launchable properties found.'
      return `${listing.projectName} scores highest: ${listing.adReadinessScore}% ad readiness + ${listing.opportunityScore} opportunity score with ${listing.blockerStatus === 'Clear' ? 'no blockers' : listing.blockerStatus.toLowerCase()}.`
    case 2: {
      const strat = STRATEGIES.find((s) => s.id === state.strategy)
      const price = listing?.startingPrice
      if (state.strategy === 'golden_visa' && price && price >= 2_000_000)
        return `At ${price >= 2_000_000 ? `AED ${(price / 1_000_000).toFixed(1)}M` : ''}, this property qualifies for the Golden Visa — a highly searched angle with lower CPL (AED ${strat?.cplBase}).`
      if (state.strategy === 'off_plan')
        return `Payment plan structure signals an off-plan play — early buyer messaging historically delivers the lowest CPL on this asset class (est. AED ${strat?.cplBase}).`
      return `Based on ${listing?.area ?? 'this area'}'s profile and ${listing?.developer ?? 'developer'}'s reputation, the investor ROI angle converts best — est. AED ${strat?.cplBase} CPL vs your account avg of AED ${financeSummary.avgCpl30d}.`
    }
    case 3: {
      const targetLeads = Math.round(state.budget / (STRATEGIES.find((s) => s.id === state.strategy)?.cplBase ?? 80))
      return `Budget of ${fmt(state.budget)} targets ~${targetLeads} leads/month at est. AED ${STRATEGIES.find((s) => s.id === state.strategy)?.cplBase} CPL — your best campaign achieved AED ${Math.min(...financeSummary.topSpendCampaigns.map((c) => c.cpl)).toFixed(0)} CPL.`
    }
    case 4: {
      const locLabels = LOCATIONS.filter((l) => state.locations.includes(l.key)).map((l) => l.label)
      return `${locLabels.slice(0, 3).join(', ')} match the highest-converting nationalities for ${STRATEGIES.find((s) => s.id === state.strategy)?.label.toLowerCase()} campaigns in your account history.`
    }
    case 5:
      return `Copy generated from ${listing?.projectName ?? 'property'}'s real data — price, payment plan, area, and developer. Click any headline to select it, or edit inline.`
    case 6:
      return `Only a live landing page will get you leads — a draft or missing page blocks the funnel. Select the page closest to live, or generate one first.`
    case 7:
      return `Review everything — then hit Launch. Campaign name, creative, and settings can be edited in platform after launch.`
    default:
      return ''
  }
}

function fmt(n: number) { return 'AED ' + n.toLocaleString('en-US') }

function fmtReach(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function estimateLeads(budget: number, strategy: StrategyId): { leads: number; cpl: number } {
  const stratCpl   = STRATEGIES.find((s) => s.id === strategy)?.cplBase ?? 80
  const accountCpl = financeSummary.avgCpl30d
  const blended    = Math.round((stratCpl * 0.6 + accountCpl * 0.4))
  return { leads: Math.round(budget / blended), cpl: blended }
}

// ─── Build initial wizard state from real data ─────────────────────────────────

function buildInitialState(): WizardState {
  const propId    = computeAIProperty(leadMachineListings)
  const listing   = leadMachineListings.find((l) => l.id === propId)!
  const strategy  = computeAIStrategy(listing)
  const budget    = computeAIBudget(strategy)
  const channel   = computeAIChannel(strategy, budget)
  const locations = computeAILocations(strategy)
  const interests = computeAIInterests(strategy)
  const headlines = generateHeadlines(listing, strategy)
  const bodies    = generateBodyCopy(listing, strategy)
  const landing   = leadMachineLandings.find((l) => l.projectId === listing.projectId)

  return {
    propertyId:   propId,
    strategy,
    channel,
    budget,
    duration:     30,
    locations,
    interests,
    useLookalike: true,
    headline:     headlines[0],
    body:         bodies[0],
    cta:          'Learn More',
    landingId:    landing?.id ?? '',
    landingUrl:   '',
    campaignName: '',
  }
}

// ─── Inline editable text ──────────────────────────────────────────────────────

function EditableField({
  value, onChange, rows = 1, placeholder, className = '',
}: {
  value: string; onChange: (v: string) => void
  rows?: number; placeholder?: string; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
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
        ref={ref} rows={rows} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-[1.65] text-white/85 focus:outline-none"
      />
      <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2">
        <button onClick={() => { onChange(draft); setEditing(false) }}
          className="rounded-lg bg-[#D4AF37]/15 px-3 py-1 text-[12px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/25">
          Apply
        </button>
        <button onClick={() => { setDraft(value); setEditing(false) }}
          className="rounded-lg px-3 py-1 text-[12px] text-white/35 transition hover:text-white/65">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ['Property', 'Strategy', 'Budget', 'Audience', 'Creative', 'Landing', 'Launch']

function StepHeader({ step }: { step: number }) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1; const done = n < step; const active = n === step
          return (
            <div key={n} className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className={['flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition',
                  done ? 'bg-[#D4AF37] text-[#0B0F1A]' : active ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37]' : 'bg-white/[0.06] text-white/25'].join(' ')}>
                  {done ? <Check className="h-2.5 w-2.5" /> : n}
                </div>
                <span className={['text-[12px] font-medium whitespace-nowrap',
                  active ? 'text-white/85' : done ? 'text-white/40' : 'text-white/20'].join(' ')}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-6 shrink-0 ${n < step ? 'bg-[#D4AF37]/35' : 'bg-white/[0.06]'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 h-0.5 w-full rounded-full bg-white/[0.05]">
        <div className="h-full rounded-full bg-[#D4AF37] transition-all duration-500"
          style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%` }} />
      </div>
    </div>
  )
}

// ─── Shared components ─────────────────────────────────────────────────────────

function AIBadge({ label = 'AI Pick' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[11px] font-medium text-[#D4AF37]">
      <Sparkles className="h-2.5 w-2.5" /> {label}
    </span>
  )
}

function AIReason({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-4 py-3">
      <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]/60 mt-0.5 shrink-0" />
      <p className="text-[12px] leading-relaxed text-white/55">{text}</p>
    </div>
  )
}

function SectionLabel({ icon: Icon, label, sub }: { icon: typeof Target; label: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#D4AF37]/60" />
        <span className="text-[13px] font-semibold text-white/80">{label}</span>
      </div>
      {sub && <p className="mt-0.5 pl-5 text-[12px] text-white/35">{sub}</p>}
    </div>
  )
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

export default function CampaignLaunchPage() {
  const [step,      setStep]      = useState(1)
  const [launched,  setLaunched]  = useState(false)
  const [launching, setLaunching] = useState(false)
  const [bodyIdx,   setBodyIdx]   = useState(0)
  const [state,     setState]     = useState<WizardState>(buildInitialState)

  function patch<K extends keyof WizardState>(key: K, val: WizardState[K]) {
    setState((s) => ({ ...s, [key]: val }))
  }

  /** Selecting a property cascades all downstream AI recommendations */
  function selectProperty(id: string) {
    const listing = leadMachineListings.find((l) => l.id === id)
    if (!listing) return
    const strategy  = computeAIStrategy(listing)
    const budget    = computeAIBudget(strategy)
    const channel   = computeAIChannel(strategy, budget)
    const locations = computeAILocations(strategy)
    const interests = computeAIInterests(strategy)
    const headlines = generateHeadlines(listing, strategy)
    const bodies    = generateBodyCopy(listing, strategy)
    const landing   = leadMachineLandings.find((l) => l.projectId === listing.projectId)
    setBodyIdx(0)
    setState((s) => ({
      ...s,
      propertyId: id, strategy, channel, budget, locations, interests,
      headline: headlines[0], body: bodies[0],
      landingId: landing?.id ?? '',
    }))
  }

  /** Changing strategy regenerates copy for the same property */
  function selectStrategy(id: StrategyId) {
    const listing = leadMachineListings.find((l) => l.id === state.propertyId)
    if (!listing) return
    const headlines = generateHeadlines(listing, id)
    const bodies    = generateBodyCopy(listing, id)
    const locations = computeAILocations(id)
    const interests = computeAIInterests(id)
    setBodyIdx(0)
    setState((s) => ({
      ...s, strategy: id, locations, interests,
      headline: headlines[0], body: bodies[0],
    }))
  }

  function nextBody() {
    const listing = leadMachineListings.find((l) => l.id === state.propertyId)
    if (!listing) return
    const bodies = generateBodyCopy(listing, state.strategy)
    const next = (bodyIdx + 1) % bodies.length
    setBodyIdx(next)
    patch('body', bodies[next])
  }

  function rotateHeadline(idx: number) {
    const listing = leadMachineListings.find((l) => l.id === state.propertyId)
    if (!listing) return
    patch('headline', generateHeadlines(listing, state.strategy)[idx])
  }

  function toggle<K extends 'locations' | 'interests'>(key: K, val: string) {
    setState((s) => ({
      ...s,
      [key]: (s[key] as string[]).includes(val)
        ? (s[key] as string[]).filter((v) => v !== val)
        : [...(s[key] as string[]), val],
    }))
  }

  const listing        = leadMachineListings.find((l) => l.id === state.propertyId)
  const selectedLanding = leadMachineLandings.find((l) => l.id === state.landingId)
  const aiPropId       = computeAIProperty(leadMachineListings)
  const est            = estimateLeads(state.budget, state.strategy)
  const reach          = LOCATIONS.filter((l) => state.locations.includes(l.key)).reduce((s, l) => s + l.reach, 0) +
                         (state.useLookalike ? 180_000 : 0)
  const headlines      = listing ? generateHeadlines(listing, state.strategy) : []
  const reason         = getAIReason(step, state, listing)
  const campaignName   = state.campaignName ||
    `${listing?.projectName ?? 'Campaign'} — ${STRATEGIES.find((s) => s.id === state.strategy)?.label} — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`

  function handleLaunch() {
    if (launching) return
    patch('campaignName', campaignName)
    setLaunching(true)
    setTimeout(() => { setLaunching(false); setLaunched(true) }, 1800)
  }

  // ── Launched ────────────────────────────────────────────────────────────────
  if (launched) {
    const channelLabel = state.channel === 'both' ? 'Meta + Google Ads' : state.channel === 'meta' ? 'Meta Ads' : 'Google Ads'
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10">
          <Rocket className="h-6 w-6 text-[#D4AF37]" />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-white/90">Campaign Live</h2>
        <p className="mt-1.5 max-w-sm text-[13px] text-white/40">
          <span className="text-white/65 font-medium">{state.campaignName}</span> is now running on {channelLabel}.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Daily Budget',      value: fmt(Math.round(state.budget / state.duration)) },
            { label: 'Est. Leads / Month', value: `~${est.leads}` },
            { label: 'Target CPL',         value: `AED ${est.cpl}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-white/30">{label}</div>
              <div className="mt-1 text-base font-semibold tabular-nums text-[#D4AF37]">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <Link href="/freehold-intelligence/lead-machine/campaigns"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] font-medium text-white/60 transition hover:border-white/20 hover:text-white">
            View Campaigns
          </Link>
          <button
            onClick={() => { setLaunched(false); setStep(1); setState(buildInitialState()) }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-5 py-2.5 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15">
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </button>
        </div>
      </div>
    )
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">

      <Link href="/freehold-intelligence/lead-machine/campaigns"
        className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-white/30 transition hover:text-white/60">
        <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
      </Link>

      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-white/90">Launch Campaign</h1>
        <p className="mt-0.5 text-[12px] text-white/35">AI pre-fills every field from your property data — adjust anything</p>
      </div>

      <StepHeader step={step} />
      <AIReason text={reason} />

      {/* ── Step 1: Property ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-3">
          <SectionLabel icon={Building2} label="Which property?" />
          {leadMachineListings.map((l) => {
            const isSelected    = state.propertyId === l.id
            const isAIPick      = l.id === aiPropId
            const canLaunch     = l.adReadinessScore >= 50 && l.blockerStatus !== 'Blocked'
            const score         = Math.round(l.adReadinessScore * 0.5 + l.opportunityScore * 0.5)
            return (
              <button key={l.id}
                onClick={() => canLaunch && selectProperty(l.id)}
                disabled={!canLaunch}
                className={['w-full rounded-2xl border p-4 text-left transition',
                  isSelected   ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]' :
                  canLaunch    ? 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]' :
                                 'border-white/[0.04] bg-white/[0.01] opacity-40 cursor-not-allowed'].join(' ')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-white/90">{l.projectName}</span>
                      {isAIPick && <AIBadge />}
                      {!canLaunch && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/[0.06] px-2 py-0.5 text-[11px] text-red-400">
                          <AlertCircle className="h-2.5 w-2.5" /> Not ready
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px] text-white/40">{l.area} · {l.developer}</div>
                    {!canLaunch && l.missingRequirements.length > 0 && (
                      <div className="mt-1 text-[12px] text-red-400/60">Missing: {l.missingRequirements.slice(0, 2).join(', ')}</div>
                    )}
                    {canLaunch && (
                      <div className="mt-2 flex items-center gap-3 text-[12px] text-white/35">
                        <span>Readiness <span className={l.adReadinessScore >= 70 ? 'text-[#D4AF37]' : 'text-amber-400'}>{l.adReadinessScore}%</span></span>
                        <span className="h-3 w-px bg-white/[0.08]" />
                        <span>Score <span className="text-white/55">{score}</span></span>
                        {l.startingPrice && (
                          <>
                            <span className="h-3 w-px bg-white/[0.08]" />
                            <span>from <span className="text-white/55">AED {(l.startingPrice / 1_000_000).toFixed(1)}M</span></span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Step 2: Strategy ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-3">
          <SectionLabel icon={Target} label="Campaign strategy" />
          {STRATEGIES.map((s) => {
            const Icon        = s.icon
            const isSelected  = state.strategy === s.id
            const isAIPick    = s.id === computeAIStrategy(listing ?? leadMachineListings[0])
            const cplVsAcct   = s.cplBase < financeSummary.avgCpl30d
              ? `−${Math.round(financeSummary.avgCpl30d - s.cplBase)} vs your avg`
              : `+${Math.round(s.cplBase - financeSummary.avgCpl30d)} vs your avg`
            return (
              <button key={s.id} onClick={() => selectStrategy(s.id)}
                className={['w-full rounded-2xl border p-4 text-left transition',
                  isSelected ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]' :
                               'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'].join(' ')}>
                <div className="flex items-start gap-3">
                  <div className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition',
                    isSelected ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10' : 'border-white/[0.08] bg-white/[0.04]'].join(' ')}>
                    <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-[#D4AF37]' : 'text-white/40'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[13px] font-semibold ${isSelected ? 'text-white' : 'text-white/75'}`}>{s.label}</span>
                      {isAIPick && <AIBadge />}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/40">{s.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-[12px]">
                      <span className="text-white/35">Est. CPL: <span className="font-medium text-white/55">AED {s.cplBase}</span></span>
                      <span className="h-3 w-px bg-white/[0.08]" />
                      <span className={s.cplBase < financeSummary.avgCpl30d ? 'text-[#D4AF37]/70' : 'text-white/30'}>{cplVsAcct}</span>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Step 3: Budget & Channels ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <SectionLabel icon={Zap} label="Channels" />
            <div className="grid grid-cols-3 gap-2.5">
              {([
                { key: 'meta' as Channel,   label: 'Meta Ads',      sub: 'Instagram · Facebook' },
                { key: 'google' as Channel, label: 'Google Ads',    sub: 'Search · Perf Max' },
                { key: 'both' as Channel,   label: 'Meta + Google', sub: 'Best coverage' },
              ]).map((c) => {
                const isSelected = state.channel === c.key
                const isAIPick   = c.key === computeAIChannel(state.strategy, state.budget)
                return (
                  <button key={c.key} onClick={() => patch('channel', c.key)}
                    className={['rounded-2xl border p-3.5 text-center transition',
                      isSelected ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]' :
                                   'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'].join(' ')}>
                    <div className={`text-[13px] font-medium ${isSelected ? 'text-white' : 'text-white/65'}`}>{c.label}</div>
                    <div className="mt-0.5 text-[11px] text-white/30">{c.sub}</div>
                    {isAIPick && <div className="mt-2 flex justify-center"><AIBadge /></div>}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <SectionLabel icon={DollarSign} label="Monthly budget"
              sub={`AI targets ~200 leads at AED ${est.cpl} CPL — your account avg is AED ${financeSummary.avgCpl30d}`} />
            <div className="flex flex-wrap gap-2">
              {[5000, 10000, 15000, 25000].map((v) => {
                const isAIPick = v === computeAIBudget(state.strategy)
                return (
                  <button key={v} onClick={() => patch('budget', v)}
                    className={['rounded-xl border px-4 py-2 text-[13px] font-medium transition',
                      state.budget === v ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' :
                                          'border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70'].join(' ')}>
                    AED {(v / 1000).toFixed(0)}K
                    {isAIPick && <span className="ml-1.5 text-[10px] opacity-60">AI</span>}
                  </button>
                )
              })}
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2">
                <span className="text-[12px] text-white/25">AED</span>
                <input type="number" value={state.budget}
                  onChange={(e) => patch('budget', Number(e.target.value))}
                  className="w-16 bg-transparent text-[13px] text-white/70 focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <SectionLabel icon={Target} label="Duration" />
            <div className="flex gap-2">
              {([14, 30, 60] as Duration[]).map((d) => (
                <button key={d} onClick={() => patch('duration', d)}
                  className={['rounded-xl border px-4 py-2 text-[13px] font-medium transition',
                    state.duration === d ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' :
                                          'border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70'].join(' ')}>
                  {d} days{d === 30 && <span className="ml-1.5 text-[10px] opacity-50">AI</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Live projection */}
          <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#D4AF37]/60">
              <Sparkles className="h-3 w-3" /> Live Projection
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Budget',        value: fmt(state.budget) },
                { label: 'Est. Leads',    value: `~${est.leads}` },
                { label: 'Target CPL',    value: `AED ${est.cpl}` },
                { label: 'Daily Spend',   value: fmt(Math.round(state.budget / state.duration)) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-white/25">{label}</div>
                  <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-white/80">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-3 text-[12px] text-white/35">
              Best campaign in your account: <span className="text-[#D4AF37]">AED {Math.min(...financeSummary.topSpendCampaigns.map((c) => c.cpl)).toFixed(0)} CPL</span>
              {' · '}{financeSummary.topSpendCampaigns[0].name}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Audience ──────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <SectionLabel icon={Globe} label="Target locations" />
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map((loc) => {
                const on = state.locations.includes(loc.key)
                const isAIPick = computeAILocations(state.strategy).includes(loc.key)
                return (
                  <button key={loc.key} onClick={() => toggle('locations', loc.key)}
                    className={['rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
                      on ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' :
                           'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/65'].join(' ')}>
                    {loc.label}
                    {isAIPick && !on && <span className="ml-1 text-[10px] text-[#D4AF37]/50">·</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <SectionLabel icon={Users} label="Audience interests" />
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((int) => {
                const on = state.interests.includes(int.key)
                return (
                  <button key={int.key} onClick={() => toggle('interests', int.key)}
                    className={['rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
                      on ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' :
                           'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/65'].join(' ')}>
                    {int.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={() => patch('useLookalike', !state.useLookalike)}
            className={['flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition',
              state.useLookalike ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.04]' :
                                   'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'].join(' ')}>
            <div className={['flex h-5 w-5 shrink-0 items-center justify-center rounded border transition',
              state.useLookalike ? 'border-[#D4AF37] bg-[#D4AF37]' : 'border-white/20'].join(' ')}>
              {state.useLookalike && <Check className="h-3 w-3 text-[#0B0F1A]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-white/75">CRM Lookalike Audience</div>
              <div className="mt-0.5 text-[12px] text-white/35">
                Based on {financeSummary.totalLeads30d * 4 + 215} existing leads · 1% similarity · +180K reach
              </div>
            </div>
            {state.useLookalike && <AIBadge />}
          </button>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[12px] text-white/35">Estimated Reach</div>
              <div className="text-[11px] text-white/25">
                {state.locations.length} loc · {state.interests.length} int{state.useLookalike ? ' · lookalike' : ''}
              </div>
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-white/80">{fmtReach(reach)}</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[#D4AF37]/60 transition-all duration-500"
                style={{ width: `${Math.min(100, (reach / 600_000) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Creative ──────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-5">
          {/* Headline picker */}
          <div>
            <SectionLabel icon={FileText} label="Headline" sub="AI generated from your property data — pick one or edit below" />
            <div className="space-y-2">
              {headlines.map((h, i) => (
                <button key={i} onClick={() => rotateHeadline(i)}
                  className={['w-full rounded-xl border px-4 py-3 text-left text-[13px] transition',
                    state.headline === h
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/[0.06] font-medium text-white'
                      : 'border-white/[0.07] text-white/50 hover:border-white/[0.14] hover:text-white/70'].join(' ')}>
                  <span className="mr-2 text-[10px] text-white/20">{i + 1}</span>
                  {h}
                  {i === 0 && <span className="ml-2 text-[10px] text-[#D4AF37]/50">AI</span>}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <EditableField value={state.headline} onChange={(v) => patch('headline', v)}
                rows={1} placeholder="or type a custom headline…" />
            </div>
          </div>

          {/* Body copy */}
          <div>
            <div className="flex items-center justify-between">
              <SectionLabel icon={FileText} label="Body copy" />
              <button onClick={nextBody}
                className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-white/30 transition hover:text-[#D4AF37]">
                <RefreshCw className="h-3 w-3" /> Rephrase
              </button>
            </div>
            <EditableField value={state.body} onChange={(v) => patch('body', v)} rows={4} />
            <p className="mt-1.5 text-[11px] text-white/25">
              Written for <span className="text-white/40">{listing?.projectName}</span> · {listing?.area} · click to edit inline
            </p>
          </div>

          {/* CTA */}
          <div>
            <SectionLabel icon={Target} label="Call to action" />
            <div className="flex flex-wrap gap-2">
              {CTAS.map((cta) => (
                <button key={cta} onClick={() => patch('cta', cta)}
                  className={['rounded-xl border px-3.5 py-1.5 text-[13px] font-medium transition',
                    state.cta === cta ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' :
                                        'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/65'].join(' ')}>
                  {cta}
                </button>
              ))}
            </div>
          </div>

          {/* Live ad preview */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="border-b border-white/[0.05] bg-white/[0.02] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-white/25">
              Preview · Meta Feed
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D4AF37]/15">
                  <Building2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/75">Freehold Property</div>
                  <div className="text-[11px] text-white/25">Sponsored</div>
                </div>
              </div>
              <div className="mb-3 flex h-20 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <span className="text-[12px] text-white/15">Property image · {listing?.area}</span>
              </div>
              <div className="text-[13px] font-semibold leading-tight text-white/90">{state.headline}</div>
              <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/45">{state.body}</div>
              <div className="mt-2.5 inline-block rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white">{state.cta}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 6: Landing Page ──────────────────────────────────────────────── */}
      {step === 6 && (() => {
        const propLandings = leadMachineLandings.filter((l) => l.projectId === listing?.projectId)
        const allLandings  = propLandings.length ? propLandings : leadMachineLandings
        return (
          <div className="space-y-3">
            <SectionLabel icon={Globe} label="Landing page" sub="All ad clicks go here — must be live before launch." />
            {allLandings.map((land) => {
              const isSelected = state.landingId === land.id
              const isLive     = land.status === 'Landing Active' || land.status === 'Approved'
              return (
                <button key={land.id} onClick={() => patch('landingId', land.id)}
                  className={['w-full rounded-2xl border p-4 text-left transition',
                    isSelected ? 'border-[#D4AF37]/50 bg-[#D4AF37]/[0.06]' :
                                 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'].join(' ')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-white/80">{land.landingUrl}</span>
                        <span className={['inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          isLive ? 'border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]' :
                                   'border-amber-400/20 bg-amber-400/10 text-amber-400'].join(' ')}>
                          {land.status}
                        </span>
                        {isLive && <AIBadge label="Recommended" />}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.07]">
                          <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${land.completion}%` }} />
                        </div>
                        <span className="text-[12px] text-white/35">{land.completion}% complete</span>
                      </div>
                      {land.aiReviewSummary && (
                        <div className="mt-1.5 text-[12px] text-white/30 line-clamp-1">{land.aiReviewSummary}</div>
                      )}
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37]" />}
                  </div>
                </button>
              )
            })}

            {propLandings.length === 0 && (
              <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-5 text-center">
                <AlertCircle className="mx-auto mb-2 h-5 w-5 text-amber-400" />
                <div className="text-[13px] font-medium text-amber-300">No landing page for {listing?.projectName}</div>
                <div className="mt-1 text-[12px] text-white/35">Showing all available landings — or generate one first.</div>
                <Link href={`/freehold-intelligence/inventory/${state.propertyId}/generate`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-2 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15">
                  <Sparkles className="h-3.5 w-3.5" /> Generate Landing Page
                </Link>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <div className="mb-2 text-[12px] text-white/40">Or enter a URL directly</div>
              <input type="text" value={state.landingUrl}
                onChange={(e) => patch('landingUrl', e.target.value)}
                placeholder="https://freeholdproperty.ae/…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/70 placeholder:text-white/20 focus:border-[#D4AF37]/30 focus:outline-none" />
            </div>
          </div>
        )
      })()}

      {/* ── Step 7: Review & Launch ───────────────────────────────────────────── */}
      {step === 7 && (
        <div className="space-y-5">
          <div>
            <SectionLabel icon={Rocket} label="Campaign name" sub="Auto-generated — click to edit" />
            <EditableField value={campaignName} onChange={(v) => patch('campaignName', v)} rows={1} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.04]">
            {[
              { label: 'Property',  value: listing?.projectName ?? '—' },
              { label: 'Strategy',  value: STRATEGIES.find((s) => s.id === state.strategy)?.label ?? '—' },
              { label: 'Channels',  value: state.channel === 'both' ? 'Meta + Google Ads' : state.channel === 'meta' ? 'Meta Ads' : 'Google Ads' },
              { label: 'Budget',    value: `${fmt(state.budget)} / ${state.duration} days` },
              { label: 'Locations', value: LOCATIONS.filter((l) => state.locations.includes(l.key)).map((l) => l.label).join(', ') || '—' },
              { label: 'Reach',     value: fmtReach(reach) },
              { label: 'Headline',  value: state.headline },
              { label: 'CTA',       value: state.cta },
              { label: 'Landing',   value: selectedLanding?.landingUrl ?? state.landingUrl || 'Not set' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="w-20 shrink-0 text-[12px] text-white/30">{label}</span>
                <span className="text-right text-[13px] text-white/70">{value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#D4AF37]/55">
              <Sparkles className="h-3 w-3" /> Projection
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total Budget',      value: fmt(state.budget) },
                { label: 'Est. Leads',         value: `~${est.leads}` },
                { label: 'Target CPL',         value: `AED ${est.cpl}` },
                { label: 'Daily Spend',        value: fmt(Math.round(state.budget / state.duration)) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-white/25">{label}</div>
                  <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-white/80">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-3 text-[12px] text-white/35">
              Account best: <span className="text-[#D4AF37]">AED {Math.min(...financeSummary.topSpendCampaigns.map((c) => c.cpl)).toFixed(0)} CPL</span>
              {' · '}30-day avg: <span className="text-white/50">AED {financeSummary.avgCpl30d}</span>
            </div>
          </div>

          <button onClick={handleLaunch} disabled={launching}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/15 py-4 text-[15px] font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/22 disabled:opacity-60">
            {launching
              ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#D4AF37]/40 border-t-[#D4AF37]" /> Launching…</>
              : <><Rocket className="h-4 w-4" /> Launch Campaign</>}
          </button>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-between border-t border-white/[0.05] pt-6">
        <button onClick={() => setStep((s) => Math.max(1, s - 1) as typeof step)}
          disabled={step === 1}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-white/40 transition hover:border-white/20 hover:text-white/70 disabled:opacity-25 disabled:cursor-not-allowed">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < 7 && (
          <button onClick={() => setStep((s) => (s + 1) as typeof step)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-5 py-2.5 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15">
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
