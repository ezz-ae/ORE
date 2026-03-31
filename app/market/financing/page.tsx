"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, CreditCard, Calculator, FileText, CheckCircle2, AlertCircle, ArrowRight, Banknote } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function FinancingPage() {
  const [loanAmount, setLoanAmount] = useState(2000000)
  const [downPayment, setDownPayment] = useState(500000)
  const [years, setYears] = useState(25)
  const interestRate = 4.5

  const monthlyPayment = calculateMonthlyPayment(
    loanAmount - downPayment,
    interestRate,
    years
  )

  return (
    <>
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4 ore-gradient" variant="secondary">
                Financing Options
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Mortgage & Financing for International Buyers
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Access competitive financing options from leading UAE banks. Get pre-approved and start your Dubai property investment journey.
              </p>
            </div>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="border-b border-border bg-card py-8">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold ore-text-gradient">50-80%</div>
                <div className="text-sm text-muted-foreground">Loan-to-Value</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold ore-text-gradient">4-6%</div>
                <div className="text-sm text-muted-foreground">Interest Rates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold ore-text-gradient">25 Years</div>
                <div className="text-sm text-muted-foreground">Max Term</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold ore-text-gradient">15+</div>
                <div className="text-sm text-muted-foreground">Partner Banks</div>
              </div>
            </div>
          </div>
        </section>

        {/* Mortgage Calculator */}
        <section id="calculator" className="py-16">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="text-center mb-10">
                <h2 className="font-serif text-3xl font-bold">Mortgage Calculator</h2>
                <p className="mt-2 text-muted-foreground">Estimate your monthly payments</p>
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-medium">Property Price (AED)</label>
                      <input
                        type="range"
                        min="500000"
                        max="10000000"
                        step="100000"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(Number(e.target.value))}
                        className="w-full mt-2"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>AED {loanAmount.toLocaleString()}</span>
                        <span>${(loanAmount / 3.67).toFixed(0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Down Payment (AED)</label>
                      <input
                        type="range"
                        min={loanAmount * 0.2}
                        max={loanAmount * 0.5}
                        step="50000"
                        value={downPayment}
                        onChange={(e) => setDownPayment(Number(e.target.value))}
                        className="w-full mt-2"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>AED {downPayment.toLocaleString()} ({((downPayment/loanAmount)*100).toFixed(0)}%)</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Loan Term (Years)</label>
                      <input
                        type="range"
                        min="5"
                        max="25"
                        step="5"
                        value={years}
                        onChange={(e) => setYears(Number(e.target.value))}
                        className="w-full mt-2"
                      />
                      <div className="text-sm text-muted-foreground mt-1">{years} years</div>
                    </div>

                    <div className="rounded-lg ore-gradient p-6 text-center">
                      <div className="text-sm text-primary-foreground/80">Estimated Monthly Payment</div>
                      <div className="text-3xl font-bold text-primary-foreground mt-2">
                        AED {monthlyPayment.toLocaleString()}
                      </div>
                      <div className="text-sm text-primary-foreground/80 mt-1">
                        ${(monthlyPayment / 3.67).toFixed(0).toLocaleString()} USD
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      * Based on {interestRate}% interest rate. Actual rates may vary by bank and profile.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Loan Options */}
        <section id="loan-options" className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-bold">Loan Options</h2>
              <p className="mt-2 text-muted-foreground">Choose the financing that suits your needs</p>
            </div>

            <Tabs defaultValue="resident" className="mx-auto max-w-4xl">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="resident">UAE Residents</TabsTrigger>
                <TabsTrigger value="non-resident">Non-Residents</TabsTrigger>
              </TabsList>
              
              <TabsContent value="resident" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>UAE Resident Financing</CardTitle>
                    <CardDescription>Better terms for residents and visa holders</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Up to 80% LTV</div>
                        <div className="text-sm text-muted-foreground">Higher loan-to-value ratio for residents</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Lower Interest Rates</div>
                        <div className="text-sm text-muted-foreground">From 4% p.a. for eligible applicants</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Longer Terms</div>
                        <div className="text-sm text-muted-foreground">Up to 25 years loan tenure</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Flexible Repayment</div>
                        <div className="text-sm text-muted-foreground">Options for early settlement without penalties</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="non-resident" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Non-Resident Financing</CardTitle>
                    <CardDescription>Accessible mortgages for international investors</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Up to 50% LTV</div>
                        <div className="text-sm text-muted-foreground">50-60% financing available for non-residents</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Competitive Rates</div>
                        <div className="text-sm text-muted-foreground">From 5% p.a. based on profile</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Up to 20 Years</div>
                        <div className="text-sm text-muted-foreground">Substantial loan periods available</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Higher Down Payment</div>
                        <div className="text-sm text-muted-foreground">Minimum 40-50% down payment required</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Required Documents */}
        <section id="documents" className="py-16">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-bold">Required Documents</h2>
              <p className="mt-2 text-muted-foreground">What you’ll need for mortgage application</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              <Card>
                <CardHeader>
                  <FileText className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Identity Proof</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Passport copy</li>
                    <li>• Emirates ID (residents)</li>
                    <li>• Visa copy (residents)</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Banknote className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Income Proof</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Last 6 months bank statements</li>
                    <li>• Salary certificate</li>
                    <li>• Income tax returns</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Building2 className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Property Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Sale agreement</li>
                    <li>• Property valuation</li>
                    <li>• NOC from developer</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Partner Banks */}
        <section id="banks" className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl font-bold">Our Partner Banks</h2>
              <p className="mt-2 text-muted-foreground">Access to UAE’s leading financial institutions</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 max-w-4xl mx-auto">
              {["Emirates NBD", "Dubai Islamic Bank", "ADCB", "Mashreq Bank", "FAB"].map((bank) => (
                <Card key={bank} className="text-center">
                  <CardContent className="p-6">
                    <div className="h-16 flex items-center justify-center">
                      <div className="font-medium">{bank}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="pre-approval" className="py-16">
          <div className="container">
            <Card className="ore-gradient">
              <CardContent className="p-8 md:p-12 text-center">
                <h2 className="font-serif text-3xl font-bold text-primary-foreground">
                  Ready to Get Pre-Approved?
                </h2>
                <p className="mt-4 text-primary-foreground/90 max-w-2xl mx-auto">
                  Our mortgage specialists will help you find the best financing option and guide you through the application process.
                </p>
                <div className="flex flex-wrap gap-4 justify-center mt-8">
                  <Button size="lg" variant="secondary" asChild>
                    <Link href="/contact">Get Pre-Approved</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" asChild>
                    <Link href="/properties">Browse Properties</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
    </>
  )
}

function calculateMonthlyPayment(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 100 / 12
  const numPayments = years * 12
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
  return Math.round(payment)
}
