"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AISearchBar } from "@/components/ai-search-bar"

export function AIMarketPanel() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container">
        <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">ORE AI Market Analysis</p>
          <h2 className="font-serif text-3xl font-bold">Ask ORE AI</h2>
          <p className="text-muted-foreground">
            Connect your search with ORE AI for live intelligence, demand trends,
            and tailored recommendations.
          </p>
          <div className="mx-auto max-w-xl">
            <AISearchBar placeholder="Ask ORE about Dubai market trends, yields, or off-plan strategy..." />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" className="ore-gradient" asChild>
              <Link href="/chat">Open ORE AI</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
