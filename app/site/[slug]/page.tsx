import type { Metadata } from 'next'
import {
  MapPin, Building2, Check, ChevronRight, MessageCircle, Phone,
  Download, Star, TrendingUp, Calendar,
} from 'lucide-react'
import { getMicrositeBySlug, type MicrositeData } from '@/lib/microsites'

export const dynamic = 'force-dynamic'

function fmtAed(n: number | null | undefined): string {
  if (!n || n <= 0) return 'Price on request'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

const WA = '971504173622'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const site = await getMicrositeBySlug(slug, { includeDraft: true })
  if (!site) return { title: 'Project | Freehold Property UAE' }
  return {
    title: `${site.name} | Freehold Property UAE`,
    description: site.summary,
    openGraph: { title: site.name, description: site.summary, images: site.heroImage ? [site.heroImage] : [] },
  }
}

export default async function MicrositePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await getMicrositeBySlug(slug, { includeDraft: true })
  if (!site) return <NotFound />

  const price = fmtAed(site.priceFromAed)
  const waUrl = `https://wa.me/${WA}?text=${encodeURIComponent(`Hi, I'm interested in ${site.name}. Please send details.`)}`

  return (
    <div className="min-h-screen bg-[#06070C] text-white">
      <Topbar site={site} price={price} waUrl={waUrl} />

      <div className="pt-[52px]">
        <Hero site={site} price={price} waUrl={waUrl} />

        {/* Key facts */}
        <section className="border-b border-white/[0.06] bg-[#0A0D16]">
          <div className="mx-auto grid max-w-6xl divide-x divide-white/[0.06] sm:grid-cols-4">
            {[
              { label: 'Starting Price', value: price },
              { label: 'Yield', value: site.rentalYield ? `${site.rentalYield.toFixed(1)}%` : '—' },
              { label: 'Developer', value: site.developerName },
              { label: site.handover ? 'Handover' : 'Area', value: site.handover || site.area },
            ].map((f) => (
              <div key={f.label} className="px-6 py-6 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{f.label}</div>
                <div className="mt-2 text-[18px] font-bold text-white/95">{f.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Overview */}
        {(site.description || site.summary) && (
          <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Overview</div>
              <h2 className="mb-6 text-[32px] font-bold text-white">About {site.name}</h2>
              <p className="text-[16px] leading-[1.8] text-white/60">{site.description || site.summary}</p>
            </div>
          </section>
        )}

        {/* Units */}
        {site.units.length > 0 && (
          <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-10 text-center">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Residences</div>
                <h2 className="text-[32px] font-bold text-white">Available Units</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {site.units.map((u, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="text-[20px] font-bold text-white">{u.type}</div>
                    <div className="mt-4 space-y-2 text-[13px] text-white/55">
                      <div className="flex justify-between"><span>Size</span><span className="text-white/80">{u.size}</span></div>
                      <div className="flex justify-between"><span>Layout</span><span className="text-white/80">{u.beds}</span></div>
                      <div className="flex justify-between"><span>Price</span><span className="font-semibold text-[#D4AF37]">{u.price}</span></div>
                    </div>
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] py-2.5 text-[13px] font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/15">
                      Enquire <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Gallery */}
        {site.gallery.length > 0 && (
          <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 text-center">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Gallery</div>
                <h2 className="text-[32px] font-bold text-white">Project Visuals</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {site.gallery.map((img, i) => (
                  <div key={i} className="aspect-[4/3] overflow-hidden rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${img})` }} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Amenities */}
        {site.amenities.length > 0 && (
          <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 text-center">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">Amenities</div>
                <h2 className="text-[32px] font-bold text-white">World-Class Facilities</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {site.amenities.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                    <Check className="h-4 w-4 shrink-0 text-[#D4AF37]/50" />
                    <span className="text-[13px] text-white/65">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Location + developer */}
        <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8">
              <div className="mb-3 flex items-center gap-2 text-[#D4AF37]"><MapPin className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-widest">Location</span></div>
              <h3 className="text-[24px] font-bold text-white">{site.area}, Dubai</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-white/55">
                {site.area} is one of Dubai&apos;s most sought-after addresses, combining world-class infrastructure with exceptional lifestyle amenities and strong capital appreciation fundamentals.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8">
              <div className="mb-3 flex items-center gap-2 text-[#D4AF37]"><Building2 className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-widest">Developer</span></div>
              <h3 className="text-[24px] font-bold text-white">{site.developerName}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-white/55">
                {site.developerName} is among the UAE&apos;s most trusted developers, known for delivering iconic, high-quality projects with transparent processes and lasting value.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        {site.faqs.length > 0 && (
          <section className="border-t border-white/[0.05] bg-[#0A0D16] px-5 py-20 sm:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 text-center">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/60">FAQ</div>
                <h2 className="text-[32px] font-bold text-white">Common Questions</h2>
              </div>
              <div className="space-y-3">
                {site.faqs.map((f, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
                    <div className="text-[15px] font-medium text-white/85">{f.question}</div>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/55">{f.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Contact CTA */}
        <section className="border-t border-white/[0.05] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-4xl rounded-2xl p-10 text-center" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.04) 60%, transparent 100%)', border: '1px solid rgba(212,175,55,0.18)' }}>
            <Star className="mx-auto mb-4 h-7 w-7 text-[#D4AF37]" />
            <h2 className="text-[30px] font-bold text-white">Interested in {site.name}?</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-white/55">
              Speak to a senior Freehold consultant for pricing, floor plans, and availability.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-7 py-3.5 text-[15px] font-bold text-white transition hover:bg-[#22c35e]">
                <MessageCircle className="h-4 w-4" /> WhatsApp Us
              </a>
              {site.landingSlug && (
                <a href={`/lp/${site.landingSlug}`} className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-7 py-3.5 text-[15px] font-bold text-[#06080A] transition hover:bg-[#E8C547]">
                  Get Brochure & Pricing <ChevronRight className="h-4 w-4" />
                </a>
              )}
              {site.brochureUrl && (
                <a href={site.brochureUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] px-7 py-3.5 text-[15px] font-semibold text-white/80 transition hover:bg-white/[0.05]">
                  <Download className="h-4 w-4" /> Download Brochure
                </a>
              )}
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  )
}

function Topbar({ site, price, waUrl }: { site: MicrositeData; price: string; waUrl: string }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-[#06070C]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <div className="text-[13px] font-bold tracking-wider text-[#D4AF37]">FREEHOLD <span className="font-normal text-white/30">Property UAE</span></div>
        {price !== 'Price on request' && <div className="hidden text-[12px] text-white/40 sm:block">From <span className="font-semibold text-white/70">{price}</span></div>}
        <div className="flex items-center gap-2">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-[12px] font-medium text-[#25D366] transition hover:bg-[#25D366]/20">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <a href={`tel:+${WA}`} className="hidden items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-1.5 text-[12px] text-white/50 transition hover:text-white/80 sm:flex">
            <Phone className="h-3 w-3" /> Call
          </a>
        </div>
      </div>
      {!site.isPublished && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-5 py-1.5 text-center text-[11px] font-medium text-amber-300">
          DRAFT microsite — not published. Publish from Web Studio → Microsites.
        </div>
      )}
    </div>
  )
}

function Hero({ site, price, waUrl }: { site: MicrositeData; price: string; waUrl: string }) {
  const hasImage = site.heroImage && !site.heroImage.endsWith('/logo.png')
  return (
    <section className="relative">
      <div className="absolute inset-0">
        {hasImage ? (
          <>
            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${site.heroImage})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06070C] via-[#06070C]/70 to-[#06070C]/40" />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 100% 80% at 30% 20%, rgba(212,175,55,0.16) 0%, transparent 55%), linear-gradient(135deg, #06070C 0%, #0A0D18 50%, #06070C 100%)' }} />
        )}
      </div>
      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-24 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]">
            <MapPin className="h-2.5 w-2.5" /> {site.area}
          </span>
          <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">{site.developerName}</span>
        </div>
        <h1 className="mt-6 max-w-3xl text-[44px] font-bold leading-[1.05] tracking-tight text-white sm:text-[60px]">{site.name}</h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/60">{site.summary}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <div className="rounded-xl border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-5 py-3 text-[15px] font-bold text-[#D4AF37]">From {price}</div>
          {site.rentalYield ? <div className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.05] px-5 py-3 text-[14px] font-semibold text-white/70"><TrendingUp className="h-4 w-4" /> {site.rentalYield.toFixed(1)}% yield</div> : null}
          {site.handover ? <div className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.05] px-5 py-3 text-[14px] font-semibold text-white/70"><Calendar className="h-4 w-4" /> {site.handover}</div> : null}
        </div>
        <div className="mt-8">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-8 py-4 text-[15px] font-bold text-[#06080A] transition hover:bg-[#E8C547]">
            Enquire Now <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <div className="text-[14px] font-bold tracking-wider text-[#D4AF37]">FREEHOLD Property UAE</div>
        <div className="mt-2 text-[12px] text-white/30">Business Bay, Dubai, UAE · +971 50 417 3622 · freeholdproperty.ae</div>
        <div className="mt-6 text-[10px] leading-relaxed text-white/15">
          © {new Date().getFullYear()} Freehold Property UAE. RERA Licensed · DLD Registered. Prices and availability subject to change.
        </div>
      </div>
    </footer>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#06070C] px-5 text-center">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]/40">404</div>
      <h1 className="mb-2 text-[28px] font-bold text-white">Microsite not found</h1>
      <p className="text-[14px] text-white/35">This project website is not available or has not been published.</p>
      <a href="https://freeholdproperty.ae" className="mt-8 text-[13px] text-[#D4AF37]/60 hover:text-[#D4AF37]">← Back to Freehold</a>
    </div>
  )
}
