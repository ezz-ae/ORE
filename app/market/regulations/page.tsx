import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, CheckCircle2, Users, Shield, Home, MapPin } from "lucide-react"
import Link from "next/link"

export default function RegulationsPage() {
  return (
    <>
        {/* Header */}
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Dubai Real Estate <span className="ore-text-gradient">Regulations</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-balance">
                Complete guide to legal framework, ownership rights, and purchase process for international buyers
              </p>
            </div>
          </div>
        </section>

        {/* Freehold vs Leasehold */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-8">
                Freehold vs Leasehold Ownership
              </h2>
              
              <div className="grid gap-6 md:grid-cols-2 mb-12">
                <Card className="border-primary/50">
                  <CardHeader>
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                      <Home className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="font-serif">Freehold</CardTitle>
                    <CardDescription>Full ownership with no expiry</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Complete ownership of property and land</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Perpetual ownership - no time limit</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Can sell, rent, or mortgage freely</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Available to all nationalities in designated areas</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Eligible for Golden Visa (if AED 2M+)</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                      <FileText className="h-6 w-6 text-secondary-foreground" />
                    </div>
                    <CardTitle className="font-serif">Leasehold</CardTitle>
                    <CardDescription>Long-term lease with fixed duration</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>Lease period typically 10-99 years</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>Renewable upon expiry (subject to terms)</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>Can rent out property</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>Selling may require landlord approval</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>Generally lower purchase prices</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Recommendation for International Investors:</strong> Freehold properties offer better value, complete ownership rights, Golden Visa eligibility, and easier resale. Over 95% of international buyers choose freehold.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Freehold Areas */}
        <section className="bg-muted py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg ore-gradient">
                  <MapPin className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="font-serif text-3xl font-bold tracking-tight">
                  Freehold Areas for Foreign Ownership
                </h2>
              </div>
              
              <p className="text-muted-foreground mb-8">
                International buyers can purchase freehold properties in these designated areas:
              </p>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  "Dubai Marina",
                  "Downtown Dubai",
                  "Palm Jumeirah",
                  "Jumeirah Beach Residence (JBR)",
                  "Business Bay",
                  "Dubai Hills Estate",
                  "Arabian Ranches",
                  "Emirates Living",
                  "Dubai Sports City",
                  "International City",
                  "Jumeirah Village Circle/Triangle",
                  "Dubai Silicon Oasis",
                ].map((area) => (
                  <div key={area} className="flex items-center gap-2 rounded-lg bg-card p-3 border border-border">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{area}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-6">
                * This list includes major freehold areas. Dubai Land Department maintains an official registry of all freehold zones. Always verify property status before purchase.
              </p>
            </div>
          </div>
        </section>

        {/* Purchase Process */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-8">
                Property Purchase Process
              </h2>

              <div className="space-y-6">
                {[
                  {
                    step: 1,
                    title: "Property Selection",
                    description: "Browse properties, conduct viewings (virtual or in-person), and select your ideal investment.",
                  },
                  {
                    step: 2,
                    title: "Reservation",
                    description: "Pay reservation fee (typically 10% of property value) to secure the property. Sign Memorandum of Understanding (MOU).",
                  },
                  {
                    step: 3,
                    title: "Sales Agreement",
                    description: "Review and sign Sale and Purchase Agreement (SPA) with developer or seller. This is the legally binding contract.",
                  },
                  {
                    step: 4,
                    title: "Mortgage Approval (if applicable)",
                    description: "Complete mortgage application with chosen bank. Pre-approval is recommended before reserving property.",
                  },
                  {
                    step: 5,
                    title: "Payment",
                    description: "Complete payment according to agreed schedule. Off-plan: installments during construction. Ready: balance at transfer.",
                  },
                  {
                    step: 6,
                    title: "Dubai Land Department Registration",
                    description: "Property registered with Dubai Land Department. Pay 4% transfer fee (2% buyer, 2% seller) plus admin fees.",
                  },
                  {
                    step: 7,
                    title: "Title Deed Issuance",
                    description: "Receive official title deed proving ownership. This is registered in your name with Dubai Land Department.",
                  },
                  {
                    step: 8,
                    title: "Handover (for off-plan)",
                    description: "Developer hands over completed property. Conduct snagging inspection before final acceptance.",
                  },
                ].map((item) => (
                  <Card key={item.step} className="border-border">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg ore-gradient font-bold text-primary-foreground">
                          {item.step}
                        </div>
                        <CardTitle className="font-serif">{item.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Required Documents */}
        <section className="bg-muted py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg ore-gradient">
                  <FileText className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="font-serif text-3xl font-bold tracking-tight">
                  Required Documents
                </h2>
              </div>

              <Card className="border-border">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">For All Buyers:</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Valid passport copy (notarized)</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>UAE visa copy (if resident) or entry stamp</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Emirates ID (if UAE resident)</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">For Mortgage Buyers (Additional):</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Salary certificate and bank statements (6 months)</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Proof of address and employment</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Credit report (some banks)</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">For Company Purchases:</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Trade license and memorandum of association</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Board resolution authorizing purchase</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                          <span>Authorized signatory passport copies</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Ownership Rights */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg ore-gradient">
                  <Shield className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="font-serif text-3xl font-bold tracking-tight">
                  Your Ownership Rights & Protections
                </h2>
              </div>

              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>As a Foreign Property Owner in Dubai, You Have:</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Full ownership rights</strong> - Buy, sell, rent, mortgage, or bequeath without restrictions</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Legal title deed</strong> - Official documentation from Dubai Land Department proving ownership</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Repatriation of funds</strong> - Transfer rental income and sale proceeds overseas without restriction</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Inheritance rights</strong> - Property can be passed to heirs according to your home country laws or Sharia law</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Rental income</strong> - Collect and keep 100% of rental income (no property tax)</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Legal protection</strong> - Dubai courts protect foreign investors’ property rights equally</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span><strong className="text-foreground">Escrow protection</strong> - Off-plan payments held in escrow accounts until construction milestones met</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-muted py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-3xl font-bold tracking-tight">
                Need Help Navigating the Process?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Our team guides international buyers through every step, ensuring a smooth and secure purchase
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" className="ore-gradient" asChild>
                  <Link href="/contact">Schedule Consultation</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/market/golden-visa">Learn About Golden Visa</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
