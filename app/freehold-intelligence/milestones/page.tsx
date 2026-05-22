import Link from "next/link"
import { getMilestones } from "@/src/features/freehold-intelligence/data-access"
import { ProgressFooter } from "@/src/features/freehold-intelligence/components/progress-footer"
import { StatusPill } from "@/src/features/freehold-intelligence/components/status-pill"
import { Progress } from "@/components/ui/progress"

export default async function MilestonesPage() {
  const milestones = await getMilestones()
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">M0 → M9</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">Milestone execution model</h1>
        <p className="mt-4 max-w-3xl text-white/65">Deadlines are anchored to the 2026-09-30 experimental delivery boundary and each milestone carries a success event.</p>
      </section>
      <div className="space-y-4">
        {milestones.map((milestone) => (
          <Link key={milestone.code} href={`/freehold-intelligence/milestones/${milestone.code}`} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#D4AF37]/50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#D4AF37]">{milestone.code}</p>
                <h2 className="mt-1 text-2xl font-semibold">{milestone.title}</h2>
                <p className="mt-2 text-sm text-white/55">Owner: {milestone.owner || "Unassigned"} · Deadline: {milestone.deadline}</p>
              </div>
              <div className="flex gap-2"><StatusPill value={milestone.status} /><StatusPill value={milestone.health} /></div>
            </div>
            <div className="mt-5"><Progress value={milestone.progress_pct} className="bg-white/10 [&>div]:bg-[#D4AF37]" /></div>
          </Link>
        ))}
      </div>
      <ProgressFooter milestone={milestones.find((m) => m.status === "in_progress") ?? milestones[0]} />
    </div>
  )
}
