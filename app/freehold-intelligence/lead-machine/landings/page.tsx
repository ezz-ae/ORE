'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink, Globe, Zap, AlertCircle } from 'lucide-react'
import {
  leadMachineLandings,
  leadMachineListings,
  leadMachineAdRequests,
  type LeadMachineLanding,
} from '@/src/features/freehold-intelligence/lead-machine'

type StatusFilter = 'All' | 'Approved' | 'Pending Review' | 'Draft'

function statusStyle(status: string) {
  const s = status.toLowerCase()
  if (s.includes('approved')) return { dot: 'bg-[#D4AF37]', badge: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  if (s.includes('review') || s.includes('pending')) return { dot: 'bg-[#D4AF37]', badge: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  if (s.includes('draft')) return { dot: 'bg-white/30', badge: 'text-white/55 bg-white/[0.04] border-white/10' }
  return { dot: 'bg-white/20', badge: 'text-white/40 bg-white/[0.03] border-white/[0.08]' }
}

function CheckRow({ label, status }: { label: string; status: string }) {
  const isReady = status === 'Ready'
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[12px] text-white/45">{label}</span>
      <span
        className={[
          'text-[13px] font-medium',
          isReady ? 'text-[#D4AF37]' : 'text-[#D4AF37]',
        ].join(' ')}
      >
        {status}
      </span>
    </div>
  )
}

function adReqStatusStyle(s: string) {
  if (s === 'Running')          return 'text-[#D4AF37] border-[#D4AF37]/20 bg-[#D4AF37]/10'
  if (s === 'Approved' || s === 'Ready to Launch') return 'text-[#F8E7AE] border-[#D4AF37]/20 bg-[#D4AF37]/10'
  if (s === 'Pending Review')   return 'text-white/55 border-sky-400/20 bg-sky-400/10'
  if (s === 'Blocked')          return 'text-red-300 border-red-400/20 bg-red-400/10'
  return 'text-white/40 border-white/[0.08] bg-white/[0.03]'
}

function LandingCard({ landing }: { landing: LeadMachineLanding }) {
  const listing    = leadMachineListings.find((l) => l.projectId === landing.projectId)
  const linkedReqs = leadMachineAdRequests.filter((r) => r.landingId === landing.id)
  const style      = statusStyle(landing.status)

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#131B2B] transition hover:border-[#D4AF37]/25">
      <div className="px-7 pb-0 pt-7 sm:px-8 sm:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
              {listing?.area ?? 'Unknown'} · {listing?.developer ?? '—'}
            </div>
            <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
              {listing?.projectName ?? landing.projectId}
            </h3>
          </div>
          <span
            className={[
              'mt-1 shrink-0 rounded-full border px-2.5 py-1 text-[13px] font-medium',
              style.badge,
            ].join(' ')}
          >
            {landing.status}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[12px] text-white/40">
          <Globe className="h-3 w-3 shrink-0" />
          <span className="font-mono">{landing.landingUrl}</span>
        </div>

        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="font-medium uppercase tracking-[0.18em] text-white/35">Completion</span>
            <span className="font-semibold tabular-nums text-white/75">{landing.completion}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#D4AF37]"
              style={{ width: `${landing.completion}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-7 mb-0 mt-5 border-t border-white/[0.08] sm:mx-8">
        <div className="divide-y divide-white/[0.04] py-1">
          <CheckRow label="Hero" status={landing.heroStatus} />
          <CheckRow label="Lead Form" status={landing.leadFormStatus} />
          <CheckRow label="Tracking" status={landing.trackingStatus} />
          <CheckRow label="Mobile" status={landing.mobileStatus} />
          <CheckRow label="SEO" status={landing.seoStatus} />
        </div>
      </div>

      {landing.aiReviewSummary && (
        <div className="mx-7 mb-0 mt-4 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-3.5 sm:mx-8">
          <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/30">AI take</div>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-white/65">{landing.aiReviewSummary}</p>
        </div>
      )}

      {/* Linked campaigns */}
      {linkedReqs.length > 0 ? (
        <div className="mx-7 mb-0 mt-5 border-t border-white/[0.08] pt-5 sm:mx-8">
          <div className="mb-3 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white/30">
            <Zap className="h-3 w-3 text-[#D4AF37]/50" /> Linked campaigns
          </div>
          <div className="space-y-2">
            {linkedReqs.map((req) => (
              <Link
                key={req.id}
                href={`/freehold-intelligence/lead-machine/ad-requests`}
                className="group flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 transition hover:border-[#D4AF37]/20"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-white/80 truncate group-hover:text-white">
                    {req.campaignAngle.slice(0, 55)}{req.campaignAngle.length > 55 ? '…' : ''}
                  </div>
                  <div className="mt-0.5 text-[13px] text-white/35">{req.platform} · {req.budget}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium ${adReqStatusStyle(req.status)}`}>
                  {req.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-7 mb-0 mt-5 border-t border-white/[0.08] pt-5 sm:mx-8">
          <div className="flex items-center gap-2 text-[12px] text-white/25">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            No active campaigns linked to this landing.{' '}
            <Link
              href="/freehold-intelligence/lead-machine/campaigns/new"
              className="text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
            >
              Start one
            </Link>
          </div>
        </div>
      )}

      <div className="px-7 pb-7 pt-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={landing.landingUrl}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#06080A] transition hover:gap-2.5"
          >
            Preview <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={listing ? `/freehold-intelligence/lead-machine/listings/${listing.id}` : '/freehold-intelligence/lead-machine/listings'}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[13px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white"
          >
            Open listing <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  )
}

const STATUS_FILTERS: StatusFilter[] = ['All', 'Approved', 'Pending Review', 'Draft']

export default function LandingsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')

  const approved = leadMachineLandings.filter((l) => l.status === 'Approved').length
  const pending = leadMachineLandings.filter((l) => l.status === 'Pending Review').length

  const filteredLandings = useMemo(() => {
    if (statusFilter === 'All') return leadMachineLandings
    return leadMachineLandings.filter((l) => l.status === statusFilter)
  }, [statusFilter])

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">
      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Globe className="h-3.5 w-3.5" /> Landing Pages
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          Landing Pages
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          {leadMachineLandings.length > 0 ? (
            <>
              <span className="text-white">{leadMachineLandings.length} landing pages</span> across active projects.{' '}
              {approved > 0 && <>{approved} approved and live-ready. </>}
              {pending > 0 && <>{pending} waiting on owner review before campaigns can launch.</>}
            </>
          ) : (
            'No landing pages have been generated yet. Request generation from an active listing.'
          )}
        </p>
      </section>

      <section className="mt-16">
        <div>
          <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">All</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {statusFilter === 'All'
              ? `${leadMachineLandings.length} pages`
              : `${filteredLandings.length} of ${leadMachineLandings.length} pages`}
          </h2>
        </div>

        {/* Status filter pills */}
        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={[
                'rounded-full border px-3 py-1 text-[13px] font-medium transition',
                statusFilter === filter
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white/65',
              ].join(' ')}
            >
              {filter}
            </button>
          ))}
        </div>

        {filteredLandings.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <p className="text-[15px] text-white/40">No landing pages match this filter.</p>
            <button
              onClick={() => setStatusFilter('All')}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] text-white/60 transition hover:border-[#D4AF37]/30 hover:text-white"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-8">
            {filteredLandings.map((landing) => (
              <LandingCard key={landing.id} landing={landing} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
