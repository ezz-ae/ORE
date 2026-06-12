import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  Sparkles,
  Globe,
  Image as ImageIcon,
  Tag,
} from 'lucide-react'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { inventoryProperties, type PropertyStatus, type LandingStatus } from '@/src/features/freehold-intelligence/inventory'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function statusBadge(status: PropertyStatus) {
  switch (status) {
    case 'active':
    case 'ready':      return 'bg-gold/10 text-gold border-gold/20'
    case 'off_plan':   return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'under_construction': return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'sold_out':   return 'bg-red-400/10 text-red-300 border-red-400/20'
    case 'coming_soon': return 'bg-violet-400/10 text-slate-400 border-violet-400/20'
    default:           return 'bg-surface-2 text-slate-400 border-line'
  }
}

function statusLabel(status: PropertyStatus): string {
  switch (status) {
    case 'active': return 'Active'
    case 'ready': return 'Ready'
    case 'off_plan': return 'Off Plan'
    case 'under_construction': return 'Under Construction'
    case 'sold_out': return 'Sold Out'
    case 'coming_soon': return 'Coming Soon'
  }
}

function landingBadge(status: LandingStatus) {
  switch (status) {
    case 'live':           return 'bg-gold/10 text-gold border-gold/20'
    case 'draft':          return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'pending_review': return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'missing':        return 'bg-rose-400/10 text-slate-400 border-rose-400/20'
  }
}

function landingLabel(status: LandingStatus): string {
  switch (status) {
    case 'live': return 'Live'
    case 'draft': return 'Draft'
    case 'pending_review': return 'Pending Review'
    case 'missing': return 'Missing'
  }
}

function readinessBar(value: number) {
  return value >= 50 ? 'bg-gold' : 'bg-red-400'
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-right text-sm text-slate-300">
        {value !== null && value !== undefined ? String(value) : '—'}
      </span>
    </div>
  )
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Try DB first, fall back to static data
  let prop = await getInventoryPropertyBySlug(id)
  if (!prop) {
    prop = inventoryProperties.find((p) => p.id === id || p.slug === id) ?? null
  }

  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-20 sm:px-6 text-center">
        <div className="text-[48px] font-semibold text-slate-700">404</div>
        <p className="mt-3 text-[16px] text-slate-400">Property not found.</p>
        <Link
          href="/freehold-intelligence/inventory"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-gold/70 transition hover:text-gold"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Inventory
        </Link>
      </div>
    )
  }

  const priceRange =
    prop.startingPriceAED && prop.maxPriceAED
      ? `${formatPrice(prop.startingPriceAED)} – ${formatPrice(prop.maxPriceAED)}`
      : formatPrice(prop.startingPriceAED)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link
        href="/freehold-intelligence/inventory"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Inventory
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${statusBadge(prop.status)}`}>
            {statusLabel(prop.status)}
          </span>
          <span className="text-sm capitalize text-slate-500">{prop.type}</span>
        </div>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[44px]">
          {prop.name}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {prop.area} · <span className="text-slate-300">{prop.developer}</span>
        </p>

        <div className="mt-5">
          <Link
            href={`/freehold-intelligence/inventory/${prop.id}/generate`}
            className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]"
          >
            <Sparkles className="h-4 w-4" /> Generate Landing Page
          </Link>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">

        {/* Left: property details + pricing */}
        <div className="space-y-5">
          <div className="rounded-[20px] border border-line bg-surface-2 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Property Details
            </p>
            <DetailRow label="Type" value={prop.type.charAt(0).toUpperCase() + prop.type.slice(1)} />
            <DetailRow label="Bedrooms" value={prop.bedrooms} />
            <DetailRow label="Size range" value={prop.sizeRange} />
            <DetailRow label="Handover year" value={prop.handoverYear ?? null} />
            <DetailRow label="Payment plan" value={prop.paymentPlan} />
            <DetailRow label="Total units" value={prop.totalUnits !== null ? String(prop.totalUnits) : null} />
            <DetailRow label="Available units" value={prop.availableUnits !== null ? String(prop.availableUnits) : null} />
          </div>

          <div className="rounded-[20px] border border-line bg-surface-2 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Pricing & Returns
            </p>
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Price range</div>
              <div className="mt-1 text-[22px] font-semibold tabular-nums text-white">{priceRange}</div>
            </div>
            {prop.roi !== null && (
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Expected ROI</div>
                <div className="mt-1 text-[28px] font-semibold tabular-nums leading-none text-gold">
                  {prop.roi.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: performance + readiness */}
        <div className="space-y-5">
          <div className="rounded-[20px] border border-line bg-surface-2 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Performance (30 days)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Leads',     value: prop.leads30d },
                { label: 'Views',     value: prop.views30d.toLocaleString() },
                { label: 'Campaigns', value: prop.linkedCampaigns },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-[14px] border border-line bg-surface-2 p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</div>
                  <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-line bg-surface-2 p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Readiness Scores
            </p>
            <div className="space-y-4">
              {[
                { label: 'Data Quality', value: prop.dataQuality },
                { label: 'Ad Readiness', value: prop.adReadiness },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className="tabular-nums font-semibold text-slate-300">{value} / 100</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full transition-all ${readinessBar(value)}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-3">
            <span className="text-sm text-slate-500">Last updated: </span>
            <span className="text-sm text-slate-400">{prop.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      {prop.tags.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            <Tag className="h-3 w-3" /> Tags
          </div>
          <div className="flex flex-wrap gap-2">
            {prop.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-slate-400">
                {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Landing status */}
      <section className="mt-8">
        <div className="rounded-[20px] border border-line bg-surface-2 p-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            <Globe className="h-3.5 w-3.5" /> Landing Page
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${landingBadge(prop.landingStatus)}`}>
              {landingLabel(prop.landingStatus)}
            </span>
            {prop.landingUrl && (
              <a href={prop.landingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gold/70 transition hover:text-gold">
                {prop.landingUrl} <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs">
            <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
            {prop.hasImages ? (
              <span className="text-slate-400">{prop.imageCount} image{prop.imageCount !== 1 ? 's' : ''} available</span>
            ) : (
              <span className="text-slate-400/70">No images</span>
            )}
          </div>

          {prop.landingStatus === 'missing' && (
            <div className="mt-4">
              <Link
                href={`/freehold-intelligence/inventory/${prop.id}/generate`}
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.07] px-4 py-2 text-xs text-gold transition hover:bg-gold/[0.12]"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate landing page now
              </Link>
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
