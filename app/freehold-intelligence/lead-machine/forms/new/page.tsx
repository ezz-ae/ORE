'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Check, FileText, AlertCircle,
  Plus, Trash2, CheckSquare, Square,
} from 'lucide-react'
import { leadMachineListings, leadMachineLandings } from '@/src/features/freehold-intelligence/lead-machine'
import type { MetaFormQuestion, MetaFormQuestionType, CreateLeadFormPayload } from '@/lib/meta/types'
import { useT } from '@/lib/i18n/provider'

type WizardStep = 1 | 2 | 3 | 4

const STANDARD_QUESTIONS: { type: MetaFormQuestionType; labelKey: string; descriptionKey: string; required?: boolean }[] = [
  { type: 'FULL_NAME', labelKey: 'pforms.q.fullName', descriptionKey: 'pforms.q.autoFilled', required: true },
  { type: 'PHONE',     labelKey: 'pforms.q.phone',    descriptionKey: 'pforms.q.autoFilled', required: true },
  { type: 'EMAIL',     labelKey: 'pforms.q.email',    descriptionKey: 'pforms.q.autoFilled' },
  { type: 'CITY',      labelKey: 'pforms.q.city',     descriptionKey: 'pforms.q.currentCity' },
]

const CUSTOM_PRESETS: { key: string; labelKey: string; options: { value: string; labelKey: string }[] }[] = [
  {
    key: 'budget_range',
    labelKey: 'pforms.preset.budget',
    options: [
      { value: 'under_1m',  labelKey: 'pforms.budget.under1m' },
      { value: '1m_2m',     labelKey: 'pforms.budget.1m2m'    },
      { value: '2m_3m',     labelKey: 'pforms.budget.2m3m'    },
      { value: '3m_5m',     labelKey: 'pforms.budget.3m5m'    },
      { value: 'above_5m',  labelKey: 'pforms.budget.above5m' },
    ],
  },
  {
    key: 'buying_intent',
    labelKey: 'pforms.preset.intent',
    options: [
      { value: 'invest',       labelKey: 'pforms.intent.invest'     },
      { value: 'own_use',      labelKey: 'pforms.intent.ownUse'     },
      { value: 'golden_visa',  labelKey: 'pforms.intent.goldenVisa' },
      { value: 'comparing',    labelKey: 'pforms.intent.comparing'  },
    ],
  },
  {
    key: 'timeline',
    labelKey: 'pforms.preset.timeline',
    options: [
      { value: 'immediate',  labelKey: 'pforms.timeline.immediate' },
      { value: '3_months',   labelKey: 'pforms.timeline.3months'   },
      { value: '6_months',   labelKey: 'pforms.timeline.6months'   },
      { value: 'exploring',  labelKey: 'pforms.timeline.exploring' },
    ],
  },
]

interface FormState {
  // Step 1
  listingId: string
  formName: string
  landingUrl: string
  privacyPolicyUrl: string
  // Step 2
  selectedStandard: MetaFormQuestionType[]
  selectedCustom: string[]
  // Step 3
  thankYouTitle: string
  thankYouBody: string
}

function makeDefault(t: (key: string) => string): FormState {
  return {
    listingId: '',
    formName: '',
    landingUrl: '',
    privacyPolicyUrl: 'https://freholdintelligence.com/privacy',
    selectedStandard: ['FULL_NAME', 'PHONE'],
    selectedCustom: ['budget_range', 'buying_intent'],
    thankYouTitle: t('pforms.default.thankYouTitle'),
    thankYouBody: t('pforms.default.thankYouBody'),
  }
}

