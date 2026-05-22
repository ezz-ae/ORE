import { Database, FileCheck2, ListTodo, ShieldCheck, Users, Workflow } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getDashboardSnapshot, getMilestones, getReviewItems, getSystems } from "@/src/features/freehold-intelligence/data-access"
import { CommentsPanel } from "@/src/features/freehold-intelligence/components/comments-panel"
import { DeveloperNotes } from "@/src/features/freehold-intelligence/components/developer-notes"
import { ProgressFooter } from "@/src/features/freehold-intelligence/components/progress-footer"
import { SystemCard } from "@/src/features/freehold-intelligence/components/system-card"

const metrics = [
  [Database, "Projects", "total_projects"],
  [Users, "Developers", "total_developers"],
  [Workflow, "Areas", "total_areas"],
  [ShieldCheck, "Active users", "active_users"],
  [FileCheck2, "Milestones", "milestones_total"],
  [ListTodo, "Open tasks", "open_tasks"],
] as const

export default async function FreeholdIntelligencePage() {
  const [snapshot, systems, milestones, comments] = await Promise.all([
    getDashboardSnapshot(),
    getSystems(),
    getMilestones(),
    getReviewItems("comment"),
  ])
  const activeMilestone = milestones.find((milestone) => milestone.status === "in_progress") ?? milestones[0]

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_35%),rgba(255,255,255,0.04)] p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Private Real Estate Operating System</p>
        <h1 className="mt-4 max-w-4xl font-serif text-4xl font-semibold leading-tight md:text-6xl">Controlled execution environment for Freehold’s public platform and private control room.</h1>
        <p className="mt-5 max-w-3xl text-white/65">V1 makes status, ownership, milestones, comments, tasks, permissions and developer notes visible before deeper AI, CRM and campaign systems expand.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([Icon, label, key]) => (
          <Card key={key} className="border-white/10 bg-white/[0.04] text-white shadow-none">
            <CardContent className="p-5">
              <Icon className="h-5 w-5 text-[#D4AF37]" />
              <div className="mt-4 text-3xl font-semibold">{Number(snapshot[key]).toLocaleString()}</div>
              <div className="mt-1 text-sm text-white/55">{label}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37]">Systems map</p>
            <h2 className="mt-2 text-3xl font-semibold">Execution modules</h2>
          </div>
          <p className="max-w-xl text-sm text-white/55">Every internal system shows purpose, status, progress, linked milestone, review comments, task conversion and developer execution notes.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {systems.map((system) => <SystemCard key={system.module_id} system={system} />)}
        </div>
      </section>

      <CommentsPanel pageRef="freehold-intelligence/control-room" items={comments.slice(0, 5)} />
      <ProgressFooter milestone={activeMilestone} />
      <DeveloperNotes title="Control Room" notes={[
        "Public website routes remain untouched; this route group is private execution UI only.",
        "Data is read from freehold_* tables and falls back to V1 skeleton values if env vars are missing.",
        "Next step: add real auth gating before exposing this route outside internal preview.",
      ]} />
    </div>
  )
}
