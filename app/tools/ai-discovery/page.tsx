"use client"

import Link from "next/link"
import { AISearchBar } from "@/components/ai-search-bar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function AiDiscoveryPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4 ore-gradient" variant="secondary">
                AI Discovery
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Discover Dubai Investments with AI
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Ask natural language questions and get curated project matches instantly.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <AISearchBar />
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Button className="ore-gradient" asChild>
                  <Link href="/chat">Open Full AI Chat</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/properties">Browse Listings</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
