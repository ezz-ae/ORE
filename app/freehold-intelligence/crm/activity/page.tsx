'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Activity,
  PhoneCall,
  MessageCircle,
  FileText,
  ArrowLeftRight,
  UserCog,
  Bell,
  Zap,
} from 'lucide-react'
import { crmActivityLog, type CRMActivityEvent } from '@/src/features/freehold-intelligence/server-session'
import { PageHeader, StatCard, Panel, EmptyState } from '@/components/freehold/ui'

// ─── Supplemental static events to enrich the timeline ────────────────────────

const EXTRA_EVENTS: CRMActivityEvent[] = [
  {
    id: 'act_015',
    leadId: 'inbox_004',
    leadName: 'Mohammed Al-Farsi',
    type: 'call',
    actor: 'Ahmad K.',
    content: 'First contact. Budget confirmed at AED 3M+. Interested in Palm or Creek Beach. Fast decision-maker — will decide within the week.',
    outcome: 'connected',
    durationMin: 18,
    createdAt: '2026-06-05T08:10:00+04:00',
  },
  {
    id: 'act_016',
    leadId: 'inbox_001',
    leadName: 'Fatima Al-Rashidi',
    type: 'assignment',
    actor: 'system',
    content: 'Lead assigned to Sara M. based on Golden Visa and beachfront specialty match.',
    createdAt: '2026-06-05T07:45:00+04:00',
  },
  {
    id: 'act_017',
    leadId: 'inbox_001',
    leadName: 'Fatima Al-Rashidi',
    type: 'whatsapp',
    actor: 'Sara M.',
    content: 'Sent Emaar Beachfront overview with ROI breakdown and Golden Visa eligibility note.',
    createdAt: '2026-06-05T08:30:00+04:00',
  },
  {
    id: 'act_018',
    leadId: 'lead_005',
    leadName: 'Priya Nair',
    type: 'note',
    actor: 'Sara M.',
    content: 'Creek Beach shortlisted as primary option — eligibility threshold confirmed, now comparing payment plans.',
    createdAt: '2026-06-05T09:00:00+04:00',
  },
  {
    id: 'act_019',
    leadId: 'lead_001',
    leadName: 'Rami Haddad',
    type: 'follow_up',
    actor: 'system',
    content: 'Automated reminder: Payment plan comparison sent 4 hours ago — no reply yet. Consider a follow-up call this afternoon.',
    createdAt: '2026-06-05T13:30:00+04:00',
  },
  {
    id: 'act_020',
    leadId: 'inbox_002',
    leadName: 'Dominic Okafor',
    type: 'assignment',
    actor: 'system',
    content: 'Lead assigned to Omar. International timezone — WhatsApp message recommended before calling.',
    createdAt: '2026-06-04T10:00:00+04:00',
  },
  {
    id: 'act_021',
    leadId: 'inbox_002',
    leadName: 'Dominic Okafor',
    type: 'whatsapp',
    actor: 'Omar',
    content: 'Sent Palm Q2 investor summary with payment plan and yield data via WhatsApp.',
    createdAt: '2026-06-04T10:15:00+04:00',
  },
  {
    id: 'act_022',
    leadId: 'lead_004',
    leadName: 'Abdullah Al-Mansoori',
    type: 'stage_change',
    actor: 'Ahmad K.',
    content: 'Stage moved: New → Qualified. Interest confirmed in Dubai Hills 70/30 plan. Brochure sent.',
    createdAt: '2026-06-04T11:00:00+04:00',
  },
  {
    id: 'act_023',
    leadId: 'lead_002',
    leadName: 'Sara Khan',
    type: 'system',
    actor: 'system',
    content: 'Duplicate risk resolved — records merged. Original source retained as primary.',
    createdAt: '2026-06-03T18:00:00+04:00',
  },
  {
    id: 'act_024',
    leadId: 'inbox_003',
    leadName: 'Anita Sharma',
    type: 'call',
    actor: 'Layla',
    content: 'Qualification call — discussed JVC vs Dubai Hills. School proximity is a key factor. Sent school zone map.',
    outcome: 'connected',
    durationMin: 14,
    createdAt: '2026-06-03T11:00:00+04:00',
  },
]

// ─── Merged log ────────────────────────────────────────────────────────────────

const ALL_EVENTS: CRMActivityEvent[] = [...crmActivityLog, ...EXTRA_EVENTS]

// ─── Types ─────────────────────────────────────────────────────────────────────

type FilterLabel = 'All' | 'Call' | 'Message' | 'Stage Change' | 'Assignment' | 'Note' | 'Alert' | 'System'

type FilterDef = {
  label: FilterLabel
  types: CRMActivityEvent['type'][]
}

const FILTERS: FilterDef[] = [
  { label: 'All',          types: [] },
  { label: 'Call',         types: ['call'] },
  { label: 'Message',      types: ['whatsapp'] },
  { label: 'Stage Change', types: ['stage_change'] },
  { label: 'Assignment',   types: ['assignment'] },
  { label: 'Note',         types: ['note'] },
  { label: 'Alert',        types: ['follow_up'] },
  { label: 'System',       types: ['system'] },
]

