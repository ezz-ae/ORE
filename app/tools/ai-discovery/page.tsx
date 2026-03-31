"use client"

import Link from "next/link"
import { AISearchBar } from "@/components/ai-search-bar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function AiDiscoveryPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/5 bg-[#0A1F17] py-16 md:py-24">
          <div className="absolute inset-0 z-0">
            <div className="absolute right-12 top-0 h-[380px] w-[380px] bg-[radial-gradient(circle_at_50%_50%,rgba(198,155,62,0.18),transparent_55%)] blur-[80px]" />
            <div className="absolute bottom-0 left-10 h-[320px] w-[320px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
          </div>
          <div className="container">
            <div className="relative z-10 mx-auto max-w-4xl text-center">
              <Badge className="mb-4 border-none bg-[#C69B3E]/10 px-4 py-1.5 text-[#F0D792]" variant="secondary">
                AI Discovery
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                Discover Dubai Investments with AI
              </h1>
              <p className="mt-6 text-lg text-white/65">
                Ask natural language questions and get curated project matches instantly.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 text-center shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-10 lg:p-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C69B3E]">Prompt the market</p>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#152E24] md:text-4xl">Search Dubai inventory like a private advisor</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-[#152E24]/55 md:text-base">
                Ask about ROI, visa eligibility, payment plans, or district fit and let the AI narrow the shortlist for you.
              </p>

              <div className="mt-8">
                <AISearchBar />
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Button className="ore-gradient text-[#152E24]" asChild>
                  <Link href="/chat">Open Full AI Chat</Link>
                </Button>
                <Button variant="outline" className="border-[#152E24]/10 bg-[#FAF8F5] text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
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
