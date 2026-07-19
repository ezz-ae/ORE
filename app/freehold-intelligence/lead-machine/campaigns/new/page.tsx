'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadAccountMemory, saveAccountMemory, saveAccountMemoryDebounced } from '@/lib/freehold/account-memory'
import { UAE_INTERESTS, UAE_CITIES, type TargetingRecommendation, type TargetingStrategy } from '@/lib/meta/targeting-catalog'
import { TARGETING_TEMPLATES } from '@/lib/meta/targeting-templates'
import { TabPopup } from '@/components/freehold/ui/tab-popup'
import { CampaignListingPicker } from '@/components/freehold/campaign-listing-picker'
import { useSession } from '@/lib/freehold/use-session'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Megaphone,
  DollarSign, Users, FileText, Rocket, AlertCircle, Loader2,
  Monitor, Sparkles, ChevronRight, ChevronDown, Sliders, Crosshair, Gauge, MessageCircle, Phone,
  FolderOpen, Upload, X, Copy,
} from 'lucide-react'
// Real inventory replaces the old seed listings: the picker loads live projects
// from /api/freehold/inventory so campaigns are always built on real stock.
interface WizardListing {
  id: string
  projectId: string
  projectName: string
  area: string
  developer: string
  landingStatus: string
  landingSlug: string | null
  imageUrl: string
  startingPrice: number | null
  paymentPlan: string | null
  landingUrl: string
}
import type { LaunchCampaignPayload, MetaCampaignObjective, MetaCta, GeneratedCreativeVariant, CampaignTargeting, PlacementKey, PlacementCreativeOverride, MetaPixel } from '@/lib/meta/types'

// A saved audience from the Audiences tab, attachable to this launch.
interface SavedAudienceOption { id: string; name: string; kind: string; description: string; spec: CampaignTargeting }
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
  // Data Quality checks the operator has manually confirmed for THIS launch
  // only. Purely local wizard state — never writes to the inventory record,
  // and a check acknowledged here still shows as failing in Inventory. Reset
  // whenever the listing changes.
  dqVerifiedChecks: string[]
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
  // Landing-page languages this campaign's audience should match — the same
  // three the /lp pages actually serve (lib/landing-i18n.ts). Default all
  // three; resolved server-side into Meta targeting_spec.locales.
  leadLanguages: string[]
  publisherPlatforms: string[]
  // 'automatic' (default) = today's publisherPlatforms-derived delivery,
  // unchanged. 'manual' narrows delivery to EXACTLY the surfaces picked in
  // manualPlacements below (real per-surface control, not the coarse
  // facebook/instagram/audience_network platform toggle above).
  placementMode: 'automatic' | 'manual'
  // PlacementKey values (see PLACEMENT_KEYS) selected when placementMode is
  // 'manual'. Ignored (and can be non-empty) when placementMode is 'automatic'.
  manualPlacements: string[]
  // Step 3
  primaryText:   string
  // Meta's real "Multiple text options" / dynamic-creative feature — Meta
  // auto-tests combinations of these within ONE ad (never several separate
  // ads). Always at least 1 entry (Meta requires ≥1); capped at 5 (Meta's
  // real limit for both titles and descriptions).
  headlines:     string[]
  descriptions:  string[]
  landingUrl:    string
  cta:           MetaCta
  imageUrl:      string
  imageHash:     string
  // Per-placement creative overrides (landing-click ads only) — blank fields
  // inherit the default creative above.
  placementOverrides: Partial<Record<PlacementKey, PlacementCreativeOverride>>
  // Step 4
  launchStatus:  'ACTIVE' | 'PAUSED'
  cplCapAED:     number
  autoEnhance:   'on' | 'off' | 'approval'
  // Conversion pixel override — '' means "use the ad account's default
  // pixel" (today's unchanged behavior). Populated from /api/meta/pixels.
  pixelId:       string
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

// The three lead languages the product actually serves end-to-end — matches
// LpLang in lib/landing-i18n.ts exactly. Option labels are the language's own
// native name (invariant across the operator's UI locale, same convention as
// the landing pages' own language switcher).
const LEAD_LANGUAGE_OPTIONS: { code: string; labelKey: string }[] = [
  { code: 'en', labelKey: 'lm.newCampaign.s2.leadLanguage.en' },
  { code: 'ar', labelKey: 'lm.newCampaign.s2.leadLanguage.ar' },
  { code: 'ru', labelKey: 'lm.newCampaign.s2.leadLanguage.ru' },
]

// Labels resolve through i18n (lm.creatives.generate.cta.<value>) at render.
const CTA_OPTIONS: MetaCta[] = ['LEARN_MORE', 'GET_QUOTE', 'SIGN_UP', 'CONTACT_US', 'BOOK_NOW', 'APPLY_NOW']

// The 5 placements the wizard previews AND — for landing-click ads — lets an
// operator give a different image/headline/primary text. Labels reuse the
// SAME lm.newCampaign.s3.pl.<key> keys the placements wall already has.
const PLACEMENT_KEYS: PlacementKey[] = ['fbFeed', 'igFeed', 'igStory', 'fbStory', 'reels']

const STEPS: { n: number; labelKey: string; icon: typeof Megaphone }[] = [
  { n: 1, labelKey: 'lm.newCampaign.step.campaign',  icon: Megaphone },
  { n: 2, labelKey: 'lm.newCampaign.step.targeting', icon: Users },
  { n: 3, labelKey: 'lm.newCampaign.step.creative',  icon: FileText },
  { n: 4, labelKey: 'lm.newCampaign.step.launch',    icon: Rocket },
]

