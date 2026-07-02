'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, ChevronDown } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { BRAND } from '@/lib/freehold/brand'

type AdFormat = 'Meta Feed' | 'Meta Story' | 'Google Search' | 'Google Display'

const META_BLUE = '#1877F2'
const GOOGLE_BLUE = '#4285F4'

const formats: AdFormat[] = ['Meta Feed', 'Meta Story', 'Google Search', 'Google Display']

// Brand-driven page identity for the ad chrome (no hardcoded brokerage name).
const PAGE_NAME = BRAND.legalName
const PAGE_INITIALS = BRAND.legalName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

/** A real inventory project, mapped from /api/freehold/inventory. */
interface Project {
  slug: string
  name: string
  area: string
  developer: string
  price: number | null
  image: string | null
}

function fmtPrice(n: number | null): string {
  if (!n || n <= 0) return ''
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

/** Build default ad copy from a project's real fields. */
function defaultCopy(p: Project): { headline: string; description: string; url: string } {
  const price = fmtPrice(p.price)
  const headline = price ? `${p.name} — from ${price}` : p.name
  const where = [p.area && `in ${p.area}`, p.developer && `by ${p.developer}`].filter(Boolean).join(' ')
  const description =
    `${p.name}${where ? ` ${where}` : ''}. 100% freehold ownership, Golden Visa eligible. ` +
    `Register your interest today.`
  const url = `${BRAND.domain}/${p.slug}`
  return { headline, description, url }
}

/** Real project image, or a tasteful branded fallback labelled with the name. */
function AdImage({ image, name, className }: { image: string | null; name: string; className?: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} className={`h-full w-full object-cover ${className ?? ''}`} />
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-ink via-ink to-[#1a1f2e] ${className ?? ''}`}>
      <div className="text-center">
        <div className="mx-auto mb-1 h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center">
          <svg className="h-5 w-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4 4 4 4-6 4 6" />
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
          </svg>
        </div>
        <span className="text-xs text-slate-400">{name}</span>
      </div>
    </div>
  )
}

function MetaFeedPreview({ name, image, headline, description }: { name: string; image: string | null; headline: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
      <div className="flex items-center gap-2.5 bg-white px-4 py-3">
        <div className="h-8 w-8 rounded-full bg-[#1877F2] flex items-center justify-center">
          <span className="text-sm font-bold text-white">{PAGE_INITIALS}</span>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-900">{PAGE_NAME}</div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            Sponsored ·
            <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"/><path d="M8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/></svg>
          </div>
        </div>
        <div className="ml-auto text-gray-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="14" cy="8" r="1.5"/>
          </svg>
        </div>
      </div>
      <div className="bg-white px-4 pb-2 text-sm text-gray-800">{headline}</div>
      <div className="h-52"><AdImage image={image} name={name} /></div>
      <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">{BRAND.domain}</div>
          <div className="text-xs font-bold text-gray-900 leading-tight">{headline.slice(0, 40)}{headline.length > 40 ? '…' : ''}</div>
          <div className="text-xs text-gray-500 leading-tight mt-0.5">{description.slice(0, 60)}…</div>
        </div>
        <button className="ml-3 shrink-0 rounded-md bg-[#1877F2] px-3 py-1.5 text-sm font-semibold text-white">Learn More</button>
      </div>
    </div>
  )
}

function MetaStoryPreview({ name, image, headline, description }: { name: string; image: string | null; headline: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ aspectRatio: '9/16', position: 'relative' }}>
      <div className="absolute inset-0"><AdImage image={image} name={name} /></div>
      <div className="absolute left-0 right-0 top-0 flex items-center gap-2 px-3 pt-3">
        <div className="h-5 w-5 rounded-full bg-[#1877F2] flex items-center justify-center">
          <span className="text-[7px] font-bold text-white">{PAGE_INITIALS}</span>
        </div>
        <span className="text-xs font-semibold text-white drop-shadow">{PAGE_NAME}</span>
        <span className="ml-0.5 text-[9px] text-slate-200 drop-shadow">· Sponsored</span>
      </div>
      <div className="absolute left-3 right-3 top-10 h-0.5 rounded-full bg-white/20">
        <div className="h-full w-3/5 rounded-full bg-white/70" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-8 pt-6">
        <div className="text-sm font-bold leading-tight text-white">{headline}</div>
        <div className="mt-1.5 text-xs leading-relaxed text-slate-200">{description.slice(0, 70)}…</div>
        <button className="mt-3 w-full rounded-xl bg-white py-2 text-sm font-bold text-gray-900">Learn More</button>
      </div>
    </div>
  )
}

