import Link from 'next/link'
import { ArrowUpRight, LayoutList } from 'lucide-react'
import {
  leadMachineListings,
  type LeadMachineListing,
} from '@/src/features/freehold-intelligence/lead-machine'

function dot(value: string) {
  const v = value.toLowerCase()
  if (v.includes('ready') || v.includes('approved') || v.includes('active')) return 'bg-emerald-400'
  if (v.includes('block') || v.includes('missing')) return 'bg-red-400'
  if (v.includes('review') || v.includes('draft') || v.includes('access') || v.includes('pending')) return 'bg-[#D4AF37]'
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
    <article className="group overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0A0D10] transition hover:border-[#D4AF37]/25">
      <div className="relative">
        <div
          className="aspect-[16/9] bg-cover bg-center transition duration-700 group-hover:scale-[1.02]"
          style={{ backgroundImage: `url(${listing.imageUrl})` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0D10] via-[#0A0D10]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 p-6 sm:p-8">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
              {listing.area} · {listing.developer}
            </div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-[28px]">
              {listing.projectName}
            </h3>
          </div>
          {priceLabel && (
            <div className="shrink-0 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur">
              {priceLabel}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-7 pt-5 sm:px-8">
        <p className="text-[15px] leading-[1.6] text-white/65">
          <span className="font-medium text-white">{readiness(listing)}.</span>{' '}
          {listing.nextAction}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
          <span className="flex items-center gap-2 text-white/55">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.landingStatus)}`} />
            Landing · <span className="capitalize text-white/75">{statusText(listing.landingStatus)}</span>
          </span>
          <span className="flex items-center gap-2 text-white/55">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.adStatus)}`} />
            Ads · <span className="capitalize text-white/75">{statusText(listing.adStatus)}</span>
          </span>
          <span className="flex items-center gap-2 text-white/55">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.blockerStatus)}`} />
            <span className="capitalize text-white/75">{statusText(listing.blockerStatus)}</span>
          </span>
          <span className="text-white/45">
            Opportunity{' '}
            <span className="font-semibold tabular-nums text-white/85">{listing.opportunityScore}</span>
          </span>
        </div>

        {listing.missingRequirements.length > 0 && (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">Holding it back</div>
            <ul className="mt-2 grid gap-1 text-[14px] text-white/65">
              {listing.missingRequirements.map((req) => (
                <li
                  key={req}
                  className="flex items-start gap-2 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[#D4AF37]/70"
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
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#06080A] transition hover:gap-2.5"
          >
            Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
            className="rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[13px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function ListingsPage() {
  const total = leadMachineListings.length
  const ready = leadMachineListings.filter(
    (l) => l.adReadinessScore >= 80 && l.landingReadinessScore >= 80,
  ).length

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <LayoutList className="h-3.5 w-3.5" /> Active Listings
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          Active Listings
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
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
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">All</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {total} listings
            </h2>
          </div>
        </div>

        <div className="mt-8 grid gap-8">
          {leadMachineListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>
    </div>
  )
}
