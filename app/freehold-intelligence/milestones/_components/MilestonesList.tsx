'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

type HealthFilter  = 'All' | 'on_track' | 'at_risk' | 'overdue' | 'complete'
type StatusFilter  = 'All' | 'done' | 'in_progress' | 'blocked' | 'planned'

interface Milestone {
  code: string
  title: string
  status: string
  health?: string | null
  owner?: string | null
  deadline: string
  days_to_deadline?: number | null
  progress_pct?: number | null
}

function healthTone(health?: string | null) {
  switch (health) {
    case 'complete':
    case 'on_track': return { dot: 'bg-gold',       text: 'text-gold',       bar: 'bg-gold'      }
    case 'at_risk':  return { dot: 'bg-amber-400',  text: 'text-amber-300',  bar: 'bg-amber-400' }
    case 'overdue':  return { dot: 'bg-red-400',    text: 'text-red-300',    bar: 'bg-red-400'   }
    default:         return { dot: 'bg-slate-500',  text: 'text-slate-400',  bar: 'bg-slate-500' }
  }
}

const STATUS_KEY: Record<string, string> = {
  done: 'pmile.statusValue.done', live: 'pmile.statusValue.done',
  in_progress: 'pmile.statusValue.inProgress', blocked: 'pmile.statusValue.blocked',
}

const HEALTH_PILLS: { key: HealthFilter; labelKey: string }[] = [
  { key: 'All',      labelKey: 'pmile.filterAll'          },
  { key: 'on_track', labelKey: 'pmile.healthValue.on_track' },
  { key: 'at_risk',  labelKey: 'pmile.healthValue.at_risk'  },
  { key: 'overdue',  labelKey: 'pmile.healthValue.overdue'  },
  { key: 'complete', labelKey: 'pmile.healthValue.complete' },
]

const STATUS_PILLS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'All',         labelKey: 'pmile.filterAll'            },
  { key: 'done',        labelKey: 'pmile.statusValue.done'       },
  { key: 'in_progress', labelKey: 'pmile.statusValue.inProgress' },
  { key: 'blocked',     labelKey: 'pmile.statusValue.blocked'    },
  { key: 'planned',     labelKey: 'pmile.statusValue.planned'    },
]

export function MilestonesList({ milestones }: { milestones: Milestone[] }) {
  const { t } = useI18n()
  const statusLabel = (status: string) => t(STATUS_KEY[status] ?? 'pmile.statusValue.planned')
  const [healthFilter,  setHealthFilter]  = useState<HealthFilter>('All')
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('All')

  const filtered = useMemo(() => {
    let items = milestones
    if (healthFilter !== 'All') {
      items = items.filter((m) => {
        if (healthFilter === 'complete') return m.health === 'complete' || m.status === 'done' || m.status === 'live'
        return m.health === healthFilter
      })
    }
    if (statusFilter !== 'All') {
      if (statusFilter === 'done') items = items.filter((m) => m.status === 'done' || m.status === 'live')
      else if (statusFilter === 'planned') items = items.filter((m) => !['done', 'live', 'in_progress', 'blocked'].includes(m.status))
      else items = items.filter((m) => m.status === statusFilter)
    }
    return items
  }, [milestones, healthFilter, statusFilter])

  return (
    <>
      {/* Filter pills */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {HEALTH_PILLS.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => setHealthFilter(key)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium capitalize transition',
              healthFilter === key
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-line bg-surface text-slate-400 hover:text-slate-100',
            ].join(' ')}
          >
            {t(labelKey)}
          </button>
        ))}
        <span className="self-center text-slate-700">|</span>
        {STATUS_PILLS.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition',
              statusFilter === key
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-line bg-surface text-slate-400 hover:text-slate-100',
            ].join(' ')}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {filtered.length === milestones.length
          ? t('pmile.countMilestones', { count: milestones.length })
          : t('pmile.countFiltered', { filtered: filtered.length, total: milestones.length })}
      </p>

      {/* List */}
      <ol className="mt-6 grid gap-3">
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-slate-400">
            {milestones.length === 0 ? (
              t('pmile.emptyRoadmap')
            ) : (
              <>
                {t('pmile.noMatch')}{' '}
                <button
                  onClick={() => { setHealthFilter('All'); setStatusFilter('All') }}
                  className="ml-1 text-gold/60 transition hover:text-gold"
                >
                  {t('pmile.clear')}
                </button>
              </>
            )}
          </li>
        ) : (
          filtered.map((m) => {
            const tone = healthTone(m.health)
            const pct = m.progress_pct ?? 0
            return (
              <li key={m.code}>
                <Link
                  href={`/freehold-intelligence/milestones/${m.code}`}
                  className="group flex items-stretch gap-5 rounded-2xl border border-line bg-surface p-5 transition hover:border-gold/20 hover:bg-surface-2 sm:p-6"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/[0.06] text-sm font-semibold tracking-tight text-gold">
                    {m.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-semibold tracking-tight text-white">{m.title}</h3>
                      <span className={`flex items-center gap-1.5 text-xs ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {statusLabel(m.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-400">
                      <span>{m.owner ?? t('pmile.unassigned')}</span>
                      <span className="text-slate-600">·</span>
                      <span>{m.deadline}</span>
                      {m.days_to_deadline != null && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span>{t('pmile.daysRemaining', { n: m.days_to_deadline })}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 self-center text-slate-500 transition group-hover:text-gold" />
                </Link>
              </li>
            )
          })
        )}
      </ol>
    </>
  )
}