export default function NewFormPage() {
  const t       = useT()
  const router  = useRouter()
  const [step, setStep]     = useState<WizardStep>(1)
  const [form, setForm]     = useState<FormState>(() => makeDefault(t))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string } | null>(null)

  function onListingChange(id: string) {
    const listing = leadMachineListings.find((l) => l.id === id)
    const landing = listing ? leadMachineLandings.find((l) => l.projectId === listing.projectId) : null
    setForm((prev) => ({
      ...prev,
      listingId: id,
      formName:  listing ? `${listing.projectName} — Lead Form` : prev.formName,
      landingUrl: landing?.landingUrl ?? prev.landingUrl,
    }))
  }

  function toggleStandard(type: MetaFormQuestionType) {
    if (['FULL_NAME', 'PHONE'].includes(type)) return // required
    setForm((prev) => ({
      ...prev,
      selectedStandard: prev.selectedStandard.includes(type)
        ? prev.selectedStandard.filter((t) => t !== type)
        : [...prev.selectedStandard, type],
    }))
  }

  function toggleCustom(key: string) {
    setForm((prev) => ({
      ...prev,
      selectedCustom: prev.selectedCustom.includes(key)
        ? prev.selectedCustom.filter((k) => k !== key)
        : [...prev.selectedCustom, key],
    }))
  }

  function buildQuestions(): MetaFormQuestion[] {
    const standard: MetaFormQuestion[] = form.selectedStandard.map((type) => ({ type }))
    const custom: MetaFormQuestion[] = form.selectedCustom.map((key) => {
      const preset = CUSTOM_PRESETS.find((p) => p.key === key)!
      return {
        type: 'CUSTOM',
        key,
        label: t(preset.labelKey),
        options: preset.options.map((o) => ({ value: o.value, label: t(o.labelKey) })),
      }
    })
    return [...standard, ...custom]
  }

  async function handleCreate() {
    setError(null)
    setSubmitting(true)
    try {
      const payload: CreateLeadFormPayload = {
        name:              form.formName,
        listingId:         form.listingId,
        listingName:       leadMachineListings.find((l) => l.id === form.listingId)?.projectName ?? form.formName,
        landingUrl:        form.landingUrl,
        questions:         buildQuestions(),
        privacyPolicyUrl:  form.privacyPolicyUrl,
        thankYouTitle:     form.thankYouTitle || undefined,
        thankYouBody:      form.thankYouBody  || undefined,
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
      setError(e instanceof Error ? e.message : t('pforms.error.unexpected'))
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 mb-6">
          <Check className="h-8 w-8 text-gold" />
        </div>
        <h2 className="text-[28px] font-semibold text-white">{t('pforms.created.title')}</h2>
        <p className="mt-3 text-sm text-slate-400">{t('pforms.created.subtitle')}</p>
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
          {[t('pforms.step.basics'), t('pforms.step.questions'), t('pforms.step.thankYou'), t('pforms.step.review')][step - 1]}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="mt-7 flex items-center gap-2">
        {([1, 2, 3, 4] as WizardStep[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-gold' : 'bg-surface-2'}`}
          />
        ))}
      </div>

      {/* ── Step 1: Basics ── */}
      {step === 1 && (
        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t('pforms.basics.listing')}</label>
            <select
              value={form.listingId}
              onChange={(e) => onListingChange(e.target.value)}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-white outline-none focus:border-gold/40 transition"
            >
              <option value="">{t('pforms.basics.selectListing')}</option>
              {leadMachineListings.map((l) => (
                <option key={l.id} value={l.id}>{l.projectName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t('pforms.basics.formName')}</label>
            <input
              value={form.formName}
              onChange={(e) => setForm((p) => ({ ...p, formName: e.target.value }))}
              placeholder={t('pforms.basics.formNamePlaceholder')}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-white placeholder:text-slate-600 outline-none focus:border-gold/40 transition"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t('pforms.basics.landingUrl')}</label>
            <input
              value={form.landingUrl}
              onChange={(e) => setForm((p) => ({ ...p, landingUrl: e.target.value }))}
              placeholder={t('pforms.basics.landingUrlPlaceholder')}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-white placeholder:text-slate-600 outline-none focus:border-gold/40 transition"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t('pforms.basics.privacyUrl')}</label>
            <input
              value={form.privacyPolicyUrl}
              onChange={(e) => setForm((p) => ({ ...p, privacyPolicyUrl: e.target.value }))}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-white placeholder:text-slate-600 outline-none focus:border-gold/40 transition"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Questions ── */}
      {step === 2 && (
        <div className="mt-8 space-y-6">
          <div>
            <div className="mb-3 text-xs font-medium text-slate-400">{t('pforms.questions.standardFields')}</div>
            <div className="space-y-2">
              {STANDARD_QUESTIONS.map((q) => {
                const required  = ['FULL_NAME', 'PHONE'].includes(q.type)
                const selected  = form.selectedStandard.includes(q.type)
                return (
                  <button
                    key={q.type}
                    onClick={() => toggleStandard(q.type)}
                    className={`flex w-full items-center gap-3 rounded-[14px] border p-4 text-left transition ${
                      selected ? 'border-gold/25 bg-gold/[0.05]' : 'border-line bg-surface hover:border-white/15'
                    } ${required ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    {selected
                      ? <CheckSquare className="h-4 w-4 shrink-0 text-gold" />
                      : <Square className="h-4 w-4 shrink-0 text-slate-600" />
                    }
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{t(q.labelKey)}</span>
                        {required && (
                          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[9px] font-medium text-gold">{t('pforms.questions.required')}</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">{t(q.descriptionKey)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-medium text-slate-400">{t('pforms.questions.custom')}</div>
            <div className="space-y-2">
              {CUSTOM_PRESETS.map((preset) => {
                const selected = form.selectedCustom.includes(preset.key)
                return (
                  <button
                    key={preset.key}
                    onClick={() => toggleCustom(preset.key)}
                    className={`flex w-full items-center gap-3 rounded-[14px] border p-4 text-left transition ${
                      selected ? 'border-gold/25 bg-gold/[0.05]' : 'border-line bg-surface hover:border-white/15'
                    }`}
                  >
                    {selected
                      ? <CheckSquare className="h-4 w-4 shrink-0 text-gold" />
                      : <Square className="h-4 w-4 shrink-0 text-slate-600" />
                    }
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">{t(preset.labelKey)}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-slate-500">
                        {preset.options.map((o) => <span key={o.value}>{t(o.labelKey)}</span>)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-xs text-slate-500">
            {t('pforms.questions.totalNote', { n: buildQuestions().length })}
          </div>
        </div>
      )}

      {/* ── Step 3: Thank you page ── */}
      {step === 3 && (
        <div className="mt-8 space-y-5">
          <p className="text-sm text-slate-400">{t('pforms.thankYou.intro')}</p>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t('pforms.thankYou.headline')}</label>
            <input
              value={form.thankYouTitle}
              onChange={(e) => setForm((p) => ({ ...p, thankYouTitle: e.target.value }))}
              placeholder={t('pforms.thankYou.headlinePlaceholder')}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-white placeholder:text-slate-600 outline-none focus:border-gold/40 transition"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">{t('pforms.thankYou.message')}</label>
            <textarea
              value={form.thankYouBody}
              onChange={(e) => setForm((p) => ({ ...p, thankYouBody: e.target.value }))}
              rows={3}
              placeholder={t('pforms.thankYou.messagePlaceholder')}
              className="w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] text-white placeholder:text-slate-600 outline-none focus:border-gold/40 transition resize-none"
            />
          </div>

          {/* Preview */}
          <div className="rounded-[18px] border border-gold/15 bg-gold/[0.03] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-gold/70 mb-3">{t('pforms.thankYou.preview')}</div>
            <div className="text-[17px] font-semibold text-white">{form.thankYouTitle || t('pforms.thankYou.previewHeadline')}</div>
            <p className="mt-2 text-sm text-slate-400">{form.thankYouBody || t('pforms.thankYou.previewBody')}</p>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 4 && (
        <div className="mt-8 space-y-4">
          {[
            {
              title: t('pforms.review.formDetails'),
              rows: [
                [t('pforms.review.name'),      form.formName        || '—'],
                [t('pforms.review.listing'),   leadMachineListings.find((l) => l.id === form.listingId)?.projectName ?? '—'],
                [t('pforms.review.landingUrl'), form.landingUrl     || '—'],
                [t('pforms.review.privacyPolicy'), form.privacyPolicyUrl || '—'],
              ],
            },
            {
              title: t('pforms.review.questions'),
              rows: buildQuestions().map((q, i) => [
                `${i + 1}. ${q.label ?? q.type}`,
                q.type === 'CUSTOM' ? t('pforms.review.customWithOptions', { n: q.options?.length ?? 0 }) : t('pforms.review.standardAutofill'),
              ]),
            },
            {
              title: t('pforms.review.thankYouPage'),
              rows: [
                [t('pforms.review.headline'), form.thankYouTitle || '—'],
                [t('pforms.review.message'),  form.thankYouBody  || '—'],
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

        {step < 4 ? (
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
            disabled={submitting}
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
