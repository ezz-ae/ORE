import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, Circle, Clock, Flag, TrendingUp } from 'lucide-react'
import { getMilestones } from '@/src/features/freehold-intelligence/data-access'
import { ProgressFooter } from '@/src/features/freehold-intelligence/components/progress-footer'

function healthCfg(health?: string | null) {
  switch (health) {
    case 'complete': case 'on_track':
      return { dot: 'bg-emerald-400', bar: 'bg-emerald-400', text: 'text-emerald-200', chip: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200' }
    case 'at_risk':
      return { dot: 'bg-[#D4AF37]',   bar: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]', chip: 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#F8E7AE]' }
    case 'overdue':
      return { dot: 'bg-red-400',     bar: 'bg-red-400',     text: 'text-red-200',   chip: 'border-red-300/25 bg-red-500/10 text-red-200' }
    default:
      return { dot: 'bg-white/20',    bar: 'bg-white/20',    text: 'text-white/50',  chip: 'border-white/15 bg-white/5 text-white/50' }
  }
}

function statusCfg(status: string) {
  switch (status) {
    case 'live': case 'done':
      return { label: 'Done',        color: 'text-emerald-200' }
    case 'in_progress':
      return { label: 'In progress', color: 'text-[#D4AF37]'  }
    case 'blocked':
      return { label: 'Blocked',     color: 'text-red-200'    }
    default:
      return { label: 'Planned',     color: 'text-white/50'   }
  }
}

export default async function MilestonesPage() {
  const milestones = await getMilestones()
  const active = milestones.find((m) => m.status === 'in_progress') ?? milestones[0]
  const doneCount = milestones.filter((m) => m.status === 'done' || m.status === 'live').length
  const activeCount = milestones.filter((m) => m.status === 'in_progress').length
  const totalProgress = Math.round(milestones.reduce((s, m) => s + (m.progress_pct ?? 0), 0) / milestones.length)

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">M0 → M9</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Milestone execution model</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
          Delivery plan anchored to 2026-09-30. Each milestone carries a success event, owner and progress snapshot.
        </p>
      </section>

      {/* ── Summary stats ──────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Total</div>
          <div className="mt-2 text-3xl font-semibold text-white">{milestones.length}</div>
        </div>
        <div className="border border-emerald-300/20 bg-emerald-400/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Completed</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-300">{doneCount}</div>
        </div>
        <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">In progress</div>
          <div className="mt-2 text-3xl font-semibold text-[#D4AF37]">{activeCount}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Overall progress</div>
          <div className="mt-2 text-3xl font-semibold text-white">{totalProgress}%</div>
        </div>
      </div>

      {/* ── Overall bar ────────────────────────────────────────── */}
      <div className="mt-4 border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-white/40">
          <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-[#D4AF37]" /> Overall delivery</span>
          <span>{totalProgress}%</span>
        </div>
        <div className="h-2 bg-white/[0.07]">
          <div className="h-full bg-[#D4AF37] transition-all" style={{ width: `${totalProgress}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-white/30">
          <span>M0 · Start</span>
          <span>Deadline · 2026-09-30</span>
        </div>
      </div>

      {/* ── Milestone list ─────────────────────────────────────── */}
      <div className="mt-5 grid gap-3">
        {milestones.map((milestone) => {
          const hc = healthCfg(milestone.health)
          const sc = statusCfg(milestone.status)
          const pct = milestone.progress_pct ?? 0
          return (
            <Link
              key={milestone.code}
              href={`/freehold-intelligence/milestones/${milestone.code}`}
              className="group block border border-white/10 bg-white/[0.025] p-5 transition hover:border-[#D4AF37]/35 hover:bg-white/[0.04]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Code badge */}
                  <div className="grid h-11 w-11 shrink-0 place-items-center border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] text-sm font-bold text-[#D4AF37]">
                    {milestone.code}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white group-hover:text-white">{milestone.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/45">
                      <span className="flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        {milestone.owner ?? 'Unassigned'}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {milestone.deadline}
                      </span>
                      {milestone.days_to_deadline != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {milestone.days_to_deadline}d remaining
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${hc.chip}`}>
                    {milestone.health ?? 'planned'}
                  </span>
                  <span className={`text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/35">
                  <span>Progress</span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.07]">
                  <div className={`h-full transition-all ${hc.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                {milestone.description && (
                  <p className="text-xs leading-5 text-white/40 line-clamp-1">{milestone.description}</p>
                )}
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-white/20 transition group-hover:translate-x-1 group-hover:text-[#D4AF37]" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-6">
        <ProgressFooter milestone={active} />
      </div>
    </div>
  )
}
