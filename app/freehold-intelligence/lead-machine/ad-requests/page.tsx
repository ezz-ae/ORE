'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Megaphone } from 'lucide-react'
import {
  leadMachineAdRequests,
  leadMachineListings,
  type LeadMachineAdRequest,
} from '@/src/features/freehold-intelligence/lead-machine'
import { PageHeader, EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type StatusFilter = 'All' | 'Running' | 'Pending Review' | 'Blocked' | 'Paused'
type PlatformFilter = 'All' | 'Meta' | 'Google'

function statusStyle(status: string) {
  const s = status.toLowerCase()
  if (s === 'running') return { dot: 'bg-gold', badge: 'text-gold bg-gold/10 border-gold/20' }
  if (s === 'approved' || s === 'ready to launch') return { dot: 'bg-gold', badge: 'text-gold bg-gold/10 border-gold/20' }
  if (s === 'pending review') return { dot: 'bg-gold', badge: 'text-gold bg-gold/10 border-gold/20' }
  if (s === 'paused') return { dot: 'bg-white/30', badge: 'text-slate-400 bg-surface-2 border-white/10' }
  if (s === 'blocked' || s === 'needs changes') return { dot: 'bg-red-400', badge: 'text-red-400 bg-red-400/10 border-red-400/20' }
  return { dot: 'bg-white/20', badge: 'text-slate-500 bg-surface-2 border-line' }
}

function platformStyle(platform: string) {
  if (platform === 'Meta') return 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20'
  if (platform === 'Google') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  return 'text-slate-400 bg-surface-2 border-white/10'
}

function AdRequestCard({ request }: { request: LeadMachineAdRequest }) {
  const t = useT()
  const listing = leadMachineListings.find((l) => l.projectId === request.projectId)
  const status = statusStyle(request.status)
  const platform = platformStyle(request.platform)

  return (
    <article className="overflow-hidden rounded-[28px] border border-line bg-surface transition hover:border-gold/25">
      <div className="px-7 pb-0 pt-7 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium uppercase tracking-wider text-gold/85">
              {listing?.area ?? 'Unknown'} · {listing?.developer ?? '—'}
            </div>
            <h3 className="mt-2 text-xl font-semibold leading-tight text-white sm:text-2xl">
              {listing?.projectName ?? request.projectId}
            </h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={['rounded-full border px-2.5 py-1 text-sm font-medium', platform].join(' ')}>
              {request.platform}
            </span>
            <span className={['rounded-full border px-2.5 py-1 text-sm font-medium', status.badge].join(' ')}>
              {request.status}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{t('lm.requests.field.objective')}</div>
            <p className="mt-1 text-sm text-slate-300">{request.campaignObjective}</p>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{t('lm.requests.field.budget')}</div>
            <p className="mt-1 text-sm font-semibold text-white">{request.budget}</p>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{t('lm.requests.field.angle')}</div>
            <p className="mt-1 text-sm leading-[1.55] text-slate-300">{request.campaignAngle}</p>
          </div>
        </div>

        {request.blockers.length > 0 && (
          <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[0.04] px-4 py-3.5">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-red-400/70">{t('lm.requests.field.blockers')}</div>
            <ul className="mt-1.5 grid gap-1 text-sm text-slate-300">
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
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:gap-2.5"
          >
            {t('lm.requests.openListing')} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <span className="text-xs text-slate-500">{request.approvalStatus}</span>
        </div>
      </div>
    </article>
  )
}

const STATUS_PILLS: { value: StatusFilter; labelKey: string }[] = [
  { value: 'All',           labelKey: 'lm.requests.filter.all'          },
  { value: 'Running',       labelKey: 'lm.requests.filter.running'       },
  { value: 'Pending Review',labelKey: 'lm.requests.filter.pendingReview' },
  { value: 'Blocked',       labelKey: 'lm.requests.filter.blocked'       },
  { value: 'Paused',        labelKey: 'lm.requests.filter.paused'        },
]

const PLATFORM_PILLS: { value: PlatformFilter; labelKey: string }[] = [
  { value: 'All',    labelKey: 'lm.requests.filter.all'    },
  { value: 'Meta',   labelKey: 'lm.requests.filter.meta'   },
  { value: 'Google', labelKey: 'lm.requests.filter.google' },
]

export default function AdRequestsPage() {
  const t = useT()
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
  const n = leadMachineAdRequests.length

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-6 sm:pt-16">
      <PageHeader
        eyebrow={t('lm.requests.eyebrow')}
        Icon={Megaphone}
        title={t('lm.requests.title')}
        subtitle={
          n > 0 ? (
            <>
              <span className="text-white">{t('lm.requests.subtitle.count', { n: String(n), plural: n !== 1 ? 's' : '' })}</span>{' '}
              {running > 0 && <>{t('lm.requests.running', { n: String(running) })}</>}
              {pending > 0 && <>{t('lm.requests.pending', { n: String(pending) })}</>}
              {blocked > 0 && <>{t('lm.requests.blocked', { n: String(blocked) })}</>}
            </>
          ) : (
            t('lm.requests.noRequests')
          )
        }
        className="mb-10"
      />

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium uppercase tracking-wider text-slate-500">
              {filtered.length === leadMachineAdRequests.length
                ? t('lm.requests.countAll')
                : t('lm.requests.countFiltered', { n: String(filtered.length), total: String(leadMachineAdRequests.length) })}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t('lm.requests.requests', { n: String(filtered.length), plural: filtered.length !== 1 ? 's' : '' })}
            </h2>
          </div>
        </div>

        {/* Filter pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {STATUS_PILLS.map(({ value, labelKey }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                statusFilter === value
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {t(labelKey)}
            </button>
          ))}
          <span className="self-center text-slate-600">|</span>
          {PLATFORM_PILLS.map(({ value, labelKey }) => (
            <button
              key={value}
              onClick={() => setPlatformFilter(value)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                platformFilter === value
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-8">
          {filtered.map((request) => (
            <AdRequestCard key={request.id} request={request} />
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            Icon={Megaphone}
            title={t('lm.requests.noMatch')}
            action={
              <button
                onClick={() => { setStatusFilter('All'); setPlatformFilter('All') }}
                className="rounded-full border border-line px-4 py-1.5 text-xs text-slate-500 transition hover:text-slate-300"
              >
                {t('lm.requests.clearFilters')}
              </button>
            }
            className="mt-8"
          />
        )}
      </section>
    </div>
  )
}
