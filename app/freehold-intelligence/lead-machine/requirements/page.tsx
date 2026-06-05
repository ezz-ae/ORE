'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, ArrowUpRight, Search, X } from 'lucide-react'
import { leadMachineRequirements, leadMachineListings } from '@/src/features/freehold-intelligence/lead-machine'

type SeverityFilter = 'All' | 'critical' | 'high' | 'medium' | 'low'
type StatusFilter   = 'All' | 'Open' | 'Done'

const SEVERITY_PILLS: { key: SeverityFilter; label: string }[] = [
  { key: 'All',      label: 'All'      },
  { key: 'critical', label: 'Critical' },
  { key: 'high',     label: 'High'     },
  { key: 'medium',   label: 'Medium'   },
  { key: 'low',      label: 'Low'      },
]

function severityTone(s: string) {
  if (s === 'critical') return { ring: 'border-red-400/25',      bg: 'bg-red-400/[0.06]',      text: 'text-red-300',      dot: 'bg-red-400',    label: 'Critical', active: 'border-red-400/40 bg-red-400/15 text-red-300' }
  if (s === 'high')     return { ring: 'border-[#D4AF37]/25',    bg: 'bg-[#D4AF37]/[0.05]',   text: 'text-[#F8E7AE]',    dot: 'bg-[#D4AF37]', label: 'High',     active: 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#F8E7AE]' }
  if (s === 'medium')   return { ring: 'border-sky-400/20',      bg: 'bg-sky-400/[0.05]',      text: 'text-sky-200',      dot: 'bg-sky-400',   label: 'Medium',   active: 'border-sky-400/40 bg-sky-400/15 text-sky-200' }
  return                       { ring: 'border-white/[0.08]',    bg: 'bg-[#131B2B]',           text: 'text-white/50',     dot: 'bg-white/30',  label: 'Low',      active: 'border-white/20 bg-white/[0.06] text-white/65' }
}

function statusIcon(s: string) {
  if (s === 'Done')                        return <CheckCircle2 className="h-3.5 w-3.5 text-[#D4AF37]" />
  if (s === 'Needs Access' || s === 'Blocked') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  return <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
}

const projectName = (id: string) => leadMachineListings.find((l) => l.projectId === id)?.projectName || id

export default function RequirementsPage() {
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
      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <AlertCircle className="h-3.5 w-3.5" /> Requirements
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
          {totalOpen} open.
          <br />
          <span className="text-white/35">{criticalCount} critical.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
          Everything blocking landing generation, ad launch, and campaign go-live. Resolve in priority order.
        </p>
      </section>

      {/* Stat tiles */}
      <section className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.06] p-4 text-center">
          <p className="text-[26px] font-semibold text-red-300">{criticalCount}</p>
          <p className="mt-1 text-[12px] text-red-400/60">Critical</p>
        </div>
        <div className="rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#F8E7AE]">{leadMachineRequirements.filter(r => r.severity === 'high').length}</p>
          <p className="mt-1 text-[12px] text-[#D4AF37]/60">High</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{totalOpen}</p>
          <p className="mt-1 text-[12px] text-white/35">Total open</p>
        </div>
      </section>

      {/* Filters */}
      <section className="mt-8">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requirements…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-9 pr-9 text-sm text-white/80 placeholder:text-white/25 focus:border-[#D4AF37]/40 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Severity + Status pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SEVERITY_PILLS.map(({ key, label }) => {
            const tone = key !== 'All' ? severityTone(key) : null
            const isActive = severityFilter === key
            return (
              <button
                key={key}
                onClick={() => setSeverityFilter(key)}
                className={[
                  'rounded-full border px-3 py-1 text-[13px] font-medium transition',
                  isActive
                    ? key === 'All'
                      ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                      : tone!.active
                    : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
          <span className="self-center text-white/15">|</span>
          {(['All', 'Open', 'Done'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'rounded-full border px-3 py-1 text-[13px] font-medium transition',
                statusFilter === s
                  ? s === 'Done'
                    ? 'border-emerald-400/35 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/65',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
          {(query || severityFilter !== 'All' || statusFilter !== 'All') && (
            <button
              onClick={clearFilters}
              className="ml-1 text-[13px] text-white/30 transition hover:text-white/60"
            >
              Clear
            </button>
          )}
        </div>

        {/* Count */}
        <p className="mt-2 text-[12px] text-white/30">
          {filtered.length === leadMachineRequirements.length
            ? `${leadMachineRequirements.length} requirements`
            : `${filtered.length} of ${leadMachineRequirements.length} requirements`}
        </p>
      </section>

      {/* Requirements list */}
      <section className="mt-6 space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-[14px] text-white/35">No requirements match these filters.</p>
            <button
              onClick={clearFilters}
              className="mt-3 rounded-full border border-white/[0.08] px-4 py-1.5 text-[12px] text-white/45 transition hover:text-white/70"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((req) => {
            const tone = severityTone(req.severity)
            return (
              <div key={req.id} className={`rounded-[22px] border p-6 ${tone.ring} ${tone.bg}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${tone.ring} ${tone.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {tone.label}
                    </span>
                    <span className="text-[13px] text-white/30">{req.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px]">
                    {statusIcon(req.status)}
                    <span className="text-white/55">{req.status}</span>
                  </div>
                </div>

                <h3 className="mt-3 text-[15px] font-semibold text-white">{req.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{req.description}</p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                  <div className="flex flex-wrap gap-4 text-[12px] text-white/35">
                    <span>Project: <span className="text-white/55">{projectName(req.projectId)}</span></span>
                    <span>Owner: <span className="text-white/55">{req.owner}</span></span>
                    <span>Due: <span className="text-white/55">{req.dueDate}</span></span>
                  </div>
                  <div className={`text-[12px] font-medium ${tone.text}`}>→ {req.nextAction}</div>
                </div>

                <Link
                  href={`/freehold-intelligence/lead-machine/listings/${leadMachineListings.find(l => l.projectId === req.projectId)?.id || ''}`}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/30 transition hover:text-[#D4AF37]"
                >
                  View listing <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )
          })
        )}
      </section>

    </div>
  )
}
