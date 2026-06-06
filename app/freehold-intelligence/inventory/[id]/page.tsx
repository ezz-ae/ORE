'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpRight,
  Sparkles,
  Globe,
  Image as ImageIcon,
  Tag,
} from 'lucide-react'
import {
  inventoryProperties,
  type PropertyStatus,
  type LandingStatus,
} from '@/src/features/freehold-intelligence/inventory'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function statusBadge(status: PropertyStatus) {
  switch (status) {
    case 'active':
    case 'ready':
      return 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'
    case 'off_plan':
      return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'under_construction':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'sold_out':
      return 'bg-red-400/10 text-red-300 border-red-400/20'
    case 'coming_soon':
      return 'bg-violet-400/10 text-white/55 border-violet-400/20'
    default:
      return 'bg-slate-800/50 text-slate-400 border-slate-800'
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
    case 'live':
      return 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20'
    case 'draft':
      return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    case 'pending_review':
      return 'bg-blue-400/10 text-blue-300 border-blue-400/20'
    case 'missing':
      return 'bg-rose-400/10 text-white/55 border-rose-400/20'
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
  if (value >= 80) return 'bg-[#D4AF37]'
  if (value >= 50) return 'bg-[#D4AF37]'
  return 'bg-red-400'
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className="text-sm text-slate-300 text-right">
        {value !== null && value !== undefined ? String(value) : '—'}
      </span>
    </div>
  )
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const prop = inventoryProperties.find((p) => p.id === id)

  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-20 sm:px-6 text-center">
        <div className="text-[48px] font-semibold text-white/10">404</div>
        <p className="mt-3 text-[16px] text-white/50">Property not found.</p>
        <Link
          href="/freehold-intelligence/inventory"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-[#D4AF37]/70 transition hover:text-[#D4AF37]"
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

      {/* Back link */}
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
          <span className="text-sm text-slate-500 capitalize">{prop.type}</span>
        </div>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[44px]">
          {prop.name}
        </h1>
        <p className="mt-2 text-[15px] text-white/50">
          {prop.area} · <span className="text-white/70">{prop.developer}</span>
        </p>

        {/* CTA */}
        <div className="mt-5">
          <Link
            href={`/freehold-intelligence/inventory/${prop.id}/generate`}
            className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-[#06080A] transition hover:bg-[#F8E7AE]"
          >
            <Sparkles className="h-4 w-4" /> Generate Landing Page
          </Link>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">

        {/* Left col: key details */}
        <div className="space-y-5">

          {/* Property details */}
          <div className="rounded-[20px] border border-slate-800 bg-slate-800/50 p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Property Details
            </p>
            <div className="mt-3">
              <DetailRow label="Type" value={prop.type.charAt(0).toUpperCase() + prop.type.slice(1)} />
              <DetailRow label="Bedrooms" value={prop.bedrooms} />
              <DetailRow label="Size range" value={prop.sizeRange} />
              <DetailRow
                label="Handover year"
                value={prop.handoverYear ?? null}
              />
              <DetailRow
                label="Payment plan"
                value={prop.paymentPlan}
              />
              <DetailRow
                label="Total units"
                value={prop.totalUnits !== null ? String(prop.totalUnits) : null}
              />
              <DetailRow
                label="Available units"
                value={prop.availableUnits !== null ? String(prop.availableUnits) : null}
              />
            </div>
          </div>

          {/* Price & ROI */}
          <div className="rounded-[20px] border border-slate-800 bg-slate-800/50 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Pricing & Returns
            </p>
            <div className="mb-4">
              <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">Price range</div>
              <div className="mt-1 text-[22px] font-semibold text-white tabular-nums">{priceRange}</div>
            </div>
            {prop.roi !== null && (
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">Expected ROI</div>
                <div className="mt-1 text-[28px] font-semibold text-[#D4AF37] tabular-nums leading-none">
                  {prop.roi.toFixed(1)}%
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right col: performance + readiness */}
        <div className="space-y-5">

          {/* Performance metrics */}
          <div className="rounded-[20px] border border-slate-800 bg-slate-800/50 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Performance (30 days)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Leads', value: prop.leads30d },
                { label: 'Views', value: prop.views30d.toLocaleString() },
                { label: 'Campaigns', value: prop.linkedCampaigns },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-[14px] border border-slate-800 bg-slate-800/50 p-3"
                >
                  <div className="text-xs text-slate-500 uppercase tracking-[0.14em]">{label}</div>
                  <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Readiness scores */}
          <div className="rounded-[20px] border border-slate-800 bg-slate-800/50 p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Readiness Scores
            </p>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-white/60">Data Quality</span>
                  <span className="tabular-nums font-semibold text-slate-300">{prop.dataQuality} / 100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className={`h-full rounded-full transition-all ${readinessBar(prop.dataQuality)}`}
                    style={{ width: `${prop.dataQuality}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-white/60">Ad Readiness</span>
                  <span className="tabular-nums font-semibold text-slate-300">{prop.adReadiness} / 100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className={`h-full rounded-full transition-all ${readinessBar(prop.adReadiness)}`}
                    style={{ width: `${prop.adReadiness}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Last updated */}
          <div className="rounded-[16px] border border-slate-800 bg-slate-800/50 px-4 py-3">
            <span className="text-sm text-slate-500">Last updated: </span>
            <span className="text-sm text-white/55">{prop.lastUpdated}</span>
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
              <span
                key={tag}
                className="rounded-full border border-slate-800 bg-slate-800/50 px-3 py-1 text-xs text-white/55"
              >
                {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Landing status */}
      <section className="mt-8">
        <div className="rounded-[20px] border border-slate-800 bg-slate-800/50 p-5">
          <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            <Globe className="h-3.5 w-3.5" /> Landing Page
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${landingBadge(prop.landingStatus)}`}>
              {landingLabel(prop.landingStatus)}
            </span>
            {prop.landingUrl && (
              <a
                href={prop.landingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#D4AF37]/70 transition hover:text-[#D4AF37]"
              >
                {prop.landingUrl} <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
              {prop.hasImages ? (
                <span className="text-white/60">
                  {prop.imageCount} image{prop.imageCount !== 1 ? 's' : ''} available
                </span>
              ) : (
                <span className="text-white/55/70">No images</span>
              )}
            </div>
          </div>

          {prop.landingStatus === 'missing' && (
            <div className="mt-4">
              <Link
                href={`/freehold-intelligence/inventory/${prop.id}/generate`}
                className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/[0.07] px-4 py-2 text-xs text-[#D4AF37] transition hover:bg-[#D4AF37]/[0.12]"
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