// Placement control: 'automatic' keeps the coarse facebook/instagram/audience
// network toggle above driving delivery (today's behavior, unchanged).
// 'manual' switches to picking exact placement surfaces from PLACEMENT_KEYS.
const PLACEMENT_MODE_OPTIONS: { value: 'automatic' | 'manual'; labelKey: string; descKey: string }[] = [
  { value: 'automatic', labelKey: 'lm.newCampaign.s2.placementMode.automatic', descKey: 'lm.newCampaign.s2.placementMode.automaticDesc' },
  { value: 'manual',    labelKey: 'lm.newCampaign.s2.placementMode.manual',    descKey: 'lm.newCampaign.s2.placementMode.manualDesc' },
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

// Appends one AI copy variant to a headlines/descriptions list for Meta's
// real multi-text feature — exact-string duplicates are skipped, and once
// Meta's real 5-entry cap is reached the LAST entry is replaced (with a
// toast) rather than silently growing past what Meta allows.
function appendCapped(list: string[], value: string, capMessage: string): string[] {
  const next = value.trim()
  if (!next || list.includes(next)) return list
  if (list.length >= 5) {
    toast(capMessage)
    return [...list.slice(0, 4), next]
  }
  return [...list, next]
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewCampaignPage() {
  const t = useT()
  const router = useRouter()
  // Landing pages are editable only by non-broker accounts (Cor/Bashar/Yamen);
  // brokers get preview-only in the picker.
  const { user } = useSession()
  const canEditLandings = !!user && user.role !== 'broker'
  const [step,    setStep]    = useState<WizardStep>(1)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [launched, setLaunched] = useState<{ campaignId: string; status: string } | null>(null)

  const [form, setForm] = useState<WizardState>({
    listingId:    '',
    productObjective: 'smart_landing',
    objective:    'LINK_CLICKS',
    campaignName: '',
    dqVerifiedChecks: [],
    strategy:     'advantage_broad',
    dailyBudgetAED: 200,
    lifetimeCapAED: 0,
    // Default-all, deselectable — bounded to the curated list above, never
    // "every country Meta supports".
    countries:    [...COUNTRY_CODES],
    cityKeys:     ['297928'], // Dubai
    ageMin:       28,
    ageMax:       65,
    genders:      [],
    interestIds:  [UAE_INTERESTS[0].id, UAE_INTERESTS[3].id],
    leadLanguages: ['en', 'ar', 'ru'],
    publisherPlatforms: ['facebook', 'instagram'],
    placementMode: 'automatic',
    manualPlacements: [],
    primaryText:  '',
    headlines:    [''],
    descriptions: ['Request the investor summary now.'],
    landingUrl:   'https://www.freeholdproperty.ae',
    cta:          'LEARN_MORE',
    imageUrl:     '',
    imageHash:    '',
    placementOverrides: {},
    launchStatus: 'PAUSED',
    cplCapAED:    150,
    autoEnhance:  'approval',
    pixelId:      '',
  })
  // Campaign source material — brochure extracts, listing/developer links,
  // notes. THE input for new launches that have no landing page yet: copy
  // generation grounds on it instead of guessing.
  const [campaignSources, setCampaignSources] = useState<{ label: string; text: string }[]>([])
  const [srcLink, setSrcLink] = useState('')
  const [srcBusy, setSrcBusy] = useState(false)
  const [srcError, setSrcError] = useState<string | null>(null)

  async function addSourceFile(file: File | null) {
    if (!file) return
    setSrcError(null)
    const name = file.name
    // Plain text travels as-is; PDFs and images go through the multimodal
    // ingest (real Gemini extraction); other formats are honest pointers.
    if (/\.(txt|md|csv)$/i.test(name)) {
      const text = (await file.text()).slice(0, 6000)
      setCampaignSources((prev) => [...prev, { label: name, text: `${name}:\n${text}` }])
      return
    }
    const isPdf = /\.pdf$/i.test(name) || file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) {
      setCampaignSources((prev) => [...prev, { label: name, text: `Attached file "${name}" (content not extracted — treat as a reference the operator can quote).` }])
      return
    }
    if (file.size > 6_000_000) { setSrcError(t('lm.newCampaign.src.tooLarge')); return }
    setSrcBusy(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = reject
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/freehold/expert/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: isPdf ? 'pdf' : 'image', data: dataUrl, note: 'Campaign source for an ad campaign.' }),
      })
      const d = await res.json()
      if (d?.text) setCampaignSources((prev) => [...prev, { label: name, text: `${name}:\n${String(d.text).slice(0, 6000)}` }])
      else setSrcError(d?.error || t('lm.newCampaign.src.extractFailed'))
    } catch {
      setSrcError(t('lm.newCampaign.src.extractFailed'))
    } finally {
      setSrcBusy(false)
    }
  }

  function addSourceLink() {
    const url = srcLink.trim()
    if (!/^https?:\/\//i.test(url)) { setSrcError(t('lm.newCampaign.src.badLink')); return }
    setSrcError(null)
    setCampaignSources((prev) => [...prev, { label: url.replace(/^https?:\/\//, '').slice(0, 60), text: `Reference link: ${url}` }])
    setSrcLink('')
  }
  const [uploadingImg, setUploadingImg] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)

  // Live Meta reach estimate for the manual "Edit Audience" popup — reuses the
  // SAME /api/freehold/ads/audiences/reach endpoint (and request/response
  // shape) as the standalone Audiences builder's checkBuilderReach. Debounced
  // so it fires once the operator pauses, never on every keystroke/click, and
  // never shows a fabricated number — only a real Meta estimate or an honest
  // connect/warming state.
  const [audienceReach, setAudienceReach] = useState<{ lower: number; upper: number; ready: boolean } | null>(null)
  const [audienceReachLoading, setAudienceReachLoading] = useState(false)
  const [audienceReachConnected, setAudienceReachConnected] = useState(true)
  useEffect(() => {
    if (!audienceOpen) return
    setAudienceReachLoading(true)
    const timer = setTimeout(() => {
      const spec: Partial<CampaignTargeting> = {
        countries: form.countries,
        cityKeys: form.cityKeys,
        ageMin: form.ageMin,
        ageMax: form.ageMax,
        genders: form.genders.length ? form.genders : undefined,
        interests: UAE_INTERESTS.filter((i) => form.interestIds.includes(i.id)),
      }
      fetch('/api/freehold/ads/audiences/reach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          setAudienceReachConnected(d?.connected !== false)
          setAudienceReach(d?.reach ?? null)
        })
        .catch(() => setAudienceReach(null))
        .finally(() => setAudienceReachLoading(false))
    }, 650)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceOpen, form.countries, form.cityKeys, form.ageMin, form.ageMax, form.genders, form.interestIds])

  // Saved audiences (Audiences tab). Attaching one overrides the audience
  // fields of the launch — countries, age, gender, language, interests,
  // behaviors, narrowing, exclusions, attached Meta audiences — while the
  // wizard's placements still apply. ?audience=<id> pre-attaches.
  const [savedAudiences, setSavedAudiences] = useState<SavedAudienceOption[]>([])
  const [attachedAudience, setAttachedAudience] = useState<SavedAudienceOption | null>(null)
  useEffect(() => {
    fetch('/api/freehold/ads/audiences')
      .then((r) => r.json())
      .then((d) => {
        const list: SavedAudienceOption[] = Array.isArray(d?.audiences) ? d.audiences : []
        setSavedAudiences(list)
        const wanted = new URLSearchParams(window.location.search).get('audience')
        if (wanted) {
          const hit = list.find((a) => a.id === wanted)
          if (hit) setAttachedAudience(hit)
        }
      })
      .catch(() => null)
  }, [])

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

  // Per-launch acknowledgment of failing DQ checks. Local wizard state only:
  // it never mutates the inventory record, and an acknowledged check is
  // "proceeding with awareness", never a fabricated pass.
  function toggleDqVerified(key: string) {
    setForm((prev) => ({
      ...prev,
      dqVerifiedChecks: prev.dqVerifiedChecks.includes(key)
        ? prev.dqVerifiedChecks.filter((k) => k !== key)
        : [...prev.dqVerifiedChecks, key],
    }))
  }
  // Guard against stale results from a previously selected listing.
  const dqForCurrentListing = dqData && dqData.listing.slug === form.listingId ? dqData : null
  // Deliberately mixed-severity (required AND recommended): the Step 4 banner
  // surfaces ANY incompleteness, so its copy stays severity-neutral
  // ("field(s)", not "required field(s)").
  const dqFailingChecks = dqForCurrentListing ? dqForCurrentListing.checks.filter((c) => !c.present) : []
  const dqUnacknowledged = dqFailingChecks.filter((c) => !form.dqVerifiedChecks.includes(c.key))
  const dqAcknowledgedCount = dqFailingChecks.length - dqUnacknowledged.length

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
  // The sticky preview rail switches between the ad mock and the live landing page.
  const [previewTab, setPreviewTab] = useState<'ad' | 'landing'>('ad')
  // Full placements wall — one popup showing the ad across every surface.
  const [placementsOpen, setPlacementsOpen] = useState(false)
  const [genAngle, setGenAngle] = useState<'investor' | 'urgency' | 'lifestyle' | 'yield' | 'golden_visa' | 'end_user'>('investor')
  const [variants, setVariants] = useState<GeneratedCreativeVariant[]>([])
  const [genLoading, setGenLoading] = useState(false)
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
          // Ground the copy in the operator's source material (brochure
          // extracts, links) — decisive for new launches with no landing page.
          sources: campaignSources.map((s) => s.text),
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
    // Multi-variant copy is Meta's real "Multiple text options" feature —
    // ADD each generated headline/description to the ad's list (deduped,
    // capped at 5) instead of replacing the single value, so every accepted
    // variant becomes one more combination Meta auto-tests within this ad.
    const headlines = appendCapped(form.headlines, v.headline, t('lm.newCampaign.s3.headlineCapReached'))
    const descriptions = v.description
      ? appendCapped(form.descriptions, v.description, t('lm.newCampaign.s3.descriptionCapReached'))
      : form.descriptions
    setForm((prev) => ({ ...prev, primaryText: v.primaryText, headlines, descriptions, cta: v.cta }))
  }

  // The learning loop: fetch AI targeting learned from ACTUAL lead outcomes.
  const [aiTargeting, setAiTargeting] = useState<TargetingRecommendation | null>(null)
  const [aiTargetingLoading, setAiTargetingLoading] = useState(false)
  const [aiTargetingApplied, setAiTargetingApplied] = useState(false)
  async function fetchAiTargeting() {
    setAiTargetingLoading(true)
    try {
      // Send the SELECTED listing so the recommendation is tailored to this
      // asset and its price band — not a one-size-fits-the-account answer.
      const listing = listings.find((l) => l.id === form.listingId)
      const res = await fetch('/api/freehold/ai/targeting', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: listing
            ? { name: listing.projectName, area: listing.area, price: listing.startingPrice ?? 0 }
            : undefined,
        }),
      })
      const d = await res.json()
      if (res.ok && d?.recommendation) setAiTargeting(d.recommendation)
    } catch { /* panel simply stays collapsed */ }
    finally { setAiTargetingLoading(false) }
  }
  // The learning loop loads ITSELF when targeting opens — the intelligence is
  // the default view of step 2, not a hidden button.
  useEffect(() => {
    if (step === 2 && !aiTargeting && !aiTargetingLoading) fetchAiTargeting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  function applyAiTargeting() {
    if (!aiTargeting) return
    setForm((prev) => ({
      ...prev,
      strategy: aiTargeting.strategy,
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
  // Landing-click ads get per-placement creative via Meta's asset_feed_spec.
  // Lead ads get it too, but via a different real mechanism — a separate ad
  // set per customized placement (see launchFullCampaign in lib/meta/client)
  // — because Meta restricts the asset_feed_spec field that would carry a
  // lead_gen_form_id to internal/Special-Ad-Category apps only. WhatsApp/
  // call ads still use one shared creative for every placement.
  const supportsPlacementCreative = activeObjective.dest === 'landing' || activeObjective.dest === 'form'

  // Meta's real "Multiple text options" (dynamic creative) feature only
  // actually engages for a plain landing-click ad with NO active
  // per-placement creative override — the exact eligibility createAdCreative
  // enforces server-side (client.ts: an active override takes the
  // asset_customization_rules path instead, before wantsMultiText is even
  // evaluated; Meta Lead/WhatsApp/Call destinations never reach it either).
  // Gate the "add another headline/description" affordance and the review
  // step's "+N more variants" promise on this so we never invite copy that
  // Meta will silently ignore.
  const hasActivePlacementOverrides = Object.values(form.placementOverrides).some(
    (ov) => ov && (ov.headline?.trim() || ov.primaryText?.trim() || ov.imageHash || ov.imageUrl),
  )
  const multiTextEligible = activeObjective.dest === 'landing' && !hasActivePlacementOverrides

  // Lead form — wired into the Meta Lead objective. The forms feature already
  // exists (/lead-machine/forms + /api/meta/forms); the builder now lets you
  // pick, create, or edit the in-ad form the leads land in.
  type LeadFormLite = { id: string; name: string; leads_count?: number; status?: string }
  const [leadForms, setLeadForms] = useState<LeadFormLite[]>([])
  const [leadFormId, setLeadFormId] = useState('')
  // In-ad form creation: the form is created (or duplicated) in a popup and
  // attached to THIS ad immediately — the wizard and its state never unload.
  const [formPopupOpen, setFormPopupOpen] = useState(false)
  const [newFormName, setNewFormName] = useState('')
  // Meta form locale for in-ad creation. Option labels are each language's
  // own name, so they are intentionally not translated.
  const FORM_LOCALES: { value: string; label: string }[] = [
    { value: 'en_US', label: 'English' },
    { value: 'ar_AR', label: 'العربية' },
    { value: 'ru_RU', label: 'Русский' },
  ]
  const [newFormLocale, setNewFormLocale] = useState('en_US')
  const [formBusy, setFormBusy] = useState(false)
  const [dupBusyId, setDupBusyId] = useState<string | null>(null)

  async function createFormPayload(name: string, questions: Array<{ type: string; label?: string; key?: string; options?: Array<{ value: string; label: string }> }>, locale?: string) {
    const listing = listings.find((l) => l.id === form.listingId)
    const res = await fetch('/api/meta/forms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        listingId: form.listingId,
        listingName: listing?.projectName ?? name,
        landingUrl: form.landingUrl,
        questions,
        privacyPolicyUrl: 'https://freeholdproperty.ae/privacy',
        ...(locale ? { locale } : {}),
        thankYouTitle: t('pforms.default.thankYouTitle'),
        thankYouBody: t('pforms.default.thankYouBody'),
      }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || !d.id) throw new Error(d.error || t('pforms.error.createFailed'))
    return d.id as string
  }

  function attachForm(id: string, name: string) {
    setLeadForms((prev) => [{ id, name, status: 'ACTIVE', leads_count: 0, created_time: new Date().toISOString() } as LeadFormLite, ...prev])
    setLeadFormId(id)
    setFormPopupOpen(false)
    toast.success(t('lm.newCampaign.leadForm.attached'))
  }

  async function createInlineForm() {
    if (!newFormName.trim() || formBusy) return
    setFormBusy(true)
    try {
      const id = await createFormPayload(newFormName.trim(), [{ type: 'FULL_NAME' }, { type: 'PHONE' }, { type: 'EMAIL' }], newFormLocale)
      attachForm(id, newFormName.trim())
    } catch (e) { toast.error(e instanceof Error ? e.message : t('pforms.error.createFailed')) }
    finally { setFormBusy(false) }
  }

  async function duplicateForm(src: LeadFormLite) {
    if (dupBusyId) return
    setDupBusyId(src.id)
    try {
      // Copy the source form's real questions so the duplicate matches it.
      const res = await fetch(`/api/meta/forms/${src.id}`, { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      const qs = Array.isArray(d.form?.questions) && d.form.questions.length
        ? d.form.questions.map((q: { type: string; label?: string; key?: string }) => ({ type: q.type, ...(q.label ? { label: q.label } : {}), ...(q.key ? { key: q.key } : {}) }))
        : [{ type: 'FULL_NAME' }, { type: 'PHONE' }, { type: 'EMAIL' }]
      const name = `${src.name} · copy`
      const id = await createFormPayload(name, qs)
      attachForm(id, name)
    } catch (e) { toast.error(e instanceof Error ? e.message : t('pforms.error.createFailed')) }
    finally { setDupBusyId(null) }
  }
  const [leadFormsLoading, setLeadFormsLoading] = useState(false)
  // Destination number for call / WhatsApp objectives (E.164, e.g. +9715…).
  const [destinationPhone, setDestinationPhone] = useState('')
  // Conversion pixel picker (step 4) — real pixels on the connected ad
  // account via the existing /api/meta/pixels endpoint. Loaded once; an empty
  // list (not connected, or no pixels) just leaves the "account default"
  // option, so a demo/disconnected session never blocks the wizard.
  const [pixels, setPixels] = useState<MetaPixel[]>([])
  const [pixelsLoading, setPixelsLoading] = useState(false)
  useEffect(() => {
    setPixelsLoading(true)
    fetch('/api/meta/pixels', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.pixels)) setPixels(d.pixels as MetaPixel[]) })
      .catch(() => {})
      .finally(() => setPixelsLoading(false))
  }, [])
  useEffect(() => {
    if (form.productObjective !== 'meta_lead') return
    setLeadFormsLoading(true)
    fetch('/api/meta/forms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.forms)) setLeadForms(d.forms as LeadFormLite[]) })
      .catch(() => {})
      .finally(() => setLeadFormsLoading(false))
  }, [form.productObjective])
  // A just-created/attached form can lag out of Meta's list — keep it
  // selectable in the picker so the wiring is never invisible ("can't find
  // the form again").
  useEffect(() => {
    if (!leadFormId || leadFormsLoading) return
    setLeadForms((prev) => (prev.some((f) => f.id === leadFormId)
      ? prev
      : [{ id: leadFormId, name: t('lm.newCampaign.leadForm.attachedOption') }, ...prev]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadFormId, leadFormsLoading])

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
        const draft = JSON.parse(raw) as Partial<WizardState> & { __leadFormId?: string }
        setForm((prev) => ({ ...prev, ...draft }))
        if (typeof draft.__leadFormId === 'string' && draft.__leadFormId) setLeadFormId(draft.__leadFormId)
        restoredLocally = true
      }
    } catch { /* ignore corrupt drafts */ }
    loadAccountMemory().then((m) => {
      const acctDraft = m.campaignDraft
      if (!restoredLocally && acctDraft && typeof acctDraft === 'object') {
        setForm((prev) => ({ ...prev, ...(acctDraft as Partial<WizardState>) }))
        const savedFormId = (acctDraft as { __leadFormId?: string }).__leadFormId
        if (typeof savedFormId === 'string' && savedFormId) setLeadFormId(savedFormId)
      }
      draftRestored.current = true
    })
  }, [])
  useEffect(() => {
    // The attached lead form travels WITH the draft — leaving to edit the form
    // (opens in a new tab) and coming back must never lose the wiring, and
    // "Edit form" must always be able to find the form it just created.
    const draft = { ...form, __leadFormId: leadFormId }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* full/blocked storage */ }
    // Account save waits for restore so a pristine form never clobbers a
    // draft the account already holds.
    if (draftRestored.current) saveAccountMemoryDebounced('campaignDraft', draft, 1500)
  }, [form, leadFormId])

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
            developer: String(p.developer || ''),
            landingStatus: String(p.landingStatus || 'missing'),
            landingSlug: (p.landingSlug as string) || null,
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
  // "Create Ad Campaign" link (?project=<slug>&name=<name>&price=<aed>),
  // and/or from a targeting template (?template=<id> — the "Use this
  // template" buttons in the targeting gallery).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const templateId = p.get('template')
    if (templateId) {
      const tmpl = TARGETING_TEMPLATES.find((x) => x.id === templateId)
      if (tmpl) {
        setForm((prev) => ({
          ...prev,
          countries: tmpl.targeting.countries.length ? tmpl.targeting.countries : prev.countries,
          cityKeys: tmpl.targeting.cityKeys.length ? tmpl.targeting.cityKeys : prev.cityKeys,
          ageMin: tmpl.targeting.ageMin,
          ageMax: tmpl.targeting.ageMax,
          genders: tmpl.targeting.genders ?? prev.genders,
          interestIds: tmpl.targeting.interests.map((i) => i.id),
          publisherPlatforms: tmpl.targeting.publisherPlatforms.length ? tmpl.targeting.publisherPlatforms : prev.publisherPlatforms,
        }))
      }
    }
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
      headlines: [displayName],
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
      headlines:    [listing.projectName],
      landingUrl:   listing.landingUrl,
      imageUrl:     listing.imageUrl,
      imageHash:    '',   // fall back to the listing photo unless a new file is uploaded
      // Acknowledgments belong to one listing's checks — never carry them
      // over to a different listing.
      dqVerifiedChecks: [],
    }))
    setDqData(null)
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

  // ── Library / Drive media picker ────────────────────────────────────────────
  // Use anything you made in Drive (QR-stamped permits, edited renders) as the
  // ad image. Drive exports are data: URLs — ingest them natively into the Meta
  // ad account (image_hash) through the same adimages endpoint uploads use.
  type LibImage = { id: string; title: string; url: string | null }
  const [libOpen, setLibOpen] = useState(false)
  const [libLoading, setLibLoading] = useState(false)
  const [libImages, setLibImages] = useState<LibImage[]>([])
  const [libApplying, setLibApplying] = useState('')

  async function toggleLibrary() {
    const next = !libOpen
    setLibOpen(next)
    if (!next || libImages.length || libLoading) return
    setLibLoading(true)
    try {
      const r = await fetch('/api/freehold/library?kind=image', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (Array.isArray(d?.items)) setLibImages((d.items as LibImage[]).filter((i) => i.url))
    } finally { setLibLoading(false) }
  }

  async function useLibraryImage(item: LibImage) {
    if (!item.url) return
    if (item.url.startsWith('data:')) {
      setLibApplying(item.id); setApiError(null)
      try {
        const res = await fetch('/api/meta/adimages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: item.url }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok || !d.hash) { setApiError(d?.error || t('lm.newCampaign.s3.libFailed')); return }
        setForm((prev) => ({ ...prev, imageHash: d.hash, imageUrl: d.url || prev.imageUrl }))
        setLibOpen(false)
      } finally { setLibApplying('') }
    } else {
      setForm((prev) => ({ ...prev, imageUrl: item.url as string, imageHash: '' }))
      setLibOpen(false)
    }
  }

  // ── Per-placement creative overrides ────────────────────────────────────────
  // Landing-click ads only (Meta's per-placement creative — asset_feed_spec —
  // shares the destination's CTA-value slot that lead-form/WhatsApp/call ads
  // need for their form id / phone number, so it isn't offered there).
  const [overrideOpenKey, setOverrideOpenKey] = useState<PlacementKey | null>(null)
  const [overrideUploading, setOverrideUploading] = useState<PlacementKey | ''>('')
  const [overrideLibFor, setOverrideLibFor] = useState<PlacementKey | ''>('')

  function overrideOf(key: PlacementKey): PlacementCreativeOverride {
    return form.placementOverrides[key] ?? {}
  }
  function isCustomized(key: PlacementKey): boolean {
    const ov = overrideOf(key)
    return !!(ov.headline?.trim() || ov.primaryText?.trim() || ov.imageHash || ov.imageUrl)
  }
  function setOverrideField<K extends keyof PlacementCreativeOverride>(key: PlacementKey, field: K, value: PlacementCreativeOverride[K]) {
    setForm((prev) => ({
      ...prev,
      placementOverrides: { ...prev.placementOverrides, [key]: { ...prev.placementOverrides[key], [field]: value } },
    }))
  }
  // Atomic hash+url update (mirrors the default-image pattern) so a stale
  // imageUrl fallback can never win a race against its own imageHash write.
  function setOverrideImage(key: PlacementKey, hash: string, url?: string) {
    setForm((prev) => ({
      ...prev,
      placementOverrides: {
        ...prev.placementOverrides,
        [key]: { ...prev.placementOverrides[key], imageHash: hash, imageUrl: url || prev.placementOverrides[key]?.imageUrl },
      },
    }))
  }
  function clearOverride(key: PlacementKey) {
    setForm((prev) => {
      const next = { ...prev.placementOverrides }
      delete next[key]
      return { ...prev, placementOverrides: next }
    })
  }

  async function onUploadOverrideImage(key: PlacementKey, file: File | null) {
    if (!file) return
    setOverrideUploading(key); setApiError(null)
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
      setOverrideImage(key, d.hash, d.url)
    } catch {
      setApiError('Could not read the image file')
    } finally {
      setOverrideUploading('')
    }
  }

  async function toggleOverrideLibrary(key: PlacementKey) {
    const next = overrideLibFor === key ? '' : key
    setOverrideLibFor(next)
    if (!next || libImages.length || libLoading) return
    setLibLoading(true)
    try {
      const r = await fetch('/api/freehold/library?kind=image', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (Array.isArray(d?.items)) setLibImages((d.items as LibImage[]).filter((i) => i.url))
    } finally { setLibLoading(false) }
  }

  async function useOverrideLibraryImage(key: PlacementKey, item: LibImage) {
    if (!item.url) return
    if (item.url.startsWith('data:')) {
      setOverrideUploading(key); setApiError(null)
      try {
        const res = await fetch('/api/meta/adimages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: item.url }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok || !d.hash) { setApiError(d?.error || t('lm.newCampaign.s3.libFailed')); return }
        setOverrideImage(key, d.hash, d.url)
        setOverrideLibFor('')
      } finally { setOverrideUploading('') }
    } else {
      setOverrideField(key, 'imageUrl', item.url as string)
      setOverrideField(key, 'imageHash', '')
      setOverrideLibFor('')
    }
  }

  // ── Launch ─────────────────────────────────────────────────────────────────
  async function handleLaunch() {
    setLoading(true)
    setApiError(null)

    // Destination integrity — the chosen objective must be fully wired before
    // any money moves (a picked instant form MUST reach the launched ad).
    const dest: LaunchCampaignPayload['destination'] =
      activeObjective.dest === 'form' ? 'form'
      : activeObjective.dest === 'whatsapp' ? 'whatsapp'
      : activeObjective.dest === 'phone' ? 'phone'
      : 'landing'
    if (dest === 'form' && !leadFormId) {
      setApiError(t('lm.newCampaign.err.needForm')); setLoading(false); setStep(1); return
    }
    if (dest === 'phone' && !destinationPhone.trim()) {
      setApiError(t('lm.newCampaign.err.needPhone')); setLoading(false); setStep(1); return
    }

    const listing = listings.find((l) => l.id === form.listingId)
    const interests = UAE_INTERESTS.filter((i) => form.interestIds.includes(i.id))

    const payload: LaunchCampaignPayload = {
      campaignName:   form.campaignName,
      objective:      form.objective,
      listingId:      form.listingId,
      listingName:    listing?.projectName ?? form.campaignName,
      dailyBudgetAED: form.dailyBudgetAED,
      // An attached saved audience IS the audience — its full definition
      // (behaviors, narrowing, exclusions, Meta audiences) replaces the manual
      // fields; only the wizard's placements still apply.
      targeting: attachedAudience
        ? { ...attachedAudience.spec, publisherPlatforms: form.publisherPlatforms }
        : {
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
        // Singular fields stay the honest single-value fallback (headlines[0]
        // / descriptions[0]) for any backward-compatible reader; the plural
        // arrays below are what actually enables Meta's real multi-text
        // feature server-side when more than one entry is present.
        headline:     form.headlines[0] || '',
        headlines:    form.headlines,
        description:  form.descriptions[0] || '',
        descriptions: form.descriptions,
        // New launches often have no landing page yet — an empty URL falls
        // back to the project's public page, which always exists for a
        // listed project. Never block a launch on a missing LP.
        landingUrl:  form.landingUrl || `https://www.freeholdproperty.ae/projects/${encodeURIComponent(form.listingId)}`,
        cta:         form.cta,
        imageUrl:    form.imageUrl || undefined,
        imageHash:   form.imageHash || undefined,
        // Per-placement creative is only offered (and only meaningful) for
        // landing-click and lead-form ads — strip it for WhatsApp/call so a
        // stale draft never silently applies per-placement customization to
        // an ad that only carries one shared creative.
        placementOverrides: (dest === 'landing' || dest === 'form')
          ? Object.fromEntries(
              Object.entries(form.placementOverrides).filter(([, ov]) =>
                ov && (ov.headline?.trim() || ov.primaryText?.trim() || ov.imageHash || ov.imageUrl)))
          : undefined,
      },
      launchStatus: form.launchStatus,
      // The wiring that was missing: the picked instant form + destination
      // now actually reach the launch (previously leadFormId was UI-only).
      destination:      dest,
      leadFormId:       dest === 'form' ? leadFormId : undefined,
      destinationPhone: dest === 'phone' ? destinationPhone.trim() || undefined : undefined,
      // Money guardrails — real Meta controls, not decorative fields:
      // spend_cap on the campaign, COST_CAP bid on the ad set.
      lifetimeCapAED:   form.lifetimeCapAED > 0 ? form.lifetimeCapAED : undefined,
      cplCapAED:        form.cplCapAED > 0 ? form.cplCapAED : undefined,
      // Real conversion pixel override picked in step 4 — '' (account
      // default) sends undefined so createAdSet falls back to the
      // account's default pixel exactly as before.
      pixelId:          form.pixelId || undefined,
      // Lead-language locale targeting. An attached saved audience carries
      // its own complete definition (see the targeting comment above), so
      // this field never overrides it. All three selected = no narrowing
      // worth sending — omit rather than restrict to the full set.
      leadLanguages:    attachedAudience || form.leadLanguages.length >= LEAD_LANGUAGE_OPTIONS.length
        ? undefined
        : form.leadLanguages,
      // Real per-surface placement control — 'automatic' (default) keeps the
      // publisherPlatforms-derived behavior above; only sent as 'manual' with
      // its picks when the operator actually chose specific surfaces.
      placementMode:    form.placementMode,
      manualPlacements: form.placementMode === 'manual' ? form.manualPlacements : undefined,
      // Persisted per campaign — the autopilot pass enforces it.
      autoEnhance:      form.autoEnhance,
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
            href={`/freehold-intelligence/ads-live/meta/${launched.campaignId}`}
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

  // AdMock renders ONE combo — the first headline/description — as an honest
  // single preview even though the launched ad may carry more of each (Meta's
  // real multi-text feature auto-tests the rest; a mock can't show every
  // combination Meta might serve).
  const previewCreative = { ...form, headline: form.headlines[0] || '', description: form.descriptions[0] || '' }

  // Landing preview target — the /lp/ path inside whatever URL is set, so the
  // rail iframes the same deployment (works in preview and production alike).
  const lpMatch = form.landingUrl.match(/\/lp\/[A-Za-z0-9-]+/)
  const lpPath = lpMatch ? lpMatch[0] : ''

  const summaryTiles = [
    { labelKey: 'lm.newCampaign.s4.tileLabel.listing',   value: selectedListing?.projectName ?? form.listingId },
    { labelKey: 'lm.newCampaign.s4.tileLabel.objective',  value: t(activeObjective.labelKey) },
    { labelKey: 'lm.newCampaign.s4.tileLabel.budget',     value: `AED ${form.dailyBudgetAED.toLocaleString()}` },
    { labelKey: 'lm.newCampaign.s4.tileLabel.audience',   value: t('lm.newCampaign.s4.audienceValue', { min: String(form.ageMin), max: String(form.ageMax) }) },
    { labelKey: 'lm.newCampaign.s4.tileLabel.platforms',
      value: form.placementMode === 'manual' && form.manualPlacements.length > 0
        ? form.manualPlacements.map((k) => t(`lm.newCampaign.s3.pl.${k}`)).join(' + ')
        : form.publisherPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' + ') },
    { labelKey: 'lm.newCampaign.s4.tileLabel.cta',        value: t(`lm.creatives.generate.cta.${form.cta}`) },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

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

      {/* Builder (left) + always-on live preview rail (right) — use the full tab. */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">

      {/* Step indicator */}
      <div className="flex items-center gap-0">
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
              <CampaignListingPicker
                listings={listings}
                value={form.listingId}
                onChange={onListingChange}
                loading={listingsLoading}
                canEdit={canEditLandings}
                t={t}
                inputCls={inputCls()}
              />
              {form.listingId && (
                <button type="button" onClick={runDataQuality}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t('dq.run')}
                </button>
              )}
            </div>

            {/* Campaign sources — brochure/link/file material that completes the
                campaign when the project is a NEW LAUNCH with no landing page.
                Feeds the AI copy generation on step 3. */}
            <div className="rounded-2xl border border-line bg-surface p-4" data-coach="wiz-sources">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
                <FolderOpen className="h-3.5 w-3.5" /> {t('lm.newCampaign.src.title')}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{t('lm.newCampaign.src.sub')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">
                  <Upload className="h-3.5 w-3.5" /> {t('lm.newCampaign.src.upload')}
                  <input type="file" accept=".pdf,.txt,.md,.csv,image/*" className="hidden"
                    onChange={(e) => { void addSourceFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
                </label>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input value={srcLink} onChange={(e) => setSrcLink(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSourceLink() } }}
                    placeholder={t('lm.newCampaign.src.linkPh')}
                    className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40" />
                  <button type="button" onClick={addSourceLink}
                    className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">
                    {t('lm.newCampaign.src.addLink')}
                  </button>
                </div>
                {srcBusy && <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> {t('lm.newCampaign.src.extracting')}</span>}
              </div>
              {srcError && <p className="mt-2 text-[11px] text-red-400">{srcError}</p>}
              {campaignSources.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {campaignSources.map((src, i) => (
                    <span key={`${src.label}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold">
                      {src.label}
                      <button type="button" onClick={() => setCampaignSources((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${src.label}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
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
                    <Link href={`/freehold-intelligence/lead-machine/forms/${leadFormId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs text-slate-300 transition hover:text-white">
                      {t('lm.newCampaign.leadForm.edit')} <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  {/* Created IN the ad via popup — the wizard never unloads and
                      the new form attaches to this ad immediately. */}
                  <button type="button" onClick={() => { setNewFormName(`${selectedListing?.projectName ?? form.campaignName ?? ''} — Lead Form`.trim()); setFormPopupOpen(true) }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20">
                    <Sparkles className="h-3.5 w-3.5" /> {t('lm.newCampaign.leadForm.create')}
                  </button>
                </div>
                {!leadFormsLoading && leadForms.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">{t('lm.newCampaign.leadForm.empty')}</p>
                )}
              </div>
            )}

            {/* Call ads dial the number typed here. Click-to-WhatsApp ads
                always message the WhatsApp number CONNECTED TO THE PAGE —
                Meta does not accept an arbitrary number on the creative, so
                we say that honestly instead of collecting a number we'd drop. */}
            {form.productObjective === 'call' && (
              <div className="rounded-[14px] border border-gold/20 bg-gold/[0.04] p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
                  <Phone className="h-3.5 w-3.5" />
                  {t('lm.newCampaign.destPhone.title')}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('lm.newCampaign.destPhone.hintCall')}</p>
                <input
                  className={`${inputCls()} mt-3 max-w-xs`}
                  dir="ltr"
                  inputMode="tel"
                  value={destinationPhone}
                  onChange={(e) => setDestinationPhone(e.target.value)}
                  placeholder="+971 5x xxx xxxx"
                />
              </div>
            )}
            {form.productObjective === 'whatsapp' && (
              <div className="rounded-[14px] border border-gold/20 bg-gold/[0.04] p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t('lm.newCampaign.destPhone.title')}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('lm.newCampaign.destPhone.hintWa')}</p>
              </div>
            )}

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

            {/* Saved audiences — attach a definition from the Audiences tab */}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold"><Users className="h-3.5 w-3.5" /> {t('lm.aud.attach.title')}</span>
                <Link href="/freehold-intelligence/lead-machine/audiences" className="text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline">{t('lm.aud.attach.open')}</Link>
              </div>
              {savedAudiences.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">{t('lm.aud.attach.none')}</p>
              ) : (
                <>
                  <p className="mt-1 text-[11px] text-slate-500">{t('lm.aud.attach.sub')}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {savedAudiences.map((a) => {
                      const on = attachedAudience?.id === a.id
                      return (
                        <button key={a.id} type="button" onClick={() => setAttachedAudience(on ? null : a)}
                          className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition ${on ? 'border-gold/50 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-300 hover:border-white/15'}`}>
                          {a.name}{on ? ` — ${t('lm.aud.attach.attached')}` : ''}
                        </button>
                      )
                    })}
                  </div>
                  {attachedAudience && (
                    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2">
                      <span className="text-[11px] text-slate-300">{t('lm.aud.attach.overrides')}</span>
                      <button type="button" onClick={() => setAttachedAudience(null)} className="text-[11px] font-semibold text-slate-400 hover:text-white">{t('lm.aud.attach.detach')}</button>
                    </div>
                  )}
                </>
              )}
            </div>

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
              <Label>{t('lm.newCampaign.s2.label.leadLanguage')}</Label>
              <div className="flex flex-wrap gap-2">
                {LEAD_LANGUAGE_OPTIONS.map((lang) => {
                  const selected = form.leadLanguages.includes(lang.code)
                  return (
                    <button key={lang.code} type="button"
                      onClick={() => update('leadLanguages', selected ? form.leadLanguages.filter((c) => c !== lang.code) : [...form.leadLanguages, lang.code])}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${selected ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                      {t(lang.labelKey)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{t('lm.newCampaign.s2.leadLanguageHint')}</p>
            </div>

            {/* Live Meta reach estimate — same badge/pill pattern as the Buyer
                Match panel's live reach (Gauge icon, range, honest empty
                state), debounced to the popup's current selections above. */}
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-3">
              <Gauge className="h-4 w-4 text-gold" />
              {audienceReachLoading ? (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('lm.newCampaign.s2.reach.loading')}
                </span>
              ) : !audienceReachConnected ? (
                <span className="text-xs text-slate-400">{t('lm.newCampaign.s2.reach.connect')}</span>
              ) : audienceReach ? (
                <div className="text-sm">
                  <span className="font-semibold text-white">{fmtReach(audienceReach.lower)}–{fmtReach(audienceReach.upper)}</span>
                  <span className="ms-2 text-xs text-slate-500">{t('lm.newCampaign.s2.reach.label')}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">{t('lm.newCampaign.s2.reach.warming')}</span>
              )}
            </div>

            <div>
              <Label>{t('lm.newCampaign.s2.label.placementMode')}</Label>
              <div className="flex gap-3">
                {PLACEMENT_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update('placementMode', opt.value)}
                    className={`flex-1 rounded-[14px] border p-3 text-left transition ${
                      form.placementMode === opt.value ? 'border-gold/40 bg-gold/[0.06]' : 'border-line hover:border-white/10'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{t(opt.labelKey)}</div>
                    <p className="mt-1 text-xs text-slate-500">{t(opt.descKey)}</p>
                  </button>
                ))}
              </div>
            </div>

            {form.placementMode === 'automatic' ? (
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
            ) : (
              <div>
                <Label>{t('lm.newCampaign.s2.label.manualPlacements')}</Label>
                <div className="flex flex-wrap gap-2">
                  {PLACEMENT_KEYS.map((key) => {
                    const selected = form.manualPlacements.includes(key)
                    return (
                      <button key={key} type="button"
                        onClick={() => update('manualPlacements', selected ? form.manualPlacements.filter((v) => v !== key) : [...form.manualPlacements, key])}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${selected ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:border-white/15'}`}>
                        {t(`lm.newCampaign.s3.pl.${key}`)}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{t('lm.newCampaign.s2.manualPlacementsHint')}</p>
              </div>
            )}
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
                {dqData.checks.map((c) => {
                  const acknowledged = form.dqVerifiedChecks.includes(c.key)
                  return (
                    <div key={c.key} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {c.present
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          : <AlertCircle className={`h-4 w-4 shrink-0 ${acknowledged ? 'opacity-50' : ''} ${c.severity === 'required' ? 'text-red-400' : 'text-amber-400'}`} />}
                        <span className="flex-1 text-sm text-slate-200">{t(`dq.check.${c.key}`)}</span>
                        {c.present
                          ? <span className="truncate text-xs text-slate-500">{c.value}</span>
                          : acknowledged
                            ? <span className="text-[11px] font-medium text-slate-500">{t('dq.acknowledged')}</span>
                            : <span className={`text-[11px] font-medium ${c.severity === 'required' ? 'text-red-400' : 'text-amber-400'}`}>{c.severity === 'required' ? t('dq.missing') : t('dq.optional')}</span>}
                      </div>
                      {/* The field still reads as failing above — checking this
                          only records "proceeding with awareness" for THIS
                          launch. It never edits the inventory record. */}
                      {!c.present && (
                        <label className="mt-1.5 flex cursor-pointer items-center gap-2 ps-[26px] text-xs text-slate-400">
                          <input type="checkbox" checked={acknowledged} onChange={() => toggleDqVerified(c.key)}
                            className="h-3.5 w-3.5 rounded border-line bg-surface accent-[#D4AF37]" />
                          {t('dq.manualVerify')}
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
              {dqFailingChecks.length > 0 && (
                <p className="text-[11px] leading-relaxed text-slate-500">{t('dq.manualVerifyHint')}</p>
              )}
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

            {/* Live ad preview — inline on small screens only; the sticky rail
                owns the preview on desktop, so the form keeps its full width. */}
            <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_1fr] lg:grid-cols-1">
              <div className="lg:hidden">
                <div className="mb-2 flex items-center gap-1.5">
                  {(['feed', 'story'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPreviewPlacement(p)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${previewPlacement === p ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400'}`}>
                      {t(`lm.newCampaign.s3.placement.${p}`)}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPlacementsOpen(true)}
                    className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold transition hover:bg-gold/20">
                    {t('lm.newCampaign.s3.previewAll')}
                  </button>
                </div>
                <AdMock form={previewCreative} placement={previewPlacement} t={t} />
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

            {/* Meta's real multi-text ("Multiple text options" / dynamic
                creative) feature — up to 5 headlines Meta auto-tests in
                combination within this ONE ad, not several separate ads. */}
            <div>
              <Label>{t('lm.newCampaign.s3.label.headline')}</Label>
              <div className="space-y-2">
                {form.headlines.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputCls(i === 0 && !h)}
                      value={h}
                      onChange={(e) => {
                        const next = [...form.headlines]
                        next[i] = e.target.value
                        update('headlines', next)
                      }}
                      placeholder={t('lm.headlinePlaceholder')}
                    />
                    {form.headlines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => update('headlines', form.headlines.filter((_, j) => j !== i))}
                        aria-label={`Remove headline ${i + 1}`}
                        className="shrink-0 rounded-full border border-line bg-surface-2 p-1.5 text-slate-500 transition hover:text-rose-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {form.headlines.length < 5 && multiTextEligible && (
                <button
                  type="button"
                  onClick={() => update('headlines', [...form.headlines, ''])}
                  className="mt-2 text-xs font-semibold text-gold/80 transition hover:text-gold"
                >
                  + {t('lm.newCampaign.s3.addHeadline')}
                </button>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {multiTextEligible ? t('lm.newCampaign.s3.headlinesHint') : t('lm.newCampaign.s3.multiTextIneligible')}
              </p>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s3.label.description')}</Label>
              <div className="space-y-2">
                {form.descriptions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputCls()}
                      value={d}
                      onChange={(e) => {
                        const next = [...form.descriptions]
                        next[i] = e.target.value
                        update('descriptions', next)
                      }}
                      placeholder={t('lm.descriptionPlaceholder')}
                    />
                    {form.descriptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => update('descriptions', form.descriptions.filter((_, j) => j !== i))}
                        aria-label={`Remove description ${i + 1}`}
                        className="shrink-0 rounded-full border border-line bg-surface-2 p-1.5 text-slate-500 transition hover:text-rose-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {form.descriptions.length < 5 && multiTextEligible && (
                <button
                  type="button"
                  onClick={() => update('descriptions', [...form.descriptions, ''])}
                  className="mt-2 text-xs font-semibold text-gold/80 transition hover:text-gold"
                >
                  + {t('lm.newCampaign.s3.addDescription')}
                </button>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {multiTextEligible ? t('lm.newCampaign.s3.descriptionsHint') : t('lm.newCampaign.s3.multiTextIneligible')}
              </p>
            </div>

            <div>
              <Label>{t('lm.newCampaign.s3.label.landingUrl')} <span className="ms-1 font-normal text-slate-500">{t('lm.newCampaign.src.lpOptional')}</span></Label>
              <input
                className={inputCls(!form.landingUrl && !form.listingId)}
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
              {/* Media sources: upload → Meta (image_hash), pick from the
                  Library (incl. Drive-edited/QR-stamped images), or open the
                  Drive editor to stamp QR/permit/text and save back. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-gold/40">
                  {uploadingImg ? t('lm.newCampaign.s3.upload.uploading') : t('lm.newCampaign.s3.upload.uploadImage')}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingImg}
                    onChange={(e) => onUploadImage(e.target.files?.[0] ?? null)} />
                </label>
                <button
                  type="button"
                  onClick={toggleLibrary}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${libOpen ? 'border-gold/40 bg-gold/[0.07] text-gold' : 'border-line-strong bg-surface-2 text-slate-200 hover:border-gold/40'}`}
                >
                  {t('lm.newCampaign.s3.pickLibrary')}
                </button>
                <Link
                  href="/freehold-intelligence/drive/editor/image/new"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-gold/40"
                >
                  {t('lm.newCampaign.s3.editInDrive')} <ArrowRight className="h-3 w-3" />
                </Link>
                {form.imageHash
                  ? <span className="text-xs text-emerald-400">{t('lm.newCampaign.s3.upload.uploaded')}</span>
                  : <span className="text-xs text-slate-500">{t('lm.newCampaign.s3.upload.orPaste')}</span>}
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="ad preview" className="h-10 w-16 rounded object-cover" />
                )}
              </div>
              {libOpen && (
                <div className="mt-3 rounded-[14px] border border-line bg-surface-2 p-3">
                  <p className="mb-2 text-[11px] text-slate-500">{t('lm.newCampaign.s3.libHint')}</p>
                  {libLoading ? (
                    <p className="py-3 text-xs text-slate-500">{t('common.loading')}</p>
                  ) : libImages.length === 0 ? (
                    <p className="py-3 text-xs text-slate-500">{t('lm.newCampaign.s3.libEmpty')}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {libImages.slice(0, 15).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => useLibraryImage(item)}
                          disabled={!!libApplying}
                          className={`group relative overflow-hidden rounded-lg border transition ${libApplying === item.id ? 'border-gold' : 'border-line hover:border-gold/50'}`}
                          title={item.title}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.url ?? ''} alt={item.title} className="h-16 w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-start text-[10px] text-white/90">
                            {libApplying === item.id ? t('common.loading') : item.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Per-placement creative — offered for landing-click AND lead-form
                ads. WhatsApp/call ads carry their CTA value (WhatsApp number /
                phone) on the classic single-creative path only, so per-
                placement customization isn't offered there. */}
            {supportsPlacementCreative ? (
              <div className="rounded-[14px] border border-line bg-surface-2 p-4">
                <Label>{t('lm.newCampaign.s3.perPlacement.title')}</Label>
                <p className="mb-3 text-xs leading-relaxed text-slate-500">{t('lm.newCampaign.s3.perPlacement.hint')}</p>
                {activeObjective.dest === 'form' && (() => {
                  const customizedCount = PLACEMENT_KEYS.filter(isCustomized).length
                  if (!customizedCount) return null
                  const groups = customizedCount + (customizedCount < PLACEMENT_KEYS.length ? 1 : 0)
                  const perSet = Math.round((form.dailyBudgetAED / groups) * 100) / 100
                  return (
                    <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-300/90">
                      {t('lm.newCampaign.s3.perPlacement.leadSplitNote', { n: groups, perSet: perSet.toLocaleString() })}
                    </p>
                  )
                })()}
                <div className="flex flex-wrap gap-2">
                  {PLACEMENT_KEYS.map((key) => {
                    const open = overrideOpenKey === key
                    const customized = isCustomized(key)
                    return (
                      <button key={key} type="button" onClick={() => setOverrideOpenKey(open ? null : key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          open ? 'border-gold/50 bg-gold/10 text-gold'
                          : customized ? 'border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300'
                          : 'border-line bg-surface text-slate-300 hover:text-white'}`}>
                        {customized && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title={t('lm.newCampaign.s3.perPlacement.customized')} />}
                        {t(`lm.newCampaign.s3.pl.${key}`)}
                        <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
                      </button>
                    )
                  })}
                </div>
                {overrideOpenKey && (
                  <div className="mt-3 rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-white">{t(`lm.newCampaign.s3.pl.${overrideOpenKey}`)}</div>
                      {isCustomized(overrideOpenKey) && (
                        <button type="button" onClick={() => clearOverride(overrideOpenKey!)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-rose-300">
                          <X className="h-3 w-3" /> {t('lm.newCampaign.s3.perPlacement.clear')}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 space-y-2.5">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.headline')}</label>
                        <input className={inputCls()} value={overrideOf(overrideOpenKey).headline ?? ''}
                          onChange={(e) => setOverrideField(overrideOpenKey!, 'headline', e.target.value)}
                          placeholder={form.headlines[0] || t('lm.headlinePlaceholder')} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.primaryText')}</label>
                        <textarea rows={2} className={`${inputCls()} resize-none`} value={overrideOf(overrideOpenKey).primaryText ?? ''}
                          onChange={(e) => setOverrideField(overrideOpenKey!, 'primaryText', e.target.value)}
                          placeholder={form.primaryText || t('lm.primaryTextPlaceholder')} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.imageUrl')}</label>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-gold/40">
                            {overrideUploading === overrideOpenKey ? t('lm.newCampaign.s3.upload.uploading') : t('lm.newCampaign.s3.upload.uploadImage')}
                            <input type="file" accept="image/*" className="hidden" disabled={overrideUploading === overrideOpenKey}
                              onChange={(e) => onUploadOverrideImage(overrideOpenKey!, e.target.files?.[0] ?? null)} />
                          </label>
                          <button type="button" onClick={() => toggleOverrideLibrary(overrideOpenKey!)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${overrideLibFor === overrideOpenKey ? 'border-gold/40 bg-gold/[0.07] text-gold' : 'border-line-strong bg-surface-2 text-slate-200 hover:border-gold/40'}`}>
                            {t('lm.newCampaign.s3.pickLibrary')}
                          </button>
                          {overrideOf(overrideOpenKey).imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={overrideOf(overrideOpenKey).imageUrl} alt="" className="h-9 w-14 rounded object-cover" />
                          ) : (
                            <span className="text-[11px] text-slate-500">{t('lm.newCampaign.s3.perPlacement.useDefault')}</span>
                          )}
                        </div>
                        {overrideLibFor === overrideOpenKey && (
                          <div className="mt-2 rounded-lg border border-line bg-surface-2 p-2">
                            {libLoading ? (
                              <p className="py-2 text-[11px] text-slate-500">{t('common.loading')}</p>
                            ) : libImages.length === 0 ? (
                              <p className="py-2 text-[11px] text-slate-500">{t('lm.newCampaign.s3.libEmpty')}</p>
                            ) : (
                              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                                {libImages.slice(0, 12).map((item) => (
                                  <button key={item.id} type="button" onClick={() => useOverrideLibraryImage(overrideOpenKey!, item)}
                                    className="overflow-hidden rounded border border-line transition hover:border-gold/50" title={item.title}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={item.url ?? ''} alt={item.title} className="h-10 w-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
                {t('lm.newCampaign.s3.perPlacement.notAvailable')}
              </p>
            )}

            <div>
              <Label>{t('lm.newCampaign.s3.label.cta')}</Label>
              <select
                className={inputCls()}
                value={form.cta}
                onChange={(e) => update('cta', e.target.value as MetaCta)}
              >
                {CTA_OPTIONS.map((c) => (
                  <option key={c} value={c}>{t(`lm.creatives.generate.cta.${c}`)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* In-ad lead-form popup: create new or duplicate an existing form —
            either way it attaches to this ad instantly. */}
        {formPopupOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setFormPopupOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[15px] font-semibold text-white">{t('lm.newCampaign.leadForm.popupTitle')}</div>
                <button type="button" onClick={() => setFormPopupOpen(false)} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">{t('lm.newCampaign.s3.closePreview')}</button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('lm.newCampaign.leadForm.popupHint')}</p>

              <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('lm.newCampaign.leadForm.nameLabel')}</label>
              <input value={newFormName} onChange={(e) => setNewFormName(e.target.value)} className={`${inputCls(!newFormName.trim())} mt-1`} />
              <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('pforms.basics.language')}</label>
              <select value={newFormLocale} onChange={(e) => setNewFormLocale(e.target.value)} className={`${inputCls()} mt-1`}>
                {FORM_LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <button type="button" onClick={createInlineForm} disabled={formBusy || !newFormName.trim()}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
                {formBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t('lm.newCampaign.leadForm.createAttach')}
              </button>

              {leadForms.length > 0 && (
                <>
                  <div className="mt-5 mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('lm.newCampaign.leadForm.orDuplicate')}</div>
                  <div className="max-h-52 space-y-1.5 overflow-y-auto">
                    {leadForms.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{f.name}</span>
                        <button type="button" disabled={!!dupBusyId} onClick={() => duplicateForm(f)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
                          {dupBusyId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />} {t('lm.newCampaign.leadForm.duplicate')}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Launch ───────────────────────────────────── */}
        {placementsOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPlacementsOpen(false)}>
            <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-line bg-surface p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-white">{t('lm.newCampaign.s3.placementsTitle')}</div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{t('lm.newCampaign.s3.placementsNote')}</p>
                </div>
                <button type="button" onClick={() => setPlacementsOpen(false)} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">
                  {t('lm.newCampaign.s3.closePreview')}
                </button>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {([
                  { key: 'fbFeed' as PlacementKey, kind: 'square' as const },
                  { key: 'igFeed' as PlacementKey, kind: 'square' as const },
                  { key: 'igStory' as PlacementKey, kind: 'vertical' as const },
                  { key: 'fbStory' as PlacementKey, kind: 'vertical' as const },
                  { key: 'reels' as PlacementKey, kind: 'vertical' as const },
                ]).map(({ key, kind }) => {
                  // Merge this placement's override over the default creative —
                  // an honest preview of what actually ships, not the same
                  // creative re-shaped into 5 mock layouts.
                  const ov = supportsPlacementCreative ? overrideOf(key) : {}
                  const tileHeadline = ov.headline?.trim() || form.headlines[0] || ''
                  const tilePrimaryText = ov.primaryText?.trim() || form.primaryText
                  const tileImageUrl = ov.imageUrl || form.imageUrl
                  const customized = isCustomized(key) && supportsPlacementCreative
                  return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {customized && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title={t('lm.newCampaign.s3.perPlacement.customized')} />}
                      {t(`lm.newCampaign.s3.pl.${key}`)}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-line bg-black">
                      {kind === 'square' ? (
                        <div className="bg-[#18181b]">
                          <div className="flex items-center gap-1.5 px-2 py-1.5">
                            <div className="h-5 w-5 rounded-full bg-gold/80" />
                            <div className="text-[10px] leading-tight"><div className="font-semibold text-white">Freehold Property</div><div className="text-slate-500">{t('lm.newCampaign.s3.sponsored')}</div></div>
                          </div>
                          {tilePrimaryText && <div className="px-2 pb-1.5 text-[10px] leading-snug text-slate-200">{tilePrimaryText.slice(0, 90)}</div>}
                          <div className="aspect-square w-full bg-surface-2">
                            {tileImageUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={tileImageUrl} alt="" className="h-full w-full object-cover" />
                              : <div className="flex h-full items-center justify-center bg-gradient-to-br from-gold/20 to-transparent text-[10px] text-slate-500">{t('lm.newCampaign.s3.noImage')}</div>}
                          </div>
                          <div className="flex items-center justify-between gap-1.5 bg-[#0f0f11] px-2 py-1.5">
                            <div className="min-w-0"><div className="truncate text-[10px] font-semibold text-white">{tileHeadline || t('lm.newCampaign.s3.headlinePh')}</div></div>
                            <span className="shrink-0 rounded bg-gold/90 px-1.5 py-0.5 text-[9px] font-semibold text-ink">{t(`lm.creatives.generate.cta.${form.cta}`)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative aspect-[9/16] w-full bg-surface-2">
                          {tileImageUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={tileImageUrl} alt="" className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center bg-gradient-to-b from-gold/20 to-transparent text-[10px] text-slate-500">{t('lm.newCampaign.s3.noImage')}</div>}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                            <div className="text-[11px] font-semibold text-white">{tileHeadline || t('lm.newCampaign.s3.headlinePh')}</div>
                            <div className="mt-0.5 line-clamp-2 text-[9px] text-slate-300">{tilePrimaryText}</div>
                            <span className="mt-1 inline-block rounded bg-gold/90 px-1.5 py-0.5 text-[9px] font-semibold text-ink">{t(`lm.creatives.generate.cta.${form.cta}`)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-[18px] font-semibold text-white">{t('lm.newCampaign.s4.heading')}</h2>

            {/* Data Quality state, never hidden at launch time: amber while
                any failing check is unacknowledged, neutral once the operator
                has acknowledged every one (the listing itself is still
                incomplete in Inventory — this launch just proceeds with
                awareness). Informational, not a launch blocker, matching the
                wizard's never-hard-block philosophy. */}
            {dqFailingChecks.length > 0 && (
              <div className={`flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3 ${
                dqUnacknowledged.length > 0 ? 'border-amber-400/25 bg-amber-400/[0.06]' : 'border-line bg-surface-2'
              }`}>
                <AlertCircle className={`h-4 w-4 shrink-0 ${dqUnacknowledged.length > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="flex-1 text-sm text-slate-300">
                  {dqUnacknowledged.length > 0
                    ? t('lm.newCampaign.s4.dqWarning', { n: String(dqUnacknowledged.length) })
                    : t('lm.newCampaign.s4.dqAcknowledged', { n: String(dqAcknowledgedCount) })}
                </span>
                <button type="button" onClick={() => { setStep(1); setDqOpen(true) }}
                  className="rounded-full border border-line px-3 py-1 text-xs text-slate-300 transition hover:text-white">
                  {t('lm.newCampaign.s4.dqReview')}
                </button>
              </div>
            )}

            {/* Summary tiles */}
            <div className="grid gap-4 sm:grid-cols-2">
              {summaryTiles.map((item) => (
                <div key={item.labelKey} className="rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t(item.labelKey)}</div>
                  <div className="mt-1 text-[14px] font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Creative preview — the actual ad (image + copy), not lines of text */}
            <div className="rounded-[16px] border border-line bg-surface-2 p-5">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-3">{t('lm.newCampaign.s4.creativePreview')}</div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
                <AdMock form={previewCreative} placement="feed" t={t} />
                <div>
                  <div className="text-xs leading-relaxed text-slate-400 mb-2 whitespace-pre-line">{form.primaryText}</div>
                  <div className="text-[14px] font-semibold text-white">{form.headlines[0]}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{form.descriptions[0]}</div>
                  {(form.headlines.length > 1 || form.descriptions.length > 1) && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {multiTextEligible
                        ? t('lm.newCampaign.s4.moreVariants', { n: String(Math.max(form.headlines.length, form.descriptions.length)) })
                        : t('lm.newCampaign.s4.moreVariantsIgnored')}
                    </p>
                  )}
                  <div className="mt-2 inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs text-gold">
                    {t(`lm.creatives.generate.cta.${form.cta}`)}
                  </div>
                </div>
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

            {/* Conversion pixel — real pixels on the connected ad account.
                Blank = account default (today's unchanged behavior); this is
                the one control that actually sets pixelId all the way through
                to createAdSet's promoted_object. */}
            <div>
              <Label>{t('lm.newCampaign.s4.label.pixel')}</Label>
              <select
                value={form.pixelId}
                onChange={(e) => update('pixelId', e.target.value)}
                className={`${inputCls()} max-w-sm`}
              >
                <option value="">{pixelsLoading ? t('common.loading') : t('lm.newCampaign.s4.pixel.none')}</option>
                {pixels.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
              (step === 3 && (!form.primaryText || !form.headlines[0] || (!form.landingUrl && !form.listingId)))
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

      {/* ── Live preview rail — the ad + the landing page, visible on every step ── */}
      <aside className="sticky top-6 hidden lg:block">
        <div className="rounded-[24px] border border-line bg-surface p-4">
          <div className="flex items-center gap-1.5">
            {(['ad', 'landing'] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setPreviewTab(tab)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${previewTab === tab ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400 hover:text-white'}`}>
                {t(tab === 'ad' ? 'lm.newCampaign.preview.ad' : 'lm.newCampaign.preview.landing')}
              </button>
            ))}
            {previewTab === 'ad' && (
              <div className="ms-auto flex items-center gap-1.5">
                {(['feed', 'story'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPreviewPlacement(p)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${previewPlacement === p ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line bg-surface-2 text-slate-400'}`}>
                    {t(`lm.newCampaign.s3.placement.${p}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3">
            {previewTab === 'ad' ? (
              <>
                <AdMock form={previewCreative} placement={previewPlacement} t={t} />
                <button type="button" onClick={() => setPlacementsOpen(true)}
                  className="mt-3 w-full rounded-full border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20">
                  {t('lm.newCampaign.s3.previewAll')}
                </button>
              </>
            ) : lpPath ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-line bg-black">
                  <iframe src={lpPath} title={t('lm.newCampaign.preview.landing')} className="h-[600px] w-full" />
                </div>
                <a href={lpPath} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white">
                  {t('lm.newCampaign.preview.open')} <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </>
            ) : (
              <p className="rounded-2xl border border-line bg-surface-2 p-4 text-xs leading-relaxed text-slate-500">
                {t('lm.newCampaign.preview.noLanding')}
              </p>
            )}
          </div>
        </div>
      </aside>
      </div>
    </div>
  )
}

// ─── Ad mock ──────────────────────────────────────────────────────────────────
// The rendered ad, built ONLY from what the operator actually typed/picked
// (copy, image, CTA) — a live mock of the creative, not fabricated content.
// Used by the sticky preview rail, the mobile inline preview, and the review.
function AdMock({ form, placement, t }: {
  form: { primaryText: string; headline: string; description: string; imageUrl: string; cta: MetaCta }
  placement: 'feed' | 'story'
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-black">
      {placement === 'feed' ? (
        <div className="bg-[#18181b]">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-gold/80" />
            <div className="text-[11px] leading-tight"><div className="font-semibold text-white">Freehold Property</div><div className="text-slate-500">{t('lm.newCampaign.s3.sponsored')}</div></div>
          </div>
          {form.primaryText && <div className="px-3 pb-2 text-[12px] leading-snug text-slate-200 whitespace-pre-line">{form.primaryText.slice(0, 180)}</div>}
          <div className="aspect-square w-full bg-surface-2">
            {form.imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center bg-gradient-to-br from-gold/20 to-transparent text-xs text-slate-500">{t('lm.newCampaign.s3.noImage')}</div>}
          </div>
          <div className="flex items-center justify-between gap-2 bg-[#0f0f11] px-3 py-2">
            <div className="min-w-0"><div className="truncate text-[12px] font-semibold text-white">{form.headline || t('lm.newCampaign.s3.headlinePh')}</div><div className="truncate text-[11px] text-slate-500">{form.description}</div></div>
            <span className="shrink-0 rounded-md bg-gold/90 px-2 py-1 text-[10px] font-semibold text-ink">{t(`lm.creatives.generate.cta.${form.cta}`)}</span>
          </div>
        </div>
      ) : (
        <div className="relative aspect-[9/16] w-full bg-surface-2">
          {form.imageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center bg-gradient-to-b from-gold/20 to-transparent text-xs text-slate-500">{t('lm.newCampaign.s3.noImage')}</div>}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
            <div className="text-[13px] font-semibold text-white">{form.headline || t('lm.newCampaign.s3.headlinePh')}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-300">{form.primaryText}</div>
            <span className="mt-2 inline-block rounded-md bg-gold/90 px-2.5 py-1 text-[10px] font-semibold text-ink">{t(`lm.creatives.generate.cta.${form.cta}`)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
