import Link from "next/link"
import { BarChart3, Database, FileCheck2, LayoutGrid, ListTodo, ShieldCheck, Users, Workflow } from "lucide-react"
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

const controlApps = [
  {
    href: "/freehold-intelligence/apps/market",
    icon: Database,
    title: "Market Intelligence",
    description: "Internal market database, project intelligence, data triggers, and operator-only commercial context.",
  },
  {
    href: "/freehold-intelligence/apps/crm",
    icon: Users,
    title: "CRM Workspace",
    description: "Lead queue, pipeline, inventory, landing pages, analytics, and sales execution links in one app area.",
  },
  {
    href: "/freehold-intelligence/apps/dashboard",
    icon: BarChart3,
    title: "Command Dashboard",
    description: "Operational dashboards, project admin surfaces, profile controls, and performance views.",
  },
  {
    href: "/freehold-intelligence/server-status",
    icon: ShieldCheck,
    title: "Server Status",
    description: "Production readiness, database health, audit-style events, and control-room infrastructure notes.",
  },
]

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
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Control Room Apps</p>
        <h1 className="mt-4 max-w-4xl font-serif text-4xl font-semibold leading-tight md:text-6xl">One internal control area for Freehold’s market, CRM, dashboard and intelligence systems.</h1>
        <p className="mt-5 max-w-3xl text-white/65">This is the operator console, closer to a cPanel-style apps area than a public website page. Public routes should not expose private market or execution tools.</p>
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37]">Apps site</p>
            <h2 className="mt-2 flex items-center gap-2 text-3xl font-semibold">
              <LayoutGrid className="h-6 w-6 text-[#D4AF37]" />
              Control-room applications
            </h2>
          </div>
          <p className="max-w-xl text-sm text-white/55">Market intelligence, CRM, dashboards and server status are grouped under this private control-room URL.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {controlApps.map((app) => {
            const Icon = app.icon
            return (
              <Link key={app.href} href={app.href} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#D4AF37]/50 hover:bg-white/[0.06]">
                <Icon className="h-6 w-6 text-[#D4AF37]" />
                <h3 className="mt-5 text-xl font-semibold text-white">{app.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{app.description}</p>
                <span className="mt-5 inline-flex text-sm font-medium text-[#D4AF37]">Open app</span>
              </Link>
            )
          })}
        </div>
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
        "Public market URLs now redirect into the control-room market app.",
        "CRM and dashboard surfaces are grouped from this apps area while legacy routes remain available for their existing workflows.",
        "Data is read from freehold_* tables and falls back to V1 skeleton values if env vars are missing.",
      ]} />
    </div>
  )
}
