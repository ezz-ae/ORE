import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Phone, Mail, MessageCircle, MapPin } from 'lucide-react'
import { query } from '@/lib/db'
import { getProfileByHandle } from '@/lib/freehold/agent-profiles'
import { BioLeadForm } from '@/components/freehold/bio-lead-form'
import { BRAND } from '@/lib/freehold/brand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BioProject {
  slug: string; name: string; area: string; developer: string; priceFromAed: number | null; image: string | null
}

async function loadProjects(slugs: string[]): Promise<BioProject[]> {
  if (!slugs.length) return []
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT slug, name, area, developer_name, price_from_aed, hero_image
       FROM freehold_site_projects WHERE slug = ANY($1) LIMIT 24`, [slugs])
    const bySlug = new Map(rows.map((r) => [String(r.slug), r]))
    return slugs
      .map((s) => bySlug.get(s))
      .filter((r): r is Record<string, unknown> => !!r)
      .map((r) => ({
        slug: String(r.slug),
        name: String(r.name || ''),
        area: String(r.area || ''),
        developer: String(r.developer_name || ''),
        priceFromAed: r.price_from_aed != null ? Number(r.price_from_aed) : null,
        image: (r.hero_image as string) || null,
      }))
  } catch { return [] }
}

function fmtPrice(n: number | null): string {
  if (!n || n <= 0) return ''
  if (n >= 1_000_000) return `From AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `From AED ${Math.round(n / 1_000)}K`
  return `From AED ${Math.round(n).toLocaleString()}`
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '··'

const waLink = (num: string) => `https://wa.me/${num.replace(/[^0-9]/g, '')}`

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const p = await getProfileByHandle(handle)
  if (!p) return { title: 'Not found' }
  const title = `${p.displayName}${p.title ? ` — ${p.title}` : ''} | ${BRAND.legalName}`
  return { title, description: p.bio || `Contact ${p.displayName} for Dubai property.` }
}

export default async function AgentBioPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const profile = await getProfileByHandle(handle)
  if (!profile) notFound()
  const projects = await loadProjects(profile.projectSlugs)

  return (
    <div className="min-h-screen bg-app">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">

        {/* Header card */}
        <div className="rounded-3xl border border-white/10 bg-chrome p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold/15 text-2xl font-bold text-gold">
            {initials(profile.displayName)}
          </div>
          <h1 className="mt-4 text-xl font-semibold text-white">{profile.displayName}</h1>
          {profile.title && <p className="mt-0.5 text-sm text-gold/80">{profile.title}</p>}
          <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{BRAND.legalName}</p>
          {profile.bio && <p className="mt-4 text-sm leading-relaxed text-slate-300">{profile.bio}</p>}

          {/* Contact buttons */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {profile.whatsapp && (
              <a href={waLink(profile.whatsapp)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            {profile.email && (
              <a href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                <Mail className="h-4 w-4" /> Email
              </a>
            )}
          </div>
        </div>

        {/* Selected projects */}
        {projects.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Featured projects</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <div key={p.slug} className="overflow-hidden rounded-2xl border border-white/10 bg-chrome">
                  <div className="h-32 w-full bg-surface-2">
                    {p.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-xs text-slate-500">{p.name}</div>}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="h-3 w-3" /> {[p.area, p.developer].filter(Boolean).join(' · ')}
                    </div>
                    {fmtPrice(p.priceFromAed) && <div className="mt-1 text-xs font-medium text-gold">{fmtPrice(p.priceFromAed)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lead capture */}
        <section className="mt-8 rounded-3xl border border-white/10 bg-chrome p-6">
          <h2 className="mb-1 text-base font-semibold text-white">Get in touch</h2>
          <p className="mb-4 text-sm text-slate-400">Leave your details and {profile.displayName.split(/\s+/)[0]} will call you back.</p>
          <BioLeadForm handle={profile.handle} agentName={profile.displayName} />
        </section>

        <p className="mt-8 text-center text-xs text-slate-600">Powered by {BRAND.company} {BRAND.product}</p>
      </div>
    </div>
  )
}
