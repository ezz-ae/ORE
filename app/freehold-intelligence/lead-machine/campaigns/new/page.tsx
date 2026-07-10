'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadAccountMemory, saveAccountMemory, saveAccountMemoryDebounced } from '@/lib/freehold/account-memory'
import { UAE_INTERESTS, UAE_CITIES, type TargetingRecommendation, type TargetingStrategy } from '@/lib/meta/targeting-catalog'
import { TabPopup } from '@/components/freehold/ui/tab-popup'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Megaphone,
  DollarSign, Users, FileText, Rocket, AlertCircle, Loader2,
  Monitor, Sparkles, ChevronRight, Sliders, Crosshair, Gauge, MessageCircle, Phone, X, Plus, Target, Eye,
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
import type { LaunchCampaignPayload, MetaCampaignObjective, MetaCta, GeneratedCreativeVariant } from '@/lib/meta/types'
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
  /** Meta locale keys + names for language targeting (buyer language). */
  locales:       { key: number; name: string }[]
  publisherPlatforms: string[]
  // Step 3
  primaryText:   string
  headline:      string
  description:   string
  landingUrl:    string
  whatsappNumber: string
  phoneNumber:   string
  cta:           MetaCta
  imageUrl:      string
  imageHash:     string
  // Step 4
  launchStatus:  'ACTIVE' | 'PAUSED'
  cplCapAED:     number
  autoEnhance:   'on' | 'off' | 'approval'
}

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
type ProductObjectiveKey = 'smart_landing' | 'meta_lead' | 'branding' | 'whatsapp' | 'call'
type ObjectiveDest = 'landing' | 'form' | 'event' | 'whatsapp' | 'phone'
const PRODUCT_OBJECTIVES: {
  key: ProductObjectiveKey | 'roadshow'
  meta: MetaCampaignObjective | null
  dest: ObjectiveDest
  route?: string
  icon: typeof Monitor
  labelKey: string
  descKey: string
}[] = [
  { key: 'smart_landing', meta: 'LINK_CLICKS',     dest: 'landing', icon: Monitor,       labelKey: 'lm.newCampaign.obj.smartLanding',      descKey: 'lm.newCampaign.obj.smartLandingDesc' },
  { key: 'meta_lead',     meta: 'LEAD_GENERATION', dest: 'form',    icon: FileText,      labelKey: 'lm.newCampaign.obj.metaLead',          descKey: 'lm.newCampaign.obj.metaLeadDesc' },
  { key: 'whatsapp',      meta: 'LINK_CLICKS',     dest: 'whatsapp', icon: MessageCircle, labelKey: 'lm.newCampaign.obj.whatsapp',          descKey: 'lm.newCampaign.obj.whatsappDesc' },
  { key: 'call',          meta: 'LINK_CLICKS',     dest: 'phone',   icon: Phone,         labelKey: 'lm.newCampaign.obj.call',              descKey: 'lm.newCampaign.obj.callDesc' },
  { key: 'branding',      meta: 'REACH',           dest: 'landing', icon: Megaphone,     labelKey: 'lm.newCampaign.obj.branding',          descKey: 'lm.newCampaign.obj.brandingDesc' },
  { key: 'roadshow',      meta: null,              dest: 'event',   route: '/freehold-intelligence/lead-machine/roadshow', icon: Sparkles, labelKey: 'lm.newCampaign.obj.roadshow', descKey: 'lm.newCampaign.obj.roadshowDesc' },
]

// Countries the ad can be delivered in. AE is the home market; the rest cover
// the GCC + the key expat/investor source markets for Dubai real estate.
const COUNTRY_CODES = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'GB', 'IN', 'RU', 'DE'] as const

