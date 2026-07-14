import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import {
  Phone, MapPin, Check, TrendingUp, Shield, Star, Building2, Globe, Wifi,
  ChevronRight, MessageCircle, Sparkles, Clock, Award, Users, Car, Plane,
  ShoppingBag, GraduationCap, Coffee, Dumbbell, Trees, Waves, Sun, Moon, Download,
} from 'lucide-react'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getLandingPageBySlug, type LandingSection, type LandingPageData } from '@/lib/landing-pages'
import { getRequest as getLandingEditRequest } from '@/lib/freehold/landing-edit-requests'
import {
  LP_CHROME, normalizeLpLang, lpDir, lpFill, translateLandingContent, type LpLang,
} from '@/lib/landing-i18n'
import { resolveTheme, lpPalette, type LpTheme, type LpPalette } from '@/lib/landing-theme'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { LeadForm } from './_form'
import { FaqAccordion } from './_faq'
import { StickyLpCta } from './_sticky'
import { Tracker } from './_tracker'
import { LpEditBridge } from '@/components/lp/edit-bridge'

type Dict = Record<string, string>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAed(n: number | null | undefined, L?: Dict): string {
  // The "on request" fallback is chrome text — translate it when a dict is
  // at hand (render-time call sites); the EN literal only remains for
  // server-side content that translateLandingContent localizes later.
  if (!n || n <= 0) return L?.['price.onRequest'] ?? 'Price on request'
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
// When no landing page row exists yet, build the page from the LIVE inventory
// project (never from seed data).

// Inventory stores the plan as free text ("60/40", "20/50/30"). Only strict
// numeric splits summing ≈100 are rendered as stages — anything else means we
// don't know the structure, so the section is omitted rather than invented.
function parsePaymentPlanText(text: string | null): Record<string, number> | null {
  if (!text) return null
  const nums = (text.match(/\d{1,3}/g) ?? []).map(Number).filter((n) => n > 0 && n <= 100)
  const sum = nums.reduce((a, b) => a + b, 0)
  if (sum < 95 || sum > 105) return null
  if (nums.length === 2) return { downPayment: 0, duringConstruction: nums[0], onHandover: nums[1], postHandover: 0 }
  if (nums.length === 3) return { downPayment: nums[0], duringConstruction: nums[1], onHandover: nums[2], postHandover: 0 }
  if (nums.length === 4) return { downPayment: nums[0], duringConstruction: nums[1], onHandover: nums[2], postHandover: nums[3] }
  return null
}

function inventoryToLandingPage(prop: InventoryProperty | null): LandingPageData | null {
  if (!prop) return null

  const priceText = fmtAed(prop.startingPriceAED)
  const yieldText = prop.roi ? `${prop.roi.toFixed(1)}% annual yield` : 'Strong returns'
  const parsedPlan = parsePaymentPlanText(prop.paymentPlan)

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
    ...(parsedPlan ? [{ type: 'payment-plan' as const, data: parsedPlan }] : []),
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
    soldOut: false,
    template: 'classic',
    sections,
    project: { slug: prop.slug, name: prop.name, area: prop.area, developerName: prop.developer, heroImage: '/logo.png', priceFromAed: prop.startingPriceAED, priceToAed: prop.maxPriceAED, rentalYield: prop.roi, gallery: [], brochureUrl: null, amenities: [], faqs: [] },
  }
}

async function getPage(slug: string): Promise<LandingPageData | null> {
  try {
    const dbPage = await getLandingPageBySlug(slug, { includeDraft: true })
    if (dbPage) return dbPage
  } catch { /* fallback */ }
  const prop = await getInventoryPropertyBySlug(slug).catch(() => null)
  return inventoryToLandingPage(prop)
}

// Drafts, pending-authorization and out-of-schedule pages are staff-preview
// only: the editor's iframe shares the workspace session cookie, so previews
// keep working, while an anonymous visitor gets a 404 — the publish window
// (publishFrom/publishTo) and the authorization gate are actually enforced.
async function canPreviewDrafts(): Promise<boolean> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    return !!(await verifySession(token))
  } catch {
    return false
  }
}

// ─── Section components ───────────────────────────────────────────────────────

function HeroSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const title = pick(d, 'title') || page.title
  const subtitle = pick(d, 'subtitle') || page.subtitle
  const eyebrow = pick(d, 'eyebrow')
  const chips = pickArr(d, 'chips').map(toStr).filter(Boolean)
  const hasImage = page.heroImage && !page.heroImage.endsWith('/logo.png')
  const price = chips[1] || fmtAed(page.project?.priceFromAed, L)
  const waUrl = `https://wa.me/971504173622?text=${encodeURIComponent(`Hi, I'm interested in ${title} — please send me more info.`)}`

  return (
    <section className="relative min-h-screen">
      {/* Background */}
      {hasImage ? (
        <div className="absolute inset-0">
          <div className="h-full w-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${page.heroImage})` }} />
          <div className="absolute inset-0" style={{ background: p.heroOverlaySide }} />
          <div className="absolute inset-0" style={{ background: p.heroOverlayBottom }} />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: p.bgGradient }} />
      )}

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_420px]">

          {/* Left: headline + CTAs */}
          <div className="flex flex-col justify-center">
            {eyebrow && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {eyebrow.split('·').map(s => s.trim()).filter(Boolean).map((part, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest"
                    style={i === 0
                      ? { borderColor: 'rgba(212,175,55,0.40)', background: 'rgba(212,175,55,0.10)', color: '#D4AF37' }
                      : { borderColor: p.surfaceBorder, background: p.surfaceStrong, color: p.textFaint }}
                  >
                    {i === 0 && <MapPin className="h-2.5 w-2.5" />}{part}
                  </span>
                ))}
              </div>
            )}

            {page.soldOut && (
              <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-rose-300">
                {L['lp.soldOut']}
              </div>
            )}
            <h1 data-lpe="headline" className="text-[42px] font-bold leading-[1.1] tracking-tight sm:text-[56px] lg:text-[64px]" style={{ color: p.textPrimary }}>
              {title}
            </h1>
            <p data-lpe="subheadline" className="mt-5 max-w-lg text-[17px] leading-relaxed" style={{ color: p.textMuted }}>{subtitle}</p>

            {chips.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2">
                {chips.map((chip, i) => (
                  <div
                    key={i}
                    className="rounded-xl border px-4 py-2 text-[13px] font-semibold"
                    style={i === 1
                      ? { borderColor: 'rgba(212,175,55,0.50)', background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }
                      : { borderColor: p.surfaceBorder, background: p.surfaceStrong, color: p.textMuted }}
                  >
                    {chip}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#lead-form" className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-8 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547] active:scale-[0.98]">
                <span data-lpe="ctaText">{page.ctaText}</span> <ChevronRight className="h-4 w-4" />
              </a>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-7 py-4 text-[15px] font-semibold text-[#25D366] transition-all hover:bg-[#25D366]/20">
                <MessageCircle className="h-4 w-4" /> {L['hero.whatsapp']}
              </a>
            </div>

            <div className="mt-10 flex items-center gap-5 border-t pt-7" style={{ borderTopColor: p.divider }}>
              {[{ icon: Shield, label: L['hero.badge.dld'] }, { icon: Star, label: L['hero.badge.rera'] }, { icon: Award, label: L['hero.badge.award'] }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[11px]" style={{ color: p.textFaint }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: p.textFaint }} />{label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: inline lead form */}
          <div className="lg:pt-4">
            <div className="rounded-2xl border p-7 shadow-2xl backdrop-blur-xl" style={{ borderColor: p.surfaceBorder, background: p.formBg }}>
              <div className="mb-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">{L['hero.form.eyebrow']}</div>
                <h3 className="text-[20px] font-bold" style={{ color: p.textPrimary }}>{L['hero.form.title']}</h3>
                <p className="mt-1 text-[13px]" style={{ color: p.textFaint }}>{L['hero.form.subtitle']}</p>
              </div>
              <LeadForm propertyName={page.project?.name || title} slug={page.slug} ctaText={page.ctaText} L={L} pixels={page.pixels} palette={p} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DescriptionSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const title = pick(d, 'title') || `${L['desc.aboutPrefix']} ${page.project?.name || page.title}`
  const body = pick(d, 'body', 'description', 'content')
  const highlights = pickArr(d, 'highlights').map(toStr).filter(Boolean)

  if (!body && !highlights.length) return null

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['desc.eyebrow']}</div>
            <h2 className="mb-6 text-[34px] font-bold leading-tight" style={{ color: p.textPrimary }}>{title}</h2>
            {body && <div className="space-y-4">{body.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="text-[16px] leading-[1.75]" style={{ color: p.textMuted }}>{para}</p>
            ))}</div>}
          </div>
          {highlights.length > 0 && (
            <div className="space-y-3">
              <div className="mb-5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: p.textFaint }}>{L['desc.highlights']}</div>
              {highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border px-5 py-4" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15">
                    <Check className="h-3 w-3 text-[#D4AF37]" />
                  </div>
                  <span className="text-[14px]" style={{ color: p.textMuted }}>{h}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function GallerySection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const title = pick(d, 'title') || L['gallery.title']
  const labels = pickArr(d, 'labels', 'rooms', 'views').map(toStr).filter(Boolean)

  // Only render tiles backed by a REAL image URL — never a placeholder box.
  // Collect image URLs from the section data plus the hero image (when it's a
  // real project image, not the fallback logo).
  const dataImages = pickArr(d, 'images', 'photos', 'gallery')
    .map((img) => (typeof img === 'string' ? img.trim() : toStr(toObj(img).url) || toStr(toObj(img).src) || toStr(toObj(img).image)))
    .filter(Boolean)
  const heroImage = page.heroImage && !page.heroImage.endsWith('/logo.png') ? page.heroImage : ''
  // Also pull the project's full, live image set from the DB (not just the
  // frozen section snapshot) so every real image a project has is shown.
  const projectImages = page.project?.gallery ?? []
  const images = Array.from(new Set([...(heroImage ? [heroImage] : []), ...dataImages, ...projectImages])).slice(0, 6)

  // A single image is already shown as the hero — only render a gallery when the
  // project has at least two real images. Fewer → self-hide (no padded tiles).
  if (images.length < 2) return null

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['gallery.eyebrow']}</div>
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-[34px] font-bold" style={{ color: p.textPrimary }}>{title}</h2>
          <a href="#lead-form" className="hidden text-[13px] text-[#D4AF37]/70 hover:text-[#D4AF37] sm:block">
            {L['gallery.requestFloorPlans']}
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, i) => {
            const label = labels[i]
            return (
              <div key={i} className={`group relative overflow-hidden rounded-xl ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
                <div className="aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${src})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                </div>
                {label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-6">
                    <span className="text-[12px] font-medium text-white/80">{label}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function UnitsSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
  const title = pick(d, 'title') || L['units.title']
  const units = pickArr(d, 'units', 'types').map(toObj)

  // Only render real units — never invent unit types or pricing on a public page.
  if (!units.length) return null

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider, background: p.bgAlt }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['units.eyebrow']}</div>
        <div className="mb-10 flex items-end justify-between">
          <h2 className="text-[34px] font-bold" style={{ color: p.textPrimary }}>{title}</h2>
          <span className="hidden text-[13px] sm:block" style={{ color: p.textFaint }}>{L['units.disclaimer']}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit, i) => {
            const type = toStr(unit.type) || toStr(unit.unitType)
            const size = toStr(unit.size)
            const price = toStr(unit.price) || toStr(unit.priceRange)
            const features = Array.isArray(unit.features) ? unit.features.map(toStr).filter(Boolean) : []

            return (
              <div key={i} className="group flex flex-col rounded-2xl border overflow-hidden transition-all hover:border-[#D4AF37]/25" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                {/* Color band */}
                <div className="h-1 w-full" style={{ background: i === 0 ? '#9B8020' : i === 1 ? '#D4AF37' : '#C9A227' }} />
                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['units.unitType']}</div>
                    <div className="mt-1 text-[22px] font-bold" style={{ color: p.textPrimary }}>{type}</div>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-lg px-3 py-2.5" style={{ background: p.surfaceStrong }}>
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: p.textFaint }}>{L['units.size']}</div>
                      <div className="mt-0.5 text-[13px] font-semibold" style={{ color: p.textMuted }}>{size}</div>
                    </div>
                    <div className="rounded-lg bg-[#D4AF37]/[0.08] border border-[#D4AF37]/20 px-3 py-2.5">
                      <div className="text-[10px] text-[#D4AF37]/60 uppercase tracking-wide">{L['units.price']}</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[#D4AF37]">{price}</div>
                    </div>
                  </div>

                  {features.length > 0 && (
                    <ul className="mb-6 space-y-2">
                      {features.slice(0, 3).map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-[13px]" style={{ color: p.textMuted }}>
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]/50" />{f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <a href="#lead-form" className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] py-3 text-[13px] font-semibold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/15">
                    {L['units.requestFloorPlan']} <ChevronRight className="h-3.5 w-3.5" />
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

function KeyFactsSection({ d, p }: { d: Record<string, unknown>; p: LpPalette }) {
  const all = pickArr(d, 'items') as Array<{ label?: string; value?: string }>
  // Render every real fact (up to 6) — appended facts like Rental Yield / Unit
  // types must not be silently sliced away. Columns adapt to the count so 5–6
  // facts wrap into rows instead of overflowing a fixed four-up strip.
  const items = all.filter((it) => it && (it.label || it.value)).slice(0, 6)
  if (!items.length) return null
  const cols = items.length <= 4 ? items.length : 3
  const colClass: Record<number, string> = {
    1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4',
  }
  return (
    <div className="border-b" style={{ borderBottomColor: p.divider, background: p.bgAlt }}>
      <div className={`mx-auto grid max-w-6xl grid-cols-2 overflow-hidden ${colClass[cols] ?? 'sm:grid-cols-3'}`}>
        {items.map(({ label, value }, i) => (
          <div
            key={i}
            className="px-6 py-6 text-center"
            style={{
              borderLeftWidth: i % cols === 0 ? 0 : 1,
              borderLeftColor: p.divider,
              borderTopWidth: i >= cols ? 1 : 0,
              borderTopColor: p.divider,
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: p.textFaint }}>{label}</div>
            <div className="mt-2 text-[22px] font-bold" style={{ color: p.textPrimary }}>{value || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentPlanSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
  // Only real numbers render — a missing plan must not become an invented one.
  const down = Number(pick(d, 'downPayment')) || 0
  const during = Number(pick(d, 'duringConstruction')) || 0
  const onHand = Number(pick(d, 'onHandover')) || 0
  const post = Number(pick(d, 'postHandover')) || 0
  if (down + during + onHand + post <= 0) return null
  const stages = [
    { label: L['payment.stage.down'], pct: down, sub: L['payment.stage.downSub'], color: '#D4AF37' },
    { label: L['payment.stage.during'], pct: during, sub: L['payment.stage.duringSub'], color: '#9B8020' },
    { label: L['payment.stage.handover'], pct: onHand, sub: L['payment.stage.handoverSub'], color: '#6B5A15' },
    ...(post > 0 ? [{ label: L['payment.stage.post'], pct: post, sub: L['payment.stage.postSub'], color: '#3D330B' }] : []),
  ].filter(s => s.pct > 0)

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['payment.eyebrow']}</div>
            <h2 className="mb-4 text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['payment.title']}</h2>
            <p className="mb-10 text-[15px] leading-relaxed" style={{ color: p.textMuted }}>{L['payment.intro']}</p>

            {/* Progress bar */}
            <div className="mb-6 flex h-3 overflow-hidden rounded-full" style={{ background: p.surfaceStrong }}>
              {stages.map((s, i) => <div key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />)}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stages.map(({ label, pct, sub, color }, i) => (
                <div key={i} className="rounded-xl border p-4 text-center" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                  <div className="text-[28px] font-bold leading-none" style={{ color }}>{pct}%</div>
                  <div className="mt-2 text-[11px] font-medium" style={{ color: p.textMuted }}>{label}</div>
                  <div className="mt-1 text-[10px]" style={{ color: p.textFaint }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {[
              { icon: Shield, title: L['payment.card1.title'], desc: L['payment.card1.desc'] },
              { icon: TrendingUp, title: L['payment.card2.title'], desc: L['payment.card2.desc'] },
              { icon: Award, title: L['payment.card3.title'], desc: L['payment.card3.desc'] },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex gap-4 rounded-xl border px-5 py-5" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                  <Icon className="h-5 w-5 text-[#D4AF37]/70" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold" style={{ color: p.textPrimary }}>{title}</div>
                  <div className="mt-1 text-[13px] leading-snug" style={{ color: p.textMuted }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RoiSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  // Only strictly-positive values count as real; 0 / NaN / blank all read as
  // "not available" so a card shows "—" and a fully-empty section self-hides.
  const pos = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  // Prefer the project's live ROI intelligence (re-read from the DB on every
  // request, so Hex FH-YIELD-02 fills land immediately) over the frozen section
  // snapshot that was captured when the page was first built.
  const proj = page.project
  const yield_ = pos(proj?.roi?.projectedYield) ?? pos(proj?.rentalYield) ?? pos(pick(d, 'rentalYield', 'expectedRoi'))
  const price = pos(pick(d, 'startPriceAed')) ?? pos(proj?.priceFromAed)

  // Authoritative income figures from Hex when present; otherwise a transparent
  // projection off a real yield + starting price (the disclaimer flags it).
  const derivedAnnual = yield_ && price ? price * (yield_ / 100) : null
  const annual = pos(proj?.roi?.annualIncome) ?? derivedAnnual
  const monthly = pos(proj?.roi?.monthlyIncome) ?? (annual ? annual / 12 : null)
  const fiveYr = pos(proj?.roi?.fiveYearRental) ?? (annual ? annual * 5 : null)

  // NOTHING-FAKE: with no real yield and no income figures, hide the whole
  // section instead of rendering four blank "—" cards.
  if (!yield_ && !annual && !monthly && !fiveYr) return null

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider, background: p.bgAlt }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['roi.eyebrow']}</div>
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <h2 className="text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['roi.title']}</h2>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: p.textFaint }}>
            <Clock className="h-4 w-4" /> {L['roi.disclaimer']}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] p-7 text-center sm:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60 mb-3">{L['roi.projectedYield']}</div>
            <div className="text-[56px] font-bold text-[#D4AF37] leading-none">{yield_ ? `${yield_.toFixed(1)}%` : '—'}</div>
            <div className="mt-2 text-[12px]" style={{ color: p.textFaint }}>{L['roi.projectedYieldSub']}</div>
          </div>
          {[
            { label: L['roi.annual'], value: annual ? fmtAed(annual) : '—', sub: L['roi.annualSub'] },
            { label: L['roi.monthly'], value: monthly ? fmtAed(monthly) : '—', sub: L['roi.monthlySub'] },
            { label: L['roi.fiveYear'], value: fiveYr ? fmtAed(fiveYr) : '—', sub: L['roi.fiveYearSub'] },
          ].map(({ label, value, sub }, i) => (
            <div key={i} className="rounded-2xl border p-6 text-center" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: p.textFaint }}>{label}</div>
              <div className="text-[26px] font-bold leading-none" style={{ color: p.textPrimary }}>{value}</div>
              <div className="mt-2 text-[11px]" style={{ color: p.textFaint }}>{sub}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}

const LOCATION_ICONS: Record<string, React.ElementType> = {
  car: Car, plane: Plane, mall: ShoppingBag, school: GraduationCap, coffee: Coffee,
  gym: Dumbbell, park: Trees, beach: Waves, default: MapPin,
}

function LocationSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const area = pick(d, 'area') || page.project?.area || 'Dubai'
  const title = pick(d, 'title') || `${L['location.lifeInPrefix']} ${area}`
  const subtitle = pick(d, 'subtitle')
  // Only render real, project-specific distances — no generic default landmarks.
  const dList = pickArr(d, 'distances', 'landmarks').map(toObj)
  const highlights = pickArr(d, 'highlights').map(toStr).filter(Boolean)

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['location.eyebrow']}</div>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-[34px] font-bold" style={{ color: p.textPrimary }}>{title}</h2>
            {subtitle && <p className="mb-8 text-[15px] leading-relaxed" style={{ color: p.textMuted }}>{subtitle}</p>}

            <div className="grid grid-cols-2 gap-3">
              {dList.slice(0, 6).map((item, i) => {
                const iconKey = toStr(item.icon) || 'default'
                const Icon = LOCATION_ICONS[iconKey] || MapPin
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                      <Icon className="h-4 w-4 text-[#D4AF37]/60" />
                    </div>
                    <div>
                      <div className="text-[12px] font-medium" style={{ color: p.textMuted }}>{toStr(item.label)}</div>
                      <div className="text-[11px]" style={{ color: p.textFaint }}>{toStr(item.time || item.distance || item.value)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            {/* Area visual */}
            <div className="mb-4 overflow-hidden rounded-2xl border" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderBottomColor: p.divider }}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#D4AF37]/60" />
                  <span className="text-[14px] font-semibold" style={{ color: p.textPrimary }}>{area}{L['location.dubaiSuffix']}</span>
                </div>
                <span className="text-[11px]" style={{ color: p.textFaint }}>{L['location.uae']}</span>
              </div>
              <div className="px-5 py-5">
                {highlights.length > 0 ? (
                  <ul className="space-y-3">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px]" style={{ color: p.textMuted }}>
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]/50" />{h}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[14px] leading-relaxed" style={{ color: p.textFaint }}>{lpFill(L['location.defaultDesc'], { area })}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function WhyDubaiSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
  const whyDubai = [
    { icon: Shield, stat: '#1', label: L['whyDubai.1.label'], sub: L['whyDubai.1.sub'] },
    { icon: TrendingUp, stat: '0%', label: L['whyDubai.2.label'], sub: L['whyDubai.2.sub'] },
    { icon: Globe, stat: '200+', label: L['whyDubai.3.label'], sub: L['whyDubai.3.sub'] },
    { icon: Building2, stat: '$55bn+', label: L['whyDubai.4.label'], sub: L['whyDubai.4.sub'] },
    { icon: Star, stat: 'Top 3', label: L['whyDubai.5.label'], sub: L['whyDubai.5.sub'] },
    { icon: Award, stat: '10yr', label: L['whyDubai.6.label'], sub: L['whyDubai.6.sub'] },
  ]
  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider, background: p.bgAlt }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['whyDubai.eyebrow']}</div>
        <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
          <h2 className="text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['whyDubai.title']}</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {whyDubai.map(({ icon: Icon, stat, label, sub }) => (
            <div key={label} className="rounded-xl border p-6" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[#D4AF37]/10">
                <Icon className="h-4.5 w-4.5 text-[#D4AF37]/70" />
              </div>
              <div className="text-[28px] font-bold" style={{ color: p.textPrimary }}>{stat}</div>
              <div className="mt-1.5 text-[13px] font-medium" style={{ color: p.textMuted }}>{label}</div>
              {sub ? <div className="mt-1 text-[11px]" style={{ color: p.textFaint }}>{sub}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GoldenVisaSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
  const benefits = pickArr(d, 'benefits').map(toStr).filter(Boolean)
  const threshold = pick(d, 'threshold') || 'AED 2,000,000'
  const defaultBenefits = [L['goldenVisa.benefit1'], L['goldenVisa.benefit2'], L['goldenVisa.benefit3'], L['goldenVisa.benefit4'], L['goldenVisa.benefit5']]

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0.04) 60%, transparent 100%)', border: '1px solid rgba(212,175,55,0.18)' }}>
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="p-10">
              <div className="mb-1 flex items-center gap-2">
                <Star className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/70">{L['goldenVisa.eyebrow']}</span>
              </div>
              <h2 className="mt-4 text-[36px] font-bold leading-tight" style={{ color: p.textPrimary }}>{L['goldenVisa.title']}</h2>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: p.textMuted }}>{lpFill(L['goldenVisa.desc'], { threshold })}</p>
              <a href="#lead-form" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-7 py-3.5 text-[14px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547]">
                {L['goldenVisa.cta']} <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="border-t border-[#D4AF37]/10 p-10 lg:border-l lg:border-t-0">
              <div className="mb-5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: p.textFaint }}>{L['goldenVisa.whatYouGet']}</div>
              <ul className="space-y-4">
                {(benefits.length ? benefits : defaultBenefits).map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px]" style={{ color: p.textMuted }}>
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

function AmenitiesSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
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
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['amenities.eyebrow']}</div>
        <h2 className="mb-8 text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['amenities.title']}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, i) => {
            const Icon = getIcon(item)
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                <Icon className="h-4 w-4 shrink-0 text-[#D4AF37]/50" />
                <span className="text-[13px]" style={{ color: p.textMuted }}>{item}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function DeveloperSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
  // Use the real developer name only — never default to a brand we can't verify.
  const name = pick(d, 'name', 'developer')
  const desc = pick(d, 'description', 'about')
  // Only show track-record stats that were actually provided (no invented figures).
  const stats = pickArr(d, 'stats').map(toObj).filter((s) => toStr(s.value) && toStr(s.label))
  if (!name) return null

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider, background: p.bgAlt }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['developer.eyebrow']}</div>
        <div className={`grid grid-cols-1 gap-10 ${stats.length ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
          <div>
            <h2 className="mb-4 text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['developer.builtByPrefix']} {name}</h2>
            {desc && <p className="text-[15px] leading-relaxed" style={{ color: p.textMuted }}>{desc}</p>}
          </div>
          {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              {stats.map(({ label, value }, i) => (
                <div key={i} className="rounded-xl border p-5 text-center lg:text-left" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                  <div className="text-[28px] font-bold text-[#D4AF37]">{toStr(value)}</div>
                  <div className="mt-1 text-[12px]" style={{ color: p.textFaint }}>{toStr(label)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SocialProofSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
  const testimonials = pickArr(d, 'testimonials', 'items').map(toObj)
  // Never fabricate reviews — only render real testimonials when present.
  const list = testimonials.filter((t) => toStr(t.quote))
  if (!list.length) return null
  const avg = (list.reduce((s, t) => s + (Number(t.rating) || 5), 0) / list.length).toFixed(1)

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['social.eyebrow']}</div>
        <div className="mb-10 flex items-end justify-between">
          <h2 className="text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['social.title']}</h2>
          <div className="hidden items-center gap-1 sm:flex">
            {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37]" />)}
            <span className="ml-2 text-[13px]" style={{ color: p.textFaint }}>{avg} {L['social.average']}</span>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t, i) => (
            <div key={i} className="flex flex-col rounded-2xl border p-7" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
              <div className="mb-4 flex gap-0.5">
                {[...Array(Number(t.rating) || 5)].map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />)}
              </div>
              <p className="flex-1 text-[14px] italic leading-relaxed" style={{ color: p.textMuted }}>&ldquo;{toStr(t.quote)}&rdquo;</p>
              <div className="mt-5 border-t pt-4" style={{ borderTopColor: p.divider }}>
                <div className="text-[13px] font-semibold" style={{ color: p.textPrimary }}>{toStr(t.name)}</div>
                <div className="text-[11px]" style={{ color: p.textFaint }}>{toStr(t.role)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function NeighborhoodSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const area = pick(d, 'area') || page.project?.area || 'Dubai'
  const description = pick(d, 'description', 'body', 'about')
  const highlights = pickArr(d, 'highlights').map(toStr).filter(Boolean)

  // Only real, page-authored claims render — no invented area claims.
  if (!description && !highlights.length) return null

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider, background: p.bgAlt }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['neighborhood.eyebrow']}</div>
            <h2 className="mb-4 text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['neighborhood.lifeInPrefix']} {area}</h2>
            {description && (
              <p className="text-[15px] leading-relaxed" style={{ color: p.textMuted }}>{description}</p>
            )}
          </div>
          <div className="space-y-3">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border px-5 py-4" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15">
                  <Check className="h-3 w-3 text-[#D4AF37]" />
                </div>
                <span className="text-[14px]" style={{ color: p.textMuted }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function MarketIntelligenceSection({ d, L, p }: { d: Record<string, unknown>; L: Dict; p: LpPalette }) {
  const summary = pick(d, 'summary')
  const bullets = pickArr(d, 'bullets').map(toStr).filter(Boolean)
  // NOTHING-FAKE: never render just the header + pulsing "live" badge over no
  // content — the section self-hides when it has neither a summary nor bullets.
  if (!summary && !bullets.length) return null

  return (
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider, background: p.bgAlt }}>
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border p-8 lg:p-10" style={{ borderColor: p.surfaceBorder, background: p.surface }}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/10">
              <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: p.textPrimary }}>{L['market.title']}</div>
              <div className="text-[12px]" style={{ color: p.textFaint }}>{L['market.subtitle']}</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{L['market.live']}
            </div>
          </div>
          {summary && <p className="mb-6 text-[15px] leading-relaxed border-l-2 border-[#D4AF37]/40 pl-5" style={{ color: p.textMuted }}>{summary}</p>}
          {bullets.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: p.textMuted }}>
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

function AiConciergeSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const title = pick(d, 'title') || L['ai.title']
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
    <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_480px]">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['ai.eyebrow']}</div>
            <h2 className="mb-3 text-[34px] font-bold" style={{ color: p.textPrimary }}>{title}</h2>
            <p className="text-[15px] leading-relaxed" style={{ color: p.textMuted }}>{subtitle || lpFill(L['ai.subtitle'], { name })}</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/15 ring-1 ring-[#25D366]/25">
                <MessageCircle className="h-5 w-5 text-[#25D366]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: p.textPrimary }}>{L['ai.whatsappTitle']}</div>
                <div className="text-[11px]" style={{ color: p.textFaint }}>{L['ai.whatsappSub']}</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {list.map((prompt, i) => (
              <a key={i} href={`${waBase}${encodeURIComponent(prompt)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-[14px] transition-all hover:border-[#25D366]/25"
                style={{ borderColor: p.surfaceBorder, background: p.surface, color: p.textMuted }}>
                <span>{prompt}</span>
                <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]/50" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function LeadFormSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const title = pick(d, 'title') || L['leadForm.title']
  const subtitle = pick(d, 'subtitle') || L['leadForm.subtitle']

  return (
    <section id="lead-form" className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['leadForm.eyebrow']}</div>
            <h2 className="mb-3 text-[34px] font-bold" style={{ color: p.textPrimary }}>{title}</h2>
            <p className="mb-8 text-[15px] leading-relaxed" style={{ color: p.textMuted }}>{subtitle}</p>
            <div className="space-y-4">
              {[{ icon: Clock, text: L['leadForm.benefit1'] }, { icon: Shield, text: L['leadForm.benefit2'] }, { icon: Users, text: L['leadForm.benefit3'] }, { icon: Award, text: L['leadForm.benefit4'] }].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-[14px]" style={{ color: p.textMuted }}>
                  <Icon className="h-4 w-4 shrink-0 text-[#D4AF37]/60" />{text}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="rounded-2xl border border-[#D4AF37]/15 p-8" style={{ background: p.surface }}>
              <LeadForm propertyName={page.project?.name || page.title} slug={page.slug} ctaText={page.ctaText} L={L} pixels={page.pixels} palette={p} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DownloadBrochureSection({ d, page, L, p }: { d: Record<string, unknown>; page: LandingPageData; L: Dict; p: LpPalette }) {
  const title = pick(d, 'title') || L['brochure.title']
  const subtitle = pick(d, 'subtitle') || L['brochure.subtitle']
  // Prefer a real brochure file — the button then downloads it directly. When
  // there's no brochure, fall back to the lead form (no dead "download" link).
  const authored = pick(d, 'brochureUrl', 'url', 'brochure')
  const brochureUrl = /^https?:\/\//i.test(authored) ? authored : (page.project?.brochureUrl || '')
  const hasBrochure = /^https?:\/\//i.test(brochureUrl)

  return (
    <section className="border-t px-5 py-16 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl p-10 text-center" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.05) 60%, transparent 100%)', border: '1px solid rgba(212,175,55,0.18)' }}>
          <div className="mx-auto max-w-lg">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['brochure.eyebrow']}</div>
            <h3 className="text-[28px] font-bold" style={{ color: p.textPrimary }}>{title}</h3>
            <p className="mx-auto mt-3 text-[14px] leading-relaxed" style={{ color: p.textMuted }}>{subtitle}</p>
            {hasBrochure ? (
              <a href={brochureUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-9 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547]">
                {L['brochure.download']} <Download className="h-4 w-4" />
              </a>
            ) : (
              <a href="#lead-form" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-9 py-4 text-[15px] font-bold text-[#06080A] transition-all hover:bg-[#E8C547]">
                {page.ctaText} <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section dispatcher ───────────────────────────────────────────────────────

function Section({ section, page, L, p }: { section: LandingSection; page: LandingPageData; L: Dict; p: LpPalette }) {
  const d = section.data
  // Layout canvas: a section hidden in the editor is skipped on the live page.
  if (d && (d as Record<string, unknown>)._hidden === true) return null
  switch (section.type) {
    case 'hero': return <HeroSection d={d} page={page} L={L} p={p} />
    case 'description': return <DescriptionSection d={d} page={page} L={L} p={p} />
    case 'gallery': return <GallerySection d={d} page={page} L={L} p={p} />
    case 'units': return <UnitsSection d={d} L={L} p={p} />
    case 'key-facts': return <KeyFactsSection d={d} p={p} />
    case 'payment-plan': return <PaymentPlanSection d={d} L={L} p={p} />
    case 'roi': return <RoiSection d={d} page={page} L={L} p={p} />
    case 'why-dubai': return <WhyDubaiSection d={d} L={L} p={p} />
    case 'golden-visa': return <GoldenVisaSection d={d} L={L} p={p} />
    case 'amenities': return <AmenitiesSection d={d} L={L} p={p} />
    case 'location': return <LocationSection d={d} page={page} L={L} p={p} />
    case 'developer-profile': return <DeveloperSection d={d} L={L} p={p} />
    case 'social-proof': return <SocialProofSection d={d} L={L} p={p} />
    case 'market-intelligence': return <MarketIntelligenceSection d={d} L={L} p={p} />
    case 'ai-concierge': return <AiConciergeSection d={d} page={page} L={L} p={p} />
    case 'neighborhood': return <NeighborhoodSection d={d} page={page} L={L} p={p} />
    case 'faq': {
      const items = (pickArr(d, 'items') as Array<{ question?: string; answer?: string }>)
        .map(it => ({ question: toStr(it?.question), answer: toStr(it?.answer) }))
        .filter(it => it.question && it.answer)
      if (!items.length) return null
      return (
        <section className="border-t px-5 py-20 sm:px-8" style={{ borderTopColor: p.divider }}>
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr]">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">{L['faq.eyebrow']}</div>
                <h2 className="text-[34px] font-bold" style={{ color: p.textPrimary }}>{L['faq.title']}</h2>
                <p className="mt-3 text-[14px] leading-relaxed" style={{ color: p.textFaint }}>{L['faq.subtitle']}</p>
              </div>
              <FaqAccordion items={items} palette={p} />
            </div>
          </div>
        </section>
      )
    }
    case 'download-brochure': return <DownloadBrochureSection d={d} page={page} L={L} p={p} />
    case 'lead-form': return <LeadFormSection d={d} page={page} L={L} p={p} />
    default: return null
  }
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

const LP_LANGS: Array<{ code: LpLang; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'RU' },
]

// Build a landing-page query string preserving both lang and theme.
function lpHref(lang: LpLang, theme: LpTheme): string {
  return `?lang=${lang}&theme=${theme}`
}

function LangSwitcher({ lang, theme }: { lang: LpLang; theme: LpTheme; }) {
  return (
    <div className="flex items-center gap-1" dir="ltr">
      {LP_LANGS.map(({ code, label }) => (
        <a
          key={code}
          href={lpHref(code, theme)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
            code === lang ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : ''
          }`}
          style={code === lang ? undefined : { color: theme === 'day' ? 'rgba(11,11,15,0.45)' : 'rgba(255,255,255,0.40)' }}
        >
          {label}
        </a>
      ))}
    </div>
  )
}

function ThemeToggle({ lang, theme, p }: { lang: LpLang; theme: LpTheme; p: LpPalette }) {
  // Link to the OTHER theme and show that theme's icon (moon while in day).
  const next: LpTheme = theme === 'day' ? 'night' : 'day'
  return (
    <a
      href={lpHref(lang, next)}
      aria-label={next === 'night' ? 'Switch to night theme' : 'Switch to day theme'}
      className="flex h-8 w-8 items-center justify-center rounded-full border transition hover:border-[#D4AF37]/40"
      style={{ borderColor: p.surfaceBorder, color: p.textMuted }}
    >
      {next === 'night' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </a>
  )
}

function Topbar({ page, L, lang, theme, p }: { page: LandingPageData; L: Dict; lang: LpLang; theme: LpTheme; p: LpPalette }) {
  const hasPrice = !!page.project?.priceFromAed && page.project.priceFromAed > 0
  const price = fmtAed(page.project?.priceFromAed, L)
  const waUrl = `https://wa.me/971504173622?text=${encodeURIComponent(`Hi, I'm interested in ${page.title}`)}`
  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-md" style={{ borderBottomColor: p.divider, background: p.topbarBg }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <div className="text-[13px] font-bold tracking-wider text-[#D4AF37]">FREEHOLD <span className="font-normal" style={{ color: p.textFaint }}>{L['topbar.brandSuffix']}</span></div>
        {hasPrice && <div className="hidden text-[12px] sm:block" style={{ color: p.textFaint }}>{L['topbar.from']} <span className="font-semibold" style={{ color: p.textMuted }}>{price}</span></div>}
        <div className="flex items-center gap-2">
          <LangSwitcher lang={lang} theme={theme} />
          <ThemeToggle lang={lang} theme={theme} p={p} />
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-[12px] font-medium text-[#25D366] transition hover:bg-[#25D366]/20">
            <MessageCircle className="h-3.5 w-3.5" /> {L['topbar.whatsapp']}
          </a>
          <a href="tel:+971504173622" className="hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition sm:flex" style={{ borderColor: p.surfaceBorder, color: p.textMuted }}>
            <Phone className="h-3 w-3" /> {L['topbar.call']}
          </a>
        </div>
      </div>
      {page.isDraft && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-5 py-1.5 text-center text-[11px] font-medium text-amber-500">
          {L['topbar.draft']}
        </div>
      )}
    </div>
  )
}

function Footer({ page, L, p }: { page: LandingPageData; L: Dict; p: LpPalette }) {
  return (
    <footer className="border-t px-5 py-12 sm:px-8" style={{ borderTopColor: p.divider }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <div className="text-[14px] font-bold tracking-wider text-[#D4AF37]">FREEHOLD {L['footer.brandSuffix']}</div>
            <div className="mt-2 whitespace-pre-line text-[12px] leading-relaxed" style={{ color: p.textFaint }}>{L['footer.address']}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: p.textFaint }}>{L['footer.contact']}</div>
            <div className="space-y-1 text-[12px]" style={{ color: p.textFaint }}>
              <div dir="ltr">+971 50 417 3622</div>
              <div dir="ltr">info@freeholdproperty.ae</div>
              <div dir="ltr">freeholdproperty.ae</div>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: p.textFaint }}>{L['footer.certifications']}</div>
            <div className="space-y-1 text-[12px]" style={{ color: p.textFaint }}>
              <div>{L['footer.cert1']}</div>
              <div>{L['footer.cert2']}</div>
              <div>{L['footer.cert3']}</div>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-[10px] leading-relaxed" style={{ borderTopColor: p.divider, color: p.textFaint }}>
          © {new Date().getFullYear()} {L['footer.legal']}
          {' · '}
          {/* Required for Meta lead ads — the pre-flight test checks for it. */}
          <a href="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-[#D4AF37]">{L['footer.privacy']}</a>
        </div>
      </div>
    </footer>
  )
}

function NotFound({ L, p }: { L: Dict; p: LpPalette }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center" style={{ background: p.bg }}>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/40 mb-3">404</div>
      <h1 className="text-[28px] font-bold mb-2" style={{ color: p.textPrimary }}>{L['notFound.title']}</h1>
      <p className="text-[14px]" style={{ color: p.textFaint }}>{L['notFound.desc']}</p>
      <a href="https://freeholdproperty.ae" className="mt-8 text-[13px] text-[#D4AF37]/60 hover:text-[#D4AF37]">{L['notFound.back']}</a>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return { title: 'Property | Freehold UAE' }
  if (page.isDraft && !(await canPreviewDrafts())) return { title: 'Property | Freehold UAE' }
  return {
    title: page.seo.title || page.title,
    description: page.seo.description || page.subtitle,
    openGraph: { title: page.seo.title, description: page.seo.description, images: page.seo.ogImage ? [page.seo.ogImage] : [] },
  }
}

export default async function LandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const lang = normalizeLpLang(sp.lang)
  const L = LP_CHROME[lang]
  const dir = lpDir(lang)
  const theme = resolveTheme(sp.theme)

  const page = await getPage(slug)
  if (!page) return <NotFound L={L} p={lpPalette(theme)} />
  const staff = await canPreviewDrafts()
  if (page.isDraft && !staff) return <NotFound L={L} p={lpPalette(theme)} />

  // Staff preview of a broker's proposed edit (opened from the approvals inbox):
  // overlay the proposal's sections/CTA so an approver sees exactly what they'd
  // publish. Gated to staff — anonymous visitors never see an unapproved draft.
  const editRequestId = typeof sp.editRequest === 'string' ? sp.editRequest : ''
  if (editRequestId && staff) {
    const proposal = await getLandingEditRequest(editRequestId).catch(() => null)
    if (proposal && proposal.landingSlug.toLowerCase() === slug.toLowerCase()) {
      if (Array.isArray(proposal.proposedSections) && proposal.proposedSections.length) {
        page.sections = proposal.proposedSections as unknown as typeof page.sections
      }
      const cta = (proposal.proposedFields || {}).ctaText
      if (typeof cta === 'string' && cta) page.ctaText = cta
    }
  }

  // The template drives the page's atmosphere (Signature → lagoon palette).
  const palette = lpPalette(theme, page.template)

  const localized = await translateLandingContent(page, lang)
  const price = fmtAed(localized.project?.priceFromAed, L)

  return (
    <div className={`min-h-screen${theme === 'day' ? ' lp-day' : ''}`} dir={dir} lang={lang} style={{ background: palette.bg, color: palette.textPrimary }}>
      {/* Day-theme contrast: the gold accent (#D4AF37) is tuned for dark
          backgrounds; at 60-80% opacity on off-white it washes out. Remap all
          gold TEXT (labels, eyebrows, stats) to a deep readable gold in day
          mode — gold-filled buttons/backgrounds keep the brand tone. */}
      {theme === 'day' && (
        <style>{`.lp-day [class*="text-[#D4AF37]"]{color:#8E6D1A !important}`}</style>
      )}
      <Tracker
        slug={localized.slug}
        projectSlug={localized.projectSlug}
        metaPixelId={localized.pixels.metaPixelId}
        googleTagId={localized.pixels.googleTagId}
        googleConversionId={localized.pixels.googleConversionId}
        tiktokPixelId={localized.pixels.tiktokPixelId}
      />
      <Topbar page={localized} L={L} lang={lang} theme={theme} p={palette} />
      <div className="pt-[52px]">
        {localized.sections.map((section, i) => (
          <Section key={`${section.type}-${i}`} section={section} page={localized} L={L} p={palette} />
        ))}
        <Footer page={localized} L={L} p={palette} />
      </div>
      <StickyLpCta price={price} ctaText={localized.ctaText} slug={localized.slug} L={L} palette={palette} />
      {/* On-canvas editing bridge — active only inside the staff editor's
          iframe (?lpe=1). Persisting still goes through the authed editor API. */}
      {sp.lpe === '1' && <LpEditBridge />}
    </div>
  )
}
