'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

interface Task {
  id: string
  title: string
  body: string
  app: string
  owner: string
  due?: string
  priority: string
}

interface Approval {
  id: string
  title: string
  body: string
  app: string
  owner: string
}

interface Props {
  urgentTasks: Task[]
  pendingApprovals: Approval[]
}

export function ActionItems({ urgentTasks, pendingApprovals }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [approved, setApproved]   = useState<Set<string>>(new Set())
  const [flash, setFlash]         = useState<string | null>(null)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash])

  const visibleUrgent    = urgentTasks.filter((t) => !dismissed.has(t.id))
  const visibleApprovals = pendingApprovals.filter((a) => !approved.has(a.id))

  return (
    <>
      {/* Flash toast */}
      {flash && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/30 bg-surface px-5 py-2.5 text-sm font-medium text-gold shadow-xl backdrop-blur">
          {flash}
        </div>
      )}

      {/* Urgent items */}
      {visibleUrgent.length > 0 && (
        <section className="mt-14">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Urgent items</h2>
          <div className="mt-5 space-y-3">
            {visibleUrgent.map((task) => (
              <div key={task.id} className="flex items-start gap-4 rounded-[18px] border border-line bg-surface p-5">
                <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${task.priority === 'critical' ? 'text-red-400' : 'text-gold'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{task.title}</div>
                  <p className="mt-0.5 text-sm text-slate-400">{task.body}</p>
                  <div className="mt-1 text-xs text-slate-500">{task.app} · {task.owner}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {task.due && <span className="text-sm font-medium text-gold/70">{task.due}</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setDismissed((prev) => new Set([...prev, task.id]))
                      setFlash('Task dismissed')
                    }}
                    className="rounded-[8px] border border-line bg-surface-2 p-1.5 text-slate-500 transition hover:border-line-strong hover:text-slate-300"
                    title="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending approvals */}
      {visibleApprovals.length > 0 && (
        <section className="mt-14">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Awaiting you</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Pending approvals</h2>
          <div className="mt-5 space-y-3">
            {visibleApprovals.map((item) => (
              <div key={item.id} className="flex items-start gap-4 rounded-[18px] border border-gold/15 bg-gold/[0.03] p-5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold/60" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <p className="mt-0.5 text-sm text-slate-400">{item.body}</p>
                  <div className="mt-1 text-xs text-slate-500">{item.app} · {item.owner}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setApproved((prev) => new Set([...prev, item.id]))
                    setFlash(`"${item.title}" approved`)
                  }}
                  className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/20"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
