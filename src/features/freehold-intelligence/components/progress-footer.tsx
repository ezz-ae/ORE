import { StatusPill } from "./status-pill"
import type { Milestone } from "../types"

export function ProgressFooter({ milestone }: { milestone?: Milestone | null }) {
  if (!milestone) return null

  const pct = milestone.progress_pct ?? 0

  return (
    <footer className="mt-12 rounded-[20px] border border-white/[0.06] bg-[#0A0D10] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80">{milestone.code}</p>
          <p className="mt-1 text-[14px] font-semibold text-white">{milestone.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill value={milestone.status} />
          {milestone.health && <StatusPill value={milestone.health} />}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[11px] text-white/35">
          <span>Progress</span>
          <span className="tabular-nums font-medium text-white/55">{pct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-[#D4AF37]/70 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-3 text-[11px] text-white/30">
        <span>Deadline: {milestone.deadline}</span>
        {milestone.days_to_deadline != null && <span>{milestone.days_to_deadline}d remaining</span>}
      </div>
    </footer>
  )
}
