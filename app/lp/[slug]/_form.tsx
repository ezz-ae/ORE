'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { trackConversion, collectUtm, collectIntent, getSessionId } from './_tracker'
import type { LpPalette } from '@/lib/landing-theme'

interface LeadFormProps {
  propertyName: string
  slug: string
  ctaText?: string
  L: Record<string, string>
  palette: LpPalette
  pixels?: {
    metaPixelId?: string
    googleTagId?: string
    googleConversionId?: string
    tiktokPixelId?: string
  }
  /** Which fields the page collects, chosen in the landing generator. Absent =
   *  the default (name + phone + email). */
  fields?: Record<string, boolean>
}

export function LeadForm({ propertyName, slug, ctaText, L, palette, pixels = {}, fields }: LeadFormProps) {
  const submitLabel = ctaText || L['form.defaultCta']
  const [form, setForm] = useState({ name: '', phone: '', email: '', nationality: '', budget: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Honor the operator's field choices. Phone is always required (the minimum
  // usable lead); everything else follows the config, with sensible defaults.
  const has = (k: string, dflt: boolean) => (fields ? fields[k] === true : dflt)
  const showName = has('name', true)
  const showEmail = has('email', true)
  const showNationality = has('nationality', false)
  const showBudget = has('budget', false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if ((showName && !form.name) || !form.phone) return
    setError('')
    setSubmitting(true)
    // One id for both conversion events (browser pixel + server CAPI) so Meta
    // deduplicates them instead of counting the lead twice.
    const eventId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `lead-${Date.now()}`
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          name: form.name,
          phone: form.phone,
          email: form.email,
          ...(showNationality && form.nationality ? { nationality: form.nationality } : {}),
          ...(showBudget && form.budget ? { budget: form.budget } : {}),
          interest: `Brochure & pricing — ${propertyName}`,
          source: `lp:${slug}`,
          landingSlug: slug,
          projectSlug: slug,
          message: `Requested brochure & pricing for ${propertyName} via landing page.`
            + (showNationality && form.nationality ? ` Nationality: ${form.nationality}.` : '')
            + (showBudget && form.budget ? ` Budget: ${form.budget}.` : ''),
          // Campaign attribution — first-touch UTM captured by the tracker,
          // so the CRM lead links back to the ad that produced it.
          utm: collectUtm(),
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          // Links this lead to its landing-page session so the behaviour
          // score computed from that session travels with it.
          sessionId: getSessionId(),
          // Declared intent from the ad click (?intent=, first-touch) —
          // stored as click_intent, distinct from behaviour-derived
          // buyer_intent. Empty when the visit carried no intent.
          clickIntent: collectIntent(),
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || L['form.error'])
      trackConversion(slug, pixels, eventId)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : L['form.error'])
    } finally {
      setSubmitting(false)
    }
  }

  const labelStyle = { color: palette.textFaint }
  const inputClass =
    'lp-input w-full rounded-xl border px-4 py-3.5 text-[14px] outline-none transition-all focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20'
  const inputStyle = { borderColor: palette.surfaceBorder, background: palette.inputBg, color: palette.textPrimary }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[0.08] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/30">
          <Check className="h-7 w-7 text-[#D4AF37]" />
        </div>
        <div className="text-[20px] font-semibold mb-2" style={{ color: palette.textPrimary }}>{L['form.successTitle']}</div>
        <div className="text-[14px] leading-relaxed" style={{ color: palette.textMuted }}>
          {L['form.successPrefix']} <span style={{ color: palette.textPrimary }}>{propertyName}</span> {L['form.successSuffix']}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Theme-aware placeholder color (inline styles can't target ::placeholder). */}
      <style>{`.lp-input::placeholder{color:${palette.placeholder};}`}</style>
      {showName && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest" style={labelStyle}>
            {L['form.name']} <span className="text-[#D4AF37]">*</span>
          </label>
          <input
            type="text"
            required
            placeholder={L['form.namePlaceholder']}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest" style={labelStyle}>
          {L['form.phone']} <span className="text-[#D4AF37]">*</span>
        </label>
        <input
          type="tel"
          required
          placeholder={L['form.phonePlaceholder']}
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          className={inputClass}
          style={inputStyle}
        />
      </div>
      {showEmail && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest" style={labelStyle}>
            {L['form.email']}
          </label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      )}
      {showNationality && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest" style={labelStyle}>
            {L['form.nationality']}
          </label>
          <input
            type="text"
            placeholder={L['form.nationalityPlaceholder']}
            value={form.nationality}
            onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      )}
      {showBudget && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest" style={labelStyle}>
            {L['form.budget']}
          </label>
          <select
            value={form.budget}
            onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">{L['form.budgetAny']}</option>
            <option value="< AED 1M">{L['form.budgetR1']}</option>
            <option value="AED 1M–2M">{L['form.budgetR2']}</option>
            <option value="AED 2M–5M">{L['form.budgetR3']}</option>
            <option value="AED 5M+">{L['form.budgetR4']}</option>
          </select>
        </div>
      )}
      {error && <p className="text-[13px] text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547] active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {L['form.sending']}</> : submitLabel}
      </button>
      <p className="text-center text-[11px] leading-relaxed" style={{ color: palette.textFaint }}>
        {L['form.disclaimer']}
      </p>
    </form>
  )
}
