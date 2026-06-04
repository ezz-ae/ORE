import Link from 'next/link'
import { ArrowUpRight, ExternalLink, Globe } from 'lucide-react'
import {
  leadMachineLandings,
  leadMachineListings,
  type LeadMachineLanding,
} from '@/src/features/freehold-intelligence/lead-machine'

function statusStyle(status: string) {
  const s = status.toLowerCase()
  if (s.includes('approved')) return { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' }
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
          'text-[11px] font-medium',
          isReady ? 'text-emerald-400' : 'text-[#D4AF37]',
        ].join(' ')}
      >
        {status}
      </span>
    </div>
  )
}

function LandingCard({ landing }: { landing: LeadMachineLanding }) {
  const listing = leadMachineListings.find((l) => l.projectId === landing.projectId)
  const style = statusStyle(landing.status)

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0A0D10] transition hover:border-[#D4AF37]/25">
      <div className="px-7 pb-0 pt-7 sm:px-8 sm:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
              {listing?.area ?? 'Unknown'} · {listing?.developer ?? '—'}
            </div>
            <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
              {listing?.projectName ?? landing.projectId}
            </h3>
          </div>
          <span
            className={[
              'mt-1 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium',
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
          <div className="mb-1 flex items-center justify-between text-[11px]">
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

      <div className="mx-7 mb-0 mt-5 border-t border-white/[0.06] sm:mx-8">
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
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">AI take</div>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-white/65">{landing.aiReviewSummary}</p>
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

export default function LandingsPage() {
  const approved = leadMachineLandings.filter((l) => l.status === 'Approved').length
  const pending = leadMachineLandings.filter((l) => l.status === 'Pending Review').length

  return (
    <div className="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:pt-16">
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
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
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">All</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {leadMachineLandings.length} pages
          </h2>
        </div>

        <div className="mt-8 grid gap-8">
          {leadMachineLandings.map((landing) => (
            <LandingCard key={landing.id} landing={landing} />
          ))}
        </div>
      </section>
    </div>
  )
}
