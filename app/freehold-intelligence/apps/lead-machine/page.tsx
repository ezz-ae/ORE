import Link from 'next/link'
import { ArrowUpRight, Sparkles, Zap, BarChart2 } from 'lucide-react'
import { executeTool } from '@/lib/freehold/mcp/execute-tool'
import { AiPrompt } from '@/components/freehold/ai-prompt'
import {
  leadMachineListings,
  type LeadMachineListing,
} from '@/src/features/freehold-intelligence/lead-machine'

function dot(value: string) {
  const v = value.toLowerCase()
  if (v.includes('ready') || v.includes('approved') || v.includes('active')) return 'bg-[#D4AF37]'
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
    <article className="group overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#131B2B] transition hover:border-white/10 lg:rounded-[28px]">
      <div className="relative">
        <div
          className="aspect-[16/9] bg-cover bg-center transition duration-700 group-hover:scale-[1.015]"
          style={{ backgroundImage: `url(${listing.imageUrl})` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0D10] via-[#0A0D10]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 p-5 sm:p-7 lg:p-8">
          <div className="min-w-0">
            <div className="text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
              {listing.area} · {listing.developer}
            </div>
            <h3 className="mt-1.5 text-xl font-semibold leading-tight text-white sm:text-2xl lg:text-[28px]">
              {listing.projectName}
            </h3>
          </div>
          {priceLabel && (
            <div className="shrink-0 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur">
              {priceLabel}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-6 pt-5 sm:px-7 lg:px-8 lg:pb-8">
        <p className="text-[14px] leading-[1.6] text-white/65 lg:text-[15px]">
          <span className="font-medium text-white">{readiness(listing)}.</span>{' '}
          {listing.nextAction}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <span className="flex items-center gap-2 text-white/50">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.landingStatus)}`} />
            Landing · <span className="capitalize text-white/70">{statusText(listing.landingStatus)}</span>
          </span>
          <span className="flex items-center gap-2 text-white/50">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.adStatus)}`} />
            Ads · <span className="capitalize text-white/70">{statusText(listing.adStatus)}</span>
          </span>
          <span className="flex items-center gap-2 text-white/50">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(listing.blockerStatus)}`} />
            <span className="capitalize text-white/70">{statusText(listing.blockerStatus)}</span>
          </span>
          <span className="text-white/40">
            Score <span className="tabular-nums font-semibold text-white/80">{listing.opportunityScore}</span>
          </span>
        </div>

        {listing.missingRequirements.length > 0 && (
          <div className="mt-5 border-t border-white/[0.05] pt-4">
            <div className="text-[12px] font-medium uppercase tracking-wider text-white/30">Holding it back</div>
            <ul className="mt-2 grid gap-1 text-[13px] text-white/60">
              {listing.missingRequirements.map((req) => (
                <li key={req} className="flex items-start gap-2 before:mt-[7px] before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[#D4AF37]/60">
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#06080A] transition hover:gap-2.5"
          >
            Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/freehold-intelligence/lead-machine/requirements"
            className="rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2 text-[12px] text-white/65 transition hover:border-[#D4AF37]/25 hover:text-white"
          >
            Requirements
          </Link>
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

  const readyCount = leadMachineListings.filter(l => l.adReadinessScore >= 80).length
  const blockedCount = leadMachineListings.filter(l => l.blockerStatus !== 'Clear').length

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10 xl:grid-cols-[1fr_380px] xl:gap-14">

        {/* ══════════════════ MAIN ══════════════════ */}
        <div className="min-w-0">
          <section>
            <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
              <Zap className="h-3.5 w-3.5" /> Lead Machine
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
              Listings,
              <br />
              <span className="text-white/35">on their way to launch.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.6] text-white/60 sm:text-[18px]">
              {isLive && totalListings != null ? (
                <>
                  <span className="text-white">{Number(totalListings).toLocaleString()} active listings</span> across the private server.{' '}
                  {ready != null && <>{Number(ready).toLocaleString()} have landing pages ready. </>}
                  {blocked != null && blocked > 0 && (
                    <>{Number(blocked).toLocaleString()} blocked on access or billing.</>
                  )}
                </>
              ) : (
                'Featured listings on their way to a campaign. The AI curates by opportunity score, readiness, and clear next action.'
              )}
            </p>
          </section>

          {/* Mobile stats */}
          <div className="mt-8 grid grid-cols-3 gap-3 lg:hidden">
            <div className="rounded-2xl border border-white/[0.08] bg-[#131B2B] p-4 text-center">
              <div className="text-[22px] font-semibold text-white">{leadMachineListings.length}</div>
              <div className="text-[12px] text-white/40">Active</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#131B2B] p-4 text-center">
              <div className="text-[22px] font-semibold text-[#D4AF37]">{readyCount}</div>
              <div className="text-[12px] text-white/40">Ready</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#131B2B] p-4 text-center">
              <div className="text-[22px] font-semibold text-red-400">{blockedCount}</div>
              <div className="text-[12px] text-white/40">Blocked</div>
            </div>
          </div>

          {/* Mobile AI prompt */}
          <section className="mt-8 lg:hidden">
            <AiPrompt
              placeholder="Ask about listings, landings, ads, blockers…"
              suggestions={['Which listings are ready for ads?', 'What is blocking Meta launch?', 'Show the readiness matrix.']}
            />
          </section>

          {/* Listings */}
          <section className="mt-12">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[13px] font-medium uppercase tracking-wider text-white/40">Featured</div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">Today's curated set</h2>
              </div>
              <Link href="/freehold-intelligence/lead-machine/listings" className="hidden sm:inline-flex sm:items-center sm:gap-1.5 text-[12px] font-medium text-[#D4AF37]/70 hover:text-[#D4AF37]">
                All listings <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-7 grid gap-6">
              {leadMachineListings.map((listing) => (
                <ListingStory key={listing.id} listing={listing} />
              ))}
            </div>
          </section>

          {/* AI take */}
          <section className="mt-12 rounded-[24px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.035] px-6 py-7 lg:rounded-[28px] lg:px-9 lg:py-9">
            <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/80">
              <Sparkles className="h-3 w-3" /> AI take
            </div>
            <p className="mt-3 text-[15px] font-medium leading-[1.65] text-white/85 lg:text-[17px]">
              One listing is ready for paid traffic — the bottleneck is the Meta billing owner. Resolve that, and Dubai Hills launches today. Palm needs a single landing approval; Business Bay needs payment-plan data before a landing can be generated.
            </p>
          </section>
        </div>

        {/* ══════════════════ SIDEBAR ══════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">

            {/* Readiness scorecard */}
            <div className="rounded-[20px] border border-white/[0.08] bg-[#131B2B] p-5">
              <div className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">
                <BarChart2 className="h-3 w-3" /> Readiness
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-[28px] font-semibold text-white">{leadMachineListings.length}</div>
                  <div className="text-[12px] text-white/35">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-[28px] font-semibold text-[#D4AF37]">{readyCount}</div>
                  <div className="text-[12px] text-white/35">Ready</div>
                </div>
                <div className="text-center">
                  <div className="text-[28px] font-semibold text-red-400">{blockedCount}</div>
                  <div className="text-[12px] text-white/35">Blocked</div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {leadMachineListings.slice(0, 4).map((l) => (
                  <div key={l.id} className="flex items-center gap-3">
                    <div className="w-[90px] shrink-0 truncate text-[12px] text-white/65">{l.projectName.split(' ').slice(0, 2).join(' ')}</div>
                    <div className="flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-1.5 rounded-full bg-[#D4AF37]"
                        style={{ width: `${l.adReadinessScore}%` }}
                      />
                    </div>
                    <div className="w-7 text-right text-[13px] tabular-nums text-white/40">{l.adReadinessScore}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-[20px] border border-white/[0.08] bg-[#131B2B] p-4">
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">In Lead Machine</div>
              <div className="space-y-1">
                {[
                  { label: 'All listings', href: '/freehold-intelligence/lead-machine/listings' },
                  { label: 'Landing pages', href: '/freehold-intelligence/lead-machine/landings' },
                  { label: 'Ad requests', href: '/freehold-intelligence/lead-machine/ad-requests' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-[10px] border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-[13px] text-white/55 transition hover:border-white/10 hover:text-white/80"
                  >
                    {item.label}
                    <ArrowUpRight className="h-3 w-3 opacity-50" />
                  </Link>
                ))}
              </div>
            </div>

            {/* AI Prompt */}
            <AiPrompt
              placeholder="Ask about listings, landings, ads, blockers…"
              suggestions={[
                'Which listings are ready for ads?',
                'What is blocking Meta launch?',
                'Show the readiness matrix.',
                'Draft a landing request for Business Bay.',
              ]}
            />

          </div>
        </aside>

      </div>
    </div>
  )
}
