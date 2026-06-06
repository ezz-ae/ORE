'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

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
    case 'on_track': return { dot: 'bg-[#D4AF37]', text: 'text-[#D4AF37]', bar: 'bg-[#D4AF37]' }
    case 'at_risk':  return { dot: 'bg-[#D4AF37]',  text: 'text-[#F8E7AE]',  bar: 'bg-[#D4AF37]'  }
    case 'overdue':  return { dot: 'bg-red-400',    text: 'text-red-300',    bar: 'bg-red-400'    }
    default:         return { dot: 'bg-slate-500',  text: 'text-slate-400',  bar: 'bg-slate-500'  }
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'done':
    case 'live':        return 'Done'
    case 'in_progress': return 'In progress'
    case 'blocked':     return 'Blocked'
    default:            return 'Planned'
  }
}

const HEALTH_PILLS: { key: HealthFilter; label: string }[] = [
  { key: 'All',      label: 'All'       },
  { key: 'on_track', label: 'On track'  },
  { key: 'at_risk',  label: 'At risk'   },
  { key: 'overdue',  label: 'Overdue'   },
  { key: 'complete', label: 'Complete'  },
]

const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'All',         label: 'All'         },
  { key: 'done',        label: 'Done'        },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked',     label: 'Blocked'     },
  { key: 'planned',     label: 'Planned'     },
]

export function MilestonesList({ milestones }: { milestones: Milestone[] }) {
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
        {HEALTH_PILLS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setHealthFilter(key)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition',
              healthFilter === key
                ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
        <span className="self-center text-slate-700">|</span>
        {STATUS_PILLS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition',
              statusFilter === key
                ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {filtered.length === milestones.length
          ? `${milestones.length} milestones`
          : `${filtered.length} of ${milestones.length} milestones`}
      </p>

      {/* List */}
      <ol className="mt-6 grid gap-3">
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
            No milestones match these filters.{' '}
            <button
              onClick={() => { setHealthFilter('All'); setStatusFilter('All') }}
              className="ml-1 text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
            >
              Clear
            </button>
          </li>
        ) : (
          filtered.map((m) => {
            const tone = healthTone(m.health)
            const pct = m.progress_pct ?? 0
            return (
              <li key={m.code}>
                <Link
                  href={`/freehold-intelligence/milestones/${m.code}`}
                  className="group flex items-stretch gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-[#D4AF37]/20 hover:bg-slate-800/60 sm:p-6"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] text-sm font-semibold tracking-tight text-[#D4AF37]">
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
                      <span>{m.owner ?? 'Unassigned'}</span>
                      <span className="text-slate-600">·</span>
                      <span>{m.deadline}</span>
                      {m.days_to_deadline != null && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span>{m.days_to_deadline}d remaining</span>
                        </>
                      )}
                    </div>
                    <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-slate-800/60">
                      <div className={`h-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 self-center text-slate-500 transition group-hover:text-[#D4AF37]" />
                </Link>
              </li>
            )
          })
        )}
      </ol>
    </>
  )
}
