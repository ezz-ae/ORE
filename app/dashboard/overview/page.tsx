import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DashboardAIWidget } from "@/components/dashboard-ai-widget"
import { getDashboardOverviewData } from "@/lib/entrestate"
import Link from "next/link"
import {
  CalendarCheck,
  TrendingUp,
  Users,
  PhoneCall,
  CircleDollarSign,
  Flame,
  ArrowUpRight,
} from "lucide-react"

interface DashboardOverviewProps {
  searchParams?: { role?: string; brokerId?: string }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

export default async function DashboardOverview({ searchParams }: DashboardOverviewProps) {
  const role = searchParams?.role === "broker" ? "broker" : "admin"
  const brokerId = searchParams?.brokerId
  const data = await getDashboardOverviewData(role, brokerId)

  const kpis = [
    {
      label: "Today's Leads",
      value: data.kpis.todaysLeads,
      icon: Users,
    },
    {
      label: "Assigned This Week",
      value: data.kpis.assignedThisWeek,
      icon: CalendarCheck,
    },
    {
      label: "Active Inquiries (30d)",
      value: data.kpis.activeInquiries,
      icon: PhoneCall,
    },
    {
      label: "Scheduled Viewings",
      value: data.kpis.scheduledViewings,
      icon: TrendingUp,
    },
    {
      label: "Revenue Pipeline",
      value: formatCurrency(data.kpis.pipelineValue),
      icon: CircleDollarSign,
    },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge className="mb-3 ore-gradient" variant="secondary">
              Dashboard Overview
            </Badge>
            <h1 className="font-serif text-3xl font-bold">Sales & CRM Hub</h1>
            <p className="text-sm text-muted-foreground">
              {role === "admin"
                ? "Company-wide performance with AI-assisted insights."
                : `Broker view: ${brokerId || "your assigned leads"} and sales pipeline.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/leads">View Pending Leads</Link>
            </Button>
            <Button className="ore-gradient" asChild>
              <Link href="/dashboard/ai-assistant">Ask AI</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {kpi.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold">
                      {kpi.value}
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <DashboardAIWidget />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hot Leads Alert</CardTitle>
              <p className="text-xs text-muted-foreground">
                Prioritized using engagement and completeness signals.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.hotLeads.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No leads available yet.
                </div>
              ) : (
                data.hotLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.project_slug || "No project selected"} · {lead.phone}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <Flame className="h-4 w-4" />
                      Score {lead.score}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <p className="text-xs text-muted-foreground">
                Latest lead interactions captured in the CRM.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentLeads.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No recent leads yet.
                </div>
              ) : (
                data.recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.source || "Website"} · {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {lead.project_slug || "No project"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Performance</CardTitle>
            <p className="text-xs text-muted-foreground">
              Top performing projects by market score and ROI.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2"
              >
                <div>
                  <div className="font-semibold">{project.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {project.area || "Dubai"} · Market Score {project.marketScore ?? "—"}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  ROI {project.expectedRoi ?? "—"}% · Yield {project.rentalYield ?? "—"}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <p className="text-xs text-muted-foreground">Speed up your daily workflow.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link href="/dashboard/projects/add">
                Add New Project
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link href="/dashboard/leads">
                Assign Unassigned Leads ({data.kpis.unassignedLeads})
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link href="/dashboard/analytics">
                Generate Performance Report
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
