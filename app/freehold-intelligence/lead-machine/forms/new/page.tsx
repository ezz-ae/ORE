'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Check, FileText, AlertCircle,
  Plus, Trash2, CheckSquare, Square, Copy, Globe, Phone, Download, Sparkles,
} from 'lucide-react'
import { useLiveProjects, type LiveProject } from '@/lib/freehold/use-live-projects'
import type { MetaFormQuestion, MetaFormQuestionType, CreateLeadFormPayload, ThankYouButtonType } from '@/lib/meta/types'
import {
  CONTACT_GROUPS, CONTACT_TYPES, DEFAULT_CONTACT, FORM_TEMPLATES, PRESET_DEFS,
  buildPreset, contactLabelKey, customToMetaQuestion, introFromListing, mapFormToBuilder, materializeTemplate,
  type BuilderCustomQuestion, type FormTemplateKey, type ListingFacts,
} from '@/lib/meta/form-templates'
import { isMetaConfigErrorMessage } from '@/lib/meta/error-messages'
import { useT } from '@/lib/i18n/provider'

type WizardStep = 1 | 2 | 3 | 4 | 5

// Meta form locales the platform supports — the option labels are each
// language's own name, so they are intentionally not translated.
const FORM_LOCALES: { value: string; label: string }[] = [
  { value: 'en_US', label: 'English' },
  { value: 'ar_AR', label: 'العربية' },
  { value: 'ru_RU', label: 'Русский' },
]

interface FormState {
  // Step 1 — what kind of form
  listingId: string
  formName: string
  landingUrl: string
  higherIntent: boolean
  // Step 2 — introduction
  introEnabled: boolean
  introTitle: string
  introBullets: string[]
  // Step 3 — contact details + qualifying questions
  questionHeadline: string
  selectedContact: MetaFormQuestionType[]
  phoneVerify: boolean
  customQuestions: BuilderCustomQuestion[]
  // Step 4 — after submit
  thankYouTitle: string
  thankYouBody: string
  thankYouButton: ThankYouButtonType
  thankYouWebsiteUrl: string
  thankYouPhone: string
  // Step 5 — settings
  privacyPolicyUrl: string
  locale: string
}

function makeDefault(t: (key: string) => string): FormState {
  return {
    listingId: '',
    formName: '',
    landingUrl: '',
    higherIntent: false,
    introEnabled: false,
    introTitle: '',
    introBullets: [],
    questionHeadline: '',
    selectedContact: [...DEFAULT_CONTACT],
    phoneVerify: false,
    customQuestions: [],
    thankYouTitle: t('pforms.default.thankYouTitle'),
    thankYouBody: t('pforms.default.thankYouBody'),
    thankYouButton: 'VIEW_WEBSITE',
    thankYouWebsiteUrl: '',
    thankYouPhone: '',
    privacyPolicyUrl: 'https://freeholdproperty.ae/privacy',
    locale: 'en_US',
  }
}

const inputCls = 'w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-white placeholder:text-slate-600 outline-none focus:border-gold/40 transition'
const labelCls = 'mb-2 block text-xs font-medium text-slate-400'

let localSeq = 0
const nextId = () => `q_${++localSeq}_${Date.now().toString(36)}`

