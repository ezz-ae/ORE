import { DeveloperCard } from "@/components/developer-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getDevelopers } from "@/lib/ore"
import { filterAuthorizedDevelopers } from "@/lib/utils/authorized"
import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Top Real Estate Developers in Dubai | ORE",
  description: "Learn about the leading real estate developers in Dubai, including Emaar, Damac, Nakheel, and Sobha. Track records and project insights.",
  openGraph: {
    title: "Top Real Estate Developers in Dubai | ORE",
    description: "Learn about the leading real estate developers in Dubai.",
    images: ["/og-image.png"],
  },
}

export default async function DevelopersPage() {
  const developers = filterAuthorizedDevelopers(await getDevelopers())

  return (
    <>
        <section className="relative overflow-hidden border-b border-white/5 bg-[#0A1F17] py-16 md:py-24">
          <div className="absolute inset-0 z-0">
            <div className="absolute right-0 top-0 h-[420px] w-[420px] bg-[radial-gradient(circle_at_50%_50%,rgba(198,155,62,0.16),transparent_55%)] blur-[80px]" />
            <div className="absolute bottom-0 left-0 h-[360px] w-[360px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
          </div>
          <div className="container">
            <div className="relative z-10 mx-auto max-w-4xl text-center">
              <Badge className="mb-4 border-none bg-[#C69B3E]/10 px-4 py-1.5 text-[#F0D792]" variant="secondary">
                Developers
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                Dubai's Top Real Estate Developers
              </h1>
              <p className="mt-6 text-lg text-white/65">
                Explore Dubai's master developers, from legacy builders to innovative new firms shaping the skyline.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button className="ore-gradient text-[#152E24]" asChild>
                  <Link href="/projects">Explore Launches</Link>
                </Button>
                <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link href="/contact">Speak to an Advisor</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#0E241C] py-16 md:py-20">
          <div className="container">
            <div className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-8 lg:p-10">
              <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D792]">Verified Partners</p>
                  <h2 className="mt-2 font-serif text-2xl font-bold text-white md:text-3xl">Developer Directory</h2>
                  <p className="mt-2 text-sm text-white/60">
                    {developers.length} active developer profiles with track records, flagship launches, and delivery context.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/[0.05] text-white/75 hover:border-[#C69B3E]/25 hover:bg-white/[0.08] hover:text-white"
                  asChild
                >
                  <Link href="/projects">Browse Projects</Link>
                </Button>
              </div>

              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {developers.map((developer) => (
                  <DeveloperCard key={developer.id} developer={developer} />
                ))}
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
