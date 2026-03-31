import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, FileText, Award, DollarSign, Map, BarChart3, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function MarketPage() {
  return (
    <>
        {/* Header */}
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Dubai Real Estate <span className="ore-text-gradient">Market Intelligence</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Comprehensive insights, regulations, and opportunities in the world’s most dynamic property market
              </p>
            </div>
          </div>
        </section>

        {/* Key Stats */}
        <section className="py-12 bg-card border-b border-border">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="text-3xl font-bold ore-text-gradient">9.2%</div>
                <div className="mt-1 text-sm text-muted-foreground">Avg Annual ROI</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold ore-text-gradient">$140B+</div>
                <div className="mt-1 text-sm text-muted-foreground">Transaction Volume 2025</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold ore-text-gradient">No tax</div>
                <div className="mt-1 text-sm text-muted-foreground">Property Tax</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold ore-text-gradient">190+</div>
                <div className="mt-1 text-sm text-muted-foreground">Nationalities Invested</div>
              </div>
            </div>
          </div>
        </section>

        {/* Market Topics Grid */}
        <section className="py-20">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="group border-border hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <TrendingUp className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Why Dubai</CardTitle>
                  <CardDescription>
                    The compelling investment case for Dubai real estate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li>• No property or capital gains tax</li>
                    <li>• 8-12% average rental yields</li>
                    <li>• Strategic global location</li>
                    <li>• World-class infrastructure</li>
                  </ul>
                  <Button variant="outline" className="w-full group-hover:border-primary" asChild>
                    <Link href="/market/why-dubai">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="group border-border hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <FileText className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Regulations & Legal</CardTitle>
                  <CardDescription>
                    Legal framework for international property buyers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li>• Freehold vs leasehold explained</li>
                    <li>• Purchase process step-by-step</li>
                    <li>• Required documents</li>
                    <li>• Ownership rights & protections</li>
                  </ul>
                  <Button variant="outline" className="w-full group-hover:border-primary" asChild>
                    <Link href="/market/regulations">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="group border-border hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Award className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Golden Visa</CardTitle>
                  <CardDescription>
                    Long-term UAE residency through real estate investment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li>• AED 2M+ property eligibility</li>
                    <li>• 10-year residency permits</li>
                    <li>• Family sponsorship benefits</li>
                    <li>• Application process guide</li>
                  </ul>
                  <Button variant="outline" className="w-full group-hover:border-primary" asChild>
                    <Link href="/market/golden-visa">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="group border-border hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <DollarSign className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Financing Options</CardTitle>
                  <CardDescription>
                    Mortgage and payment plans for international buyers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li>• 50-80% loan-to-value ratios</li>
                    <li>• Participating banks & lenders</li>
                    <li>• Developer payment plans</li>
                    <li>• Pre-approval process</li>
                  </ul>
                  <Button variant="outline" className="w-full group-hover:border-primary" asChild>
                    <Link href="/market/financing">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="group border-border hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Map className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Areas Guide</CardTitle>
                  <CardDescription>
                    Compare Dubai’s premier neighborhoods and locations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li>• Area-by-area comparison</li>
                    <li>• Price trends & forecasts</li>
                    <li>• Lifestyle factors</li>
                    <li>• Investment scores</li>
                  </ul>
                  <Button variant="outline" className="w-full group-hover:border-primary" asChild>
                    <Link href="/market/areas">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="group border-border hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <BarChart3 className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Market Trends</CardTitle>
                  <CardDescription>
                    Latest analytics, reports and AI-powered insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li>• Price trends by area</li>
                    <li>• Transaction volume analysis</li>
                    <li>• Supply & demand forecasts</li>
                    <li>• AI market assistant</li>
                  </ul>
                  <Button variant="outline" className="w-full group-hover:border-primary" asChild>
                    <Link href="/market/trends">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Latest Market Update */}
        <section className="bg-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-3xl font-bold tracking-tight">
                Ready to Explore Dubai Real Estate?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Get personalized market insights and property recommendations from our AI assistant
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" className="ore-gradient" asChild>
                  <Link href="/chat">Ask AI Assistant</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/properties">Browse Properties</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
