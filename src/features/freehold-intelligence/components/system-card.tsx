import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { SystemModule } from "../types"
import { StatusPill } from "./status-pill"

export function SystemCard({ system }: { system: SystemModule }) {
  const progress = Number(system.progress_pct ?? 0)

  return (
    <Link
      href={`/freehold-intelligence/systems/${system.module_id}`}
      className="group relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0A0D10] p-6 transition hover:border-[#D4AF37]/25 lg:rounded-[28px] lg:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#D4AF37]/[0.07] via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">{system.layer}</p>
            <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight text-white">{system.module_name}</h3>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-[#D4AF37]" />
        </div>

        <p className="flex-1 text-[13px] leading-[1.65] text-white/55">{system.description}</p>

        <div className="flex flex-wrap gap-2">
          <StatusPill value={system.status} />
          {system.health && <StatusPill value={system.health} />}
          {system.milestone_code && (
            <StatusPill value={system.milestone_code} className="normal-case" />
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-white/35">
            <span>Build progress</span>
            <span className="tabular-nums font-medium text-white/55">{progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#D4AF37]/70 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
