'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, ArrowUpRight, Search, X } from 'lucide-react'
import { leadMachineRequirements, leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'
import { PageHeader, EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type SeverityFilter = 'All' | 'critical' | 'high' | 'medium' | 'low'
type StatusFilter   = 'All' | 'Open' | 'Done'

const SEVERITY_PILLS: { key: SeverityFilter; labelKey: string }[] = [
  { key: 'All',      labelKey: 'lm.requirements.filter.all'      },
  { key: 'critical', labelKey: 'lm.requirements.filter.critical' },
  { key: 'high',     labelKey: 'lm.requirements.filter.high'     },
  { key: 'medium',   labelKey: 'lm.requirements.filter.medium'   },
  { key: 'low',      labelKey: 'lm.requirements.filter.low'      },
]

const STATUS_PILLS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'All',  labelKey: 'lm.requirements.filter.all'  },
  { key: 'Open', labelKey: 'lm.requirements.filter.open' },
  { key: 'Done', labelKey: 'lm.requirements.filter.done' },
]

function severityTone(s: string) {
  if (s === 'critical') return { ring: 'border-red-400/25',      bg: 'bg-red-400/[0.06]',      text: 'text-red-300',      dot: 'bg-red-400',    labelKey: 'lm.requirements.severity.critical', active: 'border-red-400/40 bg-red-400/15 text-red-300' }
  if (s === 'high')     return { ring: 'border-gold/25',    bg: 'bg-gold/[0.05]',   text: 'text-[#F8E7AE]',    dot: 'bg-gold', labelKey: 'lm.requirements.severity.high',     active: 'border-gold/40 bg-gold/15 text-[#F8E7AE]' }
  if (s === 'medium')   return { ring: 'border-teal-400/20',      bg: 'bg-teal-400/[0.05]',      text: 'text-teal-200',      dot: 'bg-teal-400',   labelKey: 'lm.requirements.severity.medium',   active: 'border-teal-400/40 bg-teal-400/15 text-teal-200' }
  return                       { ring: 'border-line',    bg: 'bg-surface',           text: 'text-slate-400',     dot: 'bg-white/30',  labelKey: 'lm.requirements.severity.low',      active: 'border-white/20 bg-surface-2 text-slate-300' }
}

function statusIcon(s: string) {
  if (s === 'Done')                        return <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
  if (s === 'Needs Access' || s === 'Blocked') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  return <Clock className="h-3.5 w-3.5 text-gold" />
}

const projectName = (id: string) => leadMachineListings.find((l) => l.projectId === id)?.projectName || id

