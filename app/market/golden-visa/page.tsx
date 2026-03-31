import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Award, Users, CheckCircle2, Clock, FileText, TrendingUp } from "lucide-react"
import Link from "next/link"

export default function GoldenVisaPage() {
  return (
    <>
        {/* Header */}
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full ore-gradient mb-6">
                <Award className="h-10 w-10 text-primary-foreground" />
              </div>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                UAE <span className="ore-text-gradient">Golden Visa</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-balance">
                Secure long-term UAE residency through real estate investment. Your pathway to living, working, and thriving in Dubai.
              </p>
            </div>
          </div>
        </section>

        {/* What is Golden Visa */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-8">
                What is the UAE Golden Visa?
              </h2>
              
              <Card className="border-primary/50 mb-12">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground leading-relaxed">
                    The UAE Golden Visa is a long-term residency program launched by the UAE government to attract investors, entrepreneurs, and talented individuals. Property investors who purchase real estate valued at <strong className="text-foreground">AED 2 million or more</strong> are eligible for a <strong className="text-foreground">10-year renewable residency visa</strong>, providing stability and freedom to live, work, and invest in the UAE without the need for a sponsor.
                  </p>
                </CardContent>
              </Card>

              {/* Investment Tiers */}
              <h3 className="font-serif text-2xl font-bold tracking-tight mb-6">
                Investment Thresholds
              </h3>

              <div className="grid gap-6 md:grid-cols-2 mb-12">
                <Card className="border-border">
                    <CardHeader>
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                        <Award className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <CardTitle className="font-serif">AED 1 Million</CardTitle>
                      <CardDescription>10-Year Golden Visa</CardDescription>
                    </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Purchase property valued at minimum AED 1M</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>10-year renewable residency visa</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Can be ready property or off-plan</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Mortgages allowed when total investment still meets the AED 1M threshold</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Property must be retained for minimum 3 years</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-primary/50 bg-primary/5">
                  <CardHeader>
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                      <Award className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="font-serif">AED 2 Million</CardTitle>
                    <CardDescription>10-Year Golden Visa</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Purchase property valued at minimum AED 2M</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>10-year renewable residency visa</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Priority approvals for family sponsorship and renewals</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Fully paid investment (no mortgage allowed)</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-primary mt-0.5 flex-shrink-0" />
                        <span>Ten-year stability for you and your dependents</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Key Benefits */}
        <section className="bg-muted py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-8 text-center">
                Golden Visa Benefits
              </h2>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-border">
                  <CardHeader>
                    <Users className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="font-serif text-lg">Family Sponsorship</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Sponsor your spouse, children, and parents. Your family gets residency visas linked to yours.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <Clock className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="font-serif text-lg">No 6-Month Rule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Stay outside UAE for any duration without visa cancellation. Perfect for global investors.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <TrendingUp className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="font-serif text-lg">Business Freedom</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Work for any company, start your own business, or invest freely in the UAE.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <FileText className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="font-serif text-lg">No Sponsor Required</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Complete independence. No need for employer or local sponsor to maintain residency.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <Award className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="font-serif text-lg">Renewable Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Renewable every 10 years as long as you maintain property ownership.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="font-serif text-lg">Quality of Life</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Access to world-class healthcare, education, and lifestyle in one of the world’s safest cities.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Application Process */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-8">
                How to Apply for Golden Visa
              </h2>

              <div className="space-y-6">
                {[
                  {
                    step: 1,
                    title: "Purchase Eligible Property",
                    description: "Buy property worth minimum AED 1 million. Property must be freehold and registered with Dubai Land Department to qualify for the 10-year visa.",
                  },
                  {
                    step: 2,
                    title: "Obtain Title Deed",
                    description: "Complete property registration and receive official title deed in your name from Dubai Land Department.",
                  },
                  {
                    step: 3,
                    title: "Prepare Documents",
                    description: "Gather passport copies, title deed, bank statements, health insurance, and other required documents.",
                  },
                  {
                    step: 4,
                    title: "Submit Application",
                    description: "Apply online through ICP (Federal Authority for Identity and Citizenship) or through approved typing centers. Application fee: AED 3,000-10,000 depending on visa duration.",
                  },
                  {
                    step: 5,
                    title: "Medical Test & Emirates ID",
                    description: "Complete medical fitness test at approved center. Apply for Emirates ID with fingerprints and photo.",
                  },
                  {
                    step: 6,
                    title: "Visa Approval",
                    description: "Receive Golden Visa approval (typically 2-4 weeks). Visa is stamped in your passport.",
                  },
                  {
                    step: 7,
                    title: "Sponsor Family (Optional)",
                    description: "Submit applications for spouse, children, and parents residency visas linked to your Golden Visa.",
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

              <Card className="mt-8 bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Processing Time:</strong> 2-8 weeks on average. <strong className="text-foreground">Success Rate:</strong> Very high for property investors who meet requirements. We guide you through every step to ensure smooth approval.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Eligible Properties CTA */}
        <section className="bg-muted py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-3xl font-bold tracking-tight">
                Browse Golden Visa Eligible Properties
              </h2>
              <p className="mt-4 text-muted-foreground">
                Explore our curated selection of properties valued at AED 2M+ that qualify for UAE Golden Visa
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" className="ore-gradient" asChild>
                  <Link href="/properties?goldenVisa=true">View Eligible Properties</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/contact">Schedule Consultation</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20">
          <div className="container">
            <div className="mx-auto max-w-3xl">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-8">
                Frequently Asked Questions
              </h2>

              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">Can I get Golden Visa with a mortgaged property?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      For the 10-year visa, property investors are encouraged to keep equity at or above AED 1M; fully paid investments are preferred so approval is faster, though high-equity mortgages may still qualify upon review.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">Can I buy multiple properties totaling AED 2M?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Yes! You can combine multiple properties to meet the AED 2M threshold. For example, two properties worth AED 1M each qualify.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">Can I sell the property after getting Golden Visa?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      You must retain the property for a minimum of 3 years. If you sell before 3 years, your Golden Visa may be cancelled. After 3 years, you can sell but must purchase another qualifying property to maintain the visa.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">Does off-plan property qualify?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Yes, both ready properties and off-plan projects qualify for Golden Visa eligibility, as long as the value meets the threshold and you have a registered title deed or Oqood.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">What happens when my visa expires?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Your Golden Visa is renewable every 5 or 10 years as long as you still own the qualifying property (or equivalent value). The renewal process is straightforward.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