// ─── Event config ──────────────────────────────────────────────────────────────

type EventConfig = {
  Icon: typeof PhoneCall
  label: string
  iconColor: string
  iconBg: string
  badgeColor: string
}

const TYPE_CONFIG: Record<CRMActivityEvent['type'], EventConfig> = {
  call: {
    Icon: PhoneCall,
    label: 'Call',
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10 border-gold/20',
    badgeColor: 'border-gold/20 bg-gold/10 text-gold',
  },
  whatsapp: {
    Icon: MessageCircle,
    label: 'Message',
    iconColor: 'text-slate-400',
    iconBg: 'bg-sky-400/10 border-sky-400/20',
    badgeColor: 'border-sky-400/20 bg-sky-400/10 text-slate-400',
  },
  note: {
    Icon: FileText,
    label: 'Note',
    iconColor: 'text-slate-400',
    iconBg: 'bg-surface-2 border-line-strong',
    badgeColor: 'border-line-strong bg-surface-2 text-slate-400',
  },
  stage_change: {
    Icon: ArrowLeftRight,
    label: 'Stage Change',
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10 border-gold/20',
    badgeColor: 'border-gold/20 bg-gold/10 text-gold',
  },
  assignment: {
    Icon: UserCog,
    label: 'Assignment',
    iconColor: 'text-slate-400',
    iconBg: 'bg-violet-400/10 border-violet-400/20',
    badgeColor: 'border-violet-400/20 bg-violet-400/10 text-slate-400',
  },
  follow_up: {
    Icon: Bell,
    label: 'Alert',
    iconColor: 'text-amber-300',
    iconBg: 'bg-amber-400/10 border-amber-400/20',
    badgeColor: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  },
  system: {
    Icon: Zap,
    label: 'System',
    iconColor: 'text-slate-400',
    iconBg: 'bg-rose-400/10 border-rose-400/20',
    badgeColor: 'border-rose-400/20 bg-rose-400/10 text-slate-400',
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

const TODAY    = '2026-06-05'
const YESTERDAY = '2026-06-04'

function dateLabel(key: string): string {
  if (key === TODAY)     return 'Today'
  if (key === YESTERDAY) return 'Yesterday'
  return new Date(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
  })
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function OutcomeChip({ outcome }: { outcome?: string }) {
  if (!outcome) return null
  const map: Record<string, string> = {
    connected:         'border-gold/20 bg-gold/10 text-gold',
    no_answer:         'border-line-strong bg-surface-2 text-slate-400',
    progressed:        'border-gold/20 bg-gold/10 text-gold',
    callback_requested:'border-sky-400/20 bg-sky-400/10 text-slate-400',
    not_interested:    'border-rose-400/20 bg-rose-400/10 text-slate-400',
  }
  const label: Record<string, string> = {
    connected:          'Connected',
    no_answer:          'No answer',
    progressed:         'Progressed',
    callback_requested: 'Callback requested',
    not_interested:     'Not interested',
  }
  const cls = map[outcome] ?? 'border-line-strong bg-surface-2 text-slate-400'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label[outcome] ?? outcome}
    </span>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'border-gold/40 bg-gold/10 text-gold'
          : 'border-line-strong bg-surface-2 text-slate-400 hover:border-slate-500 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

function EventCard({
  event,
  isLast,
  mounted,
}: {
  event: CRMActivityEvent
  isLast: boolean
  mounted: boolean
}) {
  const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.system
  const { Icon } = cfg

  return (
    <div className="relative flex gap-5">
      {/* Vertical connector line */}
      <div className="relative flex shrink-0 flex-col items-center">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${cfg.iconBg} z-10 shrink-0`}>
          <Icon className={`h-4.5 w-4.5 ${cfg.iconColor}`} strokeWidth={1.8} />
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-surface-2" style={{ minHeight: '24px' }} />
        )}
      </div>

      {/* Card */}
      <div className="mb-4 min-w-0 flex-1 rounded-xl border border-line bg-surface px-5 py-4">
        {/* Top row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${cfg.badgeColor}`}>
            {cfg.label}
          </span>
          <Link
            href={`/freehold-intelligence/crm/leads/${event.leadId}`}
            className="text-[14px] font-semibold text-white transition-colors hover:text-gold"
          >
            {event.leadName}
          </Link>
          {typeof event.durationMin === 'number' && event.durationMin > 0 && (
            <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-xs text-slate-500">
              {event.durationMin} min
            </span>
          )}
          <OutcomeChip outcome={event.outcome} />
        </div>

        {/* Content */}
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{event.content}</p>

        {/* Footer */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-500">
          <span className="font-medium text-slate-400">{event.actor === 'system' ? 'System' : event.actor}</span>
          <span>·</span>
          <span title={formatTimestamp(event.createdAt)}>{mounted ? timeAgo(event.createdAt) : formatTimestamp(event.createdAt)}</span>
          <span>·</span>
          <span>{formatTimestamp(event.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar breakdown ─────────────────────────────────────────────────────────

function BreakdownList({
  title,
  items,
}: {
  title: string
  items: { label: string; count: number; color?: string }[]
}) {
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-slate-400">{item.label}</span>
              <span className="text-xs font-semibold text-slate-300">{item.count}</span>
            </div>
            <div className="h-[3px] rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  backgroundColor: item.color ?? '#D4AF37',
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CrmActivityPage() {
  const [activeFilter, setActiveFilter] = useState<FilterLabel>('All')
  // Relative times depend on Date.now(); compute only after mount to avoid SSR/client hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Pre-sort all events newest first
  const sortedAll = useMemo(
    () => [...ALL_EVENTS].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    []
  )

  // Filtered events
  const filtered = useMemo(() => {
    if (activeFilter === 'All') return sortedAll
    const filterDef = FILTERS.find((f) => f.label === activeFilter)
    if (!filterDef || filterDef.types.length === 0) return sortedAll
    return sortedAll.filter((e) => filterDef.types.includes(e.type))
  }, [activeFilter, sortedAll])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, CRMActivityEvent[]>()
    for (const event of filtered) {
      const key = toDateKey(event.createdAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  // Stats
  const stats = useMemo(() => {
    const todayEvents = sortedAll.filter((e) => e.createdAt.startsWith(TODAY))
    return {
      total:        sortedAll.length,
      callsToday:   todayEvents.filter((e) => e.type === 'call').length,
      messagesToday:todayEvents.filter((e) => e.type === 'whatsapp').length,
      stageChanges: sortedAll.filter((e) => e.type === 'stage_change').length,
    }
  }, [sortedAll])

  // Sidebar: by agent
  const byAgent = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of sortedAll) {
      const key = e.actor === 'system' ? 'System' : e.actor
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [sortedAll])

  // Sidebar: by type
  const byType = useMemo(() => {
    const map = new Map<string, number>()
    const colorMap: Record<string, string> = {
      call: '#6ee7b7', whatsapp: '#7dd3fc', note: '#ffffff',
      stage_change: '#D4AF37', assignment: '#c4b5fd', follow_up: '#fcd34d', system: '#fda4af',
    }
    for (const e of sortedAll) {
      map.set(e.type, (map.get(e.type) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({
        label: TYPE_CONFIG[label as CRMActivityEvent['type']]?.label ?? label,
        count,
        color: colorMap[label] ?? '#D4AF37',
      }))
      .sort((a, b) => b.count - a.count)
  }, [sortedAll])

  return (
    <div className="min-h-screen bg-surface px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="mx-auto max-w-6xl">

        <PageHeader
          eyebrow="CRM"
          Icon={Activity}
          title="Activity Log"
          subtitle={`${sortedAll.length} events — every call, message, note and stage change in order.`}
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={stats.total}         label="Total events" />
          <StatCard value={stats.callsToday}    label="Calls today"    delta={{ value: 'today', direction: 'up' }} />
          <StatCard value={stats.messagesToday} label="Messages today" hint="via WhatsApp" />
          <StatCard value={stats.stageChanges}  label="Stage changes"  delta={{ value: 'all time', direction: 'flat' }} />
        </div>

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.label}
              label={f.label}
              active={activeFilter === f.label}
              onClick={() => setActiveFilter(f.label)}
            />
          ))}
        </div>

        {/* ── Main layout: timeline + sidebar ───────────────────────────────── */}
        <div className="mt-10 lg:grid lg:grid-cols-[1fr_280px] lg:gap-10">

          {/* ── Timeline ──────────────────────────────────────────────────── */}
          <div>
            {grouped.length === 0 ? (
              <EmptyState
                Icon={Activity}
                title="No events match this filter"
                description="Try selecting a different filter type above."
              />
            ) : (
              grouped.map(([dateKey, events]) => (
                <div key={dateKey} className="mb-8">
                  {/* Date group header */}
                  <div className="mb-5 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {dateLabel(dateKey)}
                    </span>
                    <span className="flex-1 border-t border-line" />
                    <span className="rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-sm text-slate-500">
                      {events.length}
                    </span>
                  </div>

                  {/* Events */}
                  <div>
                    {events.map((event, idx) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        isLast={idx === events.length - 1}
                        mounted={mounted}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-6">
              <Panel className="p-6">
                <BreakdownList title="By agent" items={byAgent} />
              </Panel>
              <Panel className="p-6">
                <BreakdownList title="By type" items={byType} />
              </Panel>
              <Panel className="p-6">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Legend</div>
                <div className="space-y-2.5">
                  {(Object.entries(TYPE_CONFIG) as [CRMActivityEvent['type'], EventConfig][]).map(([, cfg]) => {
                    const { Icon } = cfg
                    return (
                      <div key={cfg.label} className="flex items-center gap-2.5">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${cfg.iconBg}`}>
                          <Icon className={`h-3 w-3 ${cfg.iconColor}`} strokeWidth={2} />
                        </div>
                        <span className="text-xs text-slate-400">{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </div>
          </aside>

        </div>
      </div>
    </div>
  )
}
