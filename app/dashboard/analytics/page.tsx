import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardAnalyticsData } from "@/lib/ore"
import { CircleDollarSign, BarChart3, Users } from "lucide-react"

interface DashboardAnalyticsProps {
  searchParams?: { role?: string; brokerId?: string }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

export default async function DashboardAnalyticsPage({ searchParams }: DashboardAnalyticsProps) {
  const role = searchParams?.role === "broker" ? "broker" : "admin"
  const brokerId = searchParams?.brokerId
  const analytics = await getDashboardAnalyticsData(role, brokerId)

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Analytics
        </Badge>
        <h1 className="font-serif text-3xl font-bold">Sales & Market Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Track lead sources, broker performance, and demand concentration.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Pipeline Value (30d)</div>
                <div className="mt-2 text-2xl font-semibold">{formatCurrency(analytics.pipelineValue)}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <CircleDollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Lead Sources</div>
                <div className="mt-2 text-2xl font-semibold">{analytics.leadSources.length}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Broker Coverage</div>
                <div className="mt-2 text-2xl font-semibold">{analytics.brokerPerformance.length}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lead Source Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.leadSources.map((source) => (
              <div key={source.source} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{source.source}</span>
                  <span className="text-muted-foreground">{source.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full ore-gradient"
                    style={{ width: `${Math.min((source.count / (analytics.leadSources[0]?.count || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Broker Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.brokerPerformance.map((broker) => (
              <div key={broker.brokerId} className="flex items-center justify-between text-sm">
                <span className="font-medium">{broker.brokerId}</span>
                <span className="text-muted-foreground">{broker.count} leads</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Demand by Area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.areaPerformance.map((area) => (
              <div key={area.area} className="flex items-center justify-between text-sm">
                <span className="font-medium">{area.area}</span>
                <span className="text-muted-foreground">{area.count} leads</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.topProjects.map((project) => (
              <div key={project.id} className="text-sm">
                <div className="font-medium">{project.name}</div>
                <div className="text-xs text-muted-foreground">
                  {project.area || "Dubai"} · ROI {project.expectedRoi ?? "—"}%
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
