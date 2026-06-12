'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

type RouteStatus = 'live' | 'pending' | 'planned' | 'down'

interface RouteEntry {
  path: string
  type: 'page' | 'api' | 'layout'
  status: RouteStatus
  note: string
}

type StatusFilter = 'All' | 'live' | 'pending' | 'planned'

const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'All',     label: 'All'     },
  { key: 'live',    label: 'Live'    },
  { key: 'pending', label: 'Pending' },
  { key: 'planned', label: 'Planned' },
]

function statusConfig(s: RouteStatus) {
  if (s === 'live')    return { dot: 'bg-gold', text: 'text-gold', label: 'Live'    }
  if (s === 'pending') return { dot: 'bg-gold', text: 'text-[#F8E7AE]', label: 'Pending' }
  if (s === 'planned') return { dot: 'bg-sky-400',   text: 'text-sky-200',   label: 'Planned' }
  return                      { dot: 'bg-red-400',   text: 'text-red-300',   label: 'Down'    }
}

function StatusIcon({ s }: { s: RouteStatus }) {
  if (s === 'live')    return <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
  if (s === 'pending') return <Clock className="h-3.5 w-3.5 text-gold" />
  if (s === 'planned') return <Clock className="h-3.5 w-3.5 text-slate-400" />
  return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
}

function RouteRow({ route }: { route: RouteEntry }) {
  const st = statusConfig(route.status)
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <StatusIcon s={route.status} />
      <div className="min-w-0 flex-1">
        <code className="block truncate text-xs font-mono text-slate-300">{route.path}</code>
        <p className="mt-0.5 truncate text-sm text-slate-500">{route.note}</p>
      </div>
      <span className={`hidden shrink-0 text-sm font-medium sm:block ${st.text}`}>{st.label}</span>
    </div>
  )
}

export function RouteSections({ routes }: { routes: RouteEntry[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')

  const filtered = useMemo(() => {
    if (statusFilter === 'All') return routes
    return routes.filter((r) => r.status === statusFilter)
  }, [routes, statusFilter])

  const pages  = filtered.filter((r) => r.type === 'page')
  const apis   = filtered.filter((r) => r.type === 'api')
  const gates  = filtered.filter((r) => r.type === 'layout')

  const total = routes.length

  return (
    <>
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_PILLS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={[
              'rounded-full border px-3 py-1 text-sm font-medium transition',
              statusFilter === key
                ? key === 'live'    ? 'border-emerald-400/40 bg-gold/10 text-gold'
                  : key === 'pending' ? 'border-gold/40 bg-gold/10 text-gold'
                  : key === 'planned' ? 'border-sky-400/40 bg-sky-400/10 text-slate-400'
                  : 'border-gold/40 bg-gold/10 text-gold'
                : 'border-line bg-surface-2 text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {filtered.length === total ? `${total} routes` : `${filtered.length} of ${total} routes`}
      </p>

      {/* Pages */}
      {pages.length > 0 && (
        <section className="mt-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Route audit — pages</div>
          <h2 className="mt-1.5 text-lg font-semibold text-white">{pages.length} page route{pages.length !== 1 ? 's' : ''}</h2>
          <div className="mt-4 overflow-hidden rounded-[22px] border border-line bg-surface">
            <div className="divide-y divide-line">
              {pages.map((route) => <RouteRow key={route.path} route={route} />)}
            </div>
          </div>
        </section>
      )}

      {/* APIs */}
      {apis.length > 0 && (
        <section className="mt-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Route audit — API</div>
          <h2 className="mt-1.5 text-lg font-semibold text-white">{apis.length} API route{apis.length !== 1 ? 's' : ''}</h2>
          <div className="mt-4 overflow-hidden rounded-[22px] border border-line bg-surface">
            <div className="divide-y divide-line">
              {apis.map((route) => <RouteRow key={route.path} route={route} />)}
            </div>
          </div>
        </section>
      )}

      {/* Gates */}
      {gates.length > 0 && (
        <section className="mt-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Security gates</div>
          <div className="mt-4 space-y-2">
            {gates.map((gate) => {
              const st = statusConfig(gate.status)
              return (
                <div key={gate.path} className="flex items-start gap-3 rounded-[18px] border border-gold/15 bg-gold/[0.03] p-4">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{gate.path}</div>
                    <p className="mt-0.5 text-xs text-slate-400">{gate.note}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-medium ${st.text}`}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="mt-10 rounded-[22px] border border-line bg-surface-2 px-6 py-14 text-center text-sm text-slate-500">
          No routes match this filter.{' '}
          <button onClick={() => setStatusFilter('All')} className="ml-1 text-gold/60 hover:text-gold">
            Show all
          </button>
        </div>
      )}
    </>
  )
}
