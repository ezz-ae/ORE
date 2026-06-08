'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Phone, MapPin, Check, Star, Shield, TrendingUp, Home, ChevronRight } from 'lucide-react'
import { inventoryProperties, type InventoryProperty } from '@/src/features/freehold-intelligence/inventory'

function fmtPrice(n: number | null): string {
  if (n === null) return 'Competitive Pricing'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function parsePaymentPlan(plan: string | null): { label: string; pct: string }[] {
  if (!plan) return []
  if (plan.includes('/')) {
    const parts = plan.split('/').map((s) => s.trim())
    const labels = ['Down Payment', 'During Construction', 'On Handover', 'Post Handover']
    return parts
      .map((p, i) => ({
        label: labels[i] ?? `Stage ${i + 1}`,
        pct: p.replace(/[^0-9%]/g, '') + '%',
      }))
      .filter((p) => p.pct !== '%')
  }
  return []
}

function buildHighlights(p: InventoryProperty): string[] {
  const out: string[] = []
  if (p.roi !== null) out.push(`Up to ${p.roi.toFixed(1)}% annual rental yield`)
  else out.push('Strong rental returns in prime Dubai location')
  out.push(`${p.bedrooms} bedroom residences from ${fmtPrice(p.startingPriceAED)}`)
  if (p.paymentPlan) out.push(`${p.paymentPlan} payment plan`)
  else out.push('Flexible payment options available')
  if (p.handoverYear) out.push(`Handover ${p.handoverYear} — ${p.totalUnits ? `${p.availableUnits ?? '—'} of ${p.totalUnits} units available` : 'limited availability'}`)
  else out.push(`Prime address in ${p.area}, Dubai`)
  return out.slice(0, 4)
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F1A]">
      <div className="text-center px-6">
        <div className="text-[14px] font-mono text-[#D4AF37]/60 mb-3">404</div>
        <div className="text-[22px] font-semibold text-white mb-2">Page not found</div>
        <div className="text-[14px] text-white/35">This property page is not available or has been removed.</div>
      </div>
    </div>
  )
}

