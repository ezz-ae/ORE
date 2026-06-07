'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, FolderKanban, ArrowUpRight, AlertCircle } from 'lucide-react'
import { leadMachineListings } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type AdFilter     = 'All' | 'ready' | 'blocked' | 'needs_assets'
type ReviewFilter = 'All' | 'approved' | 'pending_approval' | 'open'

function landingTone(s: string) {
  if (s === 'ready' || s === 'approved') return { dot: 'bg-gold', text: 'text-gold', label: s === 'approved' ? 'Approved' : 'Ready' }
  if (s === 'needs_review')              return { dot: 'bg-gold', text: 'text-[#F8E7AE]', label: 'Review' }
  return                                        { dot: 'bg-red-400',   text: 'text-red-300',   label: 'Missing' }
}

function adTone(s: string) {
  if (s === 'ready')        return { dot: 'bg-gold', text: 'text-gold', label: 'Ready' }
  if (s === 'blocked')      return { dot: 'bg-red-400',     text: 'text-red-300',     label: 'Blocked' }
  return                           { dot: 'bg-gold',   text: 'text-[#F8E7AE]',  label: 'Needs assets' }
}

function reviewTone(s: string) {
  if (s === 'approved')         return { dot: 'bg-gold', text: 'text-gold', label: 'Approved' }
  if (s === 'pending_approval') return { dot: 'bg-gold',   text: 'text-[#F8E7AE]',  label: 'Pending' }
  return                               { dot: 'bg-white/30',    text: 'text-slate-500',    label: 'Open' }
}

export default function DashboardProjectsPage() {
  const [adFilter,     setAdFilter]     = useState<AdFilter>('All')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('All')

  // Stats always computed from all listings (not filtered)
  const ready     = leadMachineListings.filter((l) => l.adReadiness === 'ready').length
  const blocked   = leadMachineListings.filter((l) => l.adReadiness === 'blocked').length
  const pending   = leadMachineListings.filter((l) => l.landingStatus === 'needs_review').length
  const totalReqs = leadMachineListings.reduce((s, l) => s + l.requirements.length, 0)

  const filtered = useMemo(() => {
    let items = leadMachineListings
    if (adFilter !== 'All') {
      if (adFilter === 'needs_assets') items = items.filter((l) => l.adReadiness !== 'ready' && l.adReadiness !== 'blocked')
      else items = items.filter((l) => l.adReadiness === adFilter)
    }
    if (reviewFilter !== 'All') items = items.filter((l) => l.reviewStatus === reviewFilter)
    return items
  }, [adFilter, reviewFilter])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <FolderKanban className="h-3.5 w-3.5" /> Projects Admin
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Project inventory<br /><span className="text-slate-500">and readiness.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-[1.65] text-slate-400">
          {leadMachineListings.length} active campaign projects. Full status control, editorial review, and launch readiness.
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Ad ready',          value: ready,      tone: 'text-gold' },
          { label: 'Blocked',           value: blocked,    tone: 'text-red-400' },
          { label: 'Review pending',    value: pending,    tone: 'text-gold' },
          { label: 'Open requirements', value: totalReqs,  tone: 'text-slate-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[18px] border border-line bg-surface p-5">
            <div className={`text-[28px] font-semibold ${kpi.tone}`}>{kpi.value}</div>
            <div className="mt-0.5 text-sm text-slate-500">{kpi.label}</div>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">Campaign projects</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Full inventory</h2>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {([
            { key: 'All',          label: 'All' },
            { key: 'ready',        label: 'Ad ready' },
            { key: 'needs_assets', label: 'Needs assets' },
            { key: 'blocked',      label: 'Blocked' },
          ] as { key: AdFilter; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setAdFilter(key)}
              className={['rounded-full border px-3 py-1 text-sm font-medium transition',
                adFilter === key
                  ? key === 'blocked'
                    ? 'border-red-400/40 bg-red-400/10 text-red-300'
                    : key === 'ready'
                    ? 'border-emerald-400/40 bg-gold/10 text-gold'
                    : 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}>{label}</button>
          ))}
          <span className="self-center text-slate-600">|</span>
          {([
            { key: 'All',              label: 'All reviews' },
            { key: 'approved',         label: 'Approved' },
            { key: 'pending_approval', label: 'Pending' },
            { key: 'open',             label: 'Open' },
          ] as { key: ReviewFilter; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setReviewFilter(key)}
              className={['rounded-full border px-3 py-1 text-sm font-medium transition',
                reviewFilter === key
                  ? key === 'approved'
                    ? 'border-emerald-400/40 bg-gold/10 text-gold'
                    : 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}>{label}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {filtered.length === leadMachineListings.length
            ? `${leadMachineListings.length} projects`
            : `${filtered.length} of ${leadMachineListings.length} projects`}
        </p>

        {filtered.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-line bg-surface px-6 py-10 text-center text-sm text-slate-500">
            No projects match these filters.{' '}
            <button onClick={() => { setAdFilter('All'); setReviewFilter('All') }} className="ml-1 text-gold/60 hover:text-gold">Clear</button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {filtered.map((listing) => {
              const land = landingTone(listing.landingStatus)
              const ad   = adTone(listing.adReadiness)
              const rev  = reviewTone(listing.reviewStatus)
              return (
                <div key={listing.id} className="rounded-[22px] border border-line bg-surface p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
                          className="text-[17px] font-semibold text-white transition hover:text-gold"
                        >
                          {listing.name}
                        </Link>
                        {listing.adReadiness === 'blocked' && (
                          <span className="inline-flex items-center gap-1 text-sm text-red-300/70">
                            <AlertCircle className="h-3 w-3" /> Blocked
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{listing.area} · {listing.developer}</div>
                      <p className="mt-2 text-sm text-slate-400">{listing.nextAction}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium border-current/20 ${land.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${land.dot}`} /> Landing: {land.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium border-current/20 ${ad.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${ad.dot}`} /> Ads: {ad.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium border-current/20 ${rev.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${rev.dot}`} /> Review: {rev.label}
                        </span>
                      </div>

                      {listing.requirements.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {listing.requirements.map((req) => (
                            <div key={req} className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" /> {req}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 sm:shrink-0 sm:flex-col sm:items-end sm:gap-2">
                      <span>{listing.comments} comments</span>
                      <span>{listing.tasks} tasks</span>
                      <Link
                        href={`/freehold-intelligence/lead-machine/listings/${listing.id}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-gold"
                      >
                        Open workspace <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about projects, readiness, status…"
          suggestions={[
            'Which projects are ready to launch ads right now?',
            'What is blocking the Palm Jumeirah campaign?',
            'List all projects missing landing pages.',
          ]}
        />
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        {[
          { label: 'Lead Machine', href: '/freehold-intelligence/lead-machine' },
          { label: 'Listings',     href: '/freehold-intelligence/lead-machine/listings' },
          { label: 'Ad Requests',  href: '/freehold-intelligence/lead-machine/ad-requests' },
          { label: 'Requirements', href: '/freehold-intelligence/lead-machine/requirements' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-4 py-2 text-sm text-slate-400 transition hover:border-gold/30 hover:text-white"
          >
            {link.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
      </section>

    </div>
  )
}
