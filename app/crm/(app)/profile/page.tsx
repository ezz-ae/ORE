import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DashboardProfileForm } from "@/components/dashboard-profile-form"
import { TeamAccountsPanel } from "@/components/team-accounts-panel"
import { getBrokerPerformanceSummary, getUserAccessList, getUserProfileByEmail } from "@/lib/ore"
import { canDeleteCrmUsers, canManageCrmUsers, getSessionUser } from "@/lib/auth"

interface DashboardProfilePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardProfilePage({ searchParams }: DashboardProfilePageProps) {
  const sessionUser = await getSessionUser()
  const canViewOther = canManageCrmUsers(sessionUser?.role, sessionUser?.org_title)
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const requestedEmail = typeof resolvedSearchParams?.email === "string" ? resolvedSearchParams.email : undefined
  const email =
    canViewOther && requestedEmail ? requestedEmail : sessionUser?.email
  const profile = email ? await getUserProfileByEmail(email) : null
  const brokerId = profile?.id || sessionUser?.id
  const snapshot = brokerId ? await getBrokerPerformanceSummary(brokerId) : null
  const users = canViewOther ? await getUserAccessList() : []

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      maximumFractionDigits: 0,
    }).format(value)

  const commissionRate = profile?.commission_rate || 0
  const commissionEstimate = snapshot ? snapshot.pipelineValue * (commissionRate / 100) : 0

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Profile & Settings
        </Badge>
        <h1 className="font-serif text-3xl font-bold">Broker Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your details, working style, and team access from one place.
        </p>
        {canViewOther && (
          <p className="mt-2 text-xs text-muted-foreground">
            Management can review any team profile and create new user access below.
          </p>
        )}
      </section>

      {snapshot && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Leads</div>
              <div className="mt-2 text-2xl font-semibold">{snapshot.totalLeads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Hot Leads</div>
              <div className="mt-2 text-2xl font-semibold">{snapshot.hotLeads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Pipeline Value</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatCurrency(snapshot.pipelineValue)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Commission Est.</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatCurrency(commissionEstimate)}
              </div>
              <div className="text-xs text-muted-foreground">{commissionRate}% rate</div>
            </CardContent>
          </Card>
        </section>
      )}

      <DashboardProfileForm initialProfile={profile} canEditRole={canViewOther} />
      {canViewOther ? (
        <TeamAccountsPanel
          users={users}
          currentUserId={sessionUser?.id}
          canDeleteUsers={canDeleteCrmUsers(sessionUser?.role, sessionUser?.org_title)}
        />
      ) : null}
    </div>
  )
}
