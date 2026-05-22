import { Progress } from "@/components/ui/progress"
import { StatusPill } from "./status-pill"
import type { Milestone } from "../types"

export function ProgressFooter({ milestone }: { milestone?: Milestone | null }) {
  if (!milestone) return null
  return (
    <footer className="mt-8 border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37]">Page progress footer</p>
          <p className="mt-1 font-medium text-white">{milestone.code} · {milestone.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill value={milestone.status} />
          <StatusPill value={milestone.health} />
        </div>
      </div>
      <Progress value={milestone.progress_pct ?? 0} className="bg-white/10 [&>div]:bg-[#D4AF37]" />
      <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs">
        <span>Progress: {milestone.progress_pct ?? 0}%</span>
        <span>Deadline: {milestone.deadline}</span>
        {milestone.days_to_deadline != null ? <span>{milestone.days_to_deadline} days remaining</span> : null}
      </div>
    </footer>
  )
}
