import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Privacy Policy · ORE Real Estate",
  description:
    "ORE Real Estate protects investor data with Entrestate Intelligence. Review how we collect, use, and safeguard your information.",
}

const privacyItems = [
  {
    title: "Data we collect",
    body: "We collect contact details, property preferences, engagement metrics, and CRM activity to deliver timely intelligence. Nothing is stored longer than necessary.",
  },
  {
    title: "How we use it",
    body: "Investor signals power market briefs, developer matching, and personalized chat responses. We never sell your data and only share with trusted partners.",
  },
  {
    title: "Security & storage",
    body: "All data is encrypted in transit, stored in Neon PostgreSQL, and audited via Entrestate Intelligence logs. Access is tier-gated per internal policy.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="border-b border-border bg-gradient-to-b from-background to-muted py-20">
        <div className="container">
          <Badge variant="secondary" className="ore-gradient">
            Privacy
          </Badge>
          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">
            We collect only what is needed to deliver transparent Dubai investment intelligence. You can always request deletion or see data we hold by contacting
            <Link href="/contact" className="ml-1 text-primary underline">
              hello@orerealestate.ae
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container grid gap-8 md:grid-cols-3">
          {privacyItems.map((item) => (
            <Card key={item.title}>
              <CardContent className="space-y-3">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 bg-muted/40">
        <div className="container max-w-3xl">
          <div className="space-y-4 rounded-3xl border border-border bg-card p-8">
            <h3 className="font-serif text-2xl font-bold">Need help with your data?</h3>
            <p className="text-sm text-muted-foreground">
              Reach out to our privacy officer and we will respond within 48 hours. All requests are tracked inside Entrestate Intelligence for compliance.
            </p>
            <Link href="/contact" className="inline-flex items-center gap-2 text-primary font-semibold">
              Contact privacy team →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
