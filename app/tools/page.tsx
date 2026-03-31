import Link from "next/link"
import { Calculator, CreditCard, BarChart3, Sparkles, LineChart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const tools = [
  {
    title: "ROI Calculator",
    description: "Estimate rental yield, ROI, and cash flow performance.",
    href: "/tools/roi-calculator",
    icon: Calculator,
  },
  {
    title: "Payment Simulator",
    description: "Model off-plan payment schedules and installment splits.",
    href: "/tools/payment-simulator",
    icon: CreditCard,
  },
  {
    title: "Project Comparator",
    description: "Compare two projects side by side on key metrics.",
    href: "/tools/comparator",
    icon: BarChart3,
  },
  {
    title: "AI Discovery",
    description: "Use AI to find matching projects and areas instantly.",
    href: "/tools/ai-discovery",
    icon: Sparkles,
  },
  {
    title: "Market Tracker",
    description: "Monitor trends and demand signals across Dubai.",
    href: "/tools/market-tracker",
    icon: LineChart,
  },
]

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4 ore-gradient" variant="secondary">
                Tools
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Investment Intelligence Tools
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Use calculators and AI insights to make confident Dubai property decisions.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const Icon = tool.icon
                return (
                  <Card key={tool.title} className="group transition-all hover:border-primary/50 hover:shadow-lg">
                    <CardContent className="p-6 space-y-4">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg ore-gradient">
                        <Icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl font-semibold">{tool.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                      <Button variant="outline" asChild className="w-full">
                        <Link href={tool.href}>Open Tool</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