export default function RequirementsPage() {
  const t = useT()
  const [query,          setQuery]          = useState('')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('All')
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('All')

  const totalOpen     = leadMachineRequirements.filter((r) => r.status !== 'Done').length
  const criticalCount = leadMachineRequirements.filter((r) => r.severity === 'critical').length

  const filtered = useMemo(() => {
    let items = [...leadMachineRequirements].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
    })
    if (severityFilter !== 'All') items = items.filter((r) => r.severity === severityFilter)
    if (statusFilter === 'Open')  items = items.filter((r) => r.status !== 'Done')
    if (statusFilter === 'Done')  items = items.filter((r) => r.status === 'Done')
    if (query.trim()) {
      const q = query.toLowerCase()
      items = items.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        projectName(r.projectId).toLowerCase().includes(q)
      )
    }
    return items
  }, [query, severityFilter, statusFilter])

  function clearFilters() {
    setQuery('')
    setSeverityFilter('All')
    setStatusFilter('All')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <PageHeader
        eyebrow={t('lm.requirements.eyebrow')}
        Icon={AlertCircle}
        title={<>{totalOpen} {t('lm.requirements.titleOpen')}. <span className="text-slate-500">{criticalCount} {t('lm.requirements.titleCritical')}.</span></>}
        subtitle={t('lm.requirements.subtitle')}
      />

      {/* Stat tiles */}
      <section className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.06] p-4 text-center">
          <p className="text-[26px] font-semibold text-red-300">{criticalCount}</p>
          <p className="mt-1 text-xs text-red-400/60">{t('lm.requirements.stat.critical')}</p>
        </div>
        <div className="rounded-[18px] border border-gold/20 bg-gold/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#F8E7AE]">{leadMachineRequirements.filter(r => r.severity === 'high').length}</p>
          <p className="mt-1 text-xs text-gold/60">{t('lm.requirements.stat.high')}</p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{totalOpen}</p>
          <p className="mt-1 text-xs text-slate-500">{t('lm.requirements.stat.totalOpen')}</p>
        </div>
      </section>

      {/* Filters */}
      <section className="mt-8">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('lm.requirements.searchPlaceholder')}
            className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-9 pr-9 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Severity + Status pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SEVERITY_PILLS.map(({ key, labelKey }) => {
            const tone = key !== 'All' ? severityTone(key) : null
            const isActive = severityFilter === key
            return (
              <button
                key={key}
                onClick={() => setSeverityFilter(key)}
                className={[
                  'rounded-full border px-3 py-1 text-sm font-medium transition',
                  isActive
                    ? key === 'All'
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : tone!.active
                    : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {t(labelKey)}
              </button>
            )
          })}
          <span className="self-center text-slate-600">|</span>
          {STATUS_PILLS.map(({ key, labelKey }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={[
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                statusFilter === key
                  ? key === 'Done'
                    ? 'border-emerald-400/35 bg-gold/10 text-gold'
                    : 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {t(labelKey)}
            </button>
          ))}
          {(query || severityFilter !== 'All' || statusFilter !== 'All') && (
            <button
              onClick={clearFilters}
              className="ml-1 text-sm text-slate-500 transition hover:text-slate-400"
            >
              {t('lm.requirements.clear')}
            </button>
          )}
        </div>

        {/* Count */}
        <p className="mt-2 text-xs text-slate-500">
          {filtered.length === leadMachineRequirements.length
            ? t('lm.requirements.count', { n: String(leadMachineRequirements.length) })
            : t('lm.requirements.countFiltered', { n: String(filtered.length), total: String(leadMachineRequirements.length) })}
        </p>
      </section>

      {/* Requirements list */}
      <section className="mt-6 space-y-4">
        {filtered.length === 0 ? (
          <EmptyState
            Icon={AlertCircle}
            title={t('lm.requirements.noMatch')}
            action={
              <button
                onClick={clearFilters}
                className="rounded-full border border-line px-4 py-1.5 text-xs text-slate-500 transition hover:text-slate-300"
              >
                {t('lm.requirements.clearAll')}
              </button>
            }
          />
        ) : (
          filtered.map((req) => {
            const tone = severityTone(req.severity)
            return (
              <div key={req.id} className={`rounded-[22px] border p-6 ${tone.ring} ${tone.bg}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.ring} ${tone.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {t(tone.labelKey)}
                    </span>
                    <span className="text-sm text-slate-500">{req.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {statusIcon(req.status)}
                    <span className="text-slate-400">{req.status}</span>
                  </div>
                </div>

                <h3 className="mt-3 text-sm font-semibold text-white">{req.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{req.description}</p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>{t('lm.requirements.field.project')} <span className="text-slate-400">{projectName(req.projectId)}</span></span>
                    <span>{t('lm.requirements.field.owner')} <span className="text-slate-400">{req.owner}</span></span>
                    <span>{t('lm.requirements.field.due')} <span className="text-slate-400">{req.dueDate}</span></span>
                  </div>
                  <div className={`text-xs font-medium ${tone.text}`}>→ {req.nextAction}</div>
                </div>

                <Link
                  href={`/freehold-intelligence/lead-machine/listings/${leadMachineListings.find(l => l.projectId === req.projectId)?.id || ''}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-gold"
                >
                  {t('lm.requirements.viewListing')} <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )
          })
        )}
      </section>

    </div>
  )
}
