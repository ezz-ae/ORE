'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadAccountMemory, saveAccountMemory, saveAccountMemoryDebounced } from '@/lib/freehold/account-memory'
import { UAE_INTERESTS, UAE_CITIES, STRATEGY_LABELS, type TargetingRecommendation, type TargetingStrategy } from '@/lib/meta/targeting-catalog'
import { TabPopup } from '@/components/freehold/ui/tab-popup'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Megaphone,
  DollarSign, Users, FileText, Rocket, AlertCircle, Loader2,
  Monitor, Sparkles, ChevronRight, Sliders, Radar, Repeat, Crosshair, Gauge,
} from 'lucide-react'
// Real inventory replaces the old seed listings: the picker loads live projects
// from /api/freehold/inventory so campaigns are always built on real stock.
interface WizardListing {
  id: string
  projectId: string
  projectName: string
  area: string
  imageUrl: string
  startingPrice: number | null
  paymentPlan: string | null
  landingUrl: string
}
import type { LaunchCampaignPayload, MetaCampaignObjective, MetaCta } from '@/lib/meta/types'
import { useT } from '@/lib/i18n/provider'

// ─── UAE interest targets ────────────────────────────────────────────────────
// Interests/cities come from the shared proven catalog — the same list the
// AI targeting loop is constrained to.


// ─── Wizard state ─────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4

interface WizardState {
  // Step 1
  listingId:     string
  productObjective: ProductObjectiveKey
  objective:     MetaCampaignObjective
  campaignName:  string
  // Step 2
  strategy:      TargetingStrategy | 'custom'
  dailyBudgetAED: number
  lifetimeCapAED: number
  countries:     string[]
  cityKeys:      string[]
  ageMin:        number
  ageMax:        number
  genders:       number[]
  interestIds:   string[]
  publisherPlatforms: string[]
  // Step 3
  primaryText:   string
  headline:      string
  description:   string
  landingUrl:    string
  cta:           MetaCta
  imageUrl:      string
  imageHash:     string
  // Step 4
  launchStatus:  'ACTIVE' | 'PAUSED'
  cplCapAED:     number
  autoEnhance:   'on' | 'off' | 'approval'
}

// Targeting strategies — the "mastered" way to aim, not a naive interest stack.
// Each preset shapes the audience; 'custom' opens the full audience builder.
const STRATEGIES: { key: TargetingStrategy | 'custom'; icon: typeof Radar; labelKey: string; descKey: string; broad: boolean }[] = [
  { key: 'advantage_broad',     icon: Radar,     labelKey: 'lm.newCampaign.strat.broad',      descKey: 'lm.newCampaign.strat.broadDesc',      broad: true },
  { key: 'lookalike_qualified', icon: Users,     labelKey: 'lm.newCampaign.strat.lookalike',  descKey: 'lm.newCampaign.strat.lookalikeDesc',  broad: true },
  { key: 'retargeting_warm',    icon: Repeat,    labelKey: 'lm.newCampaign.strat.retarget',   descKey: 'lm.newCampaign.strat.retargetDesc',   broad: true },
  { key: 'interest_refined',    icon: Crosshair, labelKey: 'lm.newCampaign.strat.interest',   descKey: 'lm.newCampaign.strat.interestDesc',   broad: false },
  { key: 'custom',              icon: Sliders,   labelKey: 'lm.newCampaign.strat.custom',     descKey: 'lm.newCampaign.strat.customDesc',     broad: false },
]

// Auto-enhancement lets the AI act on delivery: 'on' = apply automatically,
// 'approval' = recommend and wait for a click, 'off' = never touch it.
const AUTO_ENHANCE_OPTIONS: { value: 'on' | 'off' | 'approval'; labelKey: string; descKey: string }[] = [
  { value: 'approval', labelKey: 'lm.newCampaign.s4.autoEnhance.approval', descKey: 'lm.newCampaign.s4.autoEnhance.approvalDesc' },
  { value: 'on',       labelKey: 'lm.newCampaign.s4.autoEnhance.on',       descKey: 'lm.newCampaign.s4.autoEnhance.onDesc' },
  { value: 'off',      labelKey: 'lm.newCampaign.s4.autoEnhance.off',      descKey: 'lm.newCampaign.s4.autoEnhance.offDesc' },
]

