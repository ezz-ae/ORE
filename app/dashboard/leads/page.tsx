import { LeadsTable } from "@/components/leads-table"
import { Badge } from "@/components/ui/badge"
import { getLeads } from "@/lib/entrestate"

interface LeadsPageProps {
  searchParams?: Promise<{ role?: string; brokerId?: string }>
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const role = resolvedSearchParams?.role === "broker" ? "broker" : "admin"
  const brokerId = resolvedSearchParams?.brokerId
  const leads = await getLeads(role, brokerId)

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
              {role === "admin"
                ? "Admin view: all leads across the platform."
                : `Broker view: leads assigned to ${brokerId || "your ID"}.`}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Use `?role=broker&brokerId=BRK-001` for broker view.
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container">
          <LeadsTable leads={leads} isAdmin={role === "admin"} teamMembers={[]} />
        </div>
      </section>
    </div>
  )
}
