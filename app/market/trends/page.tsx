"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, Download, Sparkles, BarChart3, LineChart, PieChart } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function MarketTrendsPage() {
  const [showAIChat, setShowAIChat] = useState(false)

  return (
    <>
        {/* Hero with AI Assistant */}
        <section id="overview" className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4 ore-gradient" variant="secondary">
                Market Intelligence
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Dubai Real Estate Market Trends
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Latest data, analytics, and AI-powered insights into Dubai’s property market
              </p>

              {/* AI Assistant CTA */}
              <Card className="mt-8 border-primary/50 bg-gradient-to-br from-card to-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">AI Market Analyst</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ask our AI about market trends, price forecasts, or investment opportunities
                  </p>
                  <Button className="ore-gradient" asChild>
                    <Link href="/chat">Ask AI About Market Trends</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Key Metrics */}
        <section id="metrics" className="border-b border-border bg-card py-12">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <div className="text-sm text-muted-foreground">Avg Property Price</div>
                </div>
                <div className="text-2xl font-bold">AED 1,850/sqft</div>
                <div className="text-sm text-green-600">+8.5% YoY</div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <div className="text-sm text-muted-foreground">Transaction Volume</div>
                </div>
                <div className="text-2xl font-bold">24,500</div>
                <div className="text-sm text-green-600">Q4 2025</div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LineChart className="h-4 w-4 text-primary" />
                  <div className="text-sm text-muted-foreground">Rental Yields</div>
                </div>
                <div className="text-2xl font-bold">7.2%</div>
                <div className="text-sm text-muted-foreground">Avg Annual</div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  <div className="text-sm text-muted-foreground">Off-Plan Share</div>
                </div>
                <div className="text-2xl font-bold">62%</div>
                <div className="text-sm text-green-600">+5% from 2025</div>
              </div>
            </div>
          </div>
        </section>

        {/* Price Trends by Area */}
        <section id="price-trends" className="py-16">
          <div className="container">
            <div className="mb-10">
              <h2 className="font-serif text-3xl font-bold mb-2">Price Trends by Area</h2>
              <p className="text-muted-foreground">Average price per sqft movement over the last 12 months</p>
            </div>

            <div className="grid gap-4">
              {[
                { area: "Dubai Marina", current: 1850, change: 8.5, trend: "up" },
                { area: "Downtown Dubai", current: 2100, change: 12.3, trend: "up" },
                { area: "Palm Jumeirah", current: 2400, change: 6.8, trend: "up" },
                { area: "Business Bay", current: 1450, change: 10.2, trend: "up" },
                { area: "JBR", current: 1950, change: 7.4, trend: "up" },
                { area: "Dubai Hills", current: 1650, change: 15.7, trend: "up" },
              ].map((item) => (
                <Card key={item.area}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{item.area}</div>
                        <div className="text-sm text-muted-foreground">AED {item.current}/sqft</div>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-1 ${item.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                          {item.trend === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          <span className="font-semibold">{item.change}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground">YoY Growth</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full ore-gradient" 
                        style={{ width: `${Math.min(item.change * 5, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Market Segments */}
        <section id="segments" className="py-16 bg-muted/30">
          <div className="container">
            <div className="mb-10">
              <h2 className="font-serif text-3xl font-bold mb-2">Market Segments</h2>
              <p className="text-muted-foreground">Performance breakdown by property type</p>
            </div>

            <Tabs defaultValue="offplan" className="max-w-4xl mx-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="offplan">Off-Plan</TabsTrigger>
                <TabsTrigger value="secondary">Secondary</TabsTrigger>
                <TabsTrigger value="commercial">Commercial</TabsTrigger>
              </TabsList>

              <TabsContent value="offplan" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Off-Plan Market</CardTitle>
                    <CardDescription>Properties under construction or pre-launch</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">62%</div>
                        <div className="text-sm text-muted-foreground">Market Share</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">15,180</div>
                        <div className="text-sm text-muted-foreground">Transactions (Q4)</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">+18%</div>
                        <div className="text-sm text-muted-foreground">YoY Growth</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Off-plan properties continue to dominate, driven by attractive payment plans and higher ROI potential. 
                        Developer incentives and flexible terms attract international investors.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="secondary" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Secondary Market</CardTitle>
                    <CardDescription>Ready properties available for immediate occupancy</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">35%</div>
                        <div className="text-sm text-muted-foreground">Market Share</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">8,575</div>
                        <div className="text-sm text-muted-foreground">Transactions (Q4)</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">+6%</div>
                        <div className="text-sm text-muted-foreground">YoY Growth</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Secondary market shows steady growth with immediate rental income opportunities. 
                        Preferred by investors seeking cash flow from day one.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="commercial" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Commercial Real Estate</CardTitle>
                    <CardDescription>Office spaces, retail, and warehouses</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">3%</div>
                        <div className="text-sm text-muted-foreground">Market Share</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">745</div>
                        <div className="text-sm text-muted-foreground">Transactions (Q4)</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold ore-text-gradient">+12%</div>
                        <div className="text-sm text-muted-foreground">YoY Growth</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Commercial sector recovering strongly post-pandemic. Office demand up with business expansion, 
                        retail spaces in prime locations commanding premium rents.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Reports */}
        <section id="reports" className="py-16">
          <div className="container">
            <div className="mb-10">
              <h2 className="font-serif text-3xl font-bold mb-2">Market Reports</h2>
              <p className="text-muted-foreground">Download comprehensive analysis and forecasts</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "Q4 2025 Market Overview", pages: 24, date: "Dec 2025" },
                { title: "Annual Report 2025", pages: 48, date: "Jan 2026" },
                { title: "Off-Plan Investment Guide", pages: 32, date: "Nov 2025" },
                { title: "Dubai Hills Market Analysis", pages: 16, date: "Oct 2025" },
                { title: "Luxury Segment Report", pages: 28, date: "Sep 2025" },
                { title: "Rental Market Trends", pages: 20, date: "Aug 2025" },
              ].map((report, idx) => (
                <Card key={idx}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-10 w-10 rounded-lg ore-gradient flex items-center justify-center">
                        <Download className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <Badge variant="outline">{report.date}</Badge>
                    </div>
                    <h3 className="font-semibold mb-2">{report.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{report.pages} pages</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Download PDF
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* AI CTA */}
        <section id="ai-cta" className="py-16 bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="container">
            <Card className="max-w-4xl mx-auto border-primary/50">
              <CardContent className="p-8 md:p-12">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full ore-gradient flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h2 className="font-serif text-3xl font-bold">Ask Our AI Market Analyst</h2>
                </div>
                <p className="text-center text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Get instant answers about market trends, price forecasts, investment hotspots, or any data-driven insights. 
                  Our AI analyzes 3500+ projects in real-time.
                </p>
                <div className="flex flex-wrap gap-3 justify-center mb-6">
                  <Badge variant="outline">What’s the best area for ROI?</Badge>
                  <Badge variant="outline">Which developer is most reliable?</Badge>
                  <Badge variant="outline">Are prices going up or down?</Badge>
                  <Badge variant="outline">Best time to invest in off-plan?</Badge>
                </div>
                <div className="text-center">
                  <Button size="lg" className="ore-gradient" asChild>
                    <Link href="/chat">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Start AI Conversation
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
    </>
  )
}
