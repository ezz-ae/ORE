import Link from 'next/link'
import { ArrowUpRight, Sparkles, Zap } from 'lucide-react'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { AiPrompt } from '@/components/freehold/ai-prompt'
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

function ListingStory({ listing }: { listing: LeadMachineListing }) {
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
            Opportunity <span className="tabular-nums font-semibold text-white/85">{listing.opportunityScore}</span>
          </span>
        </div>

        {listing.missingRequirements.length > 0 && (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">Holding it back</div>
            <ul className="mt-2 grid gap-1 text-[14px] text-white/65">
              {listing.missingRequirements.map((req) => (
                <li key={req} className="flex items-start gap-2 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[#D4AF37]/70">
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/freehold-intelligence/review-requests?project=${listing.projectId}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#06080A] transition hover:gap-2.5"
          >
            Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button className="rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[13px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white">
            Ask AI about this
          </button>
        </div>
      </div>
    </article>
  )
}

export default async function LeadMachinePage() {
  const summaryRes = await executeTool({ tool: 'lead_machine_summary', role: 'owner' })
  const summary = summaryRes.data
  const isLive = summaryRes.fallbackStatus === 'live'

  const totalListings = summary?.totalListings
  const ready = summary?.landingPagesReady
  const blocked = summary?.blockedByAccess

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">
      {/* Eyebrow & Editorial header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Zap className="h-3.5 w-3.5" /> Lead Machine
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          Listings,
          <br />
          <span className="text-white/40">on their way to launch.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[18px] leading-[1.6] text-white/65">
          {isLive && totalListings != null ? (
            <>
              <span className="text-white">{Number(totalListings).toLocaleString()} active listings</span> across the private server.{' '}
              {ready != null && <>{Number(ready).toLocaleString()} have landing pages ready. </>}
              {blocked != null && blocked > 0 && (
                <>{Number(blocked).toLocaleString()} are blocked on access or billing.</>
              )}
            </>
          ) : (
            'Featured listings on their way to a campaign. The AI is curating these by opportunity, readiness and clear next action.'
          )}
        </p>
      </section>

      {/* AI Prompt scoped */}
      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about listings, landings, ads, blockers…"
          suggestions={[
            'Which listings are ready for ads?',
            'What is blocking Meta launch?',
            'Show the readiness matrix.',
            'Draft a landing request for Business Bay.',
          ]}
        />
      </section>

      {/* Editorial section title */}
      <section className="mt-20">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">Featured</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Today's curated set
            </h2>
          </div>
          <Link href="/freehold-intelligence/review-requests" className="hidden text-[12px] font-medium text-[#D4AF37] sm:inline-flex sm:items-center sm:gap-1.5">
            All listings <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-8 grid gap-8">
          {leadMachineListings.map((listing) => (
            <ListingStory key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* Closing editorial note */}
      <section className="mt-20 rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-7 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="mt-3 text-[17px] font-medium leading-[1.65] text-white/85 sm:text-lg">
          One listing is ready for paid traffic — the bottleneck is the Meta billing owner. Resolve that, and Dubai Hills launches today. Palm needs a single landing approval; Business Bay needs payment-plan data before a landing can be generated.
        </p>
      </section>
    </div>
  )
}