// The objective is the setup-changer: it's what the operator actually picks, and
// it rewrites the destination + downstream steps. Each maps to a real Meta
// objective the launch client already handles. Roadshow is its own strategic
// builder — selecting it routes there, so there's still ONE entry to campaigns.
type ProductObjectiveKey = 'smart_landing' | 'meta_lead' | 'branding'
const PRODUCT_OBJECTIVES: {
  key: ProductObjectiveKey | 'roadshow'
  meta: MetaCampaignObjective | null
  dest: 'landing' | 'form' | 'event'
  route?: string
  icon: typeof Monitor
  labelKey: string
  descKey: string
}[] = [
  { key: 'smart_landing', meta: 'LINK_CLICKS',     dest: 'landing', icon: Monitor,   labelKey: 'lm.newCampaign.obj.smartLanding',      descKey: 'lm.newCampaign.obj.smartLandingDesc' },
  { key: 'meta_lead',     meta: 'LEAD_GENERATION', dest: 'form',    icon: FileText,  labelKey: 'lm.newCampaign.obj.metaLead',          descKey: 'lm.newCampaign.obj.metaLeadDesc' },
  { key: 'branding',      meta: 'REACH',           dest: 'landing', icon: Megaphone, labelKey: 'lm.newCampaign.obj.branding',          descKey: 'lm.newCampaign.obj.brandingDesc' },
  { key: 'roadshow',      meta: null,              dest: 'event',   route: '/freehold-intelligence/lead-machine/roadshow', icon: Sparkles, labelKey: 'lm.newCampaign.obj.roadshow', descKey: 'lm.newCampaign.obj.roadshowDesc' },
]

// Countries the ad can be delivered in. AE is the home market; the rest cover
// the GCC + the key expat/investor source markets for Dubai real estate.
const COUNTRY_CODES = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'GB', 'IN', 'RU', 'DE'] as const

const CTA_OPTIONS: { value: MetaCta; label: string }[] = [
  { value: 'LEARN_MORE',   label: 'Learn More' },
  { value: 'GET_QUOTE',    label: 'Get Quote' },
  { value: 'SIGN_UP',      label: 'Sign Up' },
  { value: 'CONTACT_US',   label: 'Contact Us' },
  { value: 'BOOK_NOW',     label: 'Book Now' },
  { value: 'APPLY_NOW',    label: 'Apply Now' },
]

const STEPS: { n: number; labelKey: string; icon: typeof Megaphone }[] = [
  { n: 1, labelKey: 'lm.newCampaign.step.campaign',  icon: Megaphone },
  { n: 2, labelKey: 'lm.newCampaign.step.targeting', icon: Users },
  { n: 3, labelKey: 'lm.newCampaign.step.creative',  icon: FileText },
  { n: 4, labelKey: 'lm.newCampaign.step.launch',    icon: Rocket },
]

