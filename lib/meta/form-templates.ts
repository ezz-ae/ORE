/**
 * Instant-form building blocks shared by the full builder (forms/new) and the
 * in-ad quick-create popup (campaigns/new):
 *
 *   - CONTACT_GROUPS   — Meta's prefill catalog organized by operator intent
 *                        (identity / reach / location / work), not menu order
 *   - question presets — budget / timeline / purpose, grounded in the actual
 *                        listing (budget bands derive from its real price)
 *   - FORM_TEMPLATES   — 4 ready-to-duplicate real-estate forms
 *   - mapFormToBuilder — an existing Meta form → builder state (duplication)
 *
 * Everything textual goes through t() so EN/AR/RU stay in lockstep. No React
 * imports — plain data + pure functions, safe on server and client.
 */
import type {
  MetaFormQuestion,
  MetaFormQuestionType,
  MetaLeadForm,
  ThankYouButtonType,
} from './types'

export type TFn = (key: string, vars?: Record<string, string | number>) => string

/** The real listing facts a form is built from — nothing here is invented. */
export interface ListingFacts {
  name?: string
  area?: string
  priceAED?: number | null
  paymentPlan?: string | null
  landingUrl?: string
  /** Real brochure file URL when the listing has one — gates the Download button. */
  brochureUrl?: string | null
}

/** A custom (qualifying) question as the builder edits it. */
export interface BuilderCustomQuestion {
  /** Local list identity (React key / removal). */
  id: string
  /** Stable Meta question key for presets (budget_range / timeline / purpose). */
  key?: string
  label: string
  kind: 'choice' | 'text'
  /** Display labels of the choices; empty for open text. */
  options: string[]
}

// ─── Contact prefill catalog ─────────────────────────────────────────────────
// Grouped by what the operator wants to learn about the buyer. Every type is a
// documented Meta prefill question — Meta auto-fills it from the profile.

export interface ContactField { type: MetaFormQuestionType; labelKey: string }

export const CONTACT_GROUPS: { groupKey: string; fields: ContactField[] }[] = [
  {
    groupKey: 'pforms.contact.identity',
    fields: [
      { type: 'FULL_NAME',  labelKey: 'pforms.q.fullName'  },
      { type: 'FIRST_NAME', labelKey: 'pforms.q.firstName' },
      { type: 'LAST_NAME',  labelKey: 'pforms.q.lastName'  },
      { type: 'DOB',        labelKey: 'pforms.q.dob'       },
      { type: 'GENDER',     labelKey: 'pforms.q.gender'    },
    ],
  },
  {
    groupKey: 'pforms.contact.reach',
    fields: [
      { type: 'EMAIL',             labelKey: 'pforms.q.email'     },
      { type: 'PHONE',             labelKey: 'pforms.q.phone'     },
      { type: 'WORK_EMAIL',        labelKey: 'pforms.q.workEmail' },
      { type: 'WORK_PHONE_NUMBER', labelKey: 'pforms.q.workPhone' },
    ],
  },
  {
    groupKey: 'pforms.contact.location',
    fields: [
      { type: 'CITY',    labelKey: 'pforms.q.city'    },
      { type: 'STATE',   labelKey: 'pforms.q.state'   },
      { type: 'ZIP',     labelKey: 'pforms.q.zip'     },
      { type: 'COUNTRY', labelKey: 'pforms.q.country' },
    ],
  },
  {
    groupKey: 'pforms.contact.work',
    fields: [
      { type: 'COMPANY_NAME', labelKey: 'pforms.q.company'  },
      { type: 'JOB_TITLE',    labelKey: 'pforms.q.jobTitle' },
    ],
  },
]

/** Every prefill type the catalog offers, in display order. */
export const CONTACT_TYPES: MetaFormQuestionType[] =
  CONTACT_GROUPS.flatMap((g) => g.fields.map((f) => f.type))

export const DEFAULT_CONTACT: MetaFormQuestionType[] = ['FULL_NAME', 'EMAIL', 'PHONE']

/** Display label key for a prefill type (builder + detail page). */
export function contactLabelKey(type: string): string | null {
  for (const g of CONTACT_GROUPS) {
    const f = g.fields.find((f) => f.type === type)
    if (f) return f.labelKey
  }
  return null
}

// ─── Question presets ────────────────────────────────────────────────────────

export type PresetKey = 'budget' | 'timeline' | 'purpose'

