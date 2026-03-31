"use client"

import { useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function RoiCalculatorPage() {
  const [price, setPrice] = useState(1500000)
  const [annualRent, setAnnualRent] = useState(120000)
  const [annualCosts, setAnnualCosts] = useState(15000)
  const resultRef = useRef<HTMLDivElement>(null)

  const grossYield = price > 0 ? (annualRent / price) * 100 : 0
  const netYield = price > 0 ? ((annualRent - annualCosts) / price) * 100 : 0
  const monthlyCashflow = (annualRent - annualCosts) / 12

  const handleSubmit = () => {
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-4 ore-gradient" variant="secondary">
                ROI Calculator
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
                Estimate Rental ROI
              </h1>
              <p className="mt-4 text-muted-foreground">
                Calculate gross and net rental yield for your Dubai investment.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container grid gap-8 lg:grid-cols-[1fr,1fr]">
            <Card className="rounded-[2rem] border-border shadow-lg overflow-hidden">
              <CardContent className="p-8 space-y-8">
                <div>
                  <h3 className="font-serif text-xl font-bold mb-6">Investment Parameters</h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Price (AED)</Label>
                      <Input
                        id="price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="h-12 rounded-xl bg-muted/50 border-border focus:ring-primary/20"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="annualRent" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Annual Rent (AED)</Label>
                      <Input
                        id="annualRent"
                        type="number"
                        value={annualRent}
                        onChange={(e) => setAnnualRent(Number(e.target.value))}
                        className="h-12 rounded-xl bg-muted/50 border-border focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="annualCosts" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Annual Costs (AED)</Label>
                      <Input
                        id="annualCosts"
                        type="number"
                        value={annualCosts}
                        onChange={(e) => setAnnualCosts(Number(e.target.value))}
                        className="h-12 rounded-xl bg-muted/50 border-border focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  className="ore-gradient w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                  onClick={handleSubmit}
                >
                  Update Intelligence
                </Button>
              </CardContent>
            </Card>

            <Card ref={resultRef} className="scroll-mt-24 rounded-[2rem] bg-muted/30 border-border shadow-inner overflow-hidden">
              <CardContent className="p-8 space-y-10">
                <h3 className="font-serif text-xl font-bold">Yield Analysis</h3>
                <div className="grid gap-8">
                  <div className="flex items-center justify-between border-b border-border/50 pb-6">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Gross Rental Yield</div>
                      <div className="text-4xl font-bold ore-text-gradient">{grossYield.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-6">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Net Rental Yield</div>
                      <div className="text-4xl font-bold ore-text-gradient">{netYield.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Monthly Cashflow</div>
                      <div className="text-3xl font-bold text-foreground">
                        AED {monthlyCashflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-6">
                  <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5" asChild>
                    <a href="/contact">Request Detailed ROI Report</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