function LeadForm({ propertyName, slug }: { propertyName: string; slug: string }) {
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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send your request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[20px] border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/15">
          <Check className="h-6 w-6 text-[#D4AF37]" />
        </div>
        <div className="text-[18px] font-semibold text-white mb-1">Thank you!</div>
        <div className="text-[14px] text-white/50">
          Our team will contact you within 24 hours with the brochure and pricing for {propertyName}.
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-white/40 uppercase tracking-wider">Full Name *</label>
        <input
          type="text"
          required
          placeholder="Your full name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="w-full rounded-[12px] border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-white/20 outline-none transition focus:border-[#D4AF37]/40 focus:bg-white/[0.06]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-white/40 uppercase tracking-wider">Phone / WhatsApp *</label>
        <input
          type="tel"
          required
          placeholder="+971 __ ___ ____"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          className="w-full rounded-[12px] border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-white/20 outline-none transition focus:border-[#D4AF37]/40 focus:bg-white/[0.06]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-white/40 uppercase tracking-wider">Email</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          className="w-full rounded-[12px] border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-white/20 outline-none transition focus:border-[#D4AF37]/40 focus:bg-white/[0.06]"
        />
      </div>
      {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 w-full rounded-[12px] bg-[#D4AF37] px-6 py-3.5 text-[14px] font-bold text-[#06080A] transition hover:bg-[#F0CB67] disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Request Brochure & Pricing'}
      </button>
      <p className="text-center text-[11px] text-white/20">
        By submitting, you agree to be contacted by Freehold Property UAE. No spam.
      </p>
    </form>
  )
}

export default function LandingPage() {
  const { slug } = useParams<{ slug: string }>()
  const prop = inventoryProperties.find((p) => p.slug === slug)

  if (!prop) return <NotFound />

  const highlights = buildHighlights(prop)
  const paymentParts = parsePaymentPlan(prop.paymentPlan)
  const priceLabel = fmtPrice(prop.startingPriceAED)

  const statusLabel: Record<string, string> = {
    off_plan: 'Off Plan',
    under_construction: 'Under Construction',
    ready: 'Ready to Move',
    coming_soon: 'Coming Soon',
    active: 'Available',
    sold_out: 'Sold Out',
  }

  const FACTS = [
    prop.bedrooms !== 'Studio' ? { label: 'Bedrooms', value: prop.bedrooms + ' BR' } : { label: 'Type', value: 'Studio' },
    { label: 'Size', value: prop.sizeRange },
    prop.roi !== null ? { label: 'Yield', value: prop.roi.toFixed(1) + '%' } : { label: 'Area', value: prop.area },
    prop.handoverYear ? { label: 'Handover', value: String(prop.handoverYear) } : { label: 'Developer', value: prop.developer },
  ]

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0B0F1A]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <div className="text-[13px] font-semibold tracking-wide text-[#D4AF37]">
            FREEHOLD<span className="text-white/40 font-normal"> Property UAE</span>
          </div>
          <a href="tel:+971504173622"
            className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 px-3 py-1.5 text-[12px] text-[#D4AF37] transition hover:bg-[#D4AF37]/10">
            <Phone className="h-3 w-3" /> +971 50 417 3622
          </a>
        </div>
      </div>

      {/* Hero */}
      <div className="relative pt-[52px]">
        <div
          className="relative flex min-h-[78vh] flex-col justify-center overflow-hidden px-5 py-16"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 60%), linear-gradient(180deg, #0B0F1A 0%, #111827 100%)',
          }}
        >
          {/* Status + area chips */}
          <div className="mx-auto flex max-w-lg flex-wrap gap-2 mb-5">
            <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-medium text-[#D4AF37]">
              {statusLabel[prop.status] ?? prop.status}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] text-white/50">
              <MapPin className="h-3 w-3" /> {prop.area}, Dubai
            </span>
            <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] text-white/50">
              {prop.developer}
            </span>
          </div>

          <div className="mx-auto max-w-lg">
            <h1 className="text-[30px] font-bold leading-tight text-white sm:text-[36px]">
              {prop.name}
            </h1>
            <p className="mt-3 text-[16px] text-white/50 leading-relaxed">
              {prop.type.charAt(0).toUpperCase() + prop.type.slice(1)} residences in the heart of {prop.area}.
              {prop.roi !== null ? ` ${prop.roi.toFixed(1)}% expected annual yield.` : ''}
            </p>
            <div className="mt-5 text-[13px] text-white/30 uppercase tracking-wider">Starting from</div>
            <div className="text-[34px] font-bold text-[#D4AF37] leading-none">{priceLabel}</div>

            <a href="#lead-form"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-7 py-3.5 text-[15px] font-bold text-[#06080A] transition hover:bg-[#F0CB67]">
              Request Brochure <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Key facts bar */}
        <div className="border-y border-white/[0.06] bg-[#0D1321]">
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {FACTS.map(({ label, value }) => (
              <div key={label} className="border-r border-white/[0.06] last:border-r-0 px-3 py-4 text-center">
                <div className="text-[10px] text-white/25 uppercase tracking-wider">{label}</div>
                <div className="mt-1 text-[14px] font-semibold text-white/85">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="px-5 py-12">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[#D4AF37]/60">Why Invest</div>
          <h2 className="mb-7 text-[22px] font-bold text-white">Key Investment Benefits</h2>
          <div className="space-y-3">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-4 rounded-[16px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10">
                  <Check className="h-3.5 w-3.5 text-[#D4AF37]" />
                </div>
                <span className="text-[14px] text-white/75">{h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment plan */}
      {paymentParts.length >= 2 && (
        <div className="px-5 py-10 border-t border-white/[0.05]">
          <div className="mx-auto max-w-lg">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[#D4AF37]/60">Payment Structure</div>
            <h2 className="mb-7 text-[22px] font-bold text-white">{prop.paymentPlan}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {paymentParts.slice(0, 4).map(({ label, pct }) => (
                <div key={label} className="rounded-[16px] border border-white/[0.07] bg-[#131B2B] p-4 text-center">
                  <div className="text-[26px] font-bold text-[#D4AF37]">{pct}</div>
                  <div className="mt-1 text-[11px] text-white/35">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trust signals */}
      <div className="px-5 py-10 border-t border-white/[0.05]">
        <div className="mx-auto max-w-lg">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Shield, title: 'DLD Registered', sub: 'Fully regulated & licensed' },
              { icon: Star, title: 'RERA Certified', sub: 'Dubai RERA compliant' },
              { icon: TrendingUp, title: '10+ Years', sub: 'Market expertise' },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <Icon className="mx-auto mb-2 h-5 w-5 text-[#D4AF37]/60" />
                <div className="text-[12px] font-semibold text-white/80">{title}</div>
                <div className="mt-0.5 text-[10px] text-white/30">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead form */}
      <div id="lead-form" className="px-5 py-12 border-t border-white/[0.05]">
        <div className="mx-auto max-w-lg">
          <div className="rounded-[24px] border border-[#D4AF37]/15 bg-[#131B2B] p-7">
            <div className="mb-6">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[#D4AF37]/60">Get Brochure</div>
              <h2 className="text-[22px] font-bold text-white">Request Exclusive Pricing</h2>
              <p className="mt-2 text-[13px] text-white/35">
                Our specialists will send you the brochure, floor plans, and pricing within 24 hours.
              </p>
            </div>
            <LeadForm propertyName={prop.name} slug={prop.slug} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-5 py-8">
        <div className="mx-auto max-w-lg">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <div className="text-[13px] font-semibold text-[#D4AF37]">Freehold Property UAE</div>
              <div className="mt-0.5 text-[11px] text-white/25">
                Sobha Sapphire, Office 904, Business Bay, Dubai
              </div>
            </div>
            <div className="text-[11px] text-white/20 leading-relaxed">
              <div>RERA Licensed Real Estate Agency</div>
              <div>+971 50 417 3622 · info@freeholdproperty.ae</div>
            </div>
          </div>
          <div className="mt-6 border-t border-white/[0.04] pt-4 text-center text-[10px] text-white/15">
            © {new Date().getFullYear()} Freehold Property UAE. All rights reserved.
            Prices and availability subject to change. Regulated by Dubai Land Department.
          </div>
        </div>
      </div>

    </div>
  )
}
