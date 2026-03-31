import { LeadsTable } from "@/components/leads-table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getLeads, getUserAccessList, resolveAccessRole } from "@/lib/ore"
import { getSessionUser, isAdminRole } from "@/lib/auth"

export default async function LeadsPage() {
  const user = await getSessionUser()
  const accessRole = resolveAccessRole(user?.role)
  const brokerId = accessRole === "broker" ? user?.id : undefined
  const leads = await getLeads(accessRole, brokerId)
  const isAdmin = isAdminRole(user?.role)
  const teamMembers = isAdmin
    ? (await getUserAccessList())
        .filter((member) => !["ceo", "director"].includes(String(member.org_title || member.role).trim().toLowerCase().replace(/\s+/g, "_")))
        .map((member) => ({
          id: member.id,
          name: member.name || member.email,
          email: member.email,
          title: member.org_title || member.role,
        }))
    : []
  const newCount = leads.filter((lead) => (lead.status || "new") === "new").length
  const hotCount = leads.filter((lead) => lead.priority === "hot").length
  const openCount = leads.filter((lead) => !lead.assigned_broker_id).length

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge className="mb-3 ore-gradient" variant="secondary">
              Dashboard
            </Badge>
            <h1 className="font-serif text-3xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Admin view: all leads across the platform."
                : `Broker view: leads assigned to ${brokerId || "your ID"}.`}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Leads</div>
            <div className="mt-2 text-3xl font-bold">{leads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">New / Hot</div>
            <div className="mt-2 text-3xl font-bold">{newCount} / {hotCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Unassigned</div>
            <div className="mt-2 text-3xl font-bold">{openCount}</div>
          </CardContent>
        </Card>
      </section>

      <section>
        <LeadsTable leads={leads} isAdmin={isAdmin} teamMembers={teamMembers} />
      </section>
    </div>
  )
}
