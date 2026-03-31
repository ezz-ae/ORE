import Link from "next/link"
import { MarketSnapshot } from "@/components/market-snapshot"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, BarChart3, Globe } from "lucide-react"

export default function MarketTrackerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4 ore-gradient" variant="secondary">
                Market Tracker
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Dubai Market Tracker
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Stay on top of price trends, demand signals, and investment insights.
              </p>
            </div>
          </div>
        </section>

        <MarketSnapshot />

        <section className="py-16">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardContent className="p-6 space-y-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold">Quarterly Trend Report</h3>
                  <p className="text-sm text-muted-foreground">
                    Track price movement across top Dubai communities.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 space-y-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold">Demand Signals</h3>
                  <p className="text-sm text-muted-foreground">
                    See the most searched areas and top-performing projects.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 space-y-2">
                  <Globe className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold">Investor Sentiment</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor international buyer interest and demand shifts.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-10 text-center">
              <Button className="ore-gradient" asChild>
                <Link href="/market/trends">View Full Market Insights</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
