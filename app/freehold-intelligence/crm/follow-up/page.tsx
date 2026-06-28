'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Clock, MessageCircle, AlertCircle, CheckCircle, Bell, BellOff, X } from 'lucide-react'
import type { CRMFollowUpItem } from '@/src/features/freehold-intelligence/server-session'
import { useLiveLeads } from '@/lib/freehold/use-live-leads'
import { PageHeader, StatCard, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type TFn = (key: string, vars?: Record<string, string | number>) => string

type Urgency = 'All' | 'Critical' | 'High' | 'Medium' | 'Low'

const SNOOZE_OPTIONS: { labelKey: string; hours: number }[] = [
  { labelKey: 'crm.snooze4h', hours: 4 },
  { labelKey: 'crm.snooze24hOpt', hours: 24 },
  { labelKey: 'crm.snooze3d', hours: 72 },
  { labelKey: 'crm.snooze7d', hours: 168 },
]

function urgencyTone(u: string) {
  if (u === 'critical') return { labelKey: 'crm.urgency.critical', badge: 'bg-red-400/10 border-red-400/25 text-red-300', dot: 'bg-red-400' }
  if (u === 'high')     return { labelKey: 'crm.urgency.high',     badge: 'bg-gold/10 border-gold/25 text-[#F8E7AE]', dot: 'bg-gold' }
  if (u === 'medium')   return { labelKey: 'crm.urgency.medium',   badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200', dot: 'bg-sky-400' }
  return { labelKey: 'crm.urgency.low', badge: 'bg-surface-2 border-line-strong text-slate-400', dot: 'bg-slate-500' }
}

function overdueLabel(hours: number, t: TFn) {
  if (hours < 24) return t('crm.hOverdue', { hours })
  return t('crm.dOverdue', { days: Math.floor(hours / 24) })
}

function snoozeLabel(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'now'
  const h = Math.round(ms / (60 * 60 * 1000))
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
}

const URGENCY_PILL_KEY: Record<Urgency, string> = {
  All:      'crm.allUrgency',
  Critical: 'crm.urgency.critical',
  High:     'crm.urgency.high',
  Medium:   'crm.urgency.medium',
  Low:      'crm.urgency.low',
}

const urgencyPills: Urgency[] = ['All', 'Critical', 'High', 'Medium', 'Low']

const urgencyPillStyle: Record<Urgency, string> = {
  All:      'border-line-strong text-slate-400 hover:border-slate-500 hover:text-slate-200',
  Critical: 'border-red-400/25 text-red-300/70 hover:border-red-400/50 hover:text-red-300',
  High:     'border-gold/25 text-gold/70 hover:border-gold/50 hover:text-gold',
  Medium:   'border-sky-400/25 text-slate-400 hover:border-sky-400/50 hover:text-sky-200',
  Low:      'border-line-strong text-slate-500 hover:border-slate-500 hover:text-slate-300',
}

const urgencyActiveStyle: Record<Urgency, string> = {
  All:      'border-slate-500 bg-surface-2 text-white',
  Critical: 'border-red-400/40 bg-red-400/10 text-red-300',
  High:     'border-gold/40 bg-gold/10 text-gold',
  Medium:   'border-sky-400/40 bg-sky-400/10 text-sky-200',
  Low:      'border-line-strong bg-surface-2 text-slate-300',
}

type QueueItem = CRMFollowUpItem & { snoozeUntil: string | null }

export default function FollowUpQueuePage() {
  const t = useT()
  const { leads } = useLiveLeads()
  const [activeUrgency, setActiveUrgency] = useState<Urgency>('All')
  const [activeAgent, setActiveAgent] = useState<string>('All')
  const [done, setDone] = useState<Set<string>>(new Set())
  // Optimistic snooze overrides keyed by lead id (ISO string or null = cleared)
  const [snoozeOverrides, setSnoozeOverrides] = useState<Record<string, string | null>>({})
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(timer)
  }, [flash])

  const effectiveSnooze = (id: string, fallback: string | null) =>
    id in snoozeOverrides ? snoozeOverrides[id] : fallback
  const isSnoozed = (iso: string | null) => !!iso && new Date(iso).getTime() > Date.now()

  // Map live leads in contacted/qualified stages to the follow-up queue shape
  const followUpQueue = useMemo<QueueItem[]>(() => {
    const NOW_MS = Date.now()
    return leads
      .filter((l) => l.pipelineStage === 'contacted' || l.pipelineStage === 'qualified')
      .map((l) => {
        const lastMs   = new Date(l.lastContactAt).getTime()
        const dueMs    = lastMs + 72 * 60 * 60 * 1000 // 72h follow-up window
        const overdue  = Math.max(0, Math.round((NOW_MS - dueMs) / (60 * 60 * 1000)))
        return {
          leadId:        l.id,
          leadName:      l.name,
          phone:         l.phone,
          assignedAgent: l.assignedAgent,
          urgency:       l.urgency,
          intentScore:   l.intentScore,
          stage:         l.stage,
          source:        l.source,
          lastContactAt: l.lastContactAt,
          dueAt:         new Date(dueMs).toISOString(),
          overdueHours:  overdue,
          nextBestAction: l.nextBestAction,
          duplicateRisk: l.duplicateRisk,
          wrongNumberRisk: l.wrongNumberRisk,
          snoozeUntil:   effectiveSnooze(l.id, l.snoozeUntil ?? null),
        } satisfies QueueItem
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, snoozeOverrides])

  const allAgents = useMemo(
    () => ['All', ...Array.from(new Set(followUpQueue.map((l) => l.assignedAgent)))],
    [followUpQueue],
  )

  const sortedQueue = useMemo(
    () => [...followUpQueue].sort((a, b) => b.overdueHours - a.overdueHours),
    [followUpQueue],
  )

  const visible = useMemo(() => {
    return sortedQueue.filter((item) => {
      if (done.has(item.leadId) || isSnoozed(item.snoozeUntil)) return false
      if (activeUrgency !== 'All' && item.urgency !== activeUrgency.toLowerCase()) return false
      if (activeAgent !== 'All' && item.assignedAgent !== activeAgent) return false
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedQueue, done, activeUrgency, activeAgent])

  const snoozedList = useMemo(
    () => sortedQueue.filter((item) => !done.has(item.leadId) && isSnoozed(item.snoozeUntil)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedQueue, done],
  )

  const stats = useMemo(() => {
    const active = sortedQueue.filter((l) => !done.has(l.leadId) && !isSnoozed(l.snoozeUntil))
    const total = active.length
    const critical = active.filter((l) => l.urgency === 'critical').length
    const avgOverdue = total > 0 ? Math.round(active.reduce((s, l) => s + l.overdueHours, 0) / total) : 0
    return { total, critical, avgOverdue, snoozedCount: snoozedList.length }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedQueue, done, snoozedList])

  const byAgent = useMemo(() => {
    const active = sortedQueue.filter((l) => !done.has(l.leadId) && !isSnoozed(l.snoozeUntil))
    return active.reduce<Record<string, number>>((acc, l) => {
      acc[l.assignedAgent] = (acc[l.assignedAgent] ?? 0) + 1
      return acc
    }, {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedQueue, done])

  const riskLeads = useMemo(
    () => sortedQueue.filter((l) => !done.has(l.leadId) && !isSnoozed(l.snoozeUntil) && (l.duplicateRisk || l.wrongNumberRisk)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedQueue, done],
  )

  function markDone(id: string) {
    setDone((prev) => new Set([...prev, id]))
    setFlash(t('crm.markedDone'))
    // Persist: logging contact now resets the 72h follow-up window so the lead
    // legitimately leaves the overdue queue.
    fetch(`/api/freehold/crm/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_contact_at: new Date().toISOString() }),
    }).catch(() => {})
  }

  async function persistSnooze(id: string, iso: string | null) {
    try {
      await fetch(`/api/freehold/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snooze_until: iso }),
      })
    } catch {
      setFlash(t('crm.couldNotSaveSnooze'))
    }
  }

  function snooze(id: string, hours: number) {
    const iso = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    setSnoozeOverrides((p) => ({ ...p, [id]: iso }))
    setFlash(t('crm.snoozedFor', { time: hours < 24 ? `${hours}h` : `${hours / 24}d` }))
    persistSnooze(id, iso)
  }

  function unsnooze(id: string) {
    setSnoozeOverrides((p) => ({ ...p, [id]: null }))
    setFlash(t('crm.unSnoozed'))
    persistSnooze(id, null)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="min-w-0">

          <PageHeader
            eyebrow={t('crm.crm')}
            Icon={Clock}
            title={t('crm.followUpQueue')}
            subtitle={t('crm.followUpSubtitle', { total: stats.total, critical: stats.critical })}
            className="mb-6"
          />

          {/* Stats strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t('crm.statOverdue')}   value={stats.total}     hint={t('crm.statInQueue')}    />
            <StatCard label={t('crm.statCritical')}  value={stats.critical}  hint={t('crm.statActNow')}     delta={stats.critical > 0 ? { value: t('crm.statUrgentLabel'), direction: 'down' } : undefined} />
            <StatCard label={t('crm.statAvgDelay')}  value={t('crm.statAvgDelayValue', { hours: stats.avgOverdue })} hint={t('crm.statAverageHours')} />
            <StatCard label={t('crm.statSnoozed')}   value={stats.snoozedCount} hint={t('crm.statScheduledLater')} />
          </div>

          {/* Filters */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {urgencyPills.map((pill) => (
              <button
                key={pill}
                onClick={() => setActiveUrgency(pill)}
                className={`rounded-full border px-3.5 py-1 text-xs font-medium transition ${activeUrgency === pill ? urgencyActiveStyle[pill] : urgencyPillStyle[pill]}`}
              >
                {t(URGENCY_PILL_KEY[pill])}
              </button>
            ))}
            <div className="ml-auto">
              <select
                value={activeAgent}
                onChange={(e) => setActiveAgent(e.target.value)}
                className="rounded-full border border-line-strong bg-surface px-3.5 py-1 text-xs text-slate-400 outline-none transition hover:border-slate-500 hover:text-slate-200 focus:border-slate-500"
              >
                {allAgents.map((a) => (
                  <option key={a} value={a} className="bg-surface">{a === 'All' ? t('crm.allAgents') : a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead cards */}
          <div className="mt-6 space-y-3">
            {visible.length === 0 ? (
              <div className="rounded-xl border border-gold/20 bg-gold/[0.03] p-10 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-gold/60" />
                <div className="mt-4 text-[20px] font-semibold text-gold">{t('crm.queueClear')}</div>
                <p className="mt-2 text-[14px] text-slate-400">{t('crm.queueClearDesc')}</p>
              </div>
            ) : (
              visible.map((item) => {
                const tone = urgencyTone(item.urgency)
                return (
                  <div key={item.leadId} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                            className="text-[18px] font-semibold tracking-tight text-white transition hover:text-gold"
                          >
                            {item.leadName}
                          </Link>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                            {t(tone.labelKey)}
                          </span>
                          <span className="text-sm font-medium text-red-300/70">{overdueLabel(item.overdueHours, t)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                          <span>{item.stage}</span>
                          <span className="text-slate-700">·</span>
                          <span>{item.source}</span>
                          <span className="text-slate-700">·</span>
                          <span>{t('crm.intentLabel', { score: item.intentScore })}</span>
                          <span className="text-slate-700">·</span>
                          <span>{item.assignedAgent}</span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.nextBestAction}</p>
                        {(item.duplicateRisk || item.wrongNumberRisk) && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-200/70">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {item.duplicateRisk && t('crm.duplicateRiskShort')}
                              {item.wrongNumberRisk && t('crm.wrongNumberRiskShort')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-col sm:items-end">
                        <button
                          onClick={() => markDone(item.leadId)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.06] px-4 py-2 text-xs font-medium text-gold transition hover:border-emerald-400/50 hover:bg-gold/10"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> {t('crm.markDone')}
                        </button>
                        <SnoozeControl onPick={(h) => snooze(item.leadId, h)} />
                        <Link
                          href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-4 py-2 text-xs text-slate-300 transition hover:border-gold/30 hover:text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> {t('crm.whatsapp')}
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Snoozed section — editable */}
          {snoozedList.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Bell className="h-3.5 w-3.5" /> {t('crm.snoozedCount', { count: snoozedList.length })}
              </div>
              <div className="space-y-2">
                {snoozedList.map((item) => (
                  <div key={item.leadId} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
                    <Link href={`/freehold-intelligence/crm/leads/${item.leadId}`} className="text-sm font-medium text-slate-200 transition hover:text-gold">
                      {item.leadName}
                    </Link>
                    <span className="text-xs text-slate-500">{t('crm.wakesIn', { time: item.snoozeUntil ? snoozeLabel(item.snoozeUntil) : '—' })}</span>
                    <span className="text-xs text-slate-600">· {item.assignedAgent}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <SnoozeControl label={t('crm.reschedule')} onPick={(h) => snooze(item.leadId, h)} />
                      <button
                        onClick={() => unsnooze(item.leadId)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs text-slate-300 transition hover:border-gold/30 hover:text-white"
                      >
                        <BellOff className="h-3.5 w-3.5" /> {t('crm.unSnooze')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-4">

            {riskLeads > 0 && (
              <Panel>
                <PanelHeader title={t('crm.riskAlerts')} />
                <div className="p-5">
                  <div className="text-[28px] font-semibold text-orange-300">{riskLeads}</div>
                  <div className="mt-1 text-xs text-slate-400">{t('crm.riskAlertsDesc')}</div>
                </div>
              </Panel>
            )}

            <Panel>
              <PanelHeader title={t('crm.overdueByAgent')} />
              <div className="p-5">
                <div className="space-y-2">
                  {Object.entries(byAgent).sort((a, b) => b[1] - a[1]).map(([agent, count]) => (
                    <div key={agent} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{agent}</span>
                      <span className="font-medium tabular-nums text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>


          </div>
        </aside>
      </div>

      {/* Flash banner */}
      {flash && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full border border-line-strong bg-surface px-5 py-3 shadow-2xl backdrop-blur-sm">
            <CheckCircle className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium text-white">{flash}</span>
            <button onClick={() => setFlash(null)} className="ml-1 text-slate-500 transition hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SnoozeControl({ onPick, label }: { onPick: (hours: number) => void; label?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const resolvedLabel = label ?? t('crm.snooze')
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.05] px-4 py-2 text-xs font-medium text-gold/80 transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold"
      >
        <Bell className="h-3.5 w-3.5" /> {resolvedLabel}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line-strong bg-surface shadow-xl">
            {SNOOZE_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                onClick={() => { onPick(opt.hours); setOpen(false) }}
                className="block w-full px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-surface-2 hover:text-white"
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
