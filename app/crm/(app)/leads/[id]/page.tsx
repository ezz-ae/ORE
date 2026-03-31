import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LeadActivityForm } from "@/components/lead-activity-form"
import { LeadAiComposer } from "@/components/lead-ai-composer"
import { getLeadActivity, getLeadById, getProjectBySlug, getUserProfileById } from "@/lib/entrestate"
import { getSessionUser, isAdminRole } from "@/lib/auth"

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params
  const user = await getSessionUser()
  const lead = await getLeadById(id)
  if (!lead) {
    notFound()
  }

  const canView = isAdminRole(user?.role) || lead.assigned_broker_id === user?.id
  if (!canView) {
    notFound()
  }

  const activity = await getLeadActivity(lead.id)
  const project = lead.project_slug ? await getProjectBySlug(lead.project_slug) : null
  const assignedBroker = lead.assigned_broker_id ? await getUserProfileById(lead.assigned_broker_id) : null
  const creatorIds = [
    ...new Set(
      activity
        .map((item) => item.created_by)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  const activityUsers = await Promise.all(creatorIds.map((creatorId) => getUserProfileById(creatorId)))
  const activityUserMap = new Map(
    activityUsers
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
      .map((profile) => [profile.id, profile.name || profile.email]),
  )

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge className="mb-3 ore-gradient" variant="secondary">
              Lead Profile
            </Badge>
            <h1 className="font-serif text-3xl font-bold">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">
              Captured {formatDateTime(lead.created_at)} · Priority {lead.priority}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/crm/leads">Back to leads</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lead Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{lead.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{lead.phone}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline">{lead.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Broker</span>
              <span>{assignedBroker?.name || assignedBroker?.email || "Unassigned"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source</span>
              <span>{lead.source || "Website"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Client Interest</span>
              <span>{lead.interest || "General enquiry"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Contact</span>
              <span>{formatDateTime(lead.last_contact_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Budget</span>
              <span>{lead.budget_aed ? `AED ${lead.budget_aed.toLocaleString()}` : "—"}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${lead.phone}`}>Call</a>
              </Button>
              {lead.email && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`mailto:${lead.email}`}>Email</a>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {project ? (
              <>
                <div className="font-semibold">{project.name}</div>
                <div className="text-xs text-muted-foreground">
                  {project.location.area} · ROI {project.investmentHighlights.expectedROI}%
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/projects/${project.slug}`}>Open Project</Link>
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No project selected yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {activity.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.activity_type}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                  </div>
                  {item.description && <div className="mt-1 text-sm">{item.description}</div>}
                  {item.created_by && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      By {activityUserMap.get(item.created_by) || item.created_by}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Update</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadActivityForm leadId={lead.id} />
          </CardContent>
        </Card>
      </section>

      <section>
        <LeadAiComposer leadId={lead.id} phone={lead.phone} email={lead.email} />
      </section>
    </div>
  )
}
