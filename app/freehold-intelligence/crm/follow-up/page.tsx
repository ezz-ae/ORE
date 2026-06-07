'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Clock, MessageCircle, AlertCircle, CheckCircle, Bell, X } from 'lucide-react'
import { crmFollowUpQueue } from '@/src/features/freehold-intelligence/server-session'
import { PageHeader, StatCard, EmptyState, Panel, PanelHeader } from '@/components/freehold/ui'

type Urgency = 'All' | 'Critical' | 'High' | 'Medium' | 'Low'

function urgencyTone(u: string) {
  if (u === 'critical') return { label: 'Critical', badge: 'bg-red-400/10 border-red-400/25 text-red-300', dot: 'bg-red-400' }
  if (u === 'high')     return { label: 'High',     badge: 'bg-gold/10 border-gold/25 text-[#F8E7AE]', dot: 'bg-gold' }
  if (u === 'medium')   return { label: 'Medium',   badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200', dot: 'bg-sky-400' }
  return { label: 'Low', badge: 'bg-surface-2 border-line-strong text-slate-400', dot: 'bg-slate-500' }
}

function overdueLabel(hours: number) {
  if (hours < 24) return `${hours}h overdue`
  return `${Math.floor(hours / 24)}d overdue`
}

const allAgents = ['All', ...Array.from(new Set(crmFollowUpQueue.map((l) => l.assignedAgent)))]

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

export default function FollowUpQueuePage() {
  const [activeUrgency, setActiveUrgency] = useState<Urgency>('All')
  const [activeAgent, setActiveAgent] = useState<string>('All')
  const [done, setDone] = useState<Set<string>>(new Set())
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash])

  const sortedQueue = useMemo(
    () => [...crmFollowUpQueue].sort((a, b) => b.overdueHours - a.overdueHours),
    [],
  )

  const visible = useMemo(() => {
    return sortedQueue.filter((item) => {
      if (done.has(item.leadId) || snoozed.has(item.leadId)) return false
      if (activeUrgency !== 'All' && item.urgency !== activeUrgency.toLowerCase()) return false
      if (activeAgent !== 'All' && item.assignedAgent !== activeAgent) return false
      return true
    })
  }, [sortedQueue, done, snoozed, activeUrgency, activeAgent])

  const stats = useMemo(() => {
    const active = sortedQueue.filter((l) => !done.has(l.leadId) && !snoozed.has(l.leadId))
    const total = active.length
    const critical = active.filter((l) => l.urgency === 'critical').length
    const avgOverdue = total > 0 ? Math.round(active.reduce((s, l) => s + l.overdueHours, 0) / total) : 0
    return { total, critical, avgOverdue, doneCount: done.size }
  }, [sortedQueue, done, snoozed])

  const byAgent = useMemo(() => {
    const active = sortedQueue.filter((l) => !done.has(l.leadId) && !snoozed.has(l.leadId))
    return active.reduce<Record<string, number>>((acc, l) => {
      acc[l.assignedAgent] = (acc[l.assignedAgent] ?? 0) + 1
      return acc
    }, {})
  }, [sortedQueue, done, snoozed])

  const riskLeads = useMemo(
    () => sortedQueue.filter((l) => !done.has(l.leadId) && !snoozed.has(l.leadId) && (l.duplicateRisk || l.wrongNumberRisk)).length,
    [sortedQueue, done, snoozed],
  )

  function markDone(id: string) {
    setDone((prev) => new Set([...prev, id]))
    setFlash('Marked done')
  }

  function snooze(id: string) {
    setSnoozed((prev) => new Set([...prev, id]))
    setFlash('Snoozed 24h')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:pt-6">
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="min-w-0">

          <PageHeader
            eyebrow="CRM"
            Icon={Clock}
            title="Follow-up queue"
            subtitle={`${stats.total} items · ${stats.critical} critical`}
            className="mb-6"
          />

          {/* Stats strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Overdue"          value={stats.total}     hint="in queue"    />
            <StatCard label="Critical"         value={stats.critical}  hint="act now"     delta={stats.critical > 0 ? { value: 'urgent', direction: 'down' } : undefined} />
            <StatCard label="Avg delay"        value={`${stats.avgOverdue}h`} hint="average hours" />
            <StatCard label="Done this session" value={stats.doneCount} hint="actioned"   delta={stats.doneCount > 0 ? { value: 'completed', direction: 'up' } : undefined} />
          </div>

          {/* Filters */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {urgencyPills.map((pill) => (
              <button
                key={pill}
                onClick={() => setActiveUrgency(pill)}
                className={`rounded-full border px-3.5 py-1 text-xs font-medium transition ${activeUrgency === pill ? urgencyActiveStyle[pill] : urgencyPillStyle[pill]}`}
              >
                {pill}
              </button>
            ))}
            <div className="ml-auto">
              <select
                value={activeAgent}
                onChange={(e) => setActiveAgent(e.target.value)}
                className="rounded-full border border-line-strong bg-surface px-3.5 py-1 text-xs text-slate-400 outline-none transition hover:border-slate-500 hover:text-slate-200 focus:border-slate-500"
              >
                {allAgents.map((a) => (
                  <option key={a} value={a} className="bg-surface">{a === 'All' ? 'All agents' : a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead cards */}
          <div className="mt-6 space-y-3">
            {visible.length === 0 ? (
              <div className="rounded-xl border border-gold/20 bg-gold/[0.03] p-10 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-gold/60" />
                <div className="mt-4 text-[20px] font-semibold text-gold">Queue clear</div>
                <p className="mt-2 text-[14px] text-slate-400">All follow-ups actioned. Great work.</p>
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
                            {tone.label}
                          </span>
                          <span className="text-sm font-medium text-red-300/70">{overdueLabel(item.overdueHours)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                          <span>{item.stage}</span>
                          <span className="text-slate-700">·</span>
                          <span>{item.source}</span>
                          <span className="text-slate-700">·</span>
                          <span>Intent {item.intentScore}</span>
                          <span className="text-slate-700">·</span>
                          <span>{item.assignedAgent}</span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.nextBestAction}</p>
                        {(item.duplicateRisk || item.wrongNumberRisk) && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-200/70">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {item.duplicateRisk && 'Duplicate risk — resolve before contacting. '}
                              {item.wrongNumberRisk && 'Wrong number risk — verify first.'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-col sm:items-end">
                        <button
                          onClick={() => markDone(item.leadId)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.06] px-4 py-2 text-xs font-medium text-gold transition hover:border-emerald-400/50 hover:bg-gold/10"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Mark Done
                        </button>
                        <button
                          onClick={() => snooze(item.leadId)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.05] px-4 py-2 text-xs font-medium text-gold/80 transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold"
                        >
                          <Bell className="h-3.5 w-3.5" /> Snooze 24h
                        </button>
                        <Link
                          href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-4 py-2 text-xs text-slate-300 transition hover:border-gold/30 hover:text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[112px] space-y-4">

            {riskLeads > 0 && (
              <Panel>
                <PanelHeader title="Risk alerts" />
                <div className="p-5">
                  <div className="text-[28px] font-semibold text-orange-300">{riskLeads}</div>
                  <div className="mt-1 text-xs text-slate-400">leads flagged for duplicate or wrong number — resolve before outreach.</div>
                </div>
              </Panel>
            )}

            <Panel>
              <PanelHeader title="Overdue by agent" />
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