export default function NewFormPage() {
  const t       = useT()
  const [step, setStep]     = useState<WizardStep>(1)
  const [form, setForm]     = useState<FormState>(() => makeDefault(t))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string } | null>(null)
  const { projects } = useLiveProjects()

  // Where the current prefill came from (template card / duplicated form) —
  // purely informational, everything stays editable.
  const [activeTemplate, setActiveTemplate] = useState<FormTemplateKey | null>(null)
  const [importedFromId, setImportedFromId] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<string | null>(null)

  // Existing forms for "start from an existing form" (merged list: Meta + the
  // local registry of platform-created drafts).
  const [existingForms, setExistingForms] = useState<{ id: string; name: string }[]>([])
  const [importBusy, setImportBusy] = useState(false)
  useEffect(() => {
    fetch('/api/meta/forms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.forms)) {
          setExistingForms(d.forms
            .filter((f: { status?: string }) => f.status !== 'DELETED')
            .map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })))
        }
      })
      .catch(() => {})
  }, [])

  // Opened from the campaign wizard: the ad already knows its listing and
  // landing page — wire them in instead of asking the user to pick again.
  const sp = useSearchParams()
  const wiredProject = sp.get('project') ?? ''
  const wiredLp = sp.get('lp') ?? ''
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !wiredProject || projects.length === 0) return
    if (projects.some((l) => l.id === wiredProject)) {
      prefilled.current = true
      onListingChange(wiredProject)
      if (wiredLp) setForm((prev) => ({ ...prev, landingUrl: wiredLp }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wiredProject, wiredLp, projects])

  const listing: LiveProject | undefined = projects.find((l) => l.id === form.listingId)
  const facts: ListingFacts = {
    name: listing?.name,
    area: listing?.area,
    priceAED: listing?.priceAED ?? null,
    paymentPlan: listing?.paymentPlan ?? null,
    landingUrl: listing?.landingUrl,
    brochureUrl: listing?.brochureUrl ?? null,
  }
  const hasBrochure = !!listing?.brochureUrl

  function onListingChange(id: string) {
    const l = projects.find((p) => p.id === id)
    const landing = l?.hasLanding ? l : null
    setForm((prev) => ({
      ...prev,
      listingId: id,
      formName:  l ? `${l.name} — Lead Form` : prev.formName,
      landingUrl: landing?.landingUrl ?? prev.landingUrl,
      // Re-derive the intro suggestion from the newly picked listing only if
      // the operator hasn't written their own intro yet.
      ...(prev.introEnabled && !prev.introTitle && l
        ? (() => {
            const intro = introFromListing({ name: l.name, area: l.area, priceAED: l.priceAED, paymentPlan: l.paymentPlan }, t)
            return { introTitle: intro.title, introBullets: intro.bullets }
          })()
        : {}),
    }))
  }

  // ── Templates + duplication ────────────────────────────────────────────────

  function applyTemplate(key: FormTemplateKey) {
    const tpl = FORM_TEMPLATES.find((x) => x.key === key)!
    const m = materializeTemplate(tpl, facts, t)
    setActiveTemplate(key)
    setImportedFromId(null)
    setImportNote(null)
    setForm((prev) => ({
      ...prev,
      higherIntent: m.higherIntent,
      selectedContact: m.contact,
      customQuestions: m.customs,
      introEnabled: m.intro.enabled,
      introTitle: m.intro.title,
      introBullets: m.intro.bullets,
      thankYouButton: m.thankYouButton,
      thankYouWebsiteUrl: m.thankYouWebsiteUrl ?? '',
      thankYouPhone: prev.thankYouPhone,
      thankYouTitle: prev.thankYouTitle || t('pforms.default.thankYouTitle'),
      thankYouBody: prev.thankYouBody || t('pforms.default.thankYouBody'),
    }))
  }

  async function importExistingForm(id: string) {
    if (!id || importBusy) return
    setImportBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/meta/forms/${id}`, { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.form) throw new Error(d.error || t('pforms.detail.loadFailed'))
      const imp = mapFormToBuilder(d.form)
      const defaulted: string[] = []
      if (imp.higherIntent === null) defaulted.push(t('pforms.import.defaulted.formType'))
      if (imp.intro === null)        defaulted.push(t('pforms.import.defaulted.intro'))
      if (imp.thankYou === null)     defaulted.push(t('pforms.import.defaulted.thankYou'))
      if (imp.unmappedTypes.length > 0) {
        defaulted.push(t('pforms.import.skippedTypes', { types: imp.unmappedTypes.join(', ') }))
      }
      setForm((prev) => ({
        ...prev,
        formName: `${d.form.name} · ${t('pforms.import.copySuffix')}`,
        locale: imp.locale ?? prev.locale,
        landingUrl: prev.landingUrl || imp.landingUrl || '',
        higherIntent: imp.higherIntent ?? false,
        selectedContact: imp.contact,
        customQuestions: imp.customs,
        introEnabled: imp.intro !== null,
        introTitle: imp.intro?.title ?? '',
        introBullets: imp.intro?.bullets ?? [],
        thankYouTitle: imp.thankYou?.title ?? prev.thankYouTitle,
        thankYouBody: imp.thankYou?.body ?? prev.thankYouBody,
        thankYouButton: imp.thankYou?.buttonType ?? 'VIEW_WEBSITE',
        thankYouWebsiteUrl: imp.thankYou?.websiteUrl ?? '',
        thankYouPhone: imp.thankYou?.phone ?? '',
      }))
      setActiveTemplate(null)
      setImportedFromId(id)
      setImportNote(defaulted.length > 0 ? defaulted.join(' · ') : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pforms.error.unexpected'))
    } finally {
      setImportBusy(false)
    }
  }

  // ── Question state helpers ─────────────────────────────────────────────────

  function toggleContact(type: MetaFormQuestionType) {
    setForm((prev) => ({
      ...prev,
      selectedContact: prev.selectedContact.includes(type)
        ? prev.selectedContact.filter((x) => x !== type)
        : [...prev.selectedContact, type],
    }))
  }

  function addPreset(key: 'budget' | 'timeline' | 'purpose') {
    const q = buildPreset(key, facts, t)
    setForm((prev) => (prev.customQuestions.some((c) => c.key === q.key)
      ? prev
      : { ...prev, customQuestions: [...prev.customQuestions, q] }))
  }

  function addBlankQuestion(kind: 'choice' | 'text') {
    setForm((prev) => ({
      ...prev,
      customQuestions: [...prev.customQuestions, {
        id: nextId(), label: '', kind, options: kind === 'choice' ? ['', ''] : [],
      }],
    }))
  }

  function patchQuestion(id: string, patch: Partial<BuilderCustomQuestion>) {
    setForm((prev) => ({
      ...prev,
      customQuestions: prev.customQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }))
  }

  function removeQuestion(id: string) {
    setForm((prev) => ({ ...prev, customQuestions: prev.customQuestions.filter((q) => q.id !== id) }))
  }

  function buildQuestions(): MetaFormQuestion[] {
    // Catalog order keeps the form reading naturally (identity → reach → …).
    const contact: MetaFormQuestion[] = CONTACT_TYPES
      .filter((type) => form.selectedContact.includes(type))
      .map((type) => ({ type }))
    const customs = form.customQuestions
      .filter((q) => q.label.trim())
      .map((q, i) => customToMetaQuestion({ ...q, label: q.label.trim() }, i))
    return [...contact, ...customs]
  }

  const questionCount = buildQuestions().length
  const trackingSlug = form.formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'lead-form'
  const callNeedsPhone = form.thankYouButton === 'CALL_BUSINESS' && !form.thankYouPhone.trim()

  // ── Create ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    setError(null)
    setSubmitting(true)
    try {
      const bullets = form.introBullets.map((b) => b.trim()).filter(Boolean)
      const payload: CreateLeadFormPayload = {
        name:              form.formName,
        listingId:         form.listingId,
        listingName:       listing?.name ?? form.formName,
        landingUrl:        form.landingUrl,
        questions:         buildQuestions(),
        privacyPolicyUrl:  form.privacyPolicyUrl,
        locale:            form.locale,
        isOptimizedForQuality: form.higherIntent,
        questionPageHeadline: form.questionHeadline.trim() || undefined,
        contextCard: form.introEnabled && form.introTitle.trim() && bullets.length > 0
          ? { title: form.introTitle.trim(), style: 'LIST_STYLE', content: bullets.slice(0, 5) }
          : undefined,
        phoneSmsVerification: form.phoneVerify && form.selectedContact.includes('PHONE') ? true : undefined,
        thankYouTitle:     form.thankYouTitle || undefined,
        thankYouBody:      form.thankYouBody  || undefined,
        thankYouButtonType: form.thankYouButton,
        thankYouWebsiteUrl: form.thankYouButton === 'DOWNLOAD'
          ? (form.thankYouWebsiteUrl.trim() || listing?.brochureUrl || undefined)
          : (form.thankYouWebsiteUrl.trim() || undefined),
        thankYouBusinessPhone: form.thankYouButton === 'CALL_BUSINESS' ? form.thankYouPhone.trim() : undefined,
        thankYouPhoneCountryCode: form.thankYouButton === 'CALL_BUSINESS' ? 'AE' : undefined,
      }
      const res = await fetch('/api/meta/forms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('pforms.error.createFailed'))
      setCreated(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(isMetaConfigErrorMessage(msg) ? t('lm.meta.notConnectedHint') : msg || t('pforms.error.unexpected'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Created screen ─────────────────────────────────────────────────────────

  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 mb-6">
          <Check className="h-8 w-8 text-gold" />
        </div>
        <h2 className="text-[28px] font-semibold text-white">{t('pforms.created.title')}</h2>
        <p className="mt-3 text-sm text-slate-400">{t('pforms.created.subtitle')}</p>
        {/* Honest state: a form no ad uses collects nothing — say so instead of
            implying it is live. Wired-from-ad creations skip the caveat. */}
        {!wiredProject && (
          <p className="mx-auto mt-4 max-w-md rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-[12px] leading-relaxed text-amber-300">
            {t('pforms.created.unwired')}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/freehold-intelligence/lead-machine/forms/${created.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]"
          >
            {t('pforms.created.viewForm')}
          </Link>
          <Link
            href="/freehold-intelligence/lead-machine/forms"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-surface-2 px-5 py-2.5 text-sm text-slate-300 transition hover:text-white"
          >
            {t('pforms.allForms')}
          </Link>
        </div>
      </div>
    )
  }

  const stepTitles = [
    t('pforms.step.kind'),
    t('pforms.step.intro'),
    t('pforms.step.questions'),
    t('pforms.step.afterSubmit'),
    t('pforms.step.settings'),
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <Link
        href="/freehold-intelligence/lead-machine/forms"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t('pforms.allForms')}
      </Link>

      <div className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <FileText className="h-3.5 w-3.5" /> {t('pforms.new.eyebrow')}
        </div>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-white">
          {stepTitles[step - 1]}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="mt-7 flex items-center gap-2">
        {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-gold' : 'bg-surface-2'}`}
          />
        ))}
      </div>

      {/* ── Step 1: What kind of form ── */}
      {step === 1 && (
        <div className="mt-8 space-y-6">
          <div>
            <label className={labelCls}>{t('pforms.basics.listing')}</label>
            {wiredProject && form.listingId === wiredProject ? (
              <div className="flex items-center gap-2 rounded-[14px] border border-gold/30 bg-gold/[0.06] px-4 py-3 text-[14px] text-white">
                <Check className="h-4 w-4 shrink-0 text-gold" />
                <span className="min-w-0 truncate">{listing?.name ?? form.listingId}</span>
                <span className="ms-auto shrink-0 text-[11px] text-gold/70">{t('pforms.basics.wiredFromAd')}</span>
              </div>
            ) : (
              <select
                value={form.listingId}
                onChange={(e) => onListingChange(e.target.value)}
                className={inputCls}
              >
                <option value="">{t('pforms.basics.selectListing')}</option>
                {projects.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>{t('pforms.basics.formName')}</label>
            <input
              value={form.formName}
              onChange={(e) => setForm((p) => ({ ...p, formName: e.target.value }))}
              placeholder={t('pforms.basics.formNamePlaceholder')}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t('pforms.basics.landingUrl')}</label>
            <input
              value={form.landingUrl}
              onChange={(e) => setForm((p) => ({ ...p, landingUrl: e.target.value }))}
              placeholder={t('pforms.basics.landingUrlPlaceholder')}
              className={inputCls}
            />
          </div>

          {/* More volume vs Higher intent — Meta's real form-type switch, with
              the honest tradeoff on each card. */}
          <div>
            <label className={labelCls}>{t('pforms.kind.title')}</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { intent: false, name: t('pforms.kind.volume'),  desc: t('pforms.kind.volumeDesc')  },
                { intent: true,  name: t('pforms.kind.intent'),  desc: t('pforms.kind.intentDesc')  },
              ]).map((k) => (
                <button
                  key={String(k.intent)}
                  onClick={() => setForm((p) => ({ ...p, higherIntent: k.intent }))}
                  className={`rounded-[14px] border p-4 text-left transition ${
                    form.higherIntent === k.intent ? 'border-gold/40 bg-gold/[0.06]' : 'border-line bg-surface hover:border-white/15'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{k.name}</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-500">{k.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Templates — selecting one prefills the whole builder; everything
              stays editable. */}
          <div>
            <label className={labelCls}>{t('pforms.tpl.title')}</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {FORM_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  onClick={() => applyTemplate(tpl.key)}
                  className={`rounded-[14px] border p-4 text-left transition ${
                    activeTemplate === tpl.key ? 'border-gold/40 bg-gold/[0.06]' : 'border-line bg-surface hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="h-3.5 w-3.5 text-gold/80" /> {t(tpl.nameKey)}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-500">{t(tpl.descKey)}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{t('pforms.tpl.note')}</p>
          </div>

          {/* Start from an existing form */}
          {existingForms.length > 0 && (
            <div>
              <label className={labelCls}>{t('pforms.import.title')}</label>
              <div className="flex items-center gap-2">
                <select
                  value={importedFromId ?? ''}
                  onChange={(e) => importExistingForm(e.target.value)}
                  disabled={importBusy}
                  className={inputCls}
                >
                  <option value="">{importBusy ? t('common.loading') : t('pforms.import.pick')}</option>
                  {existingForms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              {importedFromId && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
                  <Copy className="mt-0.5 h-3 w-3 shrink-0 text-gold/70" />
                  <span>
                    {t('pforms.import.applied')}
                    {importNote ? <span className="text-slate-500"> — {importNote}</span> : null}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Introduction (context card) ── */}
      {step === 2 && (
        <div className="mt-8 space-y-5">
          <p className="text-sm text-slate-400">{t('pforms.intro.help')}</p>

          <button
            onClick={() => setForm((p) => {
              if (p.introEnabled) return { ...p, introEnabled: false }
              const suggested = (!p.introTitle && !p.introBullets.length && listing)
                ? introFromListing(facts, t)
                : { title: p.introTitle, bullets: p.introBullets }
              return { ...p, introEnabled: true, introTitle: suggested.title, introBullets: suggested.bullets }
            })}
            className={`flex w-full items-center gap-3 rounded-[14px] border p-4 text-left transition ${
              form.introEnabled ? 'border-gold/25 bg-gold/[0.05]' : 'border-line bg-surface hover:border-white/15'
            }`}
          >
            {form.introEnabled
              ? <CheckSquare className="h-4 w-4 shrink-0 text-gold" />
              : <Square className="h-4 w-4 shrink-0 text-slate-600" />}
            <div>
              <div className="text-sm font-medium text-white">{t('pforms.intro.enable')}</div>
              <div className="text-sm text-slate-500">{t('pforms.intro.enableDesc')}</div>
            </div>
          </button>

          {form.introEnabled && (
            <>
              <div>
                <label className={labelCls}>{t('pforms.intro.headline')}</label>
                <input
                  value={form.introTitle}
                  onChange={(e) => setForm((p) => ({ ...p, introTitle: e.target.value }))}
                  placeholder={listing?.name ?? t('pforms.intro.headlinePlaceholder')}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>{t('pforms.intro.bullets')}</label>
                <div className="space-y-2">
                  {form.introBullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={b}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          introBullets: p.introBullets.map((x, j) => (j === i ? e.target.value : x)),
                        }))}
                        className={inputCls}
                      />
                      <button
                        onClick={() => setForm((p) => ({ ...p, introBullets: p.introBullets.filter((_, j) => j !== i) }))}
                        className="shrink-0 rounded-lg border border-line bg-surface-2 p-2.5 text-slate-500 transition hover:text-red-300"
                        aria-label={t('pforms.intro.removeBullet')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {form.introBullets.length < 5 && (
                  <button
                    onClick={() => setForm((p) => ({ ...p, introBullets: [...p.introBullets, ''] }))}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs text-slate-300 transition hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t('pforms.intro.addBullet')}
                  </button>
                )}
              </div>

              {/* Honest limitation: the card's COVER PHOTO needs a page-photo
                  upload flow Meta doesn't take a URL for — not half-built. */}
              <p className="rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
                {t('pforms.intro.coverPhotoNote')}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Contact details + qualify the buyer ── */}
      {step === 3 && (
        <div className="mt-8 space-y-7">

          <div>
            <label className={labelCls}>{t('pforms.questions.headline')}</label>
            <input
              value={form.questionHeadline}
              onChange={(e) => setForm((p) => ({ ...p, questionHeadline: e.target.value }))}
              placeholder={t('pforms.questions.headlinePlaceholder')}
              className={inputCls}
            />
          </div>

          {/* Contact catalog — grouped by what you want to learn. Meta
              auto-fills every one of these from the person's profile. */}
          <div>
            <div className="mb-1 text-xs font-medium text-slate-400">{t('pforms.contact.title')}</div>
            <p className="mb-3 text-[11px] text-slate-500">{t('pforms.contact.help')}</p>
            <div className="space-y-4">
              {CONTACT_GROUPS.map((group) => (
                <div key={group.groupKey}>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t(group.groupKey)}</div>
                  <div className="flex flex-wrap gap-2">
                    {group.fields.map((f) => {
                      const selected = form.selectedContact.includes(f.type)
                      return (
                        <button
                          key={f.type}
                          onClick={() => toggleContact(f.type)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs transition ${
                            selected
                              ? 'border-gold/40 bg-gold/[0.08] text-gold'
                              : 'border-line bg-surface text-slate-400 hover:border-white/15 hover:text-slate-200'
                          }`}
                        >
                          {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {t(f.labelKey)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* SMS-verified phone — a real is_phone_sms_verify_enabled flag on
                POST /{page}/leadgen_forms. Only meaningful with PHONE on. */}
            {form.selectedContact.includes('PHONE') && (
              <button
                onClick={() => setForm((p) => ({ ...p, phoneVerify: !p.phoneVerify }))}
                className={`mt-4 flex w-full items-center gap-3 rounded-[14px] border p-4 text-left transition ${
                  form.phoneVerify ? 'border-gold/25 bg-gold/[0.05]' : 'border-line bg-surface hover:border-white/15'
                }`}
              >
                {form.phoneVerify
                  ? <CheckSquare className="h-4 w-4 shrink-0 text-gold" />
                  : <Square className="h-4 w-4 shrink-0 text-slate-600" />}
                <div>
                  <div className="text-sm font-medium text-white">{t('pforms.phoneVerify.title')}</div>
                  <div className="text-sm text-slate-500">{t('pforms.phoneVerify.desc')}</div>
                </div>
              </button>
            )}
          </div>

          {/* Qualify the buyer — custom questions */}
          <div>
            <div className="mb-1 text-xs font-medium text-slate-400">{t('pforms.qualify.title')}</div>
            <p className="mb-3 text-[11px] text-slate-500">{t('pforms.qualify.help')}</p>

            {/* One-click presets grounded in the listing */}
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESET_DEFS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => addPreset(p.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20"
                >
                  <Plus className="h-3 w-3" /> {t(p.labelKey)}
                </button>
              ))}
            </div>
            {listing?.priceAED ? (
              <p className="mb-3 text-[11px] text-slate-500">{t('pforms.qualify.budgetFromListing', { name: listing.name })}</p>
            ) : null}

            <div className="space-y-3">
              {form.customQuestions.map((q) => (
                <div key={q.id} className="rounded-[14px] border border-line bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <input
                      value={q.label}
                      onChange={(e) => patchQuestion(q.id, { label: e.target.value })}
                      placeholder={t('pforms.qualify.questionPlaceholder')}
                      className={inputCls}
                    />
                    <select
                      value={q.kind}
                      onChange={(e) => {
                        const kind = e.target.value as 'choice' | 'text'
                        patchQuestion(q.id, { kind, options: kind === 'choice' && q.options.length === 0 ? ['', ''] : q.options })
                      }}
                      className="shrink-0 rounded-[14px] border border-line bg-surface px-3 py-3 text-xs text-slate-300 outline-none focus:border-gold/40 transition"
                    >
                      <option value="choice">{t('pforms.qualify.kind.choice')}</option>
                      <option value="text">{t('pforms.qualify.kind.text')}</option>
                    </select>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="shrink-0 rounded-lg border border-line bg-surface-2 p-2.5 text-slate-500 transition hover:text-red-300"
                      aria-label={t('pforms.qualify.removeQuestion')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {q.kind === 'choice' && (
                    <div className="mt-3 space-y-2">
                      {q.options.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-4 shrink-0 text-right text-[11px] text-slate-600">{i + 1}.</span>
                          <input
                            value={o}
                            onChange={(e) => patchQuestion(q.id, { options: q.options.map((x, j) => (j === i ? e.target.value : x)) })}
                            placeholder={t('pforms.qualify.optionPlaceholder')}
                            className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-white placeholder:text-slate-600 outline-none focus:border-gold/40 transition"
                          />
                          {q.options.length > 2 && (
                            <button
                              onClick={() => patchQuestion(q.id, { options: q.options.filter((_, j) => j !== i) })}
                              className="shrink-0 rounded-lg p-1.5 text-slate-600 transition hover:text-red-300"
                              aria-label={t('pforms.qualify.removeOption')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => patchQuestion(q.id, { options: [...q.options, ''] })}
                        className="ms-6 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-slate-300 transition hover:text-white"
                      >
                        <Plus className="h-3 w-3" /> {t('pforms.qualify.addOption')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => addBlankQuestion('choice')}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs text-slate-300 transition hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" /> {t('pforms.qualify.addChoice')}
              </button>
              <button
                onClick={() => addBlankQuestion('text')}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs text-slate-300 transition hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" /> {t('pforms.qualify.addText')}
              </button>
            </div>
          </div>

          <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-xs text-slate-500">
            {t('pforms.questions.totalNote', { n: questionCount })}
          </div>
        </div>
      )}

      {/* ── Step 4: After submit ── */}
      {step === 4 && (
        <div className="mt-8 space-y-5">
          <p className="text-sm text-slate-400">{t('pforms.thankYou.intro')}</p>

          <div>
            <label className={labelCls}>{t('pforms.thankYou.headline')}</label>
            <input
              value={form.thankYouTitle}
              onChange={(e) => setForm((p) => ({ ...p, thankYouTitle: e.target.value }))}
              placeholder={t('pforms.thankYou.headlinePlaceholder')}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t('pforms.thankYou.message')}</label>
            <textarea
              value={form.thankYouBody}
              onChange={(e) => setForm((p) => ({ ...p, thankYouBody: e.target.value }))}
              rows={3}
              placeholder={t('pforms.thankYou.messagePlaceholder')}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Thank-you button — Download only offered when the listing has a
              real brochure file. */}
          <div>
            <label className={labelCls}>{t('pforms.thankYou.button')}</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                { type: 'VIEW_WEBSITE' as const,  icon: Globe,    name: t('pforms.thankYou.btn.website'),  desc: t('pforms.thankYou.btn.websiteDesc'),  show: true },
                { type: 'CALL_BUSINESS' as const, icon: Phone,    name: t('pforms.thankYou.btn.call'),     desc: t('pforms.thankYou.btn.callDesc'),     show: true },
                { type: 'DOWNLOAD' as const,      icon: Download, name: t('pforms.thankYou.btn.download'), desc: t('pforms.thankYou.btn.downloadDesc'), show: hasBrochure },
              ]).filter((b) => b.show).map((b) => {
                const Icon = b.icon
                const active = form.thankYouButton === b.type
                return (
                  <button
                    key={b.type}
                    onClick={() => setForm((p) => ({
                      ...p,
                      thankYouButton: b.type,
                      thankYouWebsiteUrl: b.type === 'DOWNLOAD' ? (listing?.brochureUrl ?? p.thankYouWebsiteUrl) : p.thankYouWebsiteUrl,
                    }))}
                    className={`rounded-[14px] border p-4 text-left transition ${
                      active ? 'border-gold/40 bg-gold/[0.06]' : 'border-line bg-surface hover:border-white/15'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-gold' : 'text-slate-500'}`} />
                    <div className="mt-2 text-sm font-medium text-white">{b.name}</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{b.desc}</div>
                  </button>
                )
              })}
            </div>
            {!hasBrochure && (
              <p className="mt-2 text-[11px] text-slate-500">{t('pforms.thankYou.noBrochureNote')}</p>
            )}
          </div>

          {form.thankYouButton === 'VIEW_WEBSITE' && (
            <div>
              <label className={labelCls}>{t('pforms.thankYou.websiteUrl')}</label>
              <input
                value={form.thankYouWebsiteUrl}
                onChange={(e) => setForm((p) => ({ ...p, thankYouWebsiteUrl: e.target.value }))}
                placeholder={form.landingUrl || 'https://…'}
                className={inputCls}
              />
              <p className="mt-1.5 text-[11px] text-slate-500">{t('pforms.thankYou.websiteUrlNote')}</p>
            </div>
          )}

          {form.thankYouButton === 'CALL_BUSINESS' && (
            <div>
              <label className={labelCls}>{t('pforms.thankYou.phone')}</label>
              <input
                value={form.thankYouPhone}
                onChange={(e) => setForm((p) => ({ ...p, thankYouPhone: e.target.value }))}
                dir="ltr"
                inputMode="tel"
                placeholder="+971 5x xxx xxxx"
                className={inputCls}
              />
            </div>
          )}

          {form.thankYouButton === 'DOWNLOAD' && (
            <div>
              <label className={labelCls}>{t('pforms.thankYou.downloadUrl')}</label>
              <input
                value={form.thankYouWebsiteUrl}
                onChange={(e) => setForm((p) => ({ ...p, thankYouWebsiteUrl: e.target.value }))}
                placeholder={listing?.brochureUrl ?? 'https://…/brochure.pdf'}
                className={inputCls}
              />
            </div>
          )}

          {/* Preview */}
          <div className="rounded-[18px] border border-gold/15 bg-gold/[0.03] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-gold/70 mb-3">{t('pforms.thankYou.preview')}</div>
            <div className="text-[17px] font-semibold text-white">{form.thankYouTitle || t('pforms.thankYou.previewHeadline')}</div>
            <p className="mt-2 text-sm text-slate-400">{form.thankYouBody || t('pforms.thankYou.previewBody')}</p>
            <span className="mt-4 inline-block rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink">
              {form.thankYouButton === 'CALL_BUSINESS' ? t('pforms.thankYou.btn.call')
                : form.thankYouButton === 'DOWNLOAD' ? t('pforms.thankYou.btn.download')
                : t('pforms.thankYou.btn.website')}
            </span>
          </div>
        </div>
      )}

      {/* ── Step 5: Settings & review ── */}
      {step === 5 && (
        <div className="mt-8 space-y-5">
          <div>
            <label className={labelCls}>{t('pforms.basics.language')}</label>
            <select
              value={form.locale}
              onChange={(e) => setForm((p) => ({ ...p, locale: e.target.value }))}
              className={inputCls}
            >
              {FORM_LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('pforms.basics.privacyUrl')}</label>
            <input
              value={form.privacyPolicyUrl}
              onChange={(e) => setForm((p) => ({ ...p, privacyPolicyUrl: e.target.value }))}
              className={inputCls}
            />
          </div>

          {/* Tracking parameters — auto-attached; shown read-only so the
              operator knows what rides on every lead. */}
          <div className="rounded-[14px] border border-line bg-surface-2 p-4">
            <div className="text-xs font-medium text-slate-400">{t('pforms.tracking.title')}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('pforms.tracking.note')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[11px] text-slate-400">
              <span className="rounded bg-surface px-2 py-1">utm_source=meta-form</span>
              <span className="rounded bg-surface px-2 py-1">utm_medium=paid</span>
              <span className="rounded bg-surface px-2 py-1">utm_campaign={trackingSlug}</span>
            </div>
          </div>

          {/* Review */}
          {[
            {
              title: t('pforms.review.formDetails'),
              rows: [
                [t('pforms.review.name'),      form.formName        || '—'],
                [t('pforms.review.listing'),   listing?.name ?? '—'],
                [t('pforms.review.formType'),  form.higherIntent ? t('pforms.kind.intent') : t('pforms.kind.volume')],
                [t('pforms.review.landingUrl'), form.landingUrl     || '—'],
                [t('pforms.review.privacyPolicy'), form.privacyPolicyUrl || '—'],
                ...(form.introEnabled && form.introTitle
                  ? [[t('pforms.review.introCard'), t('pforms.review.introCardValue', { n: form.introBullets.filter((b) => b.trim()).length })]]
                  : []),
                ...(form.phoneVerify && form.selectedContact.includes('PHONE')
                  ? [[t('pforms.phoneVerify.title'), t('pforms.review.enabled')]]
                  : []),
              ] as string[][],
            },
            {
              title: t('pforms.review.questions'),
              rows: buildQuestions().map((q, i) => [
                `${i + 1}. ${q.label ?? (contactLabelKey(q.type) ? t(contactLabelKey(q.type)!) : q.type)}`,
                q.type === 'CUSTOM'
                  ? (q.options?.length
                      ? t('pforms.review.customWithOptions', { n: q.options.length })
                      : t('pforms.review.customOpenText'))
                  : t('pforms.review.standardAutofill'),
              ]),
            },
            {
              title: t('pforms.review.thankYouPage'),
              rows: [
                [t('pforms.review.headline'), form.thankYouTitle || '—'],
                [t('pforms.review.message'),  form.thankYouBody  || '—'],
                [t('pforms.thankYou.button'),
                  form.thankYouButton === 'CALL_BUSINESS' ? `${t('pforms.thankYou.btn.call')} · ${form.thankYouPhone || '—'}`
                    : form.thankYouButton === 'DOWNLOAD' ? t('pforms.thankYou.btn.download')
                    : t('pforms.thankYou.btn.website')],
              ],
            },
          ].map((section) => (
            <div key={section.title} className="rounded-[18px] border border-line bg-surface p-5">
              <div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{section.title}</div>
              <div className="space-y-2">
                {section.rows.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <span className="text-xs text-slate-500 shrink-0">{label}</span>
                    <span className="text-xs text-slate-200 text-right truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {questionCount === 0 && (
            <div className="flex items-start gap-3 rounded-[14px] border border-amber-400/25 bg-amber-400/[0.06] p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-sm text-amber-200">{t('pforms.review.noQuestions')}</p>
            </div>
          )}
          {callNeedsPhone && (
            <div className="flex items-start gap-3 rounded-[14px] border border-amber-400/25 bg-amber-400/[0.06] p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-sm text-amber-200">{t('pforms.review.callNeedsPhone')}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-[14px] border border-red-400/20 bg-red-400/[0.05] p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        {step > 1
          ? (
            <button
              onClick={() => setStep((s) => (s - 1) as WizardStep)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-5 py-2.5 text-sm text-slate-300 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t('pforms.nav.back')}
            </button>
          )
          : <div />
        }

        {step < 5 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
            disabled={step === 1 && (!form.formName || !form.landingUrl)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('pforms.nav.next')} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={submitting || questionCount === 0 || callNeedsPhone}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50"
          >
            {submitting ? t('pforms.nav.creating') : t('pforms.nav.create')}
            {!submitting && <Check className="h-4 w-4" />}
          </button>
        )}
      </div>

    </div>
  )
}