const LAUNCH_MODE_OPTIONS: { value: 'PAUSED' | 'ACTIVE'; labelKey: string; descKey: string }[] = [
  { value: 'PAUSED', labelKey: 'lm.newCampaign.launchMode.paused.label', descKey: 'lm.newCampaign.launchMode.paused.desc' },
  { value: 'ACTIVE', labelKey: 'lm.newCampaign.launchMode.active.label', descKey: 'lm.newCampaign.launchMode.active.desc' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inputCls(err?: boolean) {
  return [
    'w-full rounded-[12px] border bg-surface-2 px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none transition',
    err
      ? 'border-red-400/40 focus:border-red-400'
      : 'border-line focus:border-gold/50',
  ].join(' ')
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-slate-400">{children}</label>
}

// Honest projections for a just-fired campaign — clearly labelled as ESTIMATES,
// never presented as delivered numbers. They give way to real reach/leads/CPL
// once Meta reports the first delivery.
function estimatePotentialReach(countryCount: number, interestCount: number): { min: number; max: number } {
  // Broad (no interest constraint) hunts a far larger pool than a refined stack.
  const base = Math.max(1, countryCount) * (interestCount > 0 ? 45_000 : 130_000)
  return { min: Math.round((base * 0.6) / 1000) * 1000, max: Math.round((base * 1.15) / 1000) * 1000 }
}
function estimateMonthlyResults(dailyBudgetAED: number, cplCapAED: number): number {
  if (cplCapAED <= 0) return 0
  return Math.max(0, Math.floor((dailyBudgetAED * 30) / cplCapAED))
}
const fmtReach = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewCampaignPage() {
  const t = useT()
  const router = useRouter()
  const [step,    setStep]    = useState<WizardStep>(1)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [launched, setLaunched] = useState<{ campaignId: string; status: string } | null>(null)

  const [form, setForm] = useState<WizardState>({
    listingId:    '',
    productObjective: 'smart_landing',
    objective:    'LINK_CLICKS',
    campaignName: '',
    strategy:     'advantage_broad',
    dailyBudgetAED: 200,
    lifetimeCapAED: 0,
    countries:    ['AE'],
    cityKeys:     ['297928'], // Dubai
    ageMin:       28,
    ageMax:       65,
    genders:      [],
    interestIds:  [UAE_INTERESTS[0].id, UAE_INTERESTS[3].id],
    publisherPlatforms: ['facebook', 'instagram'],
    primaryText:  '',
    headline:     '',
    description:  'Request the investor summary now.',
    landingUrl:   'https://www.freeholdproperty.ae',
    cta:          'LEARN_MORE',
    imageUrl:     '',
    imageHash:    '',
    launchStatus: 'PAUSED',
    cplCapAED:    150,
    autoEnhance:  'approval',
  })
  const [uploadingImg, setUploadingImg] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)

  // Picking a strategy shapes the audience. Broad strategies clear the interest
  // stack (let the algorithm hunt); interest_refined keeps it; custom opens the
  // full builder popup.
  function selectStrategy(s: (typeof STRATEGIES)[number]) {
    if (s.key === 'custom') { setAudienceOpen(true) }
    setForm((prev) => ({
      ...prev,
      strategy: s.key,
      interestIds: s.broad ? [] : (prev.interestIds.length ? prev.interestIds : [UAE_INTERESTS[0].id, UAE_INTERESTS[3].id]),
    }))
    setApiError(null)
  }
  const GENDER_OPTIONS: { key: string; val: number[] }[] = [
    { key: 'all', val: [] }, { key: 'men', val: [1] }, { key: 'women', val: [2] },
  ]
  const genderKey = form.genders.length === 0 ? 'all' : form.genders[0] === 1 ? 'men' : 'women'

  // The learning loop: fetch AI targeting learned from ACTUAL lead outcomes.
  const [aiTargeting, setAiTargeting] = useState<TargetingRecommendation | null>(null)
  const [aiTargetingLoading, setAiTargetingLoading] = useState(false)
  const [aiTargetingApplied, setAiTargetingApplied] = useState(false)
  async function fetchAiTargeting() {
    setAiTargetingLoading(true)
    try {
      const res = await fetch('/api/freehold/ai/targeting', { cache: 'no-store' })
      const d = await res.json()
      if (res.ok && d?.recommendation) setAiTargeting(d.recommendation)
    } catch { /* panel simply stays collapsed */ }
    finally { setAiTargetingLoading(false) }
  }
  function applyAiTargeting() {
    if (!aiTargeting) return
    setForm((prev) => ({
      ...prev,
      interestIds: aiTargeting.interestIds,
      ageMin: aiTargeting.ageMin,
      ageMax: aiTargeting.ageMax,
      cityKeys: aiTargeting.cityKeys,
      dailyBudgetAED: aiTargeting.dailyBudgetAED,
    }))
    setAiTargetingApplied(true)
  }

  // Real projects for the picker — loaded from the live inventory API.
  const [listings, setListings] = useState<WizardListing[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setApiError(null)
  }

  // Picking the objective is the setup-changer. Roadshow is a strategic builder
  // of its own — route there (keeping one entry point to campaigns).
  function selectObjective(po: (typeof PRODUCT_OBJECTIVES)[number]) {
    if (po.route) { router.push(po.route); return }
    setForm((prev) => ({ ...prev, productObjective: po.key as ProductObjectiveKey, objective: po.meta ?? prev.objective }))
    setApiError(null)
  }

  const activeObjective = PRODUCT_OBJECTIVES.find((o) => o.key === form.productObjective) ?? PRODUCT_OBJECTIVES[0]

  // Everything the user types is saved: restore the last draft on mount
  // (this device first, then the ACCOUNT — so a draft started on the laptop
  // resumes on the phone), and persist every change locally + to the account.
  // Cleared everywhere after a successful launch.
  const DRAFT_KEY = 'fh-campaign-draft'
  const draftRestored = useRef(false)
  useEffect(() => {
    let restoredLocally = false
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as Partial<WizardState>
        setForm((prev) => ({ ...prev, ...draft }))
        restoredLocally = true
      }
    } catch { /* ignore corrupt drafts */ }
    loadAccountMemory().then((m) => {
      const acctDraft = m.campaignDraft
      if (!restoredLocally && acctDraft && typeof acctDraft === 'object') {
        setForm((prev) => ({ ...prev, ...(acctDraft as Partial<WizardState>) }))
      }
      draftRestored.current = true
    })
  }, [])
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch { /* full/blocked storage */ }
    // Account save waits for restore so a pristine form never clobbers a
    // draft the account already holds.
    if (draftRestored.current) saveAccountMemoryDebounced('campaignDraft', form, 1500)
  }, [form])

  // Load real inventory for the project picker.
  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const props: WizardListing[] = (d?.properties || [])
          .map((p: Record<string, unknown>) => ({
            id: String(p.slug || ''),
            projectId: String(p.slug || ''),
            projectName: String(p.name || ''),
            area: String(p.area || ''),
            imageUrl: (p.heroImage as string) || '',
            startingPrice: typeof p.startingPriceAED === 'number' ? p.startingPriceAED : null,
            paymentPlan: (p.paymentPlan as string) || null,
            // One landing per listing: always /lp/[slug]. When a dedicated
            // landing page exists we use its own slug; otherwise /lp/[project]
            // renders live from inventory — so the ad never points anywhere
            // but the listing's landing.
            landingUrl: p.landingUrl
              ? `https://www.freeholdproperty.ae${p.landingUrl}`
              : `https://www.freeholdproperty.ae/lp/${p.slug}`,
          }))
          .filter((l: WizardListing) => l.id && l.projectName)
        setListings(props)
      })
      .catch(() => {})
      .finally(() => setListingsLoading(false))
  }, [])

  // Prefill from a real inventory project when arriving via the Inventory
  // "Create Ad Campaign" link (?project=<slug>&name=<name>&price=<aed>).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const project = p.get('project')
    const name = p.get('name')
    const price = p.get('price')
    const lp = p.get('lp') // landing-page slug → the ad's destination URL
    if (!project && !name) return
    const displayName = name || project || ''
    const priceNum = price ? Number(price) : 0
    setForm((prev) => ({
      ...prev,
      listingId: project || prev.listingId,
      campaignName: `${displayName} — ${prev.objective === 'LEAD_GENERATION' ? 'Lead Gen' : 'Traffic'}`,
      headline: displayName,
      primaryText: priceNum > 0
        ? `${displayName} — starting from AED ${priceNum.toLocaleString()}. Request the investor summary now.`
        : `${displayName} — request the investor summary now.`,
      landingUrl: lp
        ? `https://www.freeholdproperty.ae/lp/${lp}`
        : project ? `https://www.freeholdproperty.ae/lp/${project}` : prev.landingUrl,
    }))
  }, [])

  // ── Listing change pre-populates creative ──────────────────────────────────
  function onListingChange(id: string) {
    const listing = listings.find((l) => l.id === id)
    if (!listing) return
    setForm((prev) => ({
      ...prev,
      listingId:    listing.id,
      campaignName: `${listing.projectName} — ${prev.objective === 'LEAD_GENERATION' ? 'Lead Gen' : 'Traffic'}`,
      primaryText:  `${listing.projectName} — starting from AED ${listing.startingPrice?.toLocaleString() ?? '—'}. ${listing.paymentPlan ?? 'Request the investor summary now.'}`.trim(),
      headline:     listing.projectName,
      landingUrl:   listing.landingUrl,
      imageUrl:     listing.imageUrl,
      imageHash:    '',   // fall back to the listing photo unless a new file is uploaded
    }))
  }

  // Upload a chosen file to the connected Meta ad account → image_hash.
  async function onUploadImage(file: File | null) {
    if (!file) return
    setUploadingImg(true); setApiError(null)
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/meta/adimages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setApiError(d?.error || 'Image upload failed'); return }
      setForm((prev) => ({ ...prev, imageHash: d.hash, imageUrl: d.url || prev.imageUrl }))
    } catch {
      setApiError('Could not read the image file')
    } finally {
      setUploadingImg(false)
    }
  }

  // ── Launch ─────────────────────────────────────────────────────────────────
  async function handleLaunch() {
    setLoading(true)
    setApiError(null)

    const listing = listings.find((l) => l.id === form.listingId)
    const interests = UAE_INTERESTS.filter((i) => form.interestIds.includes(i.id))

    const payload: LaunchCampaignPayload = {
      campaignName:   form.campaignName,
      objective:      form.objective,
      listingId:      form.listingId,
      listingName:    listing?.projectName ?? form.campaignName,
      dailyBudgetAED: form.dailyBudgetAED,
      targeting: {
        countries:          form.countries.length ? form.countries : ['AE'],
        cityKeys:           form.cityKeys,
        ageMin:             form.ageMin,
        ageMax:             form.ageMax,
        genders:            form.genders,
        publisherPlatforms: form.publisherPlatforms,
        interests,
      },
      creative: {
        primaryText: form.primaryText,
        headline:    form.headline,
        description: form.description,
        landingUrl:  form.landingUrl,
        cta:         form.cta,
        imageUrl:    form.imageUrl || undefined,
        imageHash:   form.imageHash || undefined,
      },
      launchStatus: form.launchStatus,
    }

    try {
      const res = await fetch('/api/meta/launch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error ?? 'Launch failed. Check your Meta credentials and try again.')
        setLoading(false)
        return
      }

      setLaunched({ campaignId: data.campaignId, status: data.status })
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      saveAccountMemory({ campaignDraft: null }) // launched — clear the draft everywhere
    } catch {
      setApiError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Success screen — honest post-launch state ──────────────────────────────
  // A just-fired campaign has NO reach, NO leads, NO CPL yet. Instead of showing
  // zeros (which read as broken), we show what we CAN honestly say: potential
  // reach (estimate), expected results (from budget ÷ CPL cap), the CPL cap
  // itself, and the auto-enhancement mode. Each estimate is labelled as such and
  // becomes the real metric once Meta reports the first delivery.
  if (launched) {
    const reach = estimatePotentialReach(form.countries.length, form.interestIds.length)
    const expected = estimateMonthlyResults(form.dailyBudgetAED, form.cplCapAED)
    const enhanceLabel = AUTO_ENHANCE_OPTIONS.find((o) => o.value === form.autoEnhance)?.labelKey ?? 'lm.newCampaign.s4.autoEnhance.approval'
    const resultCards = [
      { label: t('lm.newCampaign.result.potentialReach'), value: `${fmtReach(reach.min)}–${fmtReach(reach.max)}`, note: t('lm.newCampaign.result.potentialReachNote'), tone: 'text-gold' },
      { label: t('lm.newCampaign.result.expectedResults'), value: expected > 0 ? `~${expected}/${t('lm.newCampaign.result.perMonth')}` : '—', note: t('lm.newCampaign.result.expectedResultsNote'), tone: 'text-emerald-400' },
      { label: t('lm.newCampaign.result.cplCap'), value: `AED ${form.cplCapAED.toLocaleString()}`, note: t('lm.newCampaign.result.cplCapNote'), tone: 'text-white' },
      { label: t('lm.newCampaign.result.autoEnhance'), value: t(enhanceLabel), note: t('lm.newCampaign.result.autoEnhanceNote'), tone: 'text-violet-300' },
    ]
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-gold" />
          <h1 className="mt-6 text-[32px] font-semibold text-white">{t('lm.newCampaign.success.title')}</h1>
          <p className="mt-3 text-[16px] text-slate-400">
            {launched.status === 'ACTIVE'
              ? t('lm.newCampaign.success.liveMsg')
              : t('lm.newCampaign.success.pausedMsg')}
          </p>
        </div>

        {/* Honest results — estimates until the campaign delivers. */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {resultCards.map((c) => (
            <div key={c.label} className="rounded-[16px] border border-line bg-surface-2 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{c.label}</div>
              <div className={`mt-1.5 text-[22px] font-semibold leading-none ${c.tone}`}>{c.value}</div>
              <div className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{c.note}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-600">{t('lm.newCampaign.result.becomesReal')}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/freehold-intelligence/lead-machine/campaigns/${launched.campaignId}`}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]"
          >
            {t('lm.newCampaign.success.openDashboard')}
          </Link>
          <Link
            href="/freehold-intelligence/lead-machine/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-surface-2"
          >
            {t('lm.newCampaign.success.allCampaigns')}
          </Link>
        </div>
      </div>
    )
  }

  const selectedListing = listings.find((l) => l.id === form.listingId)

  const summaryTiles = [
    { labelKey: 'lm.newCampaign.s4.tileLabel.listing',   value: selectedListing?.projectName ?? form.listingId },
    { labelKey: 'lm.newCampaign.s4.tileLabel.objective',  value: t(activeObjective.labelKey) },
    { labelKey: 'lm.newCampaign.s4.tileLabel.budget',     value: `AED ${form.dailyBudgetAED.toLocaleString()}` },
    { labelKey: 'lm.newCampaign.s4.tileLabel.audience',   value: t('lm.newCampaign.s4.audienceValue', { min: String(form.ageMin), max: String(form.ageMax) }) },
    { labelKey: 'lm.newCampaign.s4.tileLabel.platforms',  value: form.publisherPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' + ') },
    { labelKey: 'lm.newCampaign.s4.tileLabel.cta',        value: CTA_OPTIONS.find((c) => c.value === form.cta)?.label ?? form.cta },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/lead-machine/campaigns" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('lm.newCampaign.back')}
      </Link>

      <div className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Megaphone className="h-3.5 w-3.5" /> {t('lm.newCampaign.eyebrow')}
        </div>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-white sm:text-[40px]">
          {t('lm.newCampaign.title')}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-0">
        {STEPS.map((s, i) => {
          const active  = step === s.n
          const done    = step > s.n
          const Icon    = s.icon
          return (
            <div key={s.n} className="flex flex-1 items-center">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
                done    ? 'border-emerald-400/40 bg-gold/15 text-gold'
                : active ? 'border-gold/50 bg-gold/15 text-gold'
                : 'border-line bg-surface-2 text-slate-500'
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
              </div>
              <span className={`ml-2 hidden text-sm font-medium sm:block ${active ? 'text-white' : done ? 'text-gold/70' : 'text-slate-600'}`}>{t(s.labelKey)}</span>
              {i < STEPS.length - 1 && (
                <div className={`mx-3 h-px flex-1 ${done ? 'bg-gold/30' : 'bg-surface-2'}`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-10 rounded-[24px] border border-line bg-surface p-6 sm:p-8">

        {/* ── Step 1: Campaign ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-white">{t('lm.newCampaign.s1.heading')}</h2>

            <div data-coach="wiz-listing">
              <Label>{t('lm.newCampaign.s1.label.listing')}</Label>
              <select
                className={inputCls()}
                value={form.listingId}
                onChange={(e) => onListingChange(e.target.value)}
              >
                <option value="" disabled>
                  {listingsLoading ? t('common.loading') : t('lm.newCampaign.s1.pickProject')}
                </option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>{l.projectName} · {l.area}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s1.label.objective')}</Label>
              <p className="mb-2 text-xs text-slate-500">{t('lm.newCampaign.s1.objectiveHint')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRODUCT_OBJECTIVES.map((po) => {
                  const Icon = po.icon
                  const active = !po.route && form.productObjective === po.key
                  return (
                    <button
                      key={po.key}
                      type="button"
                      onClick={() => selectObjective(po)}
                      className={`flex items-start gap-3 rounded-[14px] border p-4 text-left transition ${
                        active
                          ? 'border-gold/40 bg-gold/[0.06]'
                          : 'border-line bg-surface-2 hover:border-white/10'
                      }`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-gold/15 text-gold' : 'bg-white/[0.04] text-slate-400'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-[14px] font-semibold text-white">
                          {t(po.labelKey)}
                          {po.route && <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{t(po.descKey)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s1.label.name')}</Label>
              <input
                className={inputCls()}
                value={form.campaignName}
                onChange={(e) => update('campaignName', e.target.value)}
                placeholder={t('lm.campaignNamePlaceholder')}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Targeting ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-white">{t('lm.newCampaign.s2.heading')}</h2>

            {/* AI targeting — learned from what your past leads actually did */}
            <div className="rounded-2xl border border-gold/20 bg-gold/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gold">{t('lm.newCampaign.ai.title')}</span>
                {!aiTargeting ? (
                  <button
                    type="button"
                    onClick={fetchAiTargeting}
                    disabled={aiTargetingLoading}
                    className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
                  >
                    {aiTargetingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('lm.newCampaign.ai.get')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={applyAiTargeting}
                    disabled={aiTargetingApplied}
                    className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
                  >
                    {aiTargetingApplied ? t('lm.newCampaign.ai.applied') : t('lm.newCampaign.ai.apply')}
                  </button>
                )}
              </div>
              {!aiTargeting && !aiTargetingLoading && (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{t('lm.newCampaign.ai.hint')}</p>
              )}
              {aiTargeting && (
                <div className="mt-2 space-y-2 text-xs leading-relaxed">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
                      {STRATEGY_LABELS[aiTargeting.strategy]}
                    </span>
                    <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-slate-300">{aiTargeting.ageMin}–{aiTargeting.ageMax}</span>
                    <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-slate-300">AED {aiTargeting.dailyBudgetAED}/d</span>
                    {aiTargeting.interestIds.length === 0 && (
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">{t('lm.newCampaign.ai.broad')}</span>
                    )}
                    {UAE_INTERESTS.filter((i) => aiTargeting.interestIds.includes(i.id)).map((i) => (
                      <span key={i.id} className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[11px] text-gold">{i.name}</span>
                    ))}
                  </div>
                  <p className="text-slate-200">{aiTargeting.analysis}</p>
                  {aiTargeting.signalPlan && <p className="text-slate-400"><span className="font-semibold text-slate-300">{t('lm.newCampaign.ai.signals')}:</span> {aiTargeting.signalPlan}</p>}
                  {aiTargeting.creativeAngle && <p className="text-slate-400"><span className="font-semibold text-slate-300">{t('lm.newCampaign.ai.creative')}:</span> {aiTargeting.creativeAngle}</p>}
                  {aiTargeting.exclusions.length > 0 && <p className="text-slate-400"><span className="font-semibold text-slate-300">{t('lm.newCampaign.ai.exclude')}:</span> {aiTargeting.exclusions.join(' · ')}</p>}
                  {aiTargeting.learningPhase && <p className="text-slate-500">{aiTargeting.learningPhase}</p>}
                  <p className="text-slate-400">{aiTargeting.rationale}</p>
                  {aiTargeting.suggestedNewInterests.length > 0 && (
                    <p className="text-slate-500">{t('lm.newCampaign.ai.research')}: {aiTargeting.suggestedNewInterests.join(' · ')}</p>
                  )}
                </div>
              )}
            </div>

            {/* Strategy — the mastered way to aim (algorithm-vs-algorithm), not a naive interest stack */}
            <div>
              <Label>{t('lm.newCampaign.s2.label.strategy')}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {STRATEGIES.map((s) => {
                  const Icon = s.icon
                  const active = form.strategy === s.key
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => selectStrategy(s)}
                      className={`flex items-start gap-3 rounded-[14px] border p-3.5 text-left transition ${
                        active ? 'border-gold/40 bg-gold/[0.06]' : 'border-line bg-surface-2 hover:border-white/10'
                      }`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-gold/15 text-gold' : 'bg-white/[0.04] text-slate-400'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-white">{t(s.labelKey)}</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{t(s.descKey)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Audience summary — the full builder opens as a popup (nested tab) */}
            <div className="rounded-[16px] border border-line bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lm.newCampaign.s2.audience')}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-slate-300">{form.countries.map((c) => t(`lm.country.${c}`)).join(', ') || t('lm.country.AE')}</span>
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-slate-300">{form.ageMin}–{form.ageMax}</span>
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-slate-300">{t(`lm.newCampaign.s2.gender.${genderKey}`)}</span>
                    {form.interestIds.length > 0
                      ? <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-gold">{t('lm.newCampaign.s2.nInterests', { n: String(form.interestIds.length) })}</span>
                      : <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">{t('lm.newCampaign.ai.broad')}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAudienceOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20"
                >
                  <Sliders className="h-3.5 w-3.5" /> {t('lm.newCampaign.s2.editAudience')}
                </button>
              </div>
            </div>

            {/* Budget + Smart Spender */}
            <div data-coach="wiz-budget" className="rounded-[16px] border border-line bg-surface-2 p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold"><Gauge className="h-3.5 w-3.5" /> {t('lm.newCampaign.s2.smartSpender')}</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t('lm.newCampaign.s2.label.budget')}</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">AED</span>
                    <input type="number" min="50" className={`${inputCls(form.dailyBudgetAED < 50)} ps-12`} value={form.dailyBudgetAED}
                      onChange={(e) => update('dailyBudgetAED', Math.max(50, parseInt(e.target.value) || 50))} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t('lm.newCampaign.s2.monthlyNote', { n: (form.dailyBudgetAED * 30).toLocaleString() })}</p>
                </div>
                <div>
                  <Label>{t('lm.newCampaign.s2.label.lifetimeCap')}</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">AED</span>
                    <input type="number" min="0" placeholder={t('lm.newCampaign.s2.lifetimeCapPh')} className={`${inputCls()} ps-12`} value={form.lifetimeCapAED || ''}
                      onChange={(e) => update('lifetimeCapAED', Math.max(0, parseInt(e.target.value) || 0))} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t('lm.newCampaign.s2.lifetimeCapHint')}</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">{t('lm.newCampaign.s2.smartSpenderNote')}</p>
            </div>
          </div>
        )}

        {/* Audience builder — a tab shown as a popup because we're nested in the wizard */}
        <TabPopup
          open={audienceOpen}
          onClose={() => setAudienceOpen(false)}
          title={t('lm.newCampaign.s2.audienceBuilder')}
          subtitle={t('lm.newCampaign.s2.audienceBuilderSub')}
          footer={<button type="button" onClick={() => setAudienceOpen(false)} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]">{t('lm.newCampaign.s2.useAudience')}</button>}
        >
          <div className="space-y-5">
            <div>
              <Label>{t('lm.newCampaign.s2.label.countries')}</Label>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_CODES.map((code) => {
                  const selected = form.countries.includes(code)
                  return (
                    <button key={code} type="button"
                      onClick={() => update('countries', selected ? form.countries.filter((c) => c !== code) : [...form.countries, code])}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${selected ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                      {t(`lm.country.${code}`)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{t('lm.newCampaign.s2.countriesHint')}</p>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s2.label.gender')}</Label>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((g) => (
                  <button key={g.key} type="button" onClick={() => update('genders', g.val)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${genderKey === g.key ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                    {t(`lm.newCampaign.s2.gender.${g.key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s2.label.cities')}</Label>
              <div className="flex flex-wrap gap-2">
                {UAE_CITIES.map((city) => {
                  const selected = form.cityKeys.includes(city.key)
                  return (
                    <button key={city.key} type="button"
                      onClick={() => update('cityKeys', selected ? form.cityKeys.filter((k) => k !== city.key) : [...form.cityKeys, city.key])}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${selected ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                      {city.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('lm.newCampaign.s2.label.ageMin')}</Label>
                <input type="number" min="18" max="65" className={inputCls()} value={form.ageMin} onChange={(e) => update('ageMin', parseInt(e.target.value))} />
              </div>
              <div>
                <Label>{t('lm.newCampaign.s2.label.ageMax')}</Label>
                <input type="number" min="18" max="65" className={inputCls()} value={form.ageMax} onChange={(e) => update('ageMax', parseInt(e.target.value))} />
              </div>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s2.label.interests')}</Label>
              <div className="flex flex-wrap gap-2">
                {UAE_INTERESTS.map((int) => {
                  const selected = form.interestIds.includes(int.id)
                  return (
                    <button key={int.id} type="button"
                      onClick={() => update('interestIds', selected ? form.interestIds.filter((i) => i !== int.id) : [...form.interestIds, int.id])}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${selected ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                      {int.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s2.label.platforms')}</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'facebook',  label: 'Facebook' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'audience_network', label: 'Audience Network' },
                ].map((p) => {
                  const selected = form.publisherPlatforms.includes(p.value)
                  return (
                    <button key={p.value} type="button"
                      onClick={() => update('publisherPlatforms', selected ? form.publisherPlatforms.filter((v) => v !== p.value) : [...form.publisherPlatforms, p.value])}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${selected ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </TabPopup>

        {/* ── Step 3: Creative ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-[18px] font-semibold text-white">{t('lm.newCampaign.s3.heading')}</h2>

            <div>
              <Label>{t('lm.newCampaign.s3.label.primaryText')}</Label>
              <textarea
                rows={4}
                className={`${inputCls(!form.primaryText)} resize-none`}
                value={form.primaryText}
                onChange={(e) => update('primaryText', e.target.value)}
                placeholder={t('lm.primaryTextPlaceholder')}
              />
              <p className="mt-1 text-sm text-slate-500">
                {t('lm.newCampaign.s3.charCount', { n: String(form.primaryText.length) })}
              </p>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s3.label.headline')}</Label>
              <input
                className={inputCls(!form.headline)}
                value={form.headline}
                onChange={(e) => update('headline', e.target.value)}
                placeholder={t('lm.headlinePlaceholder')}
              />
            </div>

            <div>
              <Label>{t('lm.newCampaign.s3.label.description')}</Label>
              <input
                className={inputCls()}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder={t('lm.descriptionPlaceholder')}
              />
            </div>

            <div>
              <Label>{t('lm.newCampaign.s3.label.landingUrl')}</Label>
              <input
                className={inputCls(!form.landingUrl)}
                value={form.landingUrl}
                onChange={(e) => update('landingUrl', e.target.value)}
                placeholder={t('lm.landingUrlPlaceholder')}
              />
            </div>

            <div data-coach="wiz-creative">
              <Label>{t('lm.newCampaign.s3.label.imageUrl')}</Label>
              <input
                className={inputCls()}
                value={form.imageUrl}
                onChange={(e) => { update('imageUrl', e.target.value); update('imageHash', '') }}
                placeholder={t('lm.imageUrlPlaceholder')}
              />
              {/* Upload your own ad image → Meta ad account (image_hash) */}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-gold/40">
                  {uploadingImg ? 'Uploading…' : 'Upload image'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingImg}
                    onChange={(e) => onUploadImage(e.target.files?.[0] ?? null)} />
                </label>
                {form.imageHash
                  ? <span className="text-xs text-emerald-400">✓ Uploaded to Meta — this image will be used</span>
                  : <span className="text-xs text-slate-500">or paste an image URL above (defaults to the listing photo)</span>}
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="ad preview" className="h-10 w-16 rounded object-cover" />
                )}
              </div>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s3.label.cta')}</Label>
              <select
                className={inputCls()}
                value={form.cta}
                onChange={(e) => update('cta', e.target.value as MetaCta)}
              >
                {CTA_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Launch ───────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-white">{t('lm.newCampaign.s4.heading')}</h2>

            {/* Summary tiles */}
            <div className="grid gap-4 sm:grid-cols-2">
              {summaryTiles.map((item) => (
                <div key={item.labelKey} className="rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t(item.labelKey)}</div>
                  <div className="mt-1 text-[14px] font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Creative preview */}
            <div className="rounded-[16px] border border-line bg-surface-2 p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-3">{t('lm.newCampaign.s4.creativePreview')}</div>
              <div className="text-xs leading-relaxed text-slate-400 mb-2">{form.primaryText}</div>
              <div className="text-[14px] font-semibold text-white">{form.headline}</div>
              <div className="text-xs text-slate-500 mt-0.5">{form.description}</div>
              <div className="mt-2 inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs text-gold">
                {CTA_OPTIONS.find((c) => c.value === form.cta)?.label}
              </div>
            </div>

            {/* Launch mode toggle */}
            <div>
              <Label>{t('lm.newCampaign.s4.label.launchMode')}</Label>
              <div className="flex gap-3">
                {LAUNCH_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('launchStatus', opt.value)}
                    className={`flex-1 rounded-[14px] border p-4 text-left transition ${
                      form.launchStatus === opt.value
                        ? opt.value === 'ACTIVE'
                          ? 'border-emerald-400/30 bg-gold/[0.06]'
                          : 'border-gold/40 bg-gold/[0.06]'
                        : 'border-line hover:border-white/10'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{t(opt.labelKey)}</div>
                    <p className="mt-1 text-sm text-slate-500">{t(opt.descKey)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* CPL cap — the number that actually matters before there's a real CPL. */}
            <div>
              <Label>{t('lm.newCampaign.s4.label.cplCap')}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">AED</span>
                <input
                  type="number" min="10"
                  className={`${inputCls(form.cplCapAED < 10)} ps-12`}
                  value={form.cplCapAED}
                  onChange={(e) => update('cplCapAED', Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
              <p className="mt-1 text-sm text-slate-500">{t('lm.newCampaign.s4.cplCapHint')}</p>
            </div>

            {/* Auto-enhancement — let the AI act, recommend, or stay out. */}
            <div>
              <Label>{t('lm.newCampaign.s4.label.autoEnhance')}</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {AUTO_ENHANCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('autoEnhance', opt.value)}
                    className={`rounded-[14px] border p-3 text-left transition ${
                      form.autoEnhance === opt.value
                        ? 'border-gold/40 bg-gold/[0.06]'
                        : 'border-line hover:border-white/10'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{t(opt.labelKey)}</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t(opt.descKey)}</p>
                  </button>
                ))}
              </div>
            </div>

            {apiError && (
              <div className="flex items-start gap-3 rounded-[14px] border border-red-400/20 bg-red-400/[0.05] p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-slate-300">{apiError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as WizardStep)}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-surface-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t('lm.newCampaign.nav.back')}
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
            disabled={
              (step === 1 && (!form.listingId || !form.campaignName)) ||
              (step === 2 && form.dailyBudgetAED < 50) ||
              (step === 3 && (!form.primaryText || !form.headline || !form.landingUrl))
            }
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('lm.newCampaign.nav.continue')} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            data-coach="wiz-launch"
            onClick={handleLaunch}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-60"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('lm.newCampaign.nav.launching')}</>
              : <><Rocket className="h-4 w-4" /> {form.launchStatus === 'ACTIVE' ? t('lm.newCampaign.launchMode.active.label') : t('lm.newCampaign.launchMode.paused.label')}</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
