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

type WizardStep = 1 | 2 | 3 | 4

const STANDARD_QUESTIONS: { type: MetaFormQuestionType; label: string; description: string; required?: boolean }[] = [
  { type: 'FULL_NAME', label: 'Full name',     description: 'Auto-filled by Meta', required: true },
  { type: 'PHONE',     label: 'Phone number',  description: 'Auto-filled by Meta', required: true },
  { type: 'EMAIL',     label: 'Email address', description: 'Auto-filled by Meta' },
  { type: 'CITY',      label: 'City',          description: 'Current city' },
]

const CUSTOM_PRESETS: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'budget_range',
    label: 'Budget range',
    options: [
      { value: 'under_1m',  label: 'Under AED 1M'  },
      { value: '1m_2m',     label: 'AED 1M – 2M'   },
      { value: '2m_3m',     label: 'AED 2M – 3M'   },
      { value: '3m_5m',     label: 'AED 3M – 5M'   },
      { value: 'above_5m',  label: 'Above AED 5M'  },
    ],
  },
  {
    key: 'buying_intent',
    label: 'Buying intent',
    options: [
      { value: 'invest',       label: 'Investment / rental yield' },
      { value: 'own_use',      label: 'Own use / family home'    },
      { value: 'golden_visa',  label: 'Golden Visa residency'    },
      { value: 'comparing',    label: 'Still comparing options'  },
    ],
  },
  {
    key: 'timeline',
    label: 'Purchase timeline',
    options: [
      { value: 'immediate',  label: 'Ready to buy now'     },
      { value: '3_months',   label: 'Within 3 months'      },
      { value: '6_months',   label: 'Within 6 months'      },
      { value: 'exploring',  label: 'Just exploring'       },
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

const DEFAULT: FormState = {
  listingId: '',
  formName: '',
  landingUrl: '',
  privacyPolicyUrl: 'https://freholdintelligence.com/privacy',
  selectedStandard: ['FULL_NAME', 'PHONE'],
  selectedCustom: ['budget_range', 'buying_intent'],
  thankYouTitle: 'Thank you — we\'ll be in touch shortly.',
  thankYouBody: 'A senior advisor will contact you within 24 hours to discuss your options.',
}

export default function NewFormPage() {
  const router  = useRouter()
  const [step, setStep]     = useState<WizardStep>(1)
  const [form, setForm]     = useState<FormState>(DEFAULT)
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
      return { type: 'CUSTOM', key, label: preset.label, options: preset.options }
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
      if (!res.ok) throw new Error(data.error ?? 'Failed to create form')
      setCreated(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D4AF37]/15 mb-6">
          <Check className="h-8 w-8 text-[#D4AF37]" />
        </div>
        <h2 className="text-[28px] font-semibold text-white">Form created.</h2>
        <p className="mt-3 text-[15px] text-white/55">Your lead gen form is live on Meta and ready to attach to campaigns.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/freehold-intelligence/lead-machine/forms/${created.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE]"
          >
            View form
          </Link>
          <Link
            href="/freehold-intelligence/lead-machine/forms"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/70 transition hover:text-white"
          >
            All forms
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
        className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All forms
      </Link>

      <div className="mt-7">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <FileText className="h-3.5 w-3.5" /> New lead form
        </div>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-white">
          {['Basics', 'Questions', 'Thank you', 'Review'][step - 1]}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="mt-7 flex items-center gap-2">
        {([1, 2, 3, 4] as WizardStep[]).map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-[#D4AF37]' : 'bg-white/[0.08]'}`}
          />
        ))}
      </div>

      {/* ── Step 1: Basics ── */}
      {step === 1 && (
        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-[12px] font-medium text-white/55">Listing</label>
            <select
              value={form.listingId}
              onChange={(e) => onListingChange(e.target.value)}
              className="w-full rounded-[14px] border border-white/[0.08] bg-[#131B2B] px-4 py-3 text-[14px] text-white outline-none focus:border-[#D4AF37]/40 transition"
            >
              <option value="">Select listing…</option>
              {leadMachineListings.map((l) => (
                <option key={l.id} value={l.id}>{l.projectName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-medium text-white/55">Form name</label>
            <input
              value={form.formName}
              onChange={(e) => setForm((p) => ({ ...p, formName: e.target.value }))}
              placeholder="e.g. Palm Jumeirah — Lead Form"
              className="w-full rounded-[14px] border border-white/[0.08] bg-[#131B2B] px-4 py-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/40 transition"
            />
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-medium text-white/55">Landing page URL</label>
            <input
              value={form.landingUrl}
              onChange={(e) => setForm((p) => ({ ...p, landingUrl: e.target.value }))}
              placeholder="https://… (used for thank-you redirect)"
              className="w-full rounded-[14px] border border-white/[0.08] bg-[#131B2B] px-4 py-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/40 transition"
            />
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-medium text-white/55">Privacy policy URL</label>
            <input
              value={form.privacyPolicyUrl}
              onChange={(e) => setForm((p) => ({ ...p, privacyPolicyUrl: e.target.value }))}
              className="w-full rounded-[14px] border border-white/[0.08] bg-[#131B2B] px-4 py-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/40 transition"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Questions ── */}
      {step === 2 && (
        <div className="mt-8 space-y-6">
          <div>
            <div className="mb-3 text-[12px] font-medium text-white/55">Standard fields</div>
            <div className="space-y-2">
              {STANDARD_QUESTIONS.map((q) => {
                const required  = ['FULL_NAME', 'PHONE'].includes(q.type)
                const selected  = form.selectedStandard.includes(q.type)
                return (
                  <button
                    key={q.type}
                    onClick={() => toggleStandard(q.type)}
                    className={`flex w-full items-center gap-3 rounded-[14px] border p-4 text-left transition ${
                      selected ? 'border-[#D4AF37]/25 bg-[#D4AF37]/[0.05]' : 'border-white/[0.08] bg-[#131B2B] hover:border-white/15'
                    } ${required ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    {selected
                      ? <CheckSquare className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                      : <Square className="h-4 w-4 shrink-0 text-white/25" />
                    }
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-white">{q.label}</span>
                        {required && (
                          <span className="rounded-full bg-[#D4AF37]/10 px-2 py-0.5 text-[9px] font-medium text-[#D4AF37]">Required</span>
                        )}
                      </div>
                      <div className="text-[13px] text-white/35">{q.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[12px] font-medium text-white/55">Qualifying questions (custom)</div>
            <div className="space-y-2">
              {CUSTOM_PRESETS.map((preset) => {
                const selected = form.selectedCustom.includes(preset.key)
                return (
                  <button
                    key={preset.key}
                    onClick={() => toggleCustom(preset.key)}
                    className={`flex w-full items-center gap-3 rounded-[14px] border p-4 text-left transition ${
                      selected ? 'border-[#D4AF37]/25 bg-[#D4AF37]/[0.05]' : 'border-white/[0.08] bg-[#131B2B] hover:border-white/15'
                    }`}
                  >
                    {selected
                      ? <CheckSquare className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                      : <Square className="h-4 w-4 shrink-0 text-white/25" />
                    }
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-white">{preset.label}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[13px] text-white/30">
                        {preset.options.map((o) => <span key={o.value}>{o.label}</span>)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-[14px] border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-[12px] text-white/35">
            {buildQuestions().length} questions total — shorter forms convert better. 3–4 questions is optimal for real estate leads.
          </div>
        </div>
      )}

      {/* ── Step 3: Thank you page ── */}
      {step === 3 && (
        <div className="mt-8 space-y-5">
          <p className="text-[13px] text-white/55">Shown to the lead immediately after form submission. Keep it warm and action-forward.</p>

          <div>
            <label className="mb-2 block text-[12px] font-medium text-white/55">Thank you headline</label>
            <input
              value={form.thankYouTitle}
              onChange={(e) => setForm((p) => ({ ...p, thankYouTitle: e.target.value }))}
              placeholder="Thank you — we'll be in touch."
              className="w-full rounded-[14px] border border-white/[0.08] bg-[#131B2B] px-4 py-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/40 transition"
            />
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-medium text-white/55">Thank you message</label>
            <textarea
              value={form.thankYouBody}
              onChange={(e) => setForm((p) => ({ ...p, thankYouBody: e.target.value }))}
              rows={3}
              placeholder="A senior advisor will contact you within 24 hours…"
              className="w-full rounded-[14px] border border-white/[0.08] bg-[#131B2B] px-4 py-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/40 transition resize-none"
            />
          </div>

          {/* Preview */}
          <div className="rounded-[18px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] p-5">
            <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/70 mb-3">Preview</div>
            <div className="text-[17px] font-semibold text-white">{form.thankYouTitle || 'Thank you headline'}</div>
            <p className="mt-2 text-[13px] text-white/60">{form.thankYouBody || 'Thank you message body…'}</p>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 4 && (
        <div className="mt-8 space-y-4">
          {[
            {
              title: 'Form details',
              rows: [
                ['Name',      form.formName        || '—'],
                ['Listing',   leadMachineListings.find((l) => l.id === form.listingId)?.projectName ?? '—'],
                ['Landing URL', form.landingUrl     || '—'],
                ['Privacy policy', form.privacyPolicyUrl || '—'],
              ],
            },
            {
              title: 'Questions',
              rows: buildQuestions().map((q, i) => [
                `${i + 1}. ${q.label ?? q.type}`,
                q.type === 'CUSTOM' ? `Custom · ${q.options?.length ?? 0} options` : 'Standard (Meta auto-fill)',
              ]),
            },
            {
              title: 'Thank you page',
              rows: [
                ['Headline', form.thankYouTitle || '—'],
                ['Message',  form.thankYouBody  || '—'],
              ],
            },
          ].map((section) => (
            <div key={section.title} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
              <div className="mb-3 text-[13px] font-medium uppercase tracking-[0.18em] text-white/35">{section.title}</div>
              <div className="space-y-2">
                {section.rows.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <span className="text-[12px] text-white/35 shrink-0">{label}</span>
                    <span className="text-[12px] text-white/75 text-right truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-start gap-3 rounded-[14px] border border-red-400/20 bg-red-400/[0.05] p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-[13px] text-red-200">{error}</p>
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
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] text-white/65 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )
          : <div />
        }

        {step < 4 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
            disabled={step === 1 && (!form.formName || !form.landingUrl)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-6 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE] disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create form'}
            {!submitting && <Check className="h-4 w-4" />}
          </button>
        )}
      </div>

    </div>
  )
}