function fmtAED(n: number): string {
  if (n >= 1_000_000) {
    const m = Math.round((n / 1_000_000) * 10) / 10
    return `AED ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `AED ${Math.round(n / 1_000)}K`
}

/** Round to a clean 250K step so bands read like a broker wrote them. */
function nice(n: number): number {
  return Math.max(250_000, Math.round(n / 250_000) * 250_000)
}

let presetSeq = 0
const presetId = (key: string) => `${key}_${++presetSeq}_${Date.now().toString(36)}`

/**
 * Budget bands derived from the listing's REAL from-price (± around it); when
 * the listing has no price, the static Dubai AED bands are used instead.
 */
export function buildBudgetPreset(facts: ListingFacts, t: TFn): BuilderCustomQuestion {
  let options: string[]
  const p = facts.priceAED
  if (p && p > 0) {
    const p1 = nice(p)
    const p2 = Math.max(nice(p * 1.5), p1 + 250_000)
    const p3 = Math.max(nice(p * 2),   p2 + 250_000)
    options = [
      t('pforms.budget.underX', { x: fmtAED(p1) }),
      `${fmtAED(p1)} – ${fmtAED(p2)}`,
      `${fmtAED(p2)} – ${fmtAED(p3)}`,
      t('pforms.budget.aboveX', { x: fmtAED(p3) }),
    ]
  } else {
    options = [
      t('pforms.budget.under1m'),
      t('pforms.budget.1m2m'),
      t('pforms.budget.2m3m'),
      t('pforms.budget.3m5m'),
      t('pforms.budget.above5m'),
    ]
  }
  return { id: presetId('budget'), key: 'budget_range', label: t('pforms.preset.budget'), kind: 'choice', options }
}

export function buildTimelinePreset(t: TFn): BuilderCustomQuestion {
  return {
    id: presetId('timeline'),
    key: 'purchase_timeline',
    label: t('pforms.preset.timeline'),
    kind: 'choice',
    options: [
      t('pforms.timeline.immediate'),
      t('pforms.timeline.1to3'),
      t('pforms.timeline.3to6'),
      t('pforms.timeline.exploring'),
    ],
  }
}

export function buildPurposePreset(t: TFn): BuilderCustomQuestion {
  return {
    id: presetId('purpose'),
    key: 'purchase_purpose',
    label: t('pforms.preset.purpose'),
    kind: 'choice',
    options: [t('pforms.intent.invest'), t('pforms.intent.ownUse')],
  }
}

export function buildPreset(key: PresetKey, facts: ListingFacts, t: TFn): BuilderCustomQuestion {
  if (key === 'budget')   return buildBudgetPreset(facts, t)
  if (key === 'timeline') return buildTimelinePreset(t)
  return buildPurposePreset(t)
}

export const PRESET_DEFS: { key: PresetKey; labelKey: string }[] = [
  { key: 'budget',   labelKey: 'pforms.preset.budget'   },
  { key: 'timeline', labelKey: 'pforms.preset.timeline' },
  { key: 'purpose',  labelKey: 'pforms.preset.purpose'  },
]

// ─── Custom question → Meta question ─────────────────────────────────────────

function optionValue(label: string, i: number): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
  return slug || `opt_${i + 1}`
}

export function customToMetaQuestion(q: BuilderCustomQuestion, index: number): MetaFormQuestion {
  const key = q.key || `custom_${optionValue(q.label, index) }`
  if (q.kind === 'text' || q.options.filter((o) => o.trim()).length === 0) {
    // Open text — a CUSTOM question without options renders as a free-text field.
    return { type: 'CUSTOM', key, label: q.label }
  }
  const seen = new Set<string>()
  const options = q.options.filter((o) => o.trim()).map((label, i) => {
    let value = optionValue(label, i)
    while (seen.has(value)) value = `${value}_${i + 1}`
    seen.add(value)
    return { value, label }
  })
  return { type: 'CUSTOM', key, label: q.label, options }
}

// ─── Intro card from the listing ─────────────────────────────────────────────

/** Bullets built ONLY from fields the listing really has — each drops if absent. */
export function introFromListing(facts: ListingFacts, t: TFn): { title: string; bullets: string[] } {
  const bullets: string[] = []
  if (facts.area)        bullets.push(t('pforms.intro.bullet.area',  { area:  facts.area }))
  if (facts.priceAED)    bullets.push(t('pforms.intro.bullet.price', { price: fmtAED(facts.priceAED) }))
  if (facts.paymentPlan) bullets.push(t('pforms.intro.bullet.plan',  { plan:  facts.paymentPlan }))
  return { title: facts.name ?? '', bullets: bullets.slice(0, 5) }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export type FormTemplateKey = 'brochure' | 'viewing' | 'investor' | 'offplan'

export interface FormTemplate {
  key: FormTemplateKey
  nameKey: string
  descKey: string
  /** false = More volume, true = Higher intent (Meta review screen). */
  higherIntent: boolean
  contact: MetaFormQuestionType[]
  presets: PresetKey[]
  /** Build the intro card from the listing's real facts. */
  intro: boolean
  /** DOWNLOAD silently becomes VIEW_WEBSITE when the listing has no brochure. */
  button: ThankYouButtonType
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: 'brochure',
    nameKey: 'pforms.tpl.brochure',
    descKey: 'pforms.tpl.brochure.desc',
    higherIntent: false,
    contact: ['FULL_NAME', 'EMAIL', 'PHONE'],
    presets: [],
    intro: false,
    button: 'DOWNLOAD',
  },
  {
    key: 'viewing',
    nameKey: 'pforms.tpl.viewing',
    descKey: 'pforms.tpl.viewing.desc',
    higherIntent: true,
    contact: ['FULL_NAME', 'PHONE'],
    presets: ['timeline'],
    intro: false,
    button: 'CALL_BUSINESS',
  },
  {
    key: 'investor',
    nameKey: 'pforms.tpl.investor',
    descKey: 'pforms.tpl.investor.desc',
    higherIntent: true,
    contact: ['FULL_NAME', 'EMAIL', 'PHONE'],
    presets: ['budget', 'timeline', 'purpose'],
    intro: true,
    button: 'VIEW_WEBSITE',
  },
  {
    key: 'offplan',
    nameKey: 'pforms.tpl.offplan',
    descKey: 'pforms.tpl.offplan.desc',
    higherIntent: false,
    contact: ['FULL_NAME', 'PHONE', 'EMAIL'],
    presets: ['budget'],
    intro: true,
    button: 'VIEW_WEBSITE',
  },
]

export interface TemplateMaterialization {
  higherIntent: boolean
  contact: MetaFormQuestionType[]
  customs: BuilderCustomQuestion[]
  intro: { enabled: boolean; title: string; bullets: string[] }
  thankYouButton: ThankYouButtonType
  /** Set only for DOWNLOAD — the listing's real brochure URL. */
  thankYouWebsiteUrl?: string
}

/** Turn a template + the listing's real facts into a full builder snapshot. */
export function materializeTemplate(tpl: FormTemplate, facts: ListingFacts, t: TFn): TemplateMaterialization {
  const customs = tpl.presets.map((p) => buildPreset(p, facts, t))
  const intro = tpl.intro
    ? { enabled: true, ...introFromListing(facts, t) }
    : { enabled: false, title: '', bullets: [] }
  // Only offer Download when a real brochure file exists on the listing.
  const button: ThankYouButtonType =
    tpl.button === 'DOWNLOAD' && !facts.brochureUrl ? 'VIEW_WEBSITE' : tpl.button
  return {
    higherIntent: tpl.higherIntent,
    contact: [...tpl.contact],
    customs,
    intro,
    thankYouButton: button,
    ...(button === 'DOWNLOAD' && facts.brochureUrl ? { thankYouWebsiteUrl: facts.brochureUrl } : {}),
  }
}

// ─── Existing form → builder state (duplication) ─────────────────────────────

export interface FormBuilderImport {
  contact: MetaFormQuestionType[]
  customs: BuilderCustomQuestion[]
  /** null when the API response carried no context_card. */
  intro: { title: string; bullets: string[] } | null
  /** null when the API response carried no is_optimized_for_quality. */
  higherIntent: boolean | null
  thankYou: {
    title?: string
    body?: string
    buttonType?: ThankYouButtonType
    websiteUrl?: string
    phone?: string
    countryCode?: string
  } | null
  locale?: string
  landingUrl?: string
  /** Question types Meta returned that the builder can't edit (kept honest in UI). */
  unmappedTypes: string[]
}

/**
 * Map what Meta actually returns for an existing form back into builder state.
 * Fields Meta doesn't return stay null — the builder fills them from defaults
 * and says so, instead of pretending the source form carried them.
 */
export function mapFormToBuilder(form: MetaLeadForm): FormBuilderImport {
  const contact: MetaFormQuestionType[] = []
  const customs: BuilderCustomQuestion[] = []
  const unmappedTypes: string[] = []
  let seq = 0
  for (const q of form.questions ?? []) {
    if ((CONTACT_TYPES as string[]).includes(q.type)) {
      contact.push(q.type as MetaFormQuestionType)
    } else if (q.type === 'CUSTOM') {
      const options = (q.options ?? [])
        .map((o) => o.label ?? o.value ?? '')
        .filter(Boolean)
      customs.push({
        id: `imported_${++seq}`,
        key: q.key,
        label: q.label ?? q.key ?? 'Question',
        kind: options.length > 0 ? 'choice' : 'text',
        options,
      })
    } else {
      unmappedTypes.push(q.type)
    }
  }

  const ty = form.thank_you_page
  const buttonType: ThankYouButtonType | undefined =
    ty?.button_type === 'CALL_BUSINESS' || ty?.button_type === 'DOWNLOAD' || ty?.button_type === 'VIEW_WEBSITE'
      ? ty.button_type
      : undefined

  return {
    contact: contact.length > 0 ? contact : [...DEFAULT_CONTACT],
    customs,
    intro: form.context_card?.title
      ? { title: form.context_card.title, bullets: form.context_card.content ?? [] }
      : null,
    higherIntent: typeof form.is_optimized_for_quality === 'boolean' ? form.is_optimized_for_quality : null,
    thankYou: ty
      ? {
          title: ty.title,
          body: ty.body,
          buttonType,
          websiteUrl: ty.website_url,
          phone: ty.business_phone_number,
          countryCode: ty.country_code,
        }
      : null,
    locale: form.locale,
    landingUrl: form.follow_up_action_url,
    unmappedTypes,
  }
}
