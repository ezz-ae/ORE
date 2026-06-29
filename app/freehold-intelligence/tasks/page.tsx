'use client'

import { useState, useMemo, useEffect } from 'react'
import { CheckSquare, AlertCircle, Clock, CheckCircle2, User, ArrowUpRight, Sparkles, Plus, X } from 'lucide-react'
import Link from 'next/link'
type Task = {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'blocked' | 'done'
  title: string
  description: string
  owner: string
  assignee: string
  app: string
  appHref?: string
  dueDate?: string
  linkedTo?: string
  convertedFrom?: string
}

function priorityTone(p: string) {
  if (p === 'critical') return { ring: 'border-red-400/25', bg: 'bg-red-400/[0.05]', text: 'text-red-300', dot: 'bg-red-400', label: 'Critical' }
  if (p === 'high')     return { ring: 'border-gold/25', bg: 'bg-gold/[0.05]', text: 'text-[#F8E7AE]', dot: 'bg-gold', label: 'High' }
  if (p === 'medium')   return { ring: 'border-teal-400/20', bg: 'bg-teal-400/[0.04]', text: 'text-teal-200', dot: 'bg-teal-400', label: 'Medium' }
  return                       { ring: 'border-line', bg: 'bg-surface', text: 'text-slate-400', dot: 'bg-slate-500', label: 'Low' }
}

function statusChip(status: string) {
  if (status === 'done')        return { text: 'text-gold', icon: <CheckCircle2 className="h-3.5 w-3.5 text-gold" />, label: 'Done' }
  if (status === 'blocked')     return { text: 'text-red-300', icon: <AlertCircle className="h-3.5 w-3.5 text-red-400" />, label: 'Blocked' }
  if (status === 'in_progress') return { text: 'text-[#F8E7AE]', icon: <Clock className="h-3.5 w-3.5 text-gold" />, label: 'In Progress' }
  return                               { text: 'text-slate-400', icon: <Clock className="h-3.5 w-3.5 text-slate-500" />, label: 'Open' }
}

const STATUS_OPTIONS = ['All', 'Open', 'In Progress', 'Blocked', 'Done'] as const
const PRIORITY_OPTIONS = ['All', 'Critical', 'High', 'Medium', 'Low'] as const

type StatusFilter = typeof STATUS_OPTIONS[number]
type PriorityFilter = typeof PRIORITY_OPTIONS[number]

const STATUS_MAP: Record<string, Task['status']> = {
  'Open': 'open',
  'In Progress': 'in_progress',
  'Blocked': 'blocked',
  'Done': 'done',
}

const PRIORITY_MAP: Record<string, Task['priority']> = {
  'Critical': 'critical',
  'High': 'high',
  'Medium': 'medium',
  'Low': 'low',
}

