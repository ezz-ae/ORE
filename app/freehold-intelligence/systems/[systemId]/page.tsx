import { notFound } from "next/navigation"
import { getMilestones, getReviewItems, getRbacMatrix, getSystem, getSystems } from "@/src/features/freehold-intelligence/data-access"
import { CommentsPanel } from "@/src/features/freehold-intelligence/components/comments-panel"
import { DeveloperNotes } from "@/src/features/freehold-intelligence/components/developer-notes"
import { ProgressFooter } from "@/src/features/freehold-intelligence/components/progress-footer"
import { StatusPill } from "@/src/features/freehold-intelligence/components/status-pill"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export async function generateStaticParams() {
  const systems = await getSystems()
  return systems.map((system) => ({ systemId: system.module_id }))
}

export default async function SystemDetailPage({ params }: { params: Promise<{ systemId: string }> }) {
  const { systemId } = await params
  const [system, milestones, rbac, comments] = await Promise.all([
    getSystem(systemId),
    getMilestones(),
    getRbacMatrix(),
    getReviewItems("comment"),
  ])
  if (!system) notFound()

  const milestone = milestones.find((m) => m.code === system.milestone_code)
  const permissions = rbac.filter((row) => row.module_name === system.module_name)

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">System detail</p>
            <h1 className="mt-3 font-serif text-5xl font-semibold">{system.module_name}</h1>
            <p className="mt-4 max-w-3xl text-white/65">{system.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill value={system.layer} />
            <StatusPill value={system.status} />
            <StatusPill value={system.health} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/50">Owner</p>
          <p className="mt-2 text-2xl font-semibold">{system.owner || "Unassigned"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/50">Milestone</p>
          <p className="mt-2 text-2xl font-semibold">{system.milestone_code || "Unmapped"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-white/50">Progress</p>
          <p className="mt-2 text-2xl font-semibold">{system.progress_pct ?? 0}%</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-2xl font-semibold">Role access matrix</h2>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/70">Role</TableHead>
              <TableHead className="text-white/70">View</TableHead>
              <TableHead className="text-white/70">Edit</TableHead>
              <TableHead className="text-white/70">Delete</TableHead>
              <TableHead className="text-white/70">Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((row) => (
              <TableRow key={row.role_name} className="border-white/10 hover:bg-white/[0.03]">
                <TableCell>{row.role_name}</TableCell>
                <TableCell>{row.can_view ? "Yes" : "No"}</TableCell>
                <TableCell>{row.can_edit ? "Yes" : "No"}</TableCell>
                <TableCell>{row.can_delete ? "Yes" : "No"}</TableCell>
                <TableCell>{row.can_admin ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <CommentsPanel pageRef={`freehold-intelligence/systems/${system.module_id}`} items={comments.filter((item) => item.page_ref === `freehold-intelligence/systems/${system.module_id}`).slice(0, 10)} />
      <ProgressFooter milestone={milestone} />
      <DeveloperNotes title={system.module_name} notes={[
        "Keep this page self-explaining: purpose, owner, milestone, access and current blockers must be visible without reading docs.",
        "Wire detailed module data into this template once each subsystem leaves skeleton mode.",
      ]} />
    </div>
  )
}
