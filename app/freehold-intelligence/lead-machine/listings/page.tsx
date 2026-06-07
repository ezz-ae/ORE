'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, LayoutList, Search, X } from 'lucide-react'
import {
  leadMachineListings,
  type LeadMachineListing,
} from '@/src/features/freehold-intelligence/lead-machine'

function dot(value: string) {
  const v = value.toLowerCase()
  if (v.includes('ready') || v.includes('approved') || v.includes('active')) return 'bg-gold'
  if (v.includes('block') || v.includes('missing')) return 'bg-red-400'
  if (v.includes('review') || v.includes('draft') || v.includes('access') || v.includes('pending')) return 'bg-gold'
  return 'bg-white/30'
}

function statusText(value: string) {
  return value.replace(/[_-]/g, ' ').toLowerCase()
}

function readiness(listing: LeadMachineListing) {
  if (listing.adReadinessScore >= 80 && listing.landingReadinessScore >= 80) return 'Ready for paid traffic'
  if (listing.blockerStatus === 'Needs Access') return 'One access away from launch'
  if (listing.blockerStatus === 'Needs Data') return 'Missing data before landing'
  if (listing.landingStatus === 'Needs Review') return 'One approval from launch'
  if (listing.landingStatus === 'Needs Landing') return 'Needs landing generation'
  return 'In progress'
}

function ListingCard({ listing }: { listing: LeadMachineListing }) {
  const priceLabel = listing.startingPrice ? `AED ${Number(listing.startingPrice).toLocaleString()}` : null

  return (
    <article className="group overflow-hidden rounded-[28px] border border-line bg-surface transition hover:border-gold/25">
      <div className="relative">
        <div
          className="aspect-[16/9] bg-cover bg-center transition duration-700 group-hover:scale-[1.02]"
          style={{ backgroundImage: `url(${listing.imageUrl})` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0D10] via-[#0A0D10]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 p-6 sm:p-8">
          <div className="min-w-0">
            <div className="text-sm font-medium uppercase tracking-wider text-gold/85">
              {listing.area} · {listing.developer}
            </div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-[28px]">
              {listing.projectName}
            </h3>
          </div>
          {priceLabel && (
            <div className="shrink-0 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              {priceLabel}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-7 pt-5 sm:px-8">
        <p className="text-sm leading-[1.6] text-slate-300">
          <span className="font-medium text-white">{readiness(listing)}.</span>{' '}
          {listing.nextAction}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="flex items-center gap-2 text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.landingStatus)}`} />
            Landing · <span className="capitalize text-slate-200">{statusText(listing.landingStatus)}</span>
          </span>
          <span className="flex items-center gap-2 text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.adStatus)}`} />
            Ads · <span className="capitalize text-slate-200">{statusText(listing.adStatus)}</span>
          </span>
          <span className="flex items-center gap-2 text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.blockerStatus)}`} />
            <span className="capitalize text-slate-200">{statusText(listing.blockerStatus)}</span>
          </span>
          <span className="text-slate-500">
            Opportunity{' '}
            <span className="font-semibold tabular-nums text-white">{listing.opportunityScore}</span>
          </span>
        </div>

        {listing.missingRequirements.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Holding it back</div>
            <ul className="mt-2 grid gap-1 text-[14px] text-slate-300">
              {listing.missingRequirements.map((req) => (
                <li
                  key={req}
                  className="flex items-start gap-2 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-gold/70"
                >
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:gap-2.5"
          >
            Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
            className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-slate-300 transition hover:border-gold/30 hover:text-white"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  )
}

type ReadinessFilter = 'All' | 'Ready' | 'Needs Review' | 'Blocked'

const FILTER_OPTIONS: ReadinessFilter[] = ['All', 'Ready', 'Needs Review', 'Blocked']

export default function ListingsPage() {
  const total = leadMachineListings.length
  const ready = leadMachineListings.filter(
    (l) => l.adReadinessScore >= 80 && l.landingReadinessScore >= 80,
  ).length

  const [query, setQuery] = useState('')
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('All')

  const filtered = useMemo(() => {
    let items = leadMachineListings
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter((l) =>
        l.projectName.toLowerCase().includes(q) ||
        l.area.toLowerCase().includes(q) ||
        l.developer.toLowerCase().includes(q)
      )
    }
    if (readinessFilter === 'Ready') {
      items = items.filter((l) => l.adReadinessScore >= 80 && l.landingReadinessScore >= 80)
    } else if (readinessFilter === 'Needs Review') {
      items = items.filter((l) => l.landingStatus === 'Needs Review')
    } else if (readinessFilter === 'Blocked') {
      items = items.filter((l) => l.blockerStatus === 'Needs Access' || l.blockerStatus === 'Needs Data')
    }
    return items
  }, [query, readinessFilter])

  const isFiltered = filtered.length !== total

  function clearFilters() {
    setQuery('')
    setReadinessFilter('All')
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-6 sm:pt-16">
      <section>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <LayoutList className="h-3.5 w-3.5" /> Active Listings
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          Active Listings
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-slate-300">
          <span className="text-white">{total} listings</span> in the current curated set.{' '}
          {ready > 0 ? (
            <>
              <span className="text-white">{ready}</span> ready for paid traffic — the rest are pending
              data, approvals, or landing generation.
            </>
          ) : (
            'None are fully ready yet — resolve blockers to unlock campaigns.'
          )}
        </p>
      </section>

      <section className="mt-16">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-wider text-slate-500">All</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {isFiltered
                ? <>{filtered.length} of {total} listings</>
                : <>{total} listings</>
              }
            </h2>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by project, area, or developer…"
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Readiness filter pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setReadinessFilter(option)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                readinessFilter === option
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-5 text-center">
            <p className="text-sm text-slate-500">No listings match these filters</p>
            <button
              onClick={clearFilters}
              className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-slate-300 transition hover:border-gold/30 hover:text-white"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-8">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
