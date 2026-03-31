"use client"

import { useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function PaymentSimulatorPage() {
  const [price, setPrice] = useState(1800000)
  const [downPayment, setDownPayment] = useState(20)
  const [duringConstruction, setDuringConstruction] = useState(50)
  const [onHandover, setOnHandover] = useState(30)
  const [postHandover, setPostHandover] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  const calcAmount = (percent: number) => (price * percent) / 100
  const totalPercent = downPayment + duringConstruction + onHandover + postHandover
  const installments = [
    { id: "downPayment", label: "Down Payment (%)", percent: downPayment, setter: setDownPayment },
    { id: "duringConstruction", label: "During Construction (%)", percent: duringConstruction, setter: setDuringConstruction },
    { id: "onHandover", label: "On Handover (%)", percent: onHandover, setter: setOnHandover },
    { id: "postHandover", label: "Post Handover (%)", percent: postHandover, setter: setPostHandover },
  ]

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
                Payment Simulator
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
                Model Off-Plan Payment Plans
              </h1>
              <p className="mt-4 text-muted-foreground">
                Adjust percentages to estimate installment amounts.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container grid gap-8 lg:grid-cols-[1fr,1fr]">
            <Card className="rounded-[2rem] border-border shadow-lg overflow-hidden">
              <CardContent className="p-8 space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Property Price (AED)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="h-12 rounded-xl bg-muted/50 border-border focus:ring-primary/20"
                      autoFocus
                    />
                  </div>

                  <div className="grid gap-6">
                    {installments.map((item) => (
                      <div key={item.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={item.id} className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{item.label}</Label>
                          <span className="text-xs font-bold text-primary">AED {calcAmount(item.percent).toLocaleString()}</span>
                        </div>
                        <Input
                          id={item.id}
                          type="number"
                          value={item.percent}
                          onChange={(e) => item.setter(Number(e.target.value))}
                          className="h-10 rounded-lg bg-muted/30 border-border"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  className="ore-gradient w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                  onClick={handleSubmit}
                >
                  Analyze Payment Flow
                </Button>
              </CardContent>
            </Card>

            <Card ref={resultRef} className="scroll-mt-24 rounded-[2rem] bg-muted/30 border-border shadow-inner overflow-hidden">
              <CardContent className="p-8 space-y-8">
                <div className="flex items-center justify-between border-b border-border/50 pb-6">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Plan Allocation</div>
                  <div className={`text-xl font-bold ${totalPercent === 100 ? "text-green-600" : "text-red-500"}`}>
                    {totalPercent}%
                  </div>
                </div>

                <div className="space-y-6">
                  {installments.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold">{item.label.replace(" (%)", "")}</div>
                        <div className="text-[10px] uppercase text-muted-foreground font-medium tracking-tight">{item.percent}% of total</div>
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        AED {calcAmount(item.percent).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-border/50">
                  <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                    This model is for estimation purposes. Request a custom plan to see developer-specific incentives and rebates.
                  </p>
                  <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5" asChild>
                    <a href="/contact">Get Official Payment Schedule</a>
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
