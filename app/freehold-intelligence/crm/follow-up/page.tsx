'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Clock, MessageCircle, AlertCircle, CheckCircle, Bell, X } from 'lucide-react'
import { crmFollowUpQueue } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type Urgency = 'All' | 'Critical' | 'High' | 'Medium' | 'Low'

function urgencyTone(u: string) {
  if (u === 'critical') return { label: 'Critical', badge: 'bg-red-400/10 border-red-400/25 text-red-300', dot: 'bg-red-400' }
  if (u === 'high')     return { label: 'High',     badge: 'bg-[#D4AF37]/10 border-[#D4AF37]/25 text-[#F8E7AE]', dot: 'bg-[#D4AF37]' }
  if (u === 'medium')   return { label: 'Medium',   badge: 'bg-sky-500/10 border-sky-400/25 text-sky-200', dot: 'bg-sky-400' }
  return { label: 'Low', badge: 'bg-white/[0.04] border-white/10 text-white/55', dot: 'bg-white/30' }
}

function overdueLabel(hours: number) {
  if (hours < 24) return `${hours}h overdue`
  return `${Math.floor(hours / 24)}d overdue`
}

const allAgents = ['All', ...Array.from(new Set(crmFollowUpQueue.map((l) => l.assignedAgent)))]

const urgencyPills: Urgency[] = ['All', 'Critical', 'High', 'Medium', 'Low']

const urgencyPillStyle: Record<Urgency, string> = {
  All:      'border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white',
  Critical: 'border-red-400/25 text-red-300/70 hover:border-red-400/50 hover:text-red-300',
  High:     'border-[#D4AF37]/25 text-[#D4AF37]/70 hover:border-[#D4AF37]/50 hover:text-[#D4AF37]',
  Medium:   'border-sky-400/25 text-white/55/70 hover:border-sky-400/50 hover:text-white/55',
  Low:      'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/60',
}