// A campaign source that IS a landing page (our own /lp/<slug> URL) can double
// as the ad destination. Extract the slug so we can auto-fill the destination
// and open that exact landing on the editor canvas.
function landingSlugFromUrl(url: string): string | null {
  const m = url.match(/\/lp\/([A-Za-z0-9._~-]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

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
    locales:      [],
    publisherPlatforms: ['facebook', 'instagram'],
    primaryText:  '',
    headline:     '',
    description:  'Request the investor summary now.',
    landingUrl:   'https://www.freeholdproperty.ae',
    whatsappNumber: '',
    phoneNumber:  '',
    cta:          'LEARN_MORE',
    imageUrl:     '',
    imageHash:    '',
    launchStatus: 'PAUSED',
    cplCapAED:    150,
    autoEnhance:  'approval',
  })
  const [uploadingImg, setUploadingImg] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)

  // Data Quality Test — verify the listing's info before it becomes an ad/landing.
  type DataQuality = {
    listing: { slug: string; name: string; editUrl: string }
    score: number
    readyToBuild: boolean
    requiredMissing: string[]
    checks: { key: string; present: boolean; value: string | null; severity: 'required' | 'recommended'; editable: boolean }[]
  }
  const [dqOpen, setDqOpen] = useState(false)
  const [dqData, setDqData] = useState<DataQuality | null>(null)
  const [dqLoading, setDqLoading] = useState(false)
  async function runDataQuality() {
    if (!form.listingId) return
    setDqOpen(true); setDqLoading(true); setDqData(null)
    try {
      const res = await fetch('/api/freehold/ads/data-quality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingSlug: form.listingId }),
      })
      const d = await res.json()
      if (!d.error) setDqData(d as DataQuality)
    } catch { /* popup shows the empty/again state */ }
    finally { setDqLoading(false) }
  }

  const GENDER_OPTIONS: { key: string; val: number[] }[] = [
    { key: 'all', val: [] }, { key: 'men', val: [1] }, { key: 'women', val: [2] },
  ]
  const genderKey = form.genders.length === 0 ? 'all' : form.genders[0] === 1 ? 'men' : 'women'

  // ── Buyer Match: the audience that actually buys THIS listing, from our own
  // closed deals + leads, anchored to the price band, with a live Meta estimate.
  type BuyerMatch = {
    band: { key: string; label: string; min: number; max: number | null }
    listing: { price: number; area: string }
    buyers: { deals: number; avgValue: number; totalValue: number; topDevelopers: { name: string; count: number }[]; leads: number; qualified: number; closed: number; closeRate: number | null; topSources: { source: string; count: number }[]; hasData: boolean }
    recommendation: { ageMin: number; ageMax: number; interestIds: string[]; interestNames: string[] }
    estimate: { lower: number; upper: number; ready: boolean } | null
    metaConnected: boolean
  }
  const [buyerMatch, setBuyerMatch] = useState<BuyerMatch | null>(null)
  const [bmLoading, setBmLoading] = useState(false)
  const [bmError, setBmError] = useState(false)
  const countriesKey = form.countries.join(',')
  function loadBuyerMatch() {
    if (!form.listingId) return
    const listing = listings.find((l) => l.id === form.listingId)
    setBuyerMatch(null); setBmError(false); setBmLoading(true)
    fetch('/api/freehold/ads/buyer-match', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingSlug: form.listingId, price: listing?.startingPrice || 0, countries: form.countries }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setBuyerMatch(d as BuyerMatch); else setBmError(true) })
      .catch(() => setBmError(true))
      .finally(() => setBmLoading(false))
  }
  useEffect(() => {
    if (step === 2 && form.listingId) loadBuyerMatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.listingId, countriesKey])
  function applyBuyerMatch() {
    if (!buyerMatch) return
    setForm((prev) => ({ ...prev, strategy: 'interest_refined', ageMin: buyerMatch.recommendation.ageMin, ageMax: buyerMatch.recommendation.ageMax, interestIds: buyerMatch.recommendation.interestIds }))
  }

  // ── Creative: real ad preview + AI copy generation (existing generator) ──
  const [previewPlacement, setPreviewPlacement] = useState<'feed' | 'story'>('feed')
  // Trakhees QR — overlaid on the creative in the scan-safe bottom corner.
  const [qrDataUrl, setQrDataUrl] = useState('')
  function onUploadQr(file: File | null) {
    if (!file) return
    const r = new FileReader()
    r.onload = () => setQrDataUrl(String(r.result))
    r.readAsDataURL(file)
  }
  const QrOverlay = () => qrDataUrl ? (
    <div className="pointer-events-none flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="Trakhees QR" className="h-11 w-11 rounded bg-white p-0.5 object-contain shadow-lg ring-1 ring-black/20" />
      <span className="mt-0.5 rounded bg-black/70 px-1 text-[7px] font-medium text-white">{t('lm.newCampaign.qr.badge')}</span>
    </div>
  ) : null
  const [genAngle, setGenAngle] = useState<'investor' | 'urgency' | 'lifestyle' | 'yield' | 'golden_visa' | 'end_user'>('investor')
  const [variants, setVariants] = useState<GeneratedCreativeVariant[]>([])
  const [genLoading, setGenLoading] = useState(false)
  // Real Meta-rendered preview (Graph generatepreviews). Distinct from the
  // local mockup above — this is exactly how Meta will render the ad.
  const [metaPreview, setMetaPreview] = useState<string | null>(null)
  const [metaPreviewState, setMetaPreviewState] = useState<'idle' | 'loading' | 'demo' | 'error'>('idle')
  async function loadMetaPreview() {
    if (!form.headline && !form.primaryText) { toast.error(t('lm.newCampaign.metaPreview.needCopy')); return }
    setMetaPreviewState('loading'); setMetaPreview(null)
    try {
      const adFormat = previewPlacement === 'story' ? 'INSTAGRAM_STORY' : 'MOBILE_FEED_STANDARD'
      const res = await fetch('/api/meta/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adFormat,
          creative: {
            primaryText: form.primaryText, headline: form.headline, description: form.description,
            landingUrl: form.landingUrl, cta: form.cta,
            imageUrl: form.imageUrl || undefined, imageHash: form.imageHash || undefined,
          },
        }),
      })
      const d = await res.json()
      if (d?.demo) { setMetaPreviewState('demo'); return }
      if (!res.ok || !d?.body) { setMetaPreviewState('error'); toast.error(d?.error || t('lm.newCampaign.metaPreview.failed')); return }
      setMetaPreview(String(d.body)); setMetaPreviewState('idle')
    } catch { setMetaPreviewState('error'); toast.error(t('lm.newCampaign.metaPreview.failed')) }
  }
  const CREATIVE_ANGLES = ['investor', 'urgency', 'lifestyle', 'yield', 'golden_visa', 'end_user'] as const
  async function generateCopy() {
    const listing = listings.find((l) => l.id === form.listingId)
    if (!listing) { setApiError(t('lm.newCampaign.s3.needListing')); return }
    setGenLoading(true); setApiError(null)
    try {
      const res = await fetch('/api/meta/creatives/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id, listingName: listing.projectName, area: listing.area,
          developer: 'Freehold', startingPrice: listing.startingPrice, paymentPlan: listing.paymentPlan,
          angle: genAngle, tone: 'direct', cta: form.cta,
          sources: sources.map((s) => s.value).filter(Boolean),
        }),
      })
      const d = await res.json()
      if (Array.isArray(d.variants)) setVariants(d.variants)
      else setApiError(d.error || t('lm.newCampaign.s3.genFailed'))
    } catch {
      setApiError(t('lm.newCampaign.s3.genFailed'))
    } finally {
      setGenLoading(false)
    }
  }
  function applyVariant(v: GeneratedCreativeVariant) {
    setForm((prev) => ({ ...prev, primaryText: v.primaryText, headline: v.headline, description: v.description || prev.description, cta: v.cta }))
  }

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

  // Lead form — wired into the Meta Lead objective. The forms feature already
  // exists (/lead-machine/forms + /api/meta/forms); the builder now lets you
  // pick, create, or edit the in-ad form the leads land in.
  type LeadFormLite = { id: string; name: string; leads_count?: number; status?: string }
  const [leadForms, setLeadForms] = useState<LeadFormLite[]>([])
  const [leadFormId, setLeadFormId] = useState('')
  const [leadFormsLoading, setLeadFormsLoading] = useState(false)
  useEffect(() => {
    if (form.productObjective !== 'meta_lead') return
    setLeadFormsLoading(true)
    fetch('/api/meta/forms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.forms)) setLeadForms(d.forms as LeadFormLite[]) })
      .catch(() => {})
      .finally(() => setLeadFormsLoading(false))
  }, [form.productObjective])

  // Conversion pixel — the ad set optimizes on it, so leads/purchases are
  // measured on real signal. Loaded from the connected ad account (real pixels
  // only); when none exist the picker stays hidden rather than showing a stub.
  type PixelLite = { id: string; name: string; lastFiredTime?: string | null }
  const [pixels, setPixels] = useState<PixelLite[]>([])
  const [pixelId, setPixelId] = useState('')
  const [pixelsLoaded, setPixelsLoaded] = useState(false)
  useEffect(() => {
    fetch('/api/meta/pixels', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.pixels)) setPixels(d.pixels as PixelLite[]) })
      .catch(() => {})
      .finally(() => setPixelsLoaded(true))
  }, [])

  // Campaign sources — inventory / link / brochure / note. They feed the creative
  // copy and targeting; they are NOT the ad destination. Multiple allowed.
  type Source = { id: string; kind: 'inventory' | 'link' | 'file' | 'note'; label: string; value: string }
  const [sources, setSources] = useState<Source[]>([])
  // Set when a link source turns out to be our own landing page — powers the
  // "auto-filled from your source" note + Edit-on-canvas in the destination.
  const [sourceLandingSlug, setSourceLandingSlug] = useState('')
  // Which language version of our own landing the ad points to. Appends ?lang=
  // to the destination so an Arabic/Russian audience lands on the localised page.
  const [landingLang, setLandingLang] = useState<'en' | 'ar' | 'ru'>('en')
  // Smart defaults — an honest usage-frequency memory (not an ML model). Values
  // the marketer reuses across campaigns (their WhatsApp / phone number) are
  // counted; once a value has been used repeatedly we offer it as a one-tap
  // fill on the next campaign. Persisted in account memory.
  type TopDefault = { value: string; count: number }
  const smartFreq = useRef<Record<string, Record<string, number>>>({})
  const [smartDefaults, setSmartDefaults] = useState<{ whatsappNumber?: TopDefault; phoneNumber?: TopDefault }>({})
  function topDefault(freq: Record<string, number> | undefined): TopDefault | undefined {
    if (!freq) return undefined
    let best: TopDefault | undefined
    for (const [value, count] of Object.entries(freq)) if (!best || count > best.count) best = { value, count }
    return best && best.count >= 2 ? best : undefined
  }
  function recordSmartDefault(field: 'whatsappNumber' | 'phoneNumber', value: string) {
    const v = value.trim()
    if (!v) return
    const freq = smartFreq.current
    freq[field] = freq[field] || {}
    freq[field][v] = (freq[field][v] || 0) + 1
    saveAccountMemory({ adSmartDefaults: freq })
  }
  // Buyer-language (locale) targeting — resolved live from Meta's adlocale
  // vocabulary, so a picked language is exactly Meta's real locale key.
  const [localeQuery, setLocaleQuery] = useState('')
  const [localeResults, setLocaleResults] = useState<{ key: number; name: string }[]>([])
  const [localeSearching, setLocaleSearching] = useState(false)
  async function searchLocales(q: string) {
    setLocaleQuery(q)
    if (q.trim().length < 2) { setLocaleResults([]); return }
    setLocaleSearching(true)
    try {
      const res = await fetch(`/api/meta/locales?q=${encodeURIComponent(q)}`)
      const d = await res.json()
      setLocaleResults(Array.isArray(d.locales) ? d.locales : [])
    } catch { setLocaleResults([]) } finally { setLocaleSearching(false) }
  }
  function addLocale(l: { key: number; name: string }) {
    setForm((prev) => (prev.locales.some((x) => x.key === l.key) ? prev : { ...prev, locales: [...prev.locales, l] }))
    setLocaleQuery(''); setLocaleResults([])
  }
  function removeLocale(key: number) {
    setForm((prev) => ({ ...prev, locales: prev.locales.filter((l) => l.key !== key) }))
  }
  // Lookalike audience from the company's OWN closed buyers. Building it uploads
  // buyers' HASHED contacts to Meta, so it is gated behind an explicit confirm.
  const [lookalike, setLookalike] = useState<{ count: number; min: number; ready: boolean; metaConnected: boolean } | null>(null)
  const [llBuilding, setLlBuilding] = useState(false)
  const [llConfirm, setLlConfirm] = useState(false)
  const [llResult, setLlResult] = useState<{ lookalikeAudienceId: string; uploaded: number } | null>(null)
  useEffect(() => {
    fetch('/api/freehold/ads/lookalike').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setLookalike(d) }).catch(() => {})
  }, [])
  async function buildLookalike() {
    setLlBuilding(true)
    try {
      const res = await fetch('/api/freehold/ads/lookalike', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, country: form.countries[0] || 'AE', ratio: 0.03, label: form.campaignName || 'Freehold' }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error === 'not_enough' ? t('lm.newCampaign.lookalike.need').replace('{n}', String(d.count)).replace('{min}', String(d.min)) : (d.error || t('lm.newCampaign.lookalike.failed'))); return }
      setLlResult(d)
      toast.success(t('lm.newCampaign.lookalike.done'))
    } catch { toast.error(t('lm.newCampaign.lookalike.failed')) }
    finally { setLlBuilding(false); setLlConfirm(false) }
  }
  const [linkInput, setLinkInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const srcFileRef = useRef<HTMLInputElement>(null)
  const addSource = (s: Omit<Source, 'id'>) => setSources((prev) => (prev.some((x) => x.kind === s.kind && x.value === s.value) ? prev : [...prev, { ...s, id: `${s.kind}-${prev.length}-${s.value.slice(0, 12)}` }]))
  const removeSource = (id: string) => setSources((prev) => prev.filter((s) => s.id !== id))
  function addInventorySource() {
    const l = listings.find((x) => x.id === form.listingId)
    if (!l) { toast.error(t('lm.newCampaign.src.needListing')); return }
    addSource({ kind: 'inventory', label: l.projectName, value: `${l.projectName}${l.area ? `, ${l.area}` : ''}${l.startingPrice ? `, from AED ${l.startingPrice.toLocaleString()}` : ''}` })
  }
  function addLinkSource() {
    const v = linkInput.trim()
    if (!v) return
    addSource({ kind: 'link', label: v.replace(/^https?:\/\//, '').slice(0, 40), value: v })
    setLinkInput('')
    // If the link is one of our own landing pages, it can be the ad's
    // destination too. Auto-fill it (only for landing-type objectives) so the
    // marketer doesn't retype it — and remember the slug for Edit-on-canvas.
    const slug = landingSlugFromUrl(v)
    if (slug && (activeObjective.dest === 'landing')) {
      setForm((prev) => ({ ...prev, landingUrl: v }))
      setSourceLandingSlug(slug)
      toast.success(t('lm.newCampaign.src.landingAutofill'))
    }
  }
  function addNoteSource() {
    const v = noteInput.trim()
    if (!v) return
    addSource({ kind: 'note', label: v.slice(0, 40), value: v })
    setNoteInput('')
  }
  async function addFileSource(file: File | null) {
    if (!file) return
    setFileBusy(true)
    try {
      if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/dashboard/projects/parse-brochure', { method: 'POST', body: fd })
        const d = await res.json()
        if (res.ok && d) addSource({ kind: 'file', label: file.name, value: `${file.name}: ${JSON.stringify(d).slice(0, 600)}` })
        else { addSource({ kind: 'file', label: file.name, value: file.name }); toast.message(t('lm.newCampaign.src.fileNoText')) }
      } else {
        addSource({ kind: 'file', label: file.name, value: file.name })
      }
    } catch { addSource({ kind: 'file', label: file.name, value: file.name }) }
    finally { setFileBusy(false); if (srcFileRef.current) srcFileRef.current.value = '' }
  }

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
      const freq = (m.adSmartDefaults && typeof m.adSmartDefaults === 'object' ? m.adSmartDefaults : {}) as Record<string, Record<string, number>>
      smartFreq.current = freq
      setSmartDefaults({ whatsappNumber: topDefault(freq.whatsappNumber), phoneNumber: topDefault(freq.phoneNumber) })
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

    // Point the ad at the chosen language version of our own landing. Only for
    // /lp/ URLs (our trilingual page) and only when not English (the default).
    const landingUrlWithLang = (landingLang !== 'en' && landingSlugFromUrl(form.landingUrl))
      ? `${form.landingUrl}${form.landingUrl.includes('?') ? '&' : '?'}lang=${landingLang}`
      : form.landingUrl

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
        locales:            form.locales.map((l) => l.key),
        publisherPlatforms: form.publisherPlatforms,
        interests,
      },
      creative: {
        primaryText: form.primaryText,
        headline:    form.headline,
        description: form.description,
        // Destination resolves from the objective: WhatsApp → wa.me, Call →
        // tel:, everything else → the landing URL. Keeps Meta's link valid.
        landingUrl:  activeObjective.dest === 'whatsapp' && form.whatsappNumber
          ? `https://wa.me/${form.whatsappNumber.replace(/[^\d]/g, '')}`
          : activeObjective.dest === 'phone' && form.phoneNumber
            ? `tel:${form.phoneNumber.replace(/[^\d+]/g, '')}`
            : landingUrlWithLang,
        cta:         form.cta,
        imageUrl:    form.imageUrl || undefined,
        imageHash:   form.imageHash || undefined,
      },
      launchStatus: form.launchStatus,
      pixelId:      pixelId || undefined,
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
      // Learn the contact values this marketer reuses, for one-tap fill next time.
      if (activeObjective.dest === 'whatsapp') recordSmartDefault('whatsappNumber', form.whatsappNumber)
      if (activeObjective.dest === 'phone') recordSmartDefault('phoneNumber', form.phoneNumber)
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
              {form.listingId && (
                <button type="button" onClick={runDataQuality}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t('dq.run')}
                </button>
              )}
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

            {/* Meta Lead → the in-ad lead form. Choose, create, or edit it. */}
            {form.productObjective === 'meta_lead' && (
              <div className="rounded-[14px] border border-gold/20 bg-gold/[0.04] p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold"><FileText className="h-3.5 w-3.5" /> {t('lm.newCampaign.leadForm.title')}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('lm.newCampaign.leadForm.hint')}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select value={leadFormId} onChange={(e) => setLeadFormId(e.target.value)} className={`${inputCls()} max-w-xs`}>
                    <option value="">{leadFormsLoading ? t('common.loading') : t('lm.newCampaign.leadForm.pick')}</option>
                    {leadForms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}{typeof f.leads_count === 'number' ? ` · ${f.leads_count}` : ''}</option>
                    ))}
                  </select>
                  {leadFormId ? (
                    <Link href={`/freehold-intelligence/lead-machine/forms/${leadFormId}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs text-slate-300 transition hover:text-white">
                      {t('lm.newCampaign.leadForm.edit')} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  <Link href="/freehold-intelligence/lead-machine/forms/new" className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20">
                    <Sparkles className="h-3.5 w-3.5" /> {t('lm.newCampaign.leadForm.create')}
                  </Link>
                </div>
                {!leadFormsLoading && leadForms.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">{t('lm.newCampaign.leadForm.empty')}</p>
                )}
              </div>
            )}

            {/* Campaign sources — feed the creative + targeting (not the destination) */}
            <div className="rounded-[14px] border border-line bg-surface-2 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300"><FileText className="h-3.5 w-3.5" /> {t('lm.newCampaign.src.title')}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('lm.newCampaign.src.hint')}</p>

              {sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sources.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-slate-300">
                      <span className="text-slate-500">{t(`lm.newCampaign.src.kind.${s.kind}`)}:</span>
                      <span className="max-w-[160px] truncate">{s.label}</span>
                      <button type="button" onClick={() => removeSource(s.id)} className="text-slate-500 hover:text-white"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                {form.listingId && (
                  <button type="button" onClick={addInventorySource} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-slate-300 transition hover:text-white">
                    <Plus className="h-3.5 w-3.5" /> {t('lm.newCampaign.src.addInventory')}
                  </button>
                )}
                <div className="flex gap-2">
                  <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLinkSource() } }} placeholder={t('lm.newCampaign.src.linkPh')} className={inputCls()} />
                  <button type="button" onClick={addLinkSource} className="shrink-0 rounded-full border border-line bg-surface px-3 text-xs text-slate-300 transition hover:text-white">{t('lm.newCampaign.src.add')}</button>
                </div>
                <div className="flex gap-2">
                  <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNoteSource() } }} placeholder={t('lm.newCampaign.src.notePh')} className={inputCls()} />
                  <button type="button" onClick={addNoteSource} className="shrink-0 rounded-full border border-line bg-surface px-3 text-xs text-slate-300 transition hover:text-white">{t('lm.newCampaign.src.add')}</button>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-surface px-3 py-1.5 text-xs text-slate-300 transition hover:border-gold/40">
                  {fileBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t('lm.newCampaign.src.addFile')}
                  <input ref={srcFileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" disabled={fileBusy} onChange={(e) => addFileSource(e.target.files?.[0] ?? null)} />
                </label>
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

            {/* Buyer Match — the audience that actually buys THIS listing, from
                our own deals + leads, with a live Meta reach estimate. */}
            <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold"><Crosshair className="h-3.5 w-3.5" /> {t('bm.title')}</span>
                {buyerMatch && <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold">{buyerMatch.band.label} · {buyerMatch.band.min >= 1e6 ? `${buyerMatch.band.min / 1e6}M` : `${Math.round(buyerMatch.band.min / 1000)}K`}{buyerMatch.band.max ? `–${buyerMatch.band.max / 1e6}M` : '+'}</span>}
              </div>

              {bmLoading && !buyerMatch ? (
                <div className="flex items-center gap-2 py-4 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('bm.loading')}</div>
              ) : !form.listingId ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{t('bm.pickListing')}</p>
              ) : buyerMatch ? (
                <div className="mt-3 space-y-3">
                  {/* Live reach estimate */}
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3">
                    <Gauge className="h-4 w-4 text-gold" />
                    {buyerMatch.estimate ? (
                      <div className="text-sm">
                        <span className="font-semibold text-white">{fmtReach(buyerMatch.estimate.lower)}–{fmtReach(buyerMatch.estimate.upper)}</span>
                        <span className="ms-2 text-xs text-slate-500">{t('bm.liveReach')}</span>
                      </div>
                    ) : buyerMatch.metaConnected ? (
                      <span className="text-xs text-slate-400">{t('bm.reachWarming')}</span>
                    ) : (
                      <span className="text-xs text-slate-400">{t('bm.connectMeta')}</span>
                    )}
                  </div>

                  {/* Real buyer profile from our own data */}
                  {buyerMatch.buyers.hasData ? (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-line bg-surface p-2.5">
                        <div className="text-[17px] font-semibold text-gold">{buyerMatch.buyers.deals}</div>
                        <div className="text-[10px] text-slate-500">{t('bm.closedDeals')}</div>
                      </div>
                      <div className="rounded-xl border border-line bg-surface p-2.5">
                        <div className="text-[17px] font-semibold text-white">{buyerMatch.buyers.avgValue >= 1e6 ? `${(buyerMatch.buyers.avgValue / 1e6).toFixed(1)}M` : buyerMatch.buyers.avgValue ? `${Math.round(buyerMatch.buyers.avgValue / 1000)}K` : '—'}</div>
                        <div className="text-[10px] text-slate-500">{t('bm.avgValue')}</div>
                      </div>
                      <div className="rounded-xl border border-line bg-surface p-2.5">
                        <div className="text-[17px] font-semibold text-emerald-400">{buyerMatch.buyers.closeRate != null ? `${buyerMatch.buyers.closeRate}%` : '—'}</div>
                        <div className="text-[10px] text-slate-500">{t('bm.closeRate')}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line bg-surface/40 p-3 text-xs leading-relaxed text-slate-400">{t('bm.noData')}</p>
                  )}

                  {buyerMatch.buyers.topSources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500">{t('bm.topSources')}:</span>
                      {buyerMatch.buyers.topSources.map((s) => (
                        <span key={s.source} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-slate-300">{s.source} · {s.count}</span>
                      ))}
                    </div>
                  )}

                  {/* Recommended audience + apply */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/20 bg-gold/[0.04] p-3">
                    <div className="min-w-0 text-[11px]">
                      <span className="text-slate-400">{t('bm.recommended')}: </span>
                      <span className="text-slate-200">{buyerMatch.recommendation.ageMin}–{buyerMatch.recommendation.ageMax}</span>
                      {buyerMatch.recommendation.interestNames.map((n) => (
                        <span key={n} className="ms-1 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-gold">{n}</span>
                      ))}
                    </div>
                    <button type="button" onClick={applyBuyerMatch} className="shrink-0 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE]">{t('bm.apply')}</button>
                  </div>

                  <p className="text-[10px] leading-relaxed text-slate-600">{t('bm.provenance')}</p>

                  {/* Secondary: the network learning-loop read (real Meta + CRM outcomes) */}
                  {!aiTargeting ? (
                    <button type="button" onClick={fetchAiTargeting} disabled={aiTargetingLoading} className="text-[11px] text-gold/70 transition hover:text-gold disabled:opacity-60">
                      {aiTargetingLoading ? '…' : `+ ${t('lm.newCampaign.ai.title')}`}
                    </button>
                  ) : (
                    <div className="space-y-1 border-t border-line pt-2 text-[11px] leading-relaxed text-slate-400">
                      <p className="text-slate-300">{aiTargeting.analysis}</p>
                      {aiTargeting.rationale && <p>{aiTargeting.rationale}</p>}
                      <button type="button" onClick={applyAiTargeting} disabled={aiTargetingApplied} className="text-gold/70 transition hover:text-gold disabled:opacity-60">
                        {aiTargetingApplied ? t('lm.newCampaign.ai.applied') : t('lm.newCampaign.ai.apply')}
                      </button>
                    </div>
                  )}
                </div>
              ) : bmError ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-xs text-slate-400">{t('bm.failed')}</p>
                  <button type="button" onClick={loadBuyerMatch} className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold transition hover:bg-gold/20">{t('bm.retry')}</button>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{t('bm.pickListing')}</p>
              )}
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

            {/* Buyer language — real Meta locale targeting (live adlocale search) */}
            <div>
              <Label>{t('lm.newCampaign.s2.label.language')}</Label>
              {form.locales.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {form.locales.map((l) => (
                    <span key={l.key} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] text-gold">
                      {l.name}
                      <button type="button" onClick={() => removeLocale(l.key)} className="text-gold/70 hover:text-gold"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input value={localeQuery} onChange={(e) => searchLocales(e.target.value)} className={inputCls()} placeholder={t('lm.newCampaign.s2.languagePh')} />
                {(localeSearching || localeResults.length > 0) && (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-line bg-surface-2 shadow-xl">
                    {localeSearching && <div className="px-3 py-2 text-[11px] text-slate-500">{t('common.loading')}</div>}
                    {localeResults.map((l) => (
                      <button key={l.key} type="button" onClick={() => addLocale(l)} className="block w-full px-3 py-2 text-start text-xs text-slate-200 hover:bg-gold/10 hover:text-gold">{l.name}</button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{t('lm.newCampaign.s2.languageHint')}</p>
            </div>

            {/* Lookalike from closed buyers — real Meta custom+lookalike audience.
                Gated: building it uploads hashed buyer contacts to Meta. */}
            {lookalike && (
              <div className="rounded-[14px] border border-gold/20 bg-gold/[0.04] p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
                  <Users className="h-3.5 w-3.5" /> {t('lm.newCampaign.lookalike.title')}
                </div>
                {llResult ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> {t('lm.newCampaign.lookalike.created').replace('{n}', String(llResult.uploaded))}
                  </p>
                ) : !lookalike.metaConnected ? (
                  <p className="mt-2 text-[12px] text-slate-400">{t('lm.newCampaign.lookalike.connect')}</p>
                ) : lookalike.count < lookalike.min ? (
                  <p className="mt-2 text-[12px] text-slate-400">{t('lm.newCampaign.lookalike.need').replace('{n}', String(lookalike.count)).replace('{min}', String(lookalike.min))}</p>
                ) : llConfirm ? (
                  <div className="mt-2">
                    <p className="text-[12px] leading-relaxed text-slate-300">{t('lm.newCampaign.lookalike.confirmBody').replace('{n}', String(lookalike.count))}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button type="button" onClick={buildLookalike} disabled={llBuilding} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
                        {llBuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {t('lm.newCampaign.lookalike.confirmCta')}
                      </button>
                      <button type="button" onClick={() => setLlConfirm(false)} disabled={llBuilding} className="rounded-full border border-line px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200">{t('common.cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-[12px] text-slate-400">{t('lm.newCampaign.lookalike.ready').replace('{n}', String(lookalike.count))}</p>
                    <button type="button" onClick={() => setLlConfirm(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20">
                      <Sparkles className="h-3.5 w-3.5" /> {t('lm.newCampaign.lookalike.build')}
                    </button>
                  </div>
                )}
              </div>
            )}

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
                <input type="number" min="18" max="65" className={inputCls()} value={form.ageMin} onChange={(e) => update('ageMin', Math.min(65, Math.max(18, parseInt(e.target.value) || 18)))} />
              </div>
              <div>
                <Label>{t('lm.newCampaign.s2.label.ageMax')}</Label>
                <input type="number" min="18" max="65" className={inputCls()} value={form.ageMax} onChange={(e) => update('ageMax', Math.min(65, Math.max(form.ageMin || 18, parseInt(e.target.value) || 65)))} />
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

        {/* Data Quality Test — verify the listing before it becomes an ad/landing */}
        <TabPopup
          open={dqOpen}
          onClose={() => setDqOpen(false)}
          title={t('dq.title')}
          subtitle={dqData?.listing.name}
          maxWidth="max-w-lg"
          footer={dqData ? (
            <>
              <Link href={dqData.listing.editUrl} className="rounded-full border border-line px-4 py-2 text-sm text-slate-300 transition hover:text-white">{t('dq.editListing')}</Link>
              <button type="button" onClick={() => setDqOpen(false)} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]">{t('dq.close')}</button>
            </>
          ) : undefined}
        >
          {dqLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('dq.running')}</div>
          ) : dqData ? (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 rounded-xl border p-3 ${dqData.readyToBuild ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-amber-400/25 bg-amber-400/[0.06]'}`}>
                <div className={`text-[26px] font-semibold ${dqData.readyToBuild ? 'text-emerald-400' : 'text-amber-400'}`}>{dqData.score}%</div>
                <div className="text-xs leading-relaxed text-slate-300">{dqData.readyToBuild ? t('dq.ready') : t('dq.notReady')}</div>
              </div>
              <div className="space-y-1.5">
                {dqData.checks.map((c) => (
                  <div key={c.key} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2">
                    {c.present
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      : <AlertCircle className={`h-4 w-4 shrink-0 ${c.severity === 'required' ? 'text-red-400' : 'text-amber-400'}`} />}
                    <span className="flex-1 text-sm text-slate-200">{t(`dq.check.${c.key}`)}</span>
                    {c.present
                      ? <span className="truncate text-xs text-slate-500">{c.value}</span>
                      : <span className={`text-[11px] font-medium ${c.severity === 'required' ? 'text-red-400' : 'text-amber-400'}`}>{c.severity === 'required' ? t('dq.missing') : t('dq.optional')}</span>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">{t('dq.editHint')}</p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">{t('dq.failed')}</p>
          )}
        </TabPopup>

        {/* ── Step 3: Creative ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-[18px] font-semibold text-white">{t('lm.newCampaign.s3.heading')}</h2>

            {/* Live ad preview — the actual creative, per placement, not lines of text */}
            <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  {(['feed', 'story'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPreviewPlacement(p)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${previewPlacement === p ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400'}`}>
                      {t(`lm.newCampaign.s3.placement.${p}`)}
                    </button>
                  ))}
                </div>
                {/* The rendered ad */}
                <div className="overflow-hidden rounded-2xl border border-line bg-black">
                  {previewPlacement === 'feed' ? (
                    <div className="bg-[#18181b]">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className="h-7 w-7 rounded-full bg-gold/80" />
                        <div className="text-[11px] leading-tight"><div className="font-semibold text-white">Freehold Property</div><div className="text-slate-500">{t('lm.newCampaign.s3.sponsored')}</div></div>
                      </div>
                      {form.primaryText && <div className="px-3 pb-2 text-[11px] leading-snug text-slate-200 whitespace-pre-line">{form.primaryText.slice(0, 180)}</div>}
                      <div className="relative aspect-square w-full bg-surface-2">
                        {form.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center bg-gradient-to-br from-gold/20 to-transparent text-xs text-slate-500">{t('lm.newCampaign.s3.noImage')}</div>}
                        <div className="absolute bottom-2 end-2 z-10"><QrOverlay /></div>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-[#0f0f11] px-3 py-2">
                        <div className="min-w-0"><div className="truncate text-[11px] font-semibold text-white">{form.headline || t('lm.newCampaign.s3.headlinePh')}</div><div className="truncate text-[10px] text-slate-500">{form.description}</div></div>
                        <span className="shrink-0 rounded-md bg-gold/90 px-2 py-1 text-[10px] font-semibold text-ink">{CTA_OPTIONS.find((c) => c.value === form.cta)?.label}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-[9/16] w-full bg-surface-2">
                      {form.imageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full items-center justify-center bg-gradient-to-b from-gold/20 to-transparent text-xs text-slate-500">{t('lm.newCampaign.s3.noImage')}</div>}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
                        <div className="text-[12px] font-semibold text-white">{form.headline || t('lm.newCampaign.s3.headlinePh')}</div>
                        <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-300">{form.primaryText}</div>
                        <span className="mt-2 inline-block rounded-md bg-gold/90 px-2.5 py-1 text-[10px] font-semibold text-ink">{CTA_OPTIONS.find((c) => c.value === form.cta)?.label}</span>
                      </div>
                      <div className="absolute end-2 top-2 z-10"><QrOverlay /></div>
                    </div>
                  )}
                </div>

                {/* Real Meta-rendered preview — exactly how Meta will show it */}
                <button type="button" onClick={loadMetaPreview} disabled={metaPreviewState === 'loading'}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:text-white disabled:opacity-50">
                  {metaPreviewState === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} {t('lm.newCampaign.metaPreview.button')}
                </button>
                {metaPreviewState === 'demo' && (
                  <p className="mt-1.5 text-[11px] text-amber-400/90">{t('lm.newCampaign.metaPreview.demo')}</p>
                )}
                {metaPreview && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white">
                    {/* Trusted iframe HTML returned by Meta's Graph API */}
                    <div className="[&_iframe]:w-full [&_iframe]:border-0" dangerouslySetInnerHTML={{ __html: metaPreview }} />
                  </div>
                )}
              </div>

              {/* AI copy generation — real Gemini variants (existing generator) */}
              <div className="rounded-2xl border border-gold/20 bg-gold/[0.04] p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold"><Sparkles className="h-3.5 w-3.5" /> {t('lm.newCampaign.s3.generate')}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CREATIVE_ANGLES.map((a) => (
                    <button key={a} type="button" onClick={() => setGenAngle(a)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${genAngle === a ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400'}`}>
                      {t(`lm.newCampaign.s3.angle.${a}`)}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={generateCopy} disabled={genLoading || !form.listingId}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
                  {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {genLoading ? t('lm.newCampaign.s3.generating') : t('lm.newCampaign.s3.generate')}
                </button>
                {variants.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {variants.map((v) => (
                      <button key={v.id} type="button" onClick={() => applyVariant(v)}
                        className="block w-full rounded-xl border border-line bg-surface p-2.5 text-left transition hover:border-gold/30">
                        <div className="text-[11px] font-semibold text-white">{v.headline}</div>
                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-400">{v.primaryText}</div>
                        <span className="mt-1 inline-block text-[10px] text-gold/70">{t('lm.newCampaign.s3.useVariant')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

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

            {/* Destination — driven by the objective so Meta submissions don't break. */}
            <div className="rounded-[14px] border border-gold/20 bg-gold/[0.04] p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
                {activeObjective.dest === 'form' ? <FileText className="h-3.5 w-3.5" /> : activeObjective.dest === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5" /> : activeObjective.dest === 'phone' ? <Phone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                {t('lm.newCampaign.dest.title')} · {t(`lm.newCampaign.dest.kind.${activeObjective.dest}`)}
              </div>

              {activeObjective.dest === 'form' ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select value={leadFormId} onChange={(e) => setLeadFormId(e.target.value)} className={`${inputCls()} max-w-xs`}>
                    <option value="">{leadFormsLoading ? t('common.loading') : t('lm.newCampaign.leadForm.pick')}</option>
                    {leadForms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  {leadFormId && <Link href={`/freehold-intelligence/lead-machine/forms/${leadFormId}`} className="rounded-full border border-line px-3 py-2 text-xs text-slate-300 hover:text-white">{t('lm.newCampaign.leadForm.edit')}</Link>}
                  <Link href="/freehold-intelligence/lead-machine/forms/new" className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/20"><Sparkles className="h-3.5 w-3.5" /> {t('lm.newCampaign.leadForm.create')}</Link>
                </div>
              ) : activeObjective.dest === 'whatsapp' ? (
                <div className="mt-3">
                  <input className={inputCls(!form.whatsappNumber)} value={form.whatsappNumber} onChange={(e) => update('whatsappNumber', e.target.value)} placeholder={t('lm.newCampaign.dest.whatsappPh')} inputMode="tel" />
                  {!form.whatsappNumber && smartDefaults.whatsappNumber && (
                    <button type="button" onClick={() => update('whatsappNumber', smartDefaults.whatsappNumber!.value)} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold hover:bg-gold/20">
                      <Sparkles className="h-3 w-3" /> {t('lm.newCampaign.smart.use').replace('{val}', smartDefaults.whatsappNumber.value).replace('{n}', String(smartDefaults.whatsappNumber.count))}
                    </button>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">{t('lm.newCampaign.dest.whatsappHint')}</p>
                </div>
              ) : activeObjective.dest === 'phone' ? (
                <div className="mt-3">
                  <input className={inputCls(!form.phoneNumber)} value={form.phoneNumber} onChange={(e) => update('phoneNumber', e.target.value)} placeholder={t('lm.newCampaign.dest.phonePh')} inputMode="tel" />
                  {!form.phoneNumber && smartDefaults.phoneNumber && (
                    <button type="button" onClick={() => update('phoneNumber', smartDefaults.phoneNumber!.value)} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold hover:bg-gold/20">
                      <Sparkles className="h-3 w-3" /> {t('lm.newCampaign.smart.use').replace('{val}', smartDefaults.phoneNumber.value).replace('{n}', String(smartDefaults.phoneNumber.count))}
                    </button>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">{t('lm.newCampaign.dest.phoneHint')}</p>
                </div>
              ) : (
                <div className="mt-3">
                  <input className={inputCls(!form.landingUrl)} value={form.landingUrl} onChange={(e) => update('landingUrl', e.target.value)} placeholder={t('lm.landingUrlPlaceholder')} />
                  {(() => {
                    // Prefer the slug the destination URL actually points to, so
                    // "Edit on canvas" opens the exact landing (source-provided
                    // or listing-default), not just the picked listing.
                    const editSlug = landingSlugFromUrl(form.landingUrl) || sourceLandingSlug || form.listingId
                    const fromSource = !!sourceLandingSlug && form.landingUrl.includes(`/lp/${sourceLandingSlug}`)
                    return (
                      <>
                        {fromSource && (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-400"><Sparkles className="h-3 w-3" /> {t('lm.newCampaign.dest.autofilledFromSource')}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href="/freehold-intelligence/lead-machine/landings" className="rounded-full border border-line px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200">{t('lm.newCampaign.dest.pickLanding')}</Link>
                          {editSlug && <Link href={`/freehold-intelligence/lead-machine/landings/${encodeURIComponent(editSlug)}/edit`} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold hover:bg-gold/20">{t('lm.newCampaign.dest.editCanvas')} <ArrowRight className="h-3 w-3" /></Link>}
                        </div>
                        {landingSlugFromUrl(form.landingUrl) && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500">{t('lm.newCampaign.dest.langLabel')}</span>
                            {(['en', 'ar', 'ru'] as const).map((lng) => (
                              <button key={lng} type="button" onClick={() => setLandingLang(lng)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${landingLang === lng ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
                                {t(`lm.newCampaign.dest.lang.${lng}`)}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Conversion pixel — real pixels from the connected account. Only
                  for web destinations (landing/form); calls & chats have no
                  on-site conversion to measure. Hidden entirely when none exist. */}
              {pixelsLoaded && pixels.length > 0 && (activeObjective.dest === 'landing' || activeObjective.dest === 'form') && (
                <div className="mt-3 border-t border-gold/15 pt-3">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <Target className="h-3 w-3" /> {t('lm.newCampaign.pixel.label')}
                  </label>
                  <select value={pixelId} onChange={(e) => setPixelId(e.target.value)} className={`${inputCls()} mt-1.5 max-w-sm`}>
                    <option value="">{t('lm.newCampaign.pixel.default')}</option>
                    {pixels.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.lastFiredTime ? '' : ` — ${t('lm.newCampaign.pixel.noEvents')}`}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">{t('lm.newCampaign.pixel.hint')}</p>
                </div>
              )}
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

            {/* Trakhees QR — overlays the creative in the scan-safe corner */}
            <div>
              <Label>{t('lm.newCampaign.qr.label')}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-gold/40">
                  <Plus className="h-3.5 w-3.5" /> {qrDataUrl ? t('lm.newCampaign.qr.replace') : t('lm.newCampaign.qr.upload')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadQr(e.target.files?.[0] ?? null)} />
                </label>
                {qrDataUrl && (
                  <button type="button" onClick={() => setQrDataUrl('')} className="text-xs text-slate-500 hover:text-white">{t('lm.newCampaign.qr.remove')}</button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{t('lm.newCampaign.qr.hint')}</p>
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
