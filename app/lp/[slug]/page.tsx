import type { Metadata } from 'next'
import { Phone, MapPin, Check, TrendingUp, Shield, Star, Building2, Globe, Wifi, ChevronRight, MessageCircle, Sparkles } from 'lucide-react'
import { getLandingPageBySlug, type LandingSection, type LandingPageData } from '@/lib/landing-pages'
import { LeadForm } from './_form'
import { FaqAccordion } from './_faq'

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

// ─── Section renderers ────────────────────────────────────────────────────────

function HeroSection({ d, page }: { d: Record<string, unknown>; page: LandingPageData }) {
  const title = pick(d, 'title') || page.title
  const subtitle = pick(d, 'subtitle') || page.subtitle
  const eyebrow = pick(d, 'eyebrow')
  const chips = pickArr(d, 'chips').map(toStr).filter(Boolean)
  const hasRealImage = page.heroImage && !page.heroImage.endsWith('/logo.png')

  return (
    <section className="relative overflow-hidden">
      {hasRealImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${page.heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090E]/50 via-[#08090E]/70 to-[#08090E]" />
        </div>
      )}
      {!hasRealImage && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(212,175,55,0.22) 0%, transparent 65%), linear-gradient(180deg, #0C1018 0%, #08090E 100%)',
          }}
        />
      )}

      <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-32">
        {eyebrow && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {eyebrow.split('·').map((part) => part.trim()).filter(Boolean).map((part, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] text-white/55"
              >
                {i === 0 && <MapPin className="h-2.5 w-2.5" />}
                {part}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-[38px] font-bold leading-[1.15] tracking-tight text-white sm:text-[48px]">
          {title}
        </h1>

        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/55">
          {subtitle}
        </p>

        {chips.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {chips.map((chip, i) => (
              <span
                key={i}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium ${
                  i === 0
                    ? 'border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border border-white/[0.08] bg-white/[0.03] text-white/60'
                }`}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#lead-form"
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-8 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547] active:scale-[0.98]"
          >
            {page.ctaText} <ChevronRight className="h-4 w-4" />
          </a>
          <a
            href="tel:+971504173622"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-6 py-4 text-[14px] text-white/60 transition-all hover:border-white/[0.20] hover:text-white/80"
          >
            <Phone className="h-4 w-4" /> +971 50 417 3622
          </a>
        </div>
      </div>
    </section>
  )
}

function MarketIntelligenceSection({ d }: { d: Record<string, unknown> }) {
  const title = pick(d, 'title') || 'AI Market Analysis'
  const subtitle = pick(d, 'subtitle') || 'Investment-grade context from the listing data.'
  const summary = pick(d, 'summary')
  const bullets = pickArr(d, 'bullets').map(toStr).filter(Boolean)

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E111A] p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/30">
              <Sparkles className="h-4 w-4 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-white/80">{title}</div>
              <div className="text-[11px] text-white/35">{subtitle}</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          </div>

          {summary && (
            <p className="mb-6 text-[15px] leading-relaxed text-white/65 border-l-2 border-[#D4AF37]/40 pl-4">
              {summary}
            </p>
          )}

          {bullets.length > 0 && (
            <ul className="space-y-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] text-white/55">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]/60" />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function KeyFactsSection({ d }: { d: Record<string, unknown> }) {
  const items = pickArr(d, 'items') as Array<{ label?: string; value?: string }>
  if (!items.length) return null

  return (
    <section className="px-6 py-4">
      <div className="mx-auto max-w-2xl">
        <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0E111A] sm:grid-cols-4 sm:divide-y-0">
          {items.slice(0, 4).map(({ label, value }, i) => (
            <div key={i} className="px-5 py-6 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</div>
              <div className="mt-2 text-[18px] font-bold text-white/90 leading-tight">{value || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PaymentPlanSection({ d }: { d: Record<string, unknown> }) {
  const down = Number(pick(d, 'downPayment')) || 20
  const during = Number(pick(d, 'duringConstruction')) || 50
  const onHand = Number(pick(d, 'onHandover')) || 30
  const post = Number(pick(d, 'postHandover')) || 0

  const stages = [
    { label: 'Down Payment', pct: down, color: '#D4AF37' },
    { label: 'During Construction', pct: during, color: '#9B8020' },
    { label: 'On Handover', pct: onHand, color: '#6B5A15' },
    ...(post > 0 ? [{ label: 'Post Handover', pct: post, color: '#3D320B' }] : []),
  ].filter((s) => s.pct > 0)

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Payment Structure</div>
        <h2 className="mb-8 text-[26px] font-bold text-white">Flexible Payment Plan</h2>

        {/* Visual bar */}
        <div className="mb-6 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
          {stages.map((s, i) => (
            <div
              key={i}
              style={{ width: `${s.pct}%`, backgroundColor: s.color }}
              className="transition-all"
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stages.map(({ label, pct, color }, i) => (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
              <div className="text-[28px] font-bold leading-none" style={{ color }}>{pct}%</div>
              <div className="mt-2 text-[11px] text-white/40 leading-snug">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RoiSection({ d, projectName }: { d: Record<string, unknown>; projectName: string }) {
  const yield_ = Number(pick(d, 'rentalYield', 'expectedRoi')) || 0
  const price = Number(pick(d, 'startPriceAed')) || 0

  const annualRental = price > 0 && yield_ > 0 ? price * (yield_ / 100) : null
  const monthlyRental = annualRental ? annualRental / 12 : null

  return (
    <section
      className="px-6 py-16"
      style={{
        background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(212,175,55,0.07) 0%, transparent 70%)',
      }}
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Returns</div>
        <h2 className="mb-10 text-[26px] font-bold text-white">Investment Performance</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-6 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60 mb-3">Annual Yield</div>
            <div className="text-[48px] font-bold text-[#D4AF37] leading-none">
              {yield_ > 0 ? `${yield_.toFixed(1)}%` : '—'}
            </div>
            <div className="mt-2 text-[12px] text-white/35">Projected net rental return</div>
          </div>

          {annualRental && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">Annual Income</div>
              <div className="text-[26px] font-bold text-white/90 leading-none">{fmtAed(annualRental)}</div>
              <div className="mt-2 text-[12px] text-white/35">Estimated gross rental</div>
            </div>
          )}

          {monthlyRental && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">Monthly Income</div>
              <div className="text-[26px] font-bold text-white/90 leading-none">{fmtAed(monthlyRental)}</div>
              <div className="mt-2 text-[12px] text-white/35">Average monthly rental</div>
            </div>
          )}
        </div>

        {price > 0 && yield_ > 0 && (
          <p className="mt-6 text-center text-[12px] text-white/25 leading-relaxed">
            Yield estimate based on {projectName} entry price of {fmtAed(price)}.
            Actual returns may vary. Not financial advice.
          </p>
        )}
      </div>
    </section>
  )
}

const WHY_DUBAI_STATS = [
  { icon: Shield, stat: '#1', label: 'Safest city in the world', sub: 'Global Peace Index' },
  { icon: TrendingUp, stat: '0%', label: 'Income & capital gains tax', sub: 'For all residents' },
  { icon: Globe, stat: '200+', label: 'Nationalities call Dubai home', sub: 'Most diverse city' },
  { icon: Building2, stat: '$55bn+', label: 'Real estate transactions (2024)', sub: 'Record-breaking year' },
  { icon: Star, stat: 'Top 3', label: 'Global luxury market', sub: 'Knight Frank 2024' },
  { icon: Wifi, stat: 'No.1', label: 'Startup hub in MENA', sub: 'Global Startup Ecosystem' },
]

function WhyDubaiSection({ d }: { d: Record<string, unknown> }) {
  const title = pick(d, 'title') || 'Why Dubai'
  const subtitle = pick(d, 'subtitle') || 'The case for investing in the world\'s fastest-growing property market.'

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{title}</div>
        <h2 className="mb-3 text-[26px] font-bold text-white">The Dubai Advantage</h2>
        <p className="mb-10 text-[15px] text-white/45 leading-relaxed">{subtitle}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WHY_DUBAI_STATS.map(({ icon: Icon, stat, label, sub }) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                <Icon className="h-4 w-4 text-[#D4AF37]/70" />
              </div>
              <div className="text-[22px] font-bold text-white/90 leading-none">{stat}</div>
              <div className="mt-1.5 text-[12px] font-medium text-white/55 leading-snug">{label}</div>
              <div className="mt-1 text-[10px] text-white/25">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AmenitiesSection({ d }: { d: Record<string, unknown> }) {
  const items = pickArr(d, 'items').map(toStr).filter(Boolean)
  const title = pick(d, 'title') || 'Amenities'

  if (!items.length) return null

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{title}</div>
        <h2 className="mb-8 text-[26px] font-bold text-white">Included Amenities</h2>
        <div className="flex flex-wrap gap-2.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] text-white/65"
            >
              <Check className="h-3 w-3 text-[#D4AF37]/60" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function LocationSection({ d }: { d: Record<string, unknown> }) {
  const title = pick(d, 'title') || 'Location & Positioning'
  const subtitle = pick(d, 'subtitle')
  const area = pick(d, 'area') || 'Dubai'
  const highlights = pickArr(d, 'highlights').map(toStr).filter(Boolean)

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Location</div>
        <h2 className="mb-2 text-[26px] font-bold text-white">{title}</h2>
        {subtitle && <p className="mb-8 text-[15px] text-white/45 leading-relaxed">{subtitle}</p>}

        <div className="rounded-2xl border border-white/[0.07] bg-[#0E111A] p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/10">
              <MapPin className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-[16px] font-semibold text-white">{area}, Dubai</div>
              <div className="text-[12px] text-white/35">United Arab Emirates</div>
            </div>
          </div>

          {highlights.length > 0 && (
            <ul className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] text-white/60">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/60" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function GoldenVisaSection({ d }: { d: Record<string, unknown> }) {
  const threshold = pick(d, 'threshold') || 'AED 2,000,000'
  const benefits = pickArr(d, 'benefits').map(toStr).filter(Boolean)
  const defaultBenefits = ['10-year renewable UAE residency', 'Sponsor family members', 'No sponsor required', 'Full ownership rights in freehold zones', 'Renewable every 10 years']

  const list = benefits.length ? benefits : defaultBenefits

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div
          className="overflow-hidden rounded-2xl border border-[#D4AF37]/20"
          style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.03) 100%)',
          }}
        >
          <div className="p-8">
            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-full bg-[#D4AF37]/20 p-1.5">
                <Star className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">UAE Golden Visa</span>
            </div>
            <h2 className="mt-4 text-[28px] font-bold text-white leading-tight">Golden Visa Eligible</h2>
            <p className="mt-2 text-[15px] text-white/50">
              Properties meeting the {threshold} threshold qualify for the UAE 10-year Golden Visa.
            </p>

            <ul className="mt-8 space-y-3">
              {list.map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-[14px] text-white/70">
                  <Check className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function SocialProofSection({ d }: { d: Record<string, unknown> }) {
  const testimonials = pickArr(d, 'testimonials', 'items') as Array<{
    quote?: string
    name?: string
    role?: string
    rating?: number
  }>

  const defaults = [
    { quote: 'Freehold helped me identify the right off-plan investment in Dubai Marina. The ROI projections were accurate and the process was seamless.', name: 'James K.', role: 'UK Investor', rating: 5 },
    { quote: 'The team\'s market knowledge is unmatched. They guided me through my first Dubai property purchase with full transparency on pricing and yields.', name: 'Sarah M.', role: 'Singapore-based buyer', rating: 5 },
  ]

  const list = testimonials.length ? testimonials : defaults

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Reviews</div>
        <h2 className="mb-8 text-[26px] font-bold text-white">Investor Experiences</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((t, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.07] bg-[#0E111A] p-6">
              <div className="mb-4 flex gap-0.5">
                {[...Array(t.rating || 5)].map((_, j) => (
                  <Star key={j} className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                ))}
              </div>
              <p className="text-[14px] italic leading-relaxed text-white/65">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className="text-[13px] font-semibold text-white/80">{t.name}</div>
                {t.role && <div className="text-[11px] text-white/35">{t.role}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DeveloperProfileSection({ d }: { d: Record<string, unknown> }) {
  const name = pick(d, 'name', 'developer') || 'Leading Dubai Developer'
  const description = pick(d, 'description', 'about')
  const stats = pickArr(d, 'stats') as Array<{ label?: string; value?: string }>

  const defaultStats = [
    { label: 'Projects Delivered', value: '50+' },
    { label: 'Years in Market', value: '20+' },
    { label: 'Satisfied Buyers', value: '15,000+' },
  ]

  const statList = stats.length ? stats : defaultStats

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Developer</div>
        <h2 className="mb-2 text-[26px] font-bold text-white">{name}</h2>
        {description && (
          <p className="mb-8 text-[15px] text-white/50 leading-relaxed">{description}</p>
        )}
        <div className="grid grid-cols-3 gap-3">
          {statList.slice(0, 3).map(({ label, value }, i) => (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
              <div className="text-[24px] font-bold text-[#D4AF37]">{value}</div>
              <div className="mt-1 text-[11px] text-white/35 leading-snug">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function NeighborhoodSection({ d }: { d: Record<string, unknown> }) {
  const area = pick(d, 'area') || 'Dubai'
  const description = pick(d, 'description') || `${area} is one of Dubai's most dynamic and connected communities, offering residents a blend of lifestyle, accessibility, and investment value.`
  const highlights = pickArr(d, 'highlights', 'features').map(toStr).filter(Boolean)

  const defaultHighlights = [
    `Direct access to major Dubai highways`,
    `Retail, dining, and lifestyle within walking distance`,
    `High rental demand from professionals and families`,
    `Established community with proven capital appreciation`,
  ]

  const list = highlights.length ? highlights : defaultHighlights

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Neighbourhood</div>
        <h2 className="mb-2 text-[26px] font-bold text-white">Life in {area}</h2>
        <p className="mb-8 text-[15px] text-white/50 leading-relaxed">{description}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((h, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15">
                <Check className="h-3 w-3 text-[#D4AF37]" />
              </div>
              <span className="text-[14px] text-white/65 leading-snug">{h}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AiConciergeSection({ d, projectName }: { d: Record<string, unknown>; projectName: string }) {
  const title = pick(d, 'title') || 'Ask Freehold AI'
  const subtitle = pick(d, 'subtitle')
  const prompts = pickArr(d, 'prompts').map(toStr).filter(Boolean)

  const defaultPrompts = [
    `Is ${projectName} better for rental yield or capital appreciation?`,
    `What type of buyer is ${projectName} best suited for?`,
    `How does ${projectName} compare to other options in this area?`,
  ]

  const list = prompts.length ? prompts : defaultPrompts
  const waBase = 'https://wa.me/971504173622?text='

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0C0F17] p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10">
              <MessageCircle className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white">{title}</h3>
              {subtitle && <p className="mt-1 text-[13px] text-white/40">{subtitle}</p>}
            </div>
          </div>

          <div className="space-y-2.5">
            {list.map((prompt, i) => (
              <a
                key={i}
                href={`${waBase}${encodeURIComponent(prompt)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 text-[14px] text-white/60 transition-all hover:border-[#D4AF37]/20 hover:bg-[#D4AF37]/[0.04] hover:text-white/80"
              >
                <span>{prompt}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
              </a>
            ))}
          </div>

          <p className="mt-5 text-center text-[11px] text-white/20">
            Tap a question to open a WhatsApp conversation with our AI advisor
          </p>
        </div>
      </div>
    </section>
  )
}

function DownloadBrochureSection({ d, ctaText }: { d: Record<string, unknown>; ctaText: string }) {
  const title = pick(d, 'title') || 'Download the Full Brochure'
  const subtitle = pick(d, 'subtitle') || 'Get floor plans, pricing details, and investment analysis in one document.'

  return (
    <section className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.05) 100%)',
            border: '1px solid rgba(212,175,55,0.18)',
          }}
        >
          <h3 className="text-[24px] font-bold text-white">{title}</h3>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-white/45 leading-relaxed">{subtitle}</p>
          <a
            href="#lead-form"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-8 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547]"
          >
            {ctaText} <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

function LeadFormSection({
  d,
  page,
}: {
  d: Record<string, unknown>
  page: LandingPageData
}) {
  const title = pick(d, 'title') || 'Get the Full Brochure & Availability'
  const subtitle =
    pick(d, 'subtitle') ||
    'A senior investment consultant will contact you with curated options, live inventory, and pricing.'

  return (
    <section id="lead-form" className="px-6 py-16 border-t border-white/[0.05]">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#0E111A] p-8">
          <div className="mb-7">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Request</div>
            <h2 className="text-[26px] font-bold text-white">{title}</h2>
            <p className="mt-2 text-[14px] text-white/40 leading-relaxed">{subtitle}</p>
          </div>
          <LeadForm
            propertyName={page.project?.name || page.title}
            slug={page.slug}
            ctaText={page.ctaText}
          />
        </div>
      </div>
    </section>
  )
}

// ─── Section dispatcher ───────────────────────────────────────────────────────

function Section({ section, page }: { section: LandingSection; page: LandingPageData }) {
  const d = section.data
  const name = page.project?.name || page.title

  switch (section.type) {
    case 'hero':
      return <HeroSection d={d} page={page} />
    case 'market-intelligence':
      return <MarketIntelligenceSection d={d} />
    case 'key-facts':
      return <KeyFactsSection d={d} />
    case 'payment-plan':
      return <PaymentPlanSection d={d} />
    case 'roi':
      return <RoiSection d={d} projectName={name} />
    case 'why-dubai':
      return <WhyDubaiSection d={d} />
    case 'amenities':
      return <AmenitiesSection d={d} />
    case 'location':
      return <LocationSection d={d} />
    case 'golden-visa':
      return <GoldenVisaSection d={d} />
    case 'social-proof':
      return <SocialProofSection d={d} />
    case 'developer-profile':
      return <DeveloperProfileSection d={d} />
    case 'neighborhood':
      return <NeighborhoodSection d={d} />
    case 'ai-concierge':
      return <AiConciergeSection d={d} projectName={name} />
    case 'faq': {
      const items = (pickArr(d, 'items') as Array<{ question?: string; answer?: string }>)
        .map((it) => ({ question: toStr(it?.question), answer: toStr(it?.answer) }))
        .filter((it) => it.question && it.answer)
      if (!items.length) return null
      return (
        <section className="px-6 py-16 border-t border-white/[0.05]">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">FAQ</div>
            <h2 className="mb-8 text-[26px] font-bold text-white">Frequently Asked Questions</h2>
            <FaqAccordion items={items} />
          </div>
        </section>
      )
    }
    case 'download-brochure':
      return <DownloadBrochureSection d={d} ctaText={page.ctaText} />
    case 'lead-form':
      return <LeadFormSection d={d} page={page} />
    default:
      return null
  }
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
  return (
    <div className="border-y border-white/[0.05] bg-[#0C0F17]">
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-8 px-6 py-4">
        {[
          { icon: Shield, label: 'DLD Registered' },
          { icon: Star, label: 'RERA Certified' },
          { icon: TrendingUp, label: 'Award-Winning' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-[12px] text-white/30">
            <Icon className="h-3.5 w-3.5 text-white/20" />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar() {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-[#08090E]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3.5">
        <div className="text-[13px] font-bold tracking-wider text-[#D4AF37]">
          FREEHOLD <span className="font-normal text-white/35">Property UAE</span>
        </div>
        <a
          href="tel:+971504173622"
          className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 px-3.5 py-1.5 text-[12px] font-medium text-[#D4AF37] transition-all hover:bg-[#D4AF37]/10"
        >
          <Phone className="h-3 w-3" /> Call Us
        </a>
      </div>
    </div>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <div className="text-[14px] font-bold tracking-wider text-[#D4AF37]">FREEHOLD Property UAE</div>
            <div className="mt-1 text-[11px] text-white/25">Sobha Sapphire, Office 904, Business Bay, Dubai</div>
          </div>
          <div className="text-[11px] text-white/20 leading-relaxed">
            <div>RERA Licensed Real Estate Agency</div>
            <div>+971 50 417 3622 · info@freeholdproperty.ae</div>
          </div>
        </div>
        <div className="mt-6 border-t border-white/[0.04] pt-5 text-center text-[10px] text-white/15 leading-relaxed">
          © {new Date().getFullYear()} Freehold Property UAE. All rights reserved.
          Prices and availability subject to change. Regulated by Dubai Land Department.
          Projected yields are estimates and do not constitute financial advice.
        </div>
      </div>
    </footer>
  )
}

// ─── Not Found ────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#08090E] px-6 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/40 mb-3">404</div>
      <h1 className="text-[28px] font-bold text-white mb-2">Page not found</h1>
      <p className="text-[14px] text-white/35">This property page is not available or has been removed.</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await getLandingPageBySlug(slug, { includeDraft: true })
  if (!page) return { title: 'Property | Freehold UAE' }
  return {
    title: page.seo.title || page.title,
    description: page.seo.description || page.subtitle,
    openGraph: {
      images: page.seo.ogImage ? [page.seo.ogImage] : [],
    },
  }
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const page = await getLandingPageBySlug(slug, { includeDraft: true })
  if (!page) return <NotFound />

  return (
    <div className="min-h-screen bg-[#08090E] text-white">
      {page.isDraft && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-[12px] font-medium text-amber-300">
          DRAFT — this page is not published yet. Go to CRM → Landing Pages → Edit to publish.
        </div>
      )}
      <Topbar />
      <div className={page.isDraft ? 'pt-[84px]' : 'pt-[52px]'}>
        {page.sections.map((section, i) => (
          <Section key={`${section.type}-${i}`} section={section} page={page} />
        ))}
        <TrustBar />
        <Footer />
      </div>
    </div>
  )
}