const urgencyActiveStyle: Record<Urgency, string> = {
  All:      'border-white/25 bg-white/[0.06] text-white',
  Critical: 'border-red-400/40 bg-red-400/10 text-red-300',
  High:     'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]',
  Medium:   'border-sky-400/40 bg-sky-400/10 text-white/55',
  Low:      'border-white/20 bg-white/[0.04] text-white/60',
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

          {/* Header */}
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[#D4AF37]/85">
            <Clock className="h-3.5 w-3.5" /> Follow-up Queue
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white/90">
            Overdue<br /><span className="text-white/35">right now.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/55">
            {stats.total} leads past their follow-up window. Sorted by delay — longest first.
          </p>

          {/* Stats strip */}
          <div className="mt-8 grid grid-cols-4 gap-3">
            <div className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
              <div className="text-[26px] font-semibold text-white">{stats.total}</div>
              <div className="mt-0.5 text-[13px] text-white/40">Overdue</div>
            </div>
            <div className="rounded-[18px] border border-red-400/15 bg-red-400/[0.04] p-5">
              <div className="text-[26px] font-semibold text-red-400">{stats.critical}</div>
              <div className="mt-0.5 text-[13px] text-white/40">Critical</div>
            </div>
            <div className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
              <div className="text-[26px] font-semibold text-white">{stats.avgOverdue}<span className="text-[14px] font-normal text-white/40">h</span></div>
              <div className="mt-0.5 text-[13px] text-white/40">Avg delay</div>
            </div>
            <div className="rounded-[18px] border border-emerald-400/15 bg-[#D4AF37]/[0.04] p-5">
              <div className="text-[26px] font-semibold text-[#D4AF37]">{stats.doneCount}</div>
              <div className="mt-0.5 text-[13px] text-white/40">Done this session</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {urgencyPills.map((pill) => (
              <button
                key={pill}
                onClick={() => setActiveUrgency(pill)}
                className={`rounded-full border px-3.5 py-1 text-[12px] font-medium transition ${activeUrgency === pill ? urgencyActiveStyle[pill] : urgencyPillStyle[pill]}`}
              >
                {pill}
              </button>
            ))}
            <div className="ml-auto">
              <select
                value={activeAgent}
                onChange={(e) => setActiveAgent(e.target.value)}
                className="rounded-full border border-white/[0.08] bg-[#131B2B] px-3.5 py-1 text-[12px] text-white/60 outline-none transition hover:border-white/20 hover:text-white focus:border-white/20"
              >
                {allAgents.map((a) => (
                  <option key={a} value={a} className="bg-[#131B2B]">{a === 'All' ? 'All agents' : a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead cards */}
          <div className="mt-6 space-y-3">
            {visible.length === 0 ? (
              <div className="rounded-[22px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.03] p-10 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-[#D4AF37]/60" />
                <div className="mt-4 text-[20px] font-semibold text-[#D4AF37]">Queue clear</div>
                <p className="mt-2 text-[14px] text-white/45">All follow-ups actioned. Great work.</p>
              </div>
            ) : (
              visible.map((item) => {
                const tone = urgencyTone(item.urgency)
                return (
                  <div key={item.leadId} className="rounded-[22px] border border-white/[0.08] bg-[#131B2B] p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                            className="text-[18px] font-semibold tracking-tight text-white transition hover:text-[#D4AF37]"
                          >
                            {item.leadName}
                          </Link>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${tone.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                            {tone.label}
                          </span>
                          <span className="text-[13px] font-medium text-red-300/70">{overdueLabel(item.overdueHours)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-white/40">
                          <span>{item.stage}</span>
                          <span className="text-white/20">·</span>
                          <span>{item.source}</span>
                          <span className="text-white/20">·</span>
                          <span>Intent {item.intentScore}</span>
                          <span className="text-white/20">·</span>
                          <span>{item.assignedAgent}</span>
                        </div>
                        <p className="mt-3 text-[13px] leading-relaxed text-white/65">{item.nextBestAction}</p>
                        {(item.duplicateRisk || item.wrongNumberRisk) && (
                          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-orange-200/70">
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] px-4 py-2 text-[12px] font-medium text-[#D4AF37] transition hover:border-emerald-400/50 hover:bg-[#D4AF37]/10"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Mark Done
                        </button>
                        <button
                          onClick={() => snooze(item.leadId)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] px-4 py-2 text-[12px] font-medium text-[#D4AF37]/80 transition hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
                        >
                          <Bell className="h-3.5 w-3.5" /> Snooze 24h
                        </button>
                        <Link
                          href={`/freehold-intelligence/crm/leads/${item.leadId}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] text-white/70 transition hover:border-[#D4AF37]/30 hover:text-white"
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
              <div className="rounded-[20px] border border-orange-500/20 bg-orange-500/[0.04] p-5">
                <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-orange-300/70">Risk alerts</div>
                <div className="mt-2 text-[28px] font-semibold text-orange-300">{riskLeads}</div>
                <div className="mt-1 text-[12px] text-white/50">leads flagged for duplicate or wrong number — resolve before outreach.</div>
              </div>
            )}

            <div className="rounded-[20px] border border-white/[0.08] bg-[#131B2B] p-5">
              <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">Overdue by agent</div>
              <div className="space-y-2">
                {Object.entries(byAgent).sort((a, b) => b[1] - a[1]).map(([agent, count]) => (
                  <div key={agent} className="flex items-center justify-between text-[13px]">
                    <span className="text-white/65">{agent}</span>
                    <span className="font-medium tabular-nums text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <AiPrompt
              placeholder="Ask about follow-ups…"
              suggestions={[
                'Which leads are most overdue?',
                'Draft a follow-up for the most critical lead.',
                'Which agent has the most overdue follow-ups?',
              ]}
            />

          </div>
        </aside>
      </div>

      {/* Flash banner */}
      {flash && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#131B2B]/95 px-5 py-3 shadow-2xl backdrop-blur-sm">
            <CheckCircle className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-[13px] font-medium text-white">{flash}</span>
            <button onClick={() => setFlash(null)} className="ml-1 text-white/40 transition hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
