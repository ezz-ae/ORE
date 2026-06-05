'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Megaphone } from 'lucide-react'
import {
  leadMachineAdRequests,
  leadMachineListings,
  type LeadMachineAdRequest,
} from '@/src/features/freehold-intelligence/lead-machine'

type StatusFilter = 'All' | 'Running' | 'Pending Review' | 'Blocked' | 'Paused'
type PlatformFilter = 'All' | 'Meta' | 'Google'

function statusStyle(status: string) {
  const s = status.toLowerCase()
  if (s === 'running') return { dot: 'bg-[#D4AF37]', badge: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  if (s === 'approved' || s === 'ready to launch') return { dot: 'bg-[#D4AF37]', badge: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  if (s === 'pending review') return { dot: 'bg-[#D4AF37]', badge: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20' }
  if (s === 'paused') return { dot: 'bg-white/30', badge: 'text-white/55 bg-white/[0.04] border-white/10' }
  if (s === 'blocked' || s === 'needs changes') return { dot: 'bg-red-400', badge: 'text-red-400 bg-red-400/10 border-red-400/20' }
  return { dot: 'bg-white/20', badge: 'text-white/40 bg-white/[0.03] border-white/[0.08]' }
}

function platformStyle(platform: string) {
  if (platform === 'Meta') return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
  if (platform === 'Google') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  return 'text-white/55 bg-white/[0.04] border-white/10'
}

function AdRequestCard({ request }: { request: LeadMachineAdRequest }) {
  const listing = leadMachineListings.find((l) => l.projectId === request.projectId)
  const status = statusStyle(request.status)
  const platform = platformStyle(request.platform)

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#131B2B] transition hover:border-[#D4AF37]/25">
      <div className="px-7 pb-0 pt-7 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
              {listing?.area ?? 'Unknown'} · {listing?.developer ?? '—'}
            </div>
            <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
              {listing?.projectName ?? request.projectId}
            </h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={[
                'rounded-full border px-2.5 py-1 text-[13px] font-medium',
                platform,
              ].join(' ')}
            >
              {request.platform}
            </span>
            <span
              className={[
                'rounded-full border px-2.5 py-1 text-[13px] font-medium',
                status.badge,
              ].join(' ')}
            >
              {request.status}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/30">Objective</div>
            <p className="mt-1 text-[13px] text-white/70">{request.campaignObjective}</p>
          </div>
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/30">Budget</div>
            <p className="mt-1 text-[13px] font-semibold text-white/85">{request.budget}</p>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/30">Campaign Angle</div>
            <p className="mt-1 text-[13px] leading-[1.55] text-white/65">{request.campaignAngle}</p>
          </div>
        </div>

        {request.blockers.length > 0 && (
          <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[0.04] px-4 py-3.5">
            <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-red-400/70">Blockers</div>
            <ul className="mt-1.5 grid gap-1 text-[13px] text-white/65">
              {request.blockers.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-red-400/60"
                >
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="px-7 pb-7 pt-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={listing ? `/freehold-intelligence/lead-machine/listings/${listing.id}` : '/freehold-intelligence/lead-machine/listings'}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#06080A] transition hover:gap-2.5"
          >
            Open listing workspace <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <span className="text-[12px] text-white/35">{request.approvalStatus}</span>
        </div>
      </div>
    </article>
  )
}

const STATUS_PILLS: StatusFilter[] = ['All', 'Running', 'Pending Review', 'Blocked', 'Paused']
const PLATFORM_PILLS: PlatformFilter[] = ['All', 'Meta', 'Google']

export default function AdRequestsPage() {
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('All')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('All')

  const filtered = useMemo(() => {
    let items = leadMachineAdRequests
    if (statusFilter !== 'All') {
      items = items.filter((r) => {
        if (statusFilter === 'Blocked') return r.status === 'Blocked' || r.status === 'Needs Changes'
        return r.status === statusFilter
      })
    }
    if (platformFilter !== 'All') {
      items = items.filter((r) => r.platform === platformFilter)
    }
    return items
  }, [statusFilter, platformFilter])

  const pending = leadMachineAdRequests.filter((r) => r.status === 'Pending Review').length
  const running = leadMachineAdRequests.filter((r) => r.status === 'Running').length
  const blocked = leadMachineAdRequests.filter((r) => r.status === 'Blocked' || r.status === 'Needs Changes').length

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-6 sm:pt-16">
      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <Megaphone className="h-3.5 w-3.5" /> Ad Requests
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white/90">
          Ad Requests
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          {leadMachineAdRequests.length > 0 ? (
            <>
              <span className="text-white">{leadMachineAdRequests.length} campaign request{leadMachineAdRequests.length !== 1 ? 's' : ''}</span> across active listings.{' '}
              {running > 0 && <>{running} running. </>}
              {pending > 0 && <>{pending} pending approval before launch. </>}
              {blocked > 0 && <>{blocked} blocked on access or creative.</>}
            </>
          ) : (
            'No ad requests have been created yet. Open a listing workspace to draft a campaign.'
          )}
        </p>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">
              {filtered.length === leadMachineAdRequests.length
                ? 'All'
                : `${filtered.length} of ${leadMachineAdRequests.length}`}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {filtered.length} request{filtered.length !== 1 ? 's' : ''}
            </h2>
          </div>
        </div>

        {/* Filter pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {STATUS_PILLS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full border px-3 py-1 text-[13px] font-medium transition',
                statusFilter === s
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
          <span className="self-center text-white/15">|</span>
          {PLATFORM_PILLS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={[
                'rounded-full border px-3 py-1 text-[13px] font-medium transition',
                platformFilter === p
                  ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-8">
          {filtered.map((request) => (
            <AdRequestCard key={request.id} request={request} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-8 rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-7 py-12 text-center sm:px-10">
            <Megaphone className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-4 text-[15px] text-white/40">No requests match these filters.</p>
            <button
              onClick={() => { setStatusFilter('All'); setPlatformFilter('All') }}
              className="mt-3 rounded-full border border-white/[0.08] px-4 py-1.5 text-[12px] text-white/45 transition hover:text-white/70"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
