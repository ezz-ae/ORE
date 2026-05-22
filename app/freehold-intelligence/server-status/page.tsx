import { getAuditEvents, getDashboardSnapshot, getMilestones } from "@/src/features/freehold-intelligence/data-access"
import { DeveloperNotes } from "@/src/features/freehold-intelligence/components/developer-notes"
import { StatusPill } from "@/src/features/freehold-intelligence/components/status-pill"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function ServerStatusPage() {
  const [snapshot, milestones, auditEvents] = await Promise.all([getDashboardSnapshot(), getMilestones(), getAuditEvents()])
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Operational readiness</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">Server status</h1>
        <p className="mt-4 max-w-3xl text-white/65">Live readiness checks from Neon-backed Freehold tables, audit log and milestone health.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-white/50">Projects</p><p className="mt-2 text-3xl font-semibold">{snapshot.total_projects.toLocaleString()}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-white/50">Milestones</p><p className="mt-2 text-3xl font-semibold">{snapshot.milestones_done}/{snapshot.milestones_total}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-white/50">Open tasks</p><p className="mt-2 text-3xl font-semibold">{snapshot.open_tasks}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-white/50">Audit 24h</p><p className="mt-2 text-3xl font-semibold">{snapshot.audit_events_24h}</p></div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-2xl font-semibold">Milestone health</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {milestones.map((milestone) => (
            <div key={milestone.code} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
              <span>{milestone.code} · {milestone.title}</span>
              <StatusPill value={milestone.health} />
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-2xl font-semibold">Recent audit events</h2>
        <Table>
          <TableHeader><TableRow className="border-white/10"><TableHead className="text-white/70">Time</TableHead><TableHead className="text-white/70">Actor</TableHead><TableHead className="text-white/70">Action</TableHead><TableHead className="text-white/70">Target</TableHead></TableRow></TableHeader>
          <TableBody>
            {auditEvents.length === 0 ? <TableRow><TableCell colSpan={4} className="text-white/50">No audit events yet.</TableCell></TableRow> : null}
            {auditEvents.map((event) => (
              <TableRow key={String(event.log_id)} className="border-white/10">
                <TableCell>{event.created_at}</TableCell>
                <TableCell>{event.actor || "system"}</TableCell>
                <TableCell>{event.action}</TableCell>
                <TableCell>{event.target_table}:{event.target_id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <DeveloperNotes title="Server Status" notes={["Audit events rely on app.actor and app.role_id session variables when server actions mutate data.", "Before production exposure, add auth middleware and route-level authorization using freehold_rbac_matrix."]} />
    </div>
  )
}
