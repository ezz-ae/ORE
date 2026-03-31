import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Shield, Globe, Building2, Plane, Sun, Award, ChartBar } from "lucide-react"
import Link from "next/link"

export default function WhyDubaiPage() {
  return (
    <>
        {/* Header */}
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Why Invest in <span className="ore-text-gradient">Dubai Real Estate</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-balance">
                Discover why Dubai has become the world’s most attractive destination for international property investors
              </p>
            </div>
          </div>
        </section>

        {/* Key Benefits Grid */}
        <section className="py-20">
          <div className="container">
            <div className="mb-16 text-center">
              <h2 className="font-serif text-3xl font-bold tracking-tight">
                Unmatched Investment Advantages
              </h2>
              <p className="mt-4 text-muted-foreground">
                Dubai offers a unique combination of benefits that no other global city can match
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <TrendingUp className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Zero Property Tax</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No property tax, no capital gains tax, and no inheritance tax. Keep 100% of your rental income and property appreciation. This alone makes Dubai one of the most tax-efficient real estate markets globally.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <ChartBar className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">High Rental Yields</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Average rental yields of 8-12% far exceed most global cities. Prime areas like Dubai Marina and Downtown consistently deliver double-digit returns, with strong tenant demand from expats and professionals.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Globe className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Strategic Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Gateway between East and West. Within 8 hours flight time to 70% of the world’s population. Dubai’s position as a global business hub ensures constant demand from international residents and investors.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Shield className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Stable Economy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Political stability, business-friendly regulations, and diversified economy beyond oil. The UAE dirham is pegged to the US dollar, providing currency stability for international investors.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Building2 className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">World-Class Infrastructure</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    State-of-the-art infrastructure, world’s busiest international airport, cutting-edge metro system, and iconic developments. Continuous investment in infrastructure supports long-term property value growth.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Award className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Golden Visa Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Invest AED 2M+ in property and qualify for long-term UAE residency. Sponsor your family, enjoy visa-free travel to 180+ countries, and establish a base in one of the world’s safest cities.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Sun className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Premium Lifestyle</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Year-round sunshine, pristine beaches, world-class dining, luxury shopping, and family-friendly entertainment. Dubai offers a quality of life that attracts high-net-worth tenants willing to pay premium rents.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <Plane className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Easy Market Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Simple property purchase process for foreigners in freehold areas. English is widely spoken, transparent pricing, secure title deeds registered with Dubai Land Department. Remote buying is streamlined and secure.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                    <TrendingUp className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="font-serif">Strong Appreciation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Historical average appreciation of 7-10% annually in prime areas. Major events like Expo 2020 legacy projects, World Expo 2040 bid, and continuous infrastructure development drive long-term value growth.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Historical Performance */}
        <section className="bg-muted py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <h2 className="font-serif text-3xl font-bold tracking-tight text-center mb-12">
                Track Record of Success
              </h2>
              
              <div className="grid gap-8 md:grid-cols-3 mb-12">
                <div className="text-center">
                  <div className="text-4xl font-bold ore-text-gradient mb-2">15%</div>
                  <div className="text-sm text-muted-foreground">Price Growth 2025-2026</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold ore-text-gradient mb-2">130K+</div>
                  <div className="text-sm text-muted-foreground">Transactions in 2025</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold ore-text-gradient mb-2">$140B+</div>
                  <div className="text-sm text-muted-foreground">Total Sales Volume 2025</div>
                </div>
              </div>

              <Card className="border-border">
                <CardContent className="pt-6">
                  <h3 className="font-serif text-xl font-semibold mb-4">Success Stories</h3>
                  <div className="space-y-4">
                    <div className="border-l-2 border-primary pl-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        “Purchased a 2BR in Dubai Marina in 2019 for AED 1.8M. Today it’s valued at AED 2.6M with consistent rental income of AED 150K annually. The Golden Visa was an added bonus for my family.”
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">- James K., UK Investor</p>
                    </div>
                    <div className="border-l-2 border-primary pl-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        “Off-plan investment in Downtown delivered 22% ROI over 3 years. The tax-free rental income and capital appreciation exceeded all expectations. Now expanding portfolio with 2 more units.”
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">- Sarah M., Singapore Investor</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-3xl font-bold tracking-tight">
                Ready to Start Your Dubai Investment Journey?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Explore 3500+ properties and get personalized recommendations from our AI assistant
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" className="ore-gradient" asChild>
                  <Link href="/properties">Browse Properties</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/contact">Schedule Consultation</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
