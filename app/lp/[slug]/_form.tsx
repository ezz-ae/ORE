'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface LeadFormProps {
  propertyName: string
  slug: string
  ctaText?: string
}

export function LeadForm({ propertyName, slug, ctaText = 'Request Brochure & Pricing' }: LeadFormProps) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          interest: `Brochure & pricing — ${propertyName}`,
          source: `lp:${slug}`,
          landingSlug: slug,
          projectSlug: slug,
          message: `Requested brochure & pricing for ${propertyName} via landing page.`,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Unable to send your request.')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send your request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[0.08] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/30">
          <Check className="h-7 w-7 text-[#D4AF37]" />
        </div>
        <div className="text-[20px] font-semibold text-white mb-2">Request received</div>
        <div className="text-[14px] text-white/50 leading-relaxed">
          Our team will send you the brochure and pricing for <span className="text-white/80">{propertyName}</span> within a few hours.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">
          Full Name <span className="text-[#D4AF37]">*</span>
        </label>
        <input
          type="text"
          required
          placeholder="Your full name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 text-[14px] text-white placeholder-white/20 outline-none transition-all focus:border-[#D4AF37]/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-[#D4AF37]/20"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">
          Phone / WhatsApp <span className="text-[#D4AF37]">*</span>
        </label>
        <input
          type="tel"
          required
          placeholder="+971 __ ___ ____"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          className="w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 text-[14px] text-white placeholder-white/20 outline-none transition-all focus:border-[#D4AF37]/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-[#D4AF37]/20"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">
          Email
        </label>
        <input
          type="email"
          placeholder="your@email.com"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          className="w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 text-[14px] text-white placeholder-white/20 outline-none transition-all focus:border-[#D4AF37]/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-[#D4AF37]/20"
        />
      </div>
      {error && <p className="text-[13px] text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547] active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : ctaText}
      </button>
      <p className="text-center text-[11px] text-white/20 leading-relaxed">
        By submitting, you agree to be contacted by Freehold Property UAE. No spam, ever.
      </p>
    </form>
  )
}