function GoogleSearchPreview({ headline, description, url }: { headline: string; description: string; url: string }) {
  const parts = headline.split('|').map((s) => s.trim()).filter(Boolean)
  const h1 = parts[0] ?? headline.slice(0, 30)
  const h2 = parts[1] ?? PAGE_NAME
  const h3 = parts[2] ?? 'Enquire Today'

  return (
    <div className="mx-auto w-full max-w-[540px] rounded-2xl border border-line bg-surface-2 p-6">
      <div className="mb-5 flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2.5">
        <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <span className="text-xs text-slate-500">buy apartment dubai</span>
      </div>
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded border border-[#4285F4]/40 px-1.5 py-0.5 text-[9px] font-semibold text-[#4285F4] tracking-wide">Ad</span>
          <span className="text-sm text-slate-400">{url}</span>
        </div>
        <div className="text-[16px] font-medium leading-snug" style={{ color: GOOGLE_BLUE }}>
          {h1}<span className="text-slate-600 mx-1.5">|</span>{h2}<span className="text-slate-600 mx-1.5">|</span>{h3}
        </div>
        <div className="mt-2 text-xs leading-relaxed text-slate-400">
          {description.slice(0, 90)}{description.length > 90 ? '…' : ''}
        </div>
        <div className="mt-1.5 text-xs text-slate-500">
          {description.slice(90, 160)}{description.length > 160 ? '…' : ''}
        </div>
      </div>
    </div>
  )
}

function GoogleDisplayPreview({ name, image, headline, description }: { name: string; image: string | null; headline: string; description: string }) {
  return (
    <div className="mx-auto w-full max-w-[480px] overflow-hidden rounded-2xl border border-line shadow-2xl" style={{ aspectRatio: '1.91/1' }}>
      <div className="flex h-full">
        <div className="w-1/2"><AdImage image={image} name={name} /></div>
        <div className="w-1/2 flex flex-col justify-between bg-white p-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{BRAND.domain}</div>
            <div className="text-sm font-bold leading-snug text-gray-900">{headline.slice(0, 50)}{headline.length > 50 ? '…' : ''}</div>
            <div className="mt-1.5 text-xs leading-relaxed text-gray-500">{description.slice(0, 80)}…</div>
          </div>
          <button className="mt-3 w-full rounded-lg py-1.5 text-sm font-bold text-white" style={{ backgroundColor: GOOGLE_BLUE }}>
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdPreviewPage() {
  const t = useT()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [format, setFormat] = useState<AdFormat>('Meta Feed')
  const [showDropdown, setShowDropdown] = useState(false)
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')

  // Load real inventory projects and default to the first one.
  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list: Project[] = (d?.properties || [])
          .map((p: Record<string, unknown>) => ({
            slug: String(p.slug || ''),
            name: String(p.name || ''),
            area: String(p.area || ''),
            developer: String(p.developer || ''),
            price: typeof p.startingPriceAED === 'number' ? p.startingPriceAED : null,
            image: (p.heroImage as string) || null,
          }))
          .filter((p: Project) => p.name)
        setProjects(list)
        if (list.length) applyProject(list[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function applyProject(p: Project) {
    setProject(p)
    const c = defaultCopy(p)
    setHeadline(c.headline)
    setDescription(c.description)
    setShowDropdown(false)
  }

  const url = useMemo(() => (project ? defaultCopy(project).url : BRAND.domain), [project])
  const image = project?.image ?? null
  const name = project?.name ?? ''

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.07A1 1 0 0121 8.85v6.298a1 1 0 01-1.447.9L15 14M4 8h11a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 012-2z" />
            </svg>
            {t('lm.preview.eyebrow')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {t('lm.preview.title')}<br />
            <span className="text-slate-500">{t('lm.preview.subtitle')}</span>
          </h1>
        </section>
      </div>

      {/* Controls row */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {/* Real project picker */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown((v) => !v)}
            disabled={projects.length === 0}
            className="flex min-w-[220px] max-w-[320px] items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/10 disabled:opacity-50"
          >
            <span className="truncate">
              {loading ? t('common.loading') : project ? project.name : t('lm.preview.noProjects')}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showDropdown && projects.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-ink shadow-xl">
              {projects.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => applyProject(p)}
                  className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-surface-2 ${project?.slug === p.slug ? 'text-gold' : 'text-slate-300'}`}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="truncate text-xs text-slate-500">{[p.area, fmtPrice(p.price)].filter(Boolean).join(' · ')}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Format toggle pills */}
        <div className="flex flex-wrap gap-1 rounded-[14px] border border-line bg-surface-2 p-1">
          {formats.map((f) => {
            const isMeta = f.startsWith('Meta')
            const accentColor = isMeta ? META_BLUE : GOOGLE_BLUE
            const isActive = format === f
            return (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className="rounded-[10px] px-4 py-2 text-xs font-semibold transition"
                style={isActive ? { backgroundColor: accentColor, color: '#ffffff' } : { color: 'rgba(255,255,255,0.45)' }}
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview area */}
      <div className="mt-8 min-h-[360px] flex items-center justify-center rounded-2xl border border-line bg-surface-2 py-10 px-4">
        {projects.length === 0 && !loading ? (
          <p className="max-w-sm text-center text-sm text-slate-500">{t('lm.preview.emptyInventory')}</p>
        ) : (
          <>
            {format === 'Meta Feed' && <MetaFeedPreview name={name} image={image} headline={headline} description={description} />}
            {format === 'Meta Story' && <MetaStoryPreview name={name} image={image} headline={headline} description={description} />}
            {format === 'Google Search' && <GoogleSearchPreview headline={headline} description={description} url={url} />}
            {format === 'Google Display' && <GoogleDisplayPreview name={name} image={image} headline={headline} description={description} />}
          </>
        )}
      </div>

      {/* Ad copy editor */}
      <section className="mt-8">
        <div className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.preview.section.adCopy')}</div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">{t('lm.preview.headline')}</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition"
              placeholder={t('lm.preview.headlinePlaceholder')}
            />
            <div className="mt-1 flex justify-end text-xs text-slate-500">{t('lm.preview.chars', { count: String(headline.length) })}</div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">{t('lm.preview.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition"
              placeholder={t('lm.preview.descriptionPlaceholder')}
            />
            <div className="mt-1 flex justify-end text-xs text-slate-500">{t('lm.preview.chars', { count: String(description.length) })}</div>
          </div>
        </div>
      </section>

      {/* Copy buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => navigator.clipboard.writeText(`[Meta Ad — ${name}]\nHeadline: ${headline}\nDescription: ${description}`).catch(() => {})}
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-[#1877F2]/30 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" style={{ color: META_BLUE }} />
          {t('lm.preview.copyForMeta')}
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(`[Google Ad — ${name}]\nHeadline: ${headline}\nDescription: ${description}`).catch(() => {})}
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-[#4285F4]/30 hover:text-white"
        >
          <Copy className="h-3.5 w-3.5" style={{ color: GOOGLE_BLUE }} />
          {t('lm.preview.copyForGoogle')}
        </button>
      </div>

    </div>
  )
}
