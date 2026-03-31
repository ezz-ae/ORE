import type { Metadata } from "next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Review the terms that govern your use of ORE's investor platform, chat, and data services powered by ORE Intelligence.",
  alternates: {
    canonical: "/terms",
  },
}

const termsItems = [
  {
    title: "Use of platform",
    body: "ORE provides curated Dubai market intelligence, chat, and tools for registered investors. Access to each feature is governed by tier-specific entitlements.",
  },
  {
    title: "Data accuracy",
    body: "Every number is backed by live ORE data. We do not guarantee future performance, but we strive to show meaningful signals while guarding against zero-value artifacts.",
  },
  {
    title: "Content & conduct",
    body: "Users must not abuse the AI assistant, inject harmful prompts, or redistribute proprietary content. Violations may lead to immediate suspension.",
  },
]

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="border-b border-border bg-gradient-to-b from-background to-muted py-20">
        <div className="container">
          <Badge variant="secondary" className="ore-gradient">
            Terms
          </Badge>
          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">
            These terms explain how you may interact with ORE Real Estate and the ORE Intelligence tools embedded across the platform.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container space-y-6">
          {termsItems.map((item) => (
            <Card key={item.title}>
              <CardContent className="space-y-3">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="rounded-3xl border border-border bg-card p-10 text-center">
            <h3 className="font-serif text-2xl font-bold">Need a copy for your legal team?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We can share an official PDF appendix covering compliance, data handling, and tier gating upon request.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