export default function TasksPage() {
  // --- core state ---
  const [tasks, setTasks] = useState<Task[]>([])
  const [statuses, setStatuses] = useState<Record<string, Task['status']>>({})

  // Load real tasks from the API.
  useEffect(() => {
    fetch('/api/freehold/tasks', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.tasks) return
        setTasks(d.tasks.map((t: Record<string, unknown>): Task => ({
          id: String(t.id),
          priority: (t.priority as Task['priority']) || 'medium',
          status: (t.status as Task['status']) || 'open',
          title: String(t.title || ''),
          description: String(t.description || ''),
          owner: String(t.assignee || '—'),
          assignee: String(t.assignee || '—'),
          app: 'Tasks',
          dueDate: t.dueDate ? String(t.dueDate) : undefined,
        })))
      })
      .catch(() => {})
  }, [])

  // --- filter state ---
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('All')
  const [activePriority, setActivePriority] = useState<PriorityFilter>('All')

  // --- create form state ---
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formAssignee, setFormAssignee] = useState('')
  const [formPriority, setFormPriority] = useState<Task['priority']>('medium')
  const [formDue, setFormDue] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  // --- effective status helper ---
  function effectiveStatus(task: Task): Task['status'] {
    return statuses[task.id] ?? task.status
  }

  // --- stats (live, from state) ---
  const stats = useMemo(() => {
    const open = tasks.filter(t => effectiveStatus(t) !== 'done').length
    const critical = tasks.filter(t => t.priority === 'critical').length
    const blocked = tasks.filter(t => effectiveStatus(t) === 'blocked').length
    const dueToday = tasks.filter(t => t.dueDate === 'Today' && effectiveStatus(t) !== 'done').length
    return { open, critical, blocked, dueToday }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses])

  // --- filtered + sorted list ---
  const filtered = useMemo(() => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const statusOrder = { blocked: 0, open: 1, in_progress: 2, done: 3 }

    return tasks
      .filter(task => {
        const es = effectiveStatus(task)
        if (activeStatus !== 'All' && es !== STATUS_MAP[activeStatus]) return false
        if (activePriority !== 'All' && task.priority !== PRIORITY_MAP[activePriority]) return false
        return true
      })
      .sort((a, b) => {
        const aEs = effectiveStatus(a)
        const bEs = effectiveStatus(b)
        // Done tasks always go to bottom
        const aDone = aEs === 'done' ? 1 : 0
        const bDone = bEs === 'done' ? 1 : 0
        if (aDone !== bDone) return aDone - bDone
        // Within non-done: blocked+critical first, then priority, then status
        if (priorityOrder[a.priority] !== priorityOrder[b.priority])
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        return statusOrder[aEs] - statusOrder[bEs]
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses, activeStatus, activePriority])

  const anyFilterActive = activeStatus !== 'All' || activePriority !== 'All'

  function markDone(id: string) {
    setStatuses(prev => ({ ...prev, [id]: 'done' }))
    fetch(`/api/freehold/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    }).catch(() => {})
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim()) return
    try {
      const res = await fetch('/api/freehold/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc.trim(),
          assignee: formAssignee.trim(),
          priority: formPriority,
          dueDate: formDue.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.task) throw new Error(data?.error || 'Failed')
      const t = data.task
      setTasks(prev => [{
        id: String(t.id), priority: t.priority || 'medium', status: t.status || 'open',
        title: t.title, description: t.description || '', owner: t.assignee || '—',
        assignee: t.assignee || '—', app: 'Tasks', dueDate: t.dueDate || undefined,
      }, ...prev])
      setFormTitle(''); setFormDesc(''); setFormAssignee(''); setFormPriority('medium'); setFormDue('')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2500)
    } catch { /* keep form for retry */ }
  }

  const inputClass =
    'w-full rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-gold/30 transition'

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <CheckSquare className="h-3.5 w-3.5" /> Tasks
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {stats.open} tasks open.
          <br />
          <span className="text-slate-400">{stats.dueToday} due today.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-[1.65] text-slate-300">
          Owned, dated and tracked. Created from review comments, blockers and internal decisions. Resolve critical and blocked items first.
        </p>
      </section>

      {/* Stat strip */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[18px] border border-line bg-surface p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{stats.open}</p>
          <p className="text-xs text-slate-500 mt-1">Open</p>
        </div>
        <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.06] p-4 text-center">
          <p className="text-[26px] font-semibold text-red-300">{stats.critical}</p>
          <p className="text-xs text-red-400/60 mt-1">Critical</p>
        </div>
        <div className="rounded-[18px] border border-orange-400/20 bg-orange-400/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-orange-300">{stats.blocked}</p>
          <p className="text-xs text-orange-400/60 mt-1">Blocked</p>
        </div>
        <div className="rounded-[18px] border border-gold/20 bg-gold/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#F8E7AE]">{stats.dueToday}</p>
          <p className="text-xs text-gold/60 mt-1">Due today</p>
        </div>
      </section>

      {/* Filter pills */}
      <section className="mt-6 flex flex-wrap items-center gap-2">
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(s => {
            const active = activeStatus === s
            return (
              <button
                key={s}
                onClick={() => setActiveStatus(s)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  active
                    ? 'border-gold/30 bg-gold/10 text-gold'
                    : 'border-line bg-surface text-slate-400 hover:border-line-strong hover:text-slate-100'
                }`}
              >
                {s}
              </button>
            )
          })}
        </div>

        <div className="h-4 w-px bg-surface-2" />

        {/* Priority pills */}
        <div className="flex flex-wrap gap-1.5">
          {PRIORITY_OPTIONS.map(p => {
            const active = activePriority === p
            return (
              <button
                key={p}
                onClick={() => setActivePriority(p)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  active
                    ? 'border-gold/30 bg-gold/10 text-gold'
                    : 'border-line bg-surface text-slate-400 hover:border-line-strong hover:text-slate-100'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Clear */}
        {anyFilterActive && (
          <button
            onClick={() => { setActiveStatus('All'); setActivePriority('All') }}
            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-sm text-slate-400 transition hover:border-line-strong hover:text-slate-100"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </section>

      {/* Task cards */}
      <section className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-[22px] border border-line bg-surface px-6 py-10 text-center text-sm text-slate-400">
            No tasks match the current filters.
          </div>
        )}

        {filtered.map(task => {
          const es = effectiveStatus(task)
          const isDone = es === 'done'
          const tone = priorityTone(task.priority)
          const st = statusChip(es)

          return (
            <div
              key={task.id}
              className={`rounded-[22px] border p-6 transition-opacity ${isDone ? 'opacity-50' : ''} ${tone.ring} ${tone.bg}`}
            >
              {/* Top row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium ${tone.ring} ${tone.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                  <span className="text-sm text-slate-400">{task.app}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {isDone
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
                    : st.icon}
                  <span className={isDone ? 'text-gold' : st.text}>
                    {isDone ? 'Done' : st.label}
                  </span>
                </div>
              </div>

              {/* Title + desc */}
              <h3 className={`mt-3 text-base font-semibold ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
                {task.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{task.description}</p>

              {/* Meta row */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    <span className="text-slate-300">{task.assignee}</span>
                  </span>
                  {task.dueDate && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span className={task.dueDate === 'Today' ? 'text-gold' : 'text-slate-300'}>{task.dueDate}</span>
                    </span>
                  )}
                  {task.linkedTo && <span>→ <span className="text-slate-400">{task.linkedTo}</span></span>}
                </div>

                {!isDone && (
                  <button
                    onClick={() => markDone(task.id)}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-gold/20 bg-gold/[0.06] px-3.5 py-1.5 text-xs font-medium text-gold transition hover:border-emerald-400/35 hover:bg-gold/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark done
                  </button>
                )}
              </div>

              {/* App link */}
              {task.appHref && (
                <Link
                  href={task.appHref}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-slate-400 transition hover:text-gold"
                >
                  Open in {task.app} <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )
        })}
      </section>

      {/* Create task form */}
      <section className="mt-8 rounded-[22px] border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Plus className="h-3.5 w-3.5" /> Create a task
          </div>
          {showSuccess && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-gold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Task created
            </span>
          )}
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <input
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Task title"
            className={inputClass}
            required
          />
          <textarea
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            placeholder="Describe the task, expected outcome, and what success looks like…"
            rows={3}
            className={`${inputClass} resize-none`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={formAssignee}
              onChange={e => setFormAssignee(e.target.value)}
              placeholder="Assign to…"
              className="rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-gold/30 transition"
            />
            <select
              value={formPriority}
              onChange={e => setFormPriority(e.target.value as Task['priority'])}
              className="rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-gold/30 transition appearance-none cursor-pointer"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              value={formDue}
              onChange={e => setFormDue(e.target.value)}
              placeholder="Due date"
              className="rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-gold/30 transition"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/90"
            >
              Create task
            </button>
          </div>
        </form>
      </section>

      {/* AI take */}
      <section className="mt-8 rounded-[22px] border border-gold/15 bg-gold/[0.03] px-6 py-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/80 mb-3">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="text-base font-medium leading-[1.65] text-slate-100">
          The two blocked tasks (Meta billing, auth middleware) have the highest downstream impact. Billing unblocks the entire campaign pipeline. After that, the Palm landing approval and the CRM lead review are both achievable today and unlock agent momentum immediately.
        </p>
      </section>


    </div>
  )
}
