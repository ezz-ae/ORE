import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardAIWidget } from "@/components/dashboard-ai-widget"
import { AdminUserAccessPanel } from "@/components/admin-user-access-panel"
import { AiProjectUpdatePanel } from "@/components/ai-project-update-panel"
import { AiTrainingCard } from "@/components/ai-training-card"
import { getDashboardOverviewData, getUserAccessList, resolveAccessRole } from "@/lib/ore"
import { getAiProjectUpdates } from "@/lib/ai-project-updates"
import { getAiTrainingRequests } from "@/lib/ai-training"
import { listConversations } from "@/lib/ai-conversations"
import { getSessionUser } from "@/lib/auth"
import { ArrowUpRight, CalendarCheck, CircleDollarSign, Flame, PhoneCall, TrendingUp, Users } from "lucide-react"

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

const overviewTabs = [
  { key: "summary", label: "Summary" },
  { key: "pipeline", label: "Pipeline" },
  { key: "ai", label: "AI Workspace" },
  { key: "admin", label: "Admin" },
] as const

interface DashboardOverviewProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardOverview({ searchParams }: DashboardOverviewProps) {
  const user = await getSessionUser()
  const accessRole = resolveAccessRole(user?.role)
  const brokerId = accessRole === "broker" ? user?.id : undefined
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const requestedTab = typeof resolvedSearchParams?.tab === "string" ? resolvedSearchParams.tab : "summary"
  const activeTab =
    requestedTab === "pipeline" || requestedTab === "ai" || (requestedTab === "admin" && accessRole === "admin")
      ? requestedTab
      : "summary"

  const data = await getDashboardOverviewData(accessRole, brokerId)
  const conversations = user ? await listConversations(user.id, 4) : []
  const trainingRequests = accessRole === "admin" ? await getAiTrainingRequests(6) : []
  const projectUpdates = accessRole === "admin" ? await getAiProjectUpdates(6) : []
  const userAccessList = accessRole === "admin" ? await getUserAccessList() : []
  const projectOptions = data.topProjects.map((project) => ({
    slug: project.slug,
    name: project.name,
    area: project.area,
  }))

  const availableTabs = overviewTabs.filter((tab) => tab.key !== "admin" || accessRole === "admin")
  const kpis = [
    { label: "Today's Leads", value: data.kpis.todaysLeads, icon: Users },
    { label: "Assigned This Week", value: data.kpis.assignedThisWeek, icon: CalendarCheck },
    { label: "Active Inquiries", value: data.kpis.activeInquiries, icon: PhoneCall },
    { label: "Scheduled Viewings", value: data.kpis.scheduledViewings, icon: TrendingUp },
    { label: "Pipeline", value: formatCurrency(data.kpis.pipelineValue), icon: CircleDollarSign },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <Badge className="ore-gradient border-none px-3" variant="secondary">
              CRM Command
            </Badge>
            <h2 className="font-serif text-3xl font-bold tracking-tight">
              {accessRole === "admin" ? "Management Overview" : `${user?.name || "Broker"} Workspace`}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              The CRM overview is now split into focused sections. Use the tabs below instead of one overloaded dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/crm/leads">Open Lead Queue</Link>
            </Button>
            <Button className="ore-gradient" asChild>
              <Link href="/crm/ai-assistant">Open AI Workspace</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {availableTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              className={activeTab === tab.key ? "ore-gradient" : ""}
              asChild
            >
              <Link href={`/crm/overview?tab=${tab.key}`}>{tab.label}</Link>
            </Button>
          ))}
        </div>
      </section>

      {activeTab === "summary" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <Card key={kpi.label} className="rounded-2xl border-border/50 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                          {kpi.label}
                        </div>
                        <div className="mt-2 text-2xl font-bold">{kpi.value}</div>
                      </div>
                      <div className="rounded-xl border border-primary/15 bg-primary/5 p-2.5">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Priority Leads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.hotLeads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    No hot leads detected yet.
                  </div>
                ) : (
                  data.hotLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                      <div>
                        <div className="font-semibold">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.project_slug || "General inquiry"} · {lead.phone}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-600">
                        <Flame className="h-3 w-3" />
                        {lead.score}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Recent AI Conversations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {conversations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    No AI conversations yet.
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <div key={conversation.id} className="rounded-xl border border-border/60 px-4 py-3">
                      <div className="font-semibold">{conversation.title || "AI Conversation"}</div>
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(conversation.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {activeTab === "pipeline" && (
        <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Lead Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <div className="font-semibold">{lead.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {lead.source || "Website"} · {new Date(lead.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {lead.project_slug || "No project"}
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" asChild>
                <Link href="/crm/leads">Go to full lead list</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-primary">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/crm/leads">
                  Work the queue
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/crm/inventory">
                  Review inventory
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/crm/analytics">
                  Read analytics
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle>Project Performance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data.topProjects.map((project) => (
                <div key={project.id} className="rounded-xl border border-border/60 px-4 py-3">
                  <div className="font-semibold">{project.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {project.area || "Dubai"} · Score {project.marketScore ?? "—"}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-emerald-600">
                    ROI {project.expectedRoi ?? "—"}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === "ai" && (
        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <DashboardAIWidget />
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>AI Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/crm/ai-assistant">
                  Open full AI assistant
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </Link>
              </Button>
              {accessRole === "admin" ? (
                <Button variant="outline" className="w-full justify-between" asChild>
                  <Link href="/crm/playbook">
                    Open AI playbook
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                  </Link>
                </Button>
              ) : null}
              <div className="rounded-xl border border-border/60 bg-card/50 p-4 text-sm text-muted-foreground">
                Use the dedicated AI workspace for long-form prompts, project creation, branded offers, and broker guidance. The overview only keeps the quick AI panel.
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === "admin" && accessRole === "admin" && (
        <div className="space-y-6">
          <AiTrainingCard projects={data.topProjects} requests={trainingRequests} />
          <AiProjectUpdatePanel projects={projectOptions} updates={projectUpdates} />
          <Card>
            <CardHeader>
              <CardTitle>AI Access Control</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminUserAccessPanel users={userAccessList} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
