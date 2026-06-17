import type { Metadata } from 'next'
import {
  Phone, MapPin, Check, TrendingUp, Shield, Star, Building2, Globe, Wifi,
  ChevronRight, MessageCircle, Sparkles, Clock, Award, Users, Car, Plane,
  ShoppingBag, GraduationCap, Coffee, Dumbbell, Trees, Waves,
} from 'lucide-react'
import { getLandingPageBySlug, type LandingSection, type LandingPageData } from '@/lib/landing-pages'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import { LeadForm } from './_form'
import { FaqAccordion } from './_faq'
import { StickyLpCta } from './_sticky'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAed(n: number | null | undefined): string {
  if (!n || n <= 0) return 'Price on request'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function pickArr(obj: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const k of keys) {
    const v = obj[k]
    if (Array.isArray(v) && v.length) return v
  }
  return []
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
}

function toObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

// ─── Inventory fallback ───────────────────────────────────────────────────────

function inventoryToLandingPage(slug: string): LandingPageData | null {
  const prop = inventoryProperties.find((p) => p.slug === slug)
  if (!prop) return null

  const priceText = fmtAed(prop.startingPriceAED)
  const yieldText = prop.roi ? `${prop.roi.toFixed(1)}% annual yield` : 'Strong returns'

  const sections: LandingSection[] = [
    {
      type: 'hero',
      data: {
        eyebrow: `${prop.area} · ${prop.developer}`,
        title: `${prop.name}`,
        subtitle: `Premium ${prop.type} residences in ${prop.area}. From ${priceText}.${prop.roi ? ` ${prop.roi.toFixed(1)}% projected annual rental yield.` : ''}`,
        chips: [prop.area, priceText, yieldText],
      },
    },
    {
      type: 'key-facts',
      data: {
        items: [
          { label: 'Bedrooms', value: prop.bedrooms },
          { label: 'Size', value: prop.sizeRange },
          { label: prop.roi ? 'Yield' : 'Type', value: prop.roi ? `${prop.roi.toFixed(1)}%` : prop.type },
          { label: prop.handoverYear ? 'Handover' : 'Developer', value: prop.handoverYear ? String(prop.handoverYear) : prop.developer },
        ],
      },
    },
    ...(prop.paymentPlan ? [{ type: 'payment-plan' as const, data: { downPayment: 20, duringConstruction: 50, onHandover: 30, postHandover: 0 } }] : []),
    ...(prop.roi ? [{ type: 'roi' as const, data: { rentalYield: prop.roi, expectedRoi: prop.roi, startPriceAed: prop.startingPriceAED ?? 0 } }] : []),
    { type: 'golden-visa' as const, data: {} },
    { type: 'why-dubai' as const, data: {} },
    { type: 'ai-concierge' as const, data: { title: 'Ask Freehold AI', subtitle: `Get instant expert answers about ${prop.name}`, prompts: [`Is ${prop.name} better for yield or capital gains?`, `What type of investor buys in ${prop.area}?`, `Compare ${prop.area} to Downtown Dubai`] } },
    { type: 'lead-form' as const, data: { title: 'Get Full Brochure & Pricing', subtitle: 'A senior investment consultant will contact you within 24 hours with floor plans, pricing, and availability.' } },
  ]

  return {
    slug: prop.slug, projectSlug: prop.slug,
    title: prop.name, subtitle: `From ${priceText} · ${yieldText}`,
    heroImage: '/logo.png', ctaText: prop.roi ? 'Get Investment Analysis' : 'Request Brochure',
    isDraft: false,
    seo: { title: `${prop.name} | Freehold Property UAE`, description: `${prop.name} in ${prop.area}. From ${priceText}. ${yieldText}.`, ogImage: '/logo.png' },
    pixels: {},
    sections,
    project: { slug: prop.slug, name: prop.name, area: prop.area, developerName: prop.developer, heroImage: '/logo.png', priceFromAed: prop.startingPriceAED, priceToAed: prop.maxPriceAED, rentalYield: prop.roi, amenities: [], faqs: [] },
  }
}

async function getPage(slug: string): Promise<LandingPageData | null> {
  try {
    const dbPage = await getLandingPageBySlug(slug, { includeDraft: true })
    if (dbPage) return dbPage
  } catch { /* fallback */ }
  return inventoryToLandingPage(slug)
}

// ─── Section components ───────────────────────────────────────────────────────

function HeroSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const title = pick(d, 'title') || page.title
  const subtitle = pick(d, 'subtitle') || page.subtitle
  const eyebrow = pick(d, 'eyebrow')
  const chips = pickArr(d, 'chips').map(toStr).filter(Boolean)
  const hasImage = page.heroImage && !page.heroImage.endsWith('/logo.png')
  const price = chips[1] || fmtAed(page.project?.priceFromAed)
  const waUrl = `https://wa.me/971504173622?text=${encodeURIComponent(`Hi, I'm interested in ${title} — please send me more info.`)}`

  return (
    <section className="relative min-h-screen">
      {/* Background */}
      {hasImage ? (
        <div className="absolute inset-0">
          <div className="h-full w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${page.heroImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06070C]/95 via-[#06070C]/80 to-[#06070C]/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06070C] via-transparent to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 100% 80% at 20% 50%, rgba(212,175,55,0.18) 0%, transparent 55%), radial-gradient(ellipse 60% 60% at 80% 20%, rgba(100,120,200,0.08) 0%, transparent 50%), linear-gradient(135deg, #06070C 0%, #0A0D18 50%, #06070C 100%)' }} />
      )}

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_420px]">

          {/* Left: headline + CTAs */}
          <div className="flex flex-col justify-center">
            {eyebrow && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {eyebrow.split('·').map(s => s.trim()).filter(Boolean).map((part, i) => (
                  <span key={i} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${i === 0 ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/[0.12] bg-white/[0.04] text-white/50'}`}>
                    {i === 0 && <MapPin className="h-2.5 w-2.5" />}{part}
                  </span>
                ))}
              </div>
            )}

            <h1 className="text-[42px] font-bold leading-[1.1] tracking-tight text-white sm:text-[56px] lg:text-[64px]">
              {title}
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/55">{subtitle}</p>

            {chips.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2">
                {chips.map((chip, i) => (
                  <div key={i} className={`rounded-xl px-4 py-2 text-[13px] font-semibold ${i === 0 ? 'border border-white/[0.10] bg-white/[0.05] text-white/70' : i === 1 ? 'border border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#D4AF37]' : 'border border-white/[0.10] bg-white/[0.05] text-white/70'}`}>
                    {chip}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#lead-form" className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-8 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547] active:scale-[0.98]">
                {page.ctaText} <ChevronRight className="h-4 w-4" />
              </a>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-7 py-4 text-[15px] font-semibold text-[#25D366] transition-all hover:bg-[#25D366]/20">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>

            <div className="mt-10 flex items-center gap-5 border-t border-white/[0.07] pt-7">
              {[{ icon: Shield, label: 'DLD Registered' }, { icon: Star, label: 'RERA Certified' }, { icon: Award, label: 'Award-Winning Agency' }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[11px] text-white/35">
                  <Icon className="h-3.5 w-3.5 text-white/25" />{label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: inline lead form */}
          <div className="lg:pt-4">
            <div className="rounded-2xl border border-white/[0.09] bg-[#0A0D18]/90 p-7 shadow-2xl backdrop-blur-xl">
              <div className="mb-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">Free Consultation</div>
                <h3 className="text-[20px] font-bold text-white">Request Investment Pack</h3>
                <p className="mt-1 text-[13px] text-white/40">Floor plans, pricing, and ROI analysis — delivered within 24 hours.</p>
              </div>
              <LeadForm propertyName={page.project?.name || title} slug={page.slug} ctaText={page.ctaText} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DescriptionSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const title = pick(d, 'title') || `About ${page.project?.name || page.title}`
  const body = pick(d, 'body', 'description', 'content')
  const highlights = pickArr(d, 'highlights').map(toStr).filter(Boolean)

  if (!body && !highlights.length) return null

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">About the Project</div>
            <h2 className="mb-6 text-[34px] font-bold leading-tight text-white">{title}</h2>
            {body && <div className="space-y-4">{body.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="text-[16px] leading-[1.75] text-white/60">{para}</p>
            ))}</div>}
          </div>
          {highlights.length > 0 && (
            <div className="space-y-3">
              <div className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-white/30">Highlights</div>
              {highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15">
                    <Check className="h-3 w-3 text-[#D4AF37]" />
                  </div>
                  <span className="text-[14px] text-white/70">{h}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function GallerySection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const title = pick(d, 'title') || 'Project Gallery'
  const labels = pickArr(d, 'labels', 'rooms', 'views').map(toStr).filter(Boolean)
  const hasImage = page.heroImage && !page.heroImage.endsWith('/logo.png')

  const defaultLabels = ['Lobby & Entrance', 'Living Room', 'Master Bedroom', 'Kitchen & Dining', 'Pool & Amenities', 'View from Terrace']
  const cells = labels.length ? labels : defaultLabels

  const gradients = [
    'from-[#1a1008] to-[#2d1f0a]',
    'from-[#080d1a] to-[#0f1626]',
    'from-[#0a1208] to-[#162012]',
    'from-[#1a0808] to-[#2d1212]',
    'from-[#08101a] to-[#0c1820]',
    'from-[#12080a] to-[#201010]',
  ]

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Visuals</div>
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-[34px] font-bold text-white">{title}</h2>
          <a href="#lead-form" className="hidden text-[13px] text-[#D4AF37]/70 hover:text-[#D4AF37] sm:block">
            Request floor plans →
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cells.slice(0, 6).map((label, i) => (
            <div key={i} className={`group relative overflow-hidden rounded-xl ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
              {hasImage && i === 0 ? (
                <div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${page.heroImage})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>
              ) : (
                <div className={`aspect-[4/3] bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                  <div className="text-center">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/20">Render</div>
                    <div className="h-px w-12 mx-auto bg-white/10" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-6">
                <span className="text-[12px] font-medium text-white/80">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function UnitsSection({ d }: { d: Record<string, unknown> }) {
  const title = pick(d, 'title') || 'Available Residences'
  const units = pickArr(d, 'units', 'types').map(toObj)

  const defaultUnits = [
    { type: '1 Bedroom', size: '650–850 sqft', price: 'AED 1.2M – 1.6M', features: ['Balcony with skyline view', 'Open-plan living', 'Built-in wardrobes'], cta: 'Request Floor Plan' },
    { type: '2 Bedroom', size: '1,050–1,350 sqft', price: 'AED 1.9M – 2.5M', features: ['Master en-suite', 'Study/den', 'Corner views available'], cta: 'Request Floor Plan' },
    { type: '3 Bedroom', size: '1,600–2,100 sqft', price: 'AED 2.8M – 3.8M', features: ['Private pool option', 'Maid\'s room', 'Premium finishes'], cta: 'Request Floor Plan' },
  ]

  const list = units.length ? units : defaultUnits as unknown as Record<string, unknown>[]

  return (
    <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Residences</div>
        <div className="mb-10 flex items-end justify-between">
          <h2 className="text-[34px] font-bold text-white">{title}</h2>
          <span className="hidden text-[13px] text-white/30 sm:block">All prices are indicative · Subject to availability</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((unit, i) => {
            const type = toStr(unit.type) || toStr(unit.unitType)
            const size = toStr(unit.size)
            const price = toStr(unit.price) || toStr(unit.priceRange)
            const features = Array.isArray(unit.features) ? unit.features.map(toStr).filter(Boolean) : []

            return (
              <div key={i} className="group flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-all hover:border-[#D4AF37]/25">
                {/* Color band */}
                <div className="h-1 w-full" style={{ background: i === 0 ? '#9B8020' : i === 1 ? '#D4AF37' : '#C9A227' }} />
                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Unit Type</div>
                    <div className="mt-1 text-[22px] font-bold text-white">{type}</div>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2.5">
                      <div className="text-[10px] text-white/30 uppercase tracking-wide">Size</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-white/80">{size}</div>
                    </div>
                    <div className="rounded-lg bg-[#D4AF37]/[0.08] border border-[#D4AF37]/20 px-3 py-2.5">
                      <div className="text-[10px] text-[#D4AF37]/50 uppercase tracking-wide">Price</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[#D4AF37]">{price}</div>
                    </div>
                  </div>

                  {features.length > 0 && (
                    <ul className="mb-6 space-y-2">
                      {features.slice(0, 3).map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-[13px] text-white/55">
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/50" />{f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <a href="#lead-form" className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] py-3 text-[13px] font-semibold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/15">
                    Request Floor Plan <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function KeyFactsSection({ d }: { d: Record<string, unknown> }) {
  const items = pickArr(d, 'items') as Array<{ label?: string; value?: string }>
  if (!items.length) return null
  return (
    <div className="border-b border-white/[0.06] bg-[#0A0D16]">
      <div className="mx-auto grid max-w-6xl divide-x divide-white/[0.06] overflow-hidden sm:grid-cols-4">
        {items.slice(0, 4).map(({ label, value }, i) => (
          <div key={i} className="px-6 py-6 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</div>
            <div className="mt-2 text-[22px] font-bold text-white/95">{value || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentPlanSection({ d }: { d: Record<string, unknown> }) {
  const down = Number(pick(d, 'downPayment')) || 20
  const during = Number(pick(d, 'duringConstruction')) || 50
  const onHand = Number(pick(d, 'onHandover')) || 30
  const post = Number(pick(d, 'postHandover')) || 0
  const stages = [
    { label: 'Down Payment', pct: down, sub: 'On booking', color: '#D4AF37' },
    { label: 'During Construction', pct: during, sub: 'Paid in instalments', color: '#9B8020' },
    { label: 'On Handover', pct: onHand, sub: 'Keys handover', color: '#6B5A15' },
    ...(post > 0 ? [{ label: 'Post Handover', pct: post, sub: 'After completion', color: '#3D330B' }] : []),
  ].filter(s => s.pct > 0)

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Finance</div>
            <h2 className="mb-4 text-[34px] font-bold text-white">Flexible Payment Plan</h2>
            <p className="mb-10 text-[15px] text-white/45 leading-relaxed">Developer-backed payment structure designed to minimise your upfront commitment while securing your investment in one of Dubai's most coveted addresses.</p>

            {/* Progress bar */}
            <div className="mb-6 flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
              {stages.map((s, i) => <div key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />)}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stages.map(({ label, pct, sub, color }, i) => (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
                  <div className="text-[28px] font-bold leading-none" style={{ color }}>{pct}%</div>
                  <div className="mt-2 text-[11px] font-medium text-white/60">{label}</div>
                  <div className="mt-1 text-[10px] text-white/25">{sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {[
              { icon: Shield, title: 'Developer-Backed Plan', desc: 'Payment milestones tied to construction progress — your capital is protected at every stage.' },
              { icon: TrendingUp, title: 'Build Equity Immediately', desc: 'Properties historically appreciate during construction in Dubai, often delivering returns before handover.' },
              { icon: Award, title: '0% Commission', desc: 'All Freehold transactions are fee-free to buyers. You pay only the agreed purchase price.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                  <Icon className="h-5 w-5 text-[#D4AF37]/70" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-white/90">{title}</div>
                  <div className="mt-1 text-[13px] text-white/45 leading-snug">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RoiSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const yield_ = Number(pick(d, 'rentalYield', 'expectedRoi')) || 0
  const price = Number(pick(d, 'startPriceAed')) || page.project?.priceFromAed || 0

  const annual = price > 0 && yield_ > 0 ? price * (yield_ / 100) : null
  const monthly = annual ? annual / 12 : null
  const fiveYr = annual ? annual * 5 : null
  const capitalGain = price > 0 ? price * 0.35 : null // assume 35% capital appreciation in 5yr

  return (
    <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Investment Returns</div>
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <h2 className="text-[34px] font-bold text-white">Why This Investment Works</h2>
          <div className="flex items-center gap-2 text-[13px] text-white/30">
            <Clock className="h-4 w-4" /> Projections — not financial advice
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] p-7 text-center sm:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60 mb-3">Projected Yield</div>
            <div className="text-[56px] font-bold text-[#D4AF37] leading-none">{yield_ > 0 ? `${yield_.toFixed(1)}%` : '—'}</div>
            <div className="mt-2 text-[12px] text-white/35">Estimated net annual return</div>
          </div>
          {[
            { label: 'Annual Income', value: annual ? fmtAed(annual) : '—', sub: 'Gross rental income' },
            { label: 'Monthly Income', value: monthly ? fmtAed(monthly) : '—', sub: 'Average per month' },
            { label: '5-Year Rental', value: fiveYr ? fmtAed(fiveYr) : '—', sub: 'Cumulative income' },
          ].map(({ label, value, sub }, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">{label}</div>
              <div className="text-[26px] font-bold text-white/90 leading-none">{value}</div>
              <div className="mt-2 text-[11px] text-white/30">{sub}</div>
            </div>
          ))}
        </div>

        {capitalGain && (
          <div className="mt-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-emerald-400/70" />
                <div>
                  <div className="text-[13px] font-semibold text-white/70">Estimated 5-Year Capital Appreciation</div>
                  <div className="text-[12px] text-white/35">Based on Dubai Hills historical growth of ~7% p.a.</div>
                </div>
              </div>
              <div className="text-[20px] font-bold text-emerald-400">+{fmtAed(capitalGain)}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const LOCATION_ICONS: Record<string, React.ElementType> = {
  car: Car, plane: Plane, mall: ShoppingBag, school: GraduationCap, coffee: Coffee,
  gym: Dumbbell, park: Trees, beach: Waves, default: MapPin,
}

function LocationSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const area = pick(d, 'area') || page.project?.area || 'Dubai'
  const title = pick(d, 'title') || `Life in ${area}`
  const subtitle = pick(d, 'subtitle')
  const distances = pickArr(d, 'distances', 'landmarks').map(toObj)
  const highlights = pickArr(d, 'highlights').map(toStr).filter(Boolean)

  const defaultDistances: Record<string, unknown>[] = [
    { icon: 'car', label: 'Dubai Mall', time: '15 min', value: '13 km' },
    { icon: 'plane', label: 'DXB Airport', time: '30 min', value: '28 km' },
    { icon: 'mall', label: 'Mall of Emirates', time: '12 min', value: '10 km' },
    { icon: 'school', label: 'International Schools', time: '5 min', value: 'In community' },
    { icon: 'park', label: 'Dubai Hills Park', time: '3 min', value: 'Walk' },
    { icon: 'gym', label: 'Golf Club', time: '8 min', value: '6 km' },
  ]

  const dList = distances.length ? distances : defaultDistances

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Location</div>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-[34px] font-bold text-white">{title}</h2>
            {subtitle && <p className="mb-8 text-[15px] text-white/50 leading-relaxed">{subtitle}</p>}

            <div className="grid grid-cols-2 gap-3">
              {dList.slice(0, 6).map((item, i) => {
                const iconKey = toStr(item.icon) || 'default'
                const Icon = LOCATION_ICONS[iconKey] || MapPin
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                      <Icon className="h-4 w-4 text-[#D4AF37]/60" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-white/75">{toStr(item.label)}</div>
                      <div className="text-[11px] text-white/30">{toStr(item.time || item.distance || item.value)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            {/* Area visual */}
            <div className="mb-4 overflow-hidden rounded-2xl border border-white/[0.07]" style={{ background: 'linear-gradient(135deg, #0A1018 0%, #0D1520 100%)' }}>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#D4AF37]/60" />
                  <span className="text-[14px] font-semibold text-white">{area}, Dubai</span>
                </div>
                <span className="text-[11px] text-white/30">United Arab Emirates</span>
              </div>
              <div className="px-5 py-5">
                {highlights.length > 0 ? (
                  <ul className="space-y-3">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] text-white/60">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/50" />{h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] text-white/40 leading-relaxed">{area} is one of Dubai's most sought-after addresses, combining world-class infrastructure with exceptional lifestyle amenities and strong capital appreciation fundamentals.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const WHY_DUBAI = [
  { icon: Shield, stat: '#1', label: 'Safest city globally', sub: 'Global Peace Index 2024' },
  { icon: TrendingUp, stat: '0%', label: 'Income & capital gains tax', sub: 'For all residents' },
  { icon: Globe, stat: '200+', label: 'Nationalities call Dubai home', sub: 'Most cosmopolitan city' },
  { icon: Building2, stat: '$55bn+', label: 'Real estate transactions 2024', sub: 'Record-breaking year' },
  { icon: Star, stat: 'Top 3', label: 'Global luxury market', sub: 'Knight Frank 2024' },
  { icon: Award, stat: '10yr', label: 'Golden Visa residency', sub: 'For qualifying investors' },
]

function WhyDubaiSection({ d }: { d: Record<string, unknown> }) {
  return (
    <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Why Dubai</div>
        <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
          <h2 className="text-[34px] font-bold text-white">The World's Most Compelling Investment City</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {WHY_DUBAI.map(({ icon: Icon, stat, label, sub }) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                <Icon className="h-4.5 w-4.5 text-[#D4AF37]/70" />
              </div>
              <div className="text-[28px] font-bold text-white/90">{stat}</div>
              <div className="mt-1.5 text-[13px] font-medium text-white/60">{label}</div>
              <div className="mt-1 text-[11px] text-white/25">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GoldenVisaSection({ d }: { d: Record<string, unknown> }) {
  const benefits = pickArr(d, 'benefits').map(toStr).filter(Boolean)
  const threshold = pick(d, 'threshold') || 'AED 2,000,000'
  const defaultBenefits = ['10-year renewable UAE residency', 'Sponsor spouse and children under 25', 'No UAE local sponsor required', 'Own property outright in all freehold zones', 'Renewable indefinitely while owning property']

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0.04) 60%, transparent 100%)', border: '1px solid rgba(212,175,55,0.18)' }}>
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="p-10">
              <div className="mb-1 flex items-center gap-2">
                <Star className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">UAE Golden Visa</span>
              </div>
              <h2 className="mt-4 text-[36px] font-bold leading-tight text-white">Golden Visa<br />Eligible Property</h2>
              <p className="mt-3 text-[15px] text-white/50 leading-relaxed">Properties at {threshold}+ threshold unlock the UAE 10-year Golden Visa — giving you and your family full residency rights with no sponsor required.</p>
              <a href="#lead-form" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-7 py-3.5 text-[14px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547]">
                Check Eligibility <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="border-t border-[#D4AF37]/10 p-10 lg:border-l lg:border-t-0">
              <div className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-white/30">What You Get</div>
              <ul className="space-y-4">
                {(benefits.length ? benefits : defaultBenefits).map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] text-white/65">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />{b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AmenitiesSection({ d }: { d: Record<string, unknown> }) {
  const items = pickArr(d, 'items').map(toStr).filter(Boolean)
  if (!items.length) return null

  const iconMap: Record<string, React.ElementType> = { pool: Waves, gym: Dumbbell, park: Trees, garden: Trees, coffee: Coffee, shop: ShoppingBag }
  const getIcon = (s: string) => {
    for (const [key, Icon] of Object.entries(iconMap)) {
      if (s.toLowerCase().includes(key)) return Icon
    }
    return Check
  }

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Amenities</div>
        <h2 className="mb-8 text-[34px] font-bold text-white">World-Class Amenities</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, i) => {
            const Icon = getIcon(item)
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                <Icon className="h-4 w-4 shrink-0 text-[#D4AF37]/50" />
                <span className="text-[13px] text-white/65">{item}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function DeveloperSection({ d }: { d: Record<string, unknown> }) {
  const name = pick(d, 'name', 'developer') || 'Emaar Properties'
  const desc = pick(d, 'description', 'about')
  const stats = pickArr(d, 'stats').map(toObj)
  const defaultStats = [{ label: 'Projects Delivered', value: '80+' }, { label: 'Years in Market', value: '25+' }, { label: 'Properties Sold', value: '85,000+' }]

  return (
    <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Developer</div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="mb-4 text-[34px] font-bold text-white">Built by {name}</h2>
            <p className="text-[15px] text-white/50 leading-relaxed">{desc || `${name} is one of the UAE's most trusted and celebrated developers, with a track record of delivering iconic projects that define Dubai's skyline. Every development is backed by uncompromising build quality, transparent sales processes, and a commitment to buyer experience that has earned thousands of loyal investors globally.`}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            {(stats.length ? stats : defaultStats).map(({ label, value }, i) => (
              <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 text-center lg:text-left">
                <div className="text-[28px] font-bold text-[#D4AF37]">{toStr(value)}</div>
                <div className="mt-1 text-[12px] text-white/40">{toStr(label)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SocialProofSection({ d }: { d: Record<string, unknown> }) {
  const testimonials = pickArr(d, 'testimonials', 'items').map(toObj)
  const defaults = [
    { quote: "Freehold guided me through my first Dubai off-plan investment with full transparency on yield projections and payment timelines. The process was seamless and the team's market knowledge is exceptional.", name: 'James K.', role: 'UK investor · Dubai Hills, 2BR', rating: 5 },
    { quote: "I compared six agencies before choosing Freehold. Their analysis of ROI vs capital gains was the most honest I received. My property has already appreciated 18% since purchase.", name: 'Priya S.', role: 'Singapore-based buyer · 3BR Portfolio', rating: 5 },
    { quote: "As a GCC buyer looking for Golden Visa-eligible properties, Freehold filtered exactly the right options for my budget. Quick, professional, and genuinely knowledgeable.", name: 'Khalid A.', role: 'Saudi Arabia · Family Home Purchase', rating: 5 },
  ]

  const list = testimonials.length ? testimonials : defaults

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Social Proof</div>
        <div className="mb-10 flex items-end justify-between">
          <h2 className="text-[34px] font-bold text-white">Investor Experiences</h2>
          <div className="hidden items-center gap-1 sm:flex">
            {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" />)}
            <span className="ml-2 text-[13px] text-white/40">5.0 average</span>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t, i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7">
              <div className="mb-4 flex gap-0.5">
                {[...Array(Number(t.rating) || 5)].map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />)}
              </div>
              <p className="flex-1 text-[14px] italic leading-relaxed text-white/60">&ldquo;{toStr(t.quote)}&rdquo;</p>
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <div className="text-[13px] font-semibold text-white/80">{toStr(t.name)}</div>
                <div className="text-[11px] text-white/35">{toStr(t.role)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function NeighborhoodSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const area = pick(d, 'area') || page.project?.area || 'Dubai'
  const description = pick(d, 'description', 'body', 'about')
  const highlights = pickArr(d, 'highlights').map(toStr).filter(Boolean)

  const defaultHighlights = [
    `${area} is one of Dubai's most connected and sought-after communities`,
    'Access to world-class schools, retail, dining, and lifestyle infrastructure',
    'Strong rental demand driven by young professionals and families',
    'Capital growth track record with continued development investment',
  ]

  return (
    <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Neighbourhood</div>
            <h2 className="mb-4 text-[34px] font-bold text-white">Life in {area}</h2>
            {description && (
              <p className="text-[15px] text-white/50 leading-relaxed">{description}</p>
            )}
          </div>
          <div className="space-y-3">
            {(highlights.length ? highlights : defaultHighlights).map((h, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15">
                  <Check className="h-3 w-3 text-[#D4AF37]" />
                </div>
                <span className="text-[14px] text-white/65">{h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function MarketIntelligenceSection({ d }: { d: Record<string, unknown> }) {
  const summary = pick(d, 'summary')
  const bullets = pickArr(d, 'bullets').map(toStr).filter(Boolean)

  return (
    <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 lg:p-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/10">
              <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white">AI Market Analysis</div>
              <div className="text-[12px] text-white/35">Investment-grade context from live market data</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
            </div>
          </div>
          {summary && <p className="mb-6 text-[15px] leading-relaxed text-white/65 border-l-2 border-[#D4AF37]/40 pl-5">{summary}</p>}
          {bullets.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[13px] text-white/50">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]/50" />{b}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function AiConciergeSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const title = pick(d, 'title') || 'Ask Our AI Advisor'
  const subtitle = pick(d, 'subtitle')
  const prompts = pickArr(d, 'prompts').map(toStr).filter(Boolean)
  const name = page.project?.name || page.title
  const defaultPrompts = [
    `What is the projected ROI for ${name} over 5 years?`,
    `Is ${name} better for rental income or capital appreciation?`,
    `What type of buyer is ${name} best suited for?`,
  ]
  const list = prompts.length ? prompts : defaultPrompts
  const waBase = 'https://wa.me/971504173622?text='

  return (
    <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_480px]">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">AI Advisor</div>
            <h2 className="mb-3 text-[34px] font-bold text-white">{title}</h2>
            <p className="text-[15px] text-white/50 leading-relaxed">{subtitle || `Get instant, expert-level answers about ${name} — from yield analysis to buyer profiles to area comparisons. Powered by Freehold AI.`}</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/15 ring-1 ring-[#25D366]/25">
                <MessageCircle className="h-5 w-5 text-[#25D366]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white/80">WhatsApp AI — instant answers</div>
                <div className="text-[11px] text-white/35">Tap any question below to start</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {list.map((prompt, i) => (
              <a key={i} href={`${waBase}${encodeURIComponent(prompt)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-[14px] text-white/60 transition-all hover:border-[#25D366]/25 hover:bg-[#25D366]/[0.04] hover:text-white/80">
                <span>{prompt}</span>
                <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]/40" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function LeadFormSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const title = pick(d, 'title') || 'Get the Full Investment Pack'
  const subtitle = pick(d, 'subtitle') || 'Floor plans, pricing, ROI analysis, and brochure — delivered within 24 hours by a senior Freehold consultant.'

  return (
    <section id="lead-form" className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Contact Us</div>
            <h2 className="mb-3 text-[34px] font-bold text-white">{title}</h2>
            <p className="mb-8 text-[15px] text-white/50 leading-relaxed">{subtitle}</p>
            <div className="space-y-4">
              {[{ icon: Clock, text: 'Response within 24 hours, guaranteed' }, { icon: Shield, text: 'No pressure sales — honest, expert advice' }, { icon: Users, text: 'Dedicated investment consultant assigned' }, { icon: Award, text: '0% buyer commission — always' }].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-[14px] text-white/55">
                  <Icon className="h-4 w-4 shrink-0 text-[#D4AF37]/60" />{text}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#0A0D16] p-8">
              <LeadForm propertyName={page.project?.name || page.title} slug={page.slug} ctaText={page.ctaText} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DownloadBrochureSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const title = pick(d, 'title') || 'Download the Full Brochure'
  const subtitle = pick(d, 'subtitle') || 'Floor plans, specifications, payment schedule, and full investment analysis in one document.'

  return (
    <section className="border-t border-white/[0.05] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl p-10 text-center" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.05) 60%, transparent 100%)', border: '1px solid rgba(212,175,55,0.18)' }}>
          <div className="mx-auto max-w-lg">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Free Download</div>
            <h3 className="text-[28px] font-bold text-white">{title}</h3>
            <p className="mx-auto mt-3 text-[14px] text-white/45 leading-relaxed">{subtitle}</p>
            <a href="#lead-form" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-9 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547]">
              {page.ctaText} <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section dispatcher ───────────────────────────────────────────────────────

function Section({ section, page }: { section: LandingSection; page: LandingPageData }) {
  const d = section.data
  switch (section.type) {
    case 'hero': return <HeroSection d={d} page={page} />
    case 'description': return <DescriptionSection d={d} page={page} />
    case 'gallery': return <GallerySection d={d} page={page} />
    case 'units': return <UnitsSection d={d} />
    case 'key-facts': return <KeyFactsSection d={d} />
    case 'payment-plan': return <PaymentPlanSection d={d} />
    case 'roi': return <RoiSection d={d} page={page} />
    case 'why-dubai': return <WhyDubaiSection d={d} />
    case 'golden-visa': return <GoldenVisaSection d={d} />
    case 'amenities': return <AmenitiesSection d={d} />
    case 'location': return <LocationSection d={d} page={page} />
    case 'developer-profile': return <DeveloperSection d={d} />
    case 'social-proof': return <SocialProofSection d={d} />
    case 'market-intelligence': return <MarketIntelligenceSection d={d} />
    case 'ai-concierge': return <AiConciergeSection d={d} page={page} />
    case 'neighborhood': return <NeighborhoodSection d={d} page={page} />
    case 'faq': {
      const items = (pickArr(d, 'items') as Array<{ question?: string; answer?: string }>)
        .map(it => ({ question: toStr(it?.question), answer: toStr(it?.answer) }))
        .filter(it => it.question && it.answer)
      if (!items.length) return null
      return (
        <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr]">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">FAQ</div>
                <h2 className="text-[34px] font-bold text-white">Common Questions</h2>
                <p className="mt-3 text-[14px] text-white/40 leading-relaxed">Everything investors typically ask before committing to a Dubai off-plan purchase.</p>
              </div>
              <FaqAccordion items={items} />
            </div>
          </div>
        </section>
      )
    }
    case 'download-brochure': return <DownloadBrochureSection d={d} page={page} />
    case 'lead-form': return <LeadFormSection d={d} page={page} />
    default: return null
  }
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

function Topbar({ page }: { page: LandingPageData }) {
  const price = fmtAed(page.project?.priceFromAed)
  const waUrl = `https://wa.me/971504173622?text=${encodeURIComponent(`Hi, I'm interested in ${page.title}`)}`
  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-[#06070C]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <div className="text-[13px] font-bold tracking-wider text-[#D4AF37]">FREEHOLD <span className="font-normal text-white/30">Property UAE</span></div>
        {price !== 'Price on request' && <div className="hidden text-[12px] text-white/40 sm:block">From <span className="font-semibold text-white/70">{price}</span></div>}
        <div className="flex items-center gap-2">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-[12px] font-medium text-[#25D366] transition hover:bg-[#25D366]/20">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <a href="tel:+971504173622" className="hidden items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[12px] text-white/50 transition hover:text-white/80 sm:flex">
            <Phone className="h-3 w-3" /> Call
          </a>
        </div>
      </div>
      {page.isDraft && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-5 py-1.5 text-center text-[11px] font-medium text-amber-300">
          DRAFT — not published · Go to CRM → Landing Pages to publish
        </div>
      )}
    </div>
  )
}

function Footer({ page }: { page: LandingPageData }) {
  return (
    <footer className="border-t border-white/[0.06] px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <div className="text-[14px] font-bold tracking-wider text-[#D4AF37]">FREEHOLD Property UAE</div>
            <div className="mt-2 text-[12px] text-white/30 leading-relaxed">Sobha Sapphire, Office 904<br />Business Bay, Dubai, UAE</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">Contact</div>
            <div className="space-y-1 text-[12px] text-white/40">
              <div>+971 50 417 3622</div>
              <div>info@freeholdproperty.ae</div>
              <div>freeholdproperty.ae</div>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">Certifications</div>
            <div className="space-y-1 text-[12px] text-white/40">
              <div>RERA Licensed Agency</div>
              <div>DLD Registered Broker</div>
              <div>Dubai Chamber Member</div>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-white/[0.05] pt-6 text-center text-[10px] text-white/15 leading-relaxed">
          © {new Date().getFullYear()} Freehold Property UAE. All rights reserved.
          Prices, yields, and availability subject to change without notice.
          Projected returns are estimates only and do not constitute financial advice.
          Regulated by the Dubai Land Department.
        </div>
      </div>
    </footer>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#06070C] px-5 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/40 mb-3">404</div>
      <h1 className="text-[28px] font-bold text-white mb-2">Page not found</h1>
      <p className="text-[14px] text-white/35">This property page is not available or has been removed.</p>
      <a href="https://freeholdproperty.ae" className="mt-8 text-[13px] text-[#D4AF37]/60 hover:text-[#D4AF37]">← Back to Freehold</a>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return { title: 'Property | Freehold UAE' }
  return {
    title: page.seo.title || page.title,
    description: page.seo.description || page.subtitle,
    openGraph: { title: page.seo.title, description: page.seo.description, images: page.seo.ogImage ? [page.seo.ogImage] : [] },
  }
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return <NotFound />

  const price = fmtAed(page.project?.priceFromAed)

  return (
    <div className="min-h-screen bg-[#06070C] text-white">
      <Topbar page={page} />
      <div className="pt-[52px]">
        {page.sections.map((section, i) => (
          <Section key={`${section.type}-${i}`} section={section} page={page} />
        ))}
        <Footer page={page} />
      </div>
      <StickyLpCta price={price} ctaText={page.ctaText} slug={page.slug} />
    </div>
  )
}
