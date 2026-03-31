import { AreaCard } from "@/components/area-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SmallLeadForm } from "@/components/small-lead-form"
import { getAreas } from "@/lib/ore"
import Link from "next/link"
import { Metadata } from "next"
import { filterAuthorizedAreas } from "@/lib/utils/authorized"
import { safeNum, safePercent, shouldShow } from "@/lib/utils/safeDisplay"

export const metadata: Metadata = {
  title: "Dubai Area Guides & Neighborhood Insights | ORE",
  description: "Discover the best places to live and invest in Dubai. Comprehensive guides for Dubai Marina, Downtown, Palm Jumeirah, and more.",
  openGraph: {
    title: "Dubai Area Guides & Neighborhood Insights | ORE",
    description: "Discover the best places to live and invest in Dubai.",
    images: ["/logo_blsck.png"],
  },
}

export default async function AreasPage() {
  const rawAreas = await getAreas().catch(() => [])
  const areas = filterAuthorizedAreas(rawAreas)
  const topYieldAreas = [...areas].sort((a, b) => b.rentalYield - a.rentalYield).slice(0, 3)
  const bestValueAreas = [...areas].sort((a, b) => a.avgPricePerSqft - b.avgPricePerSqft).slice(0, 3)
  const topScoreAreas = [...areas].sort((a, b) => b.investmentScore - a.investmentScore).slice(0, 3)
  const formatPriceLabel = (value?: number) => {
    const formatted = safeNum(value)
    return formatted === "—" ? "—" : `AED ${formatted}`
  }
  const formatYieldLabel = (value?: number) => safePercent(value)
  const formatScoreLabel = (value?: number) =>
    shouldShow(value) ? `${value}/10` : "—"

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/5 bg-[#0A1F17] py-16 md:py-24">
          <div className="absolute inset-0 z-0">
            <div className="absolute right-0 top-0 h-[420px] w-[420px] bg-[radial-gradient(circle_at_50%_50%,rgba(198,155,62,0.16),transparent_55%)] blur-[80px]" />
            <div className="absolute bottom-0 left-0 h-[360px] w-[360px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
          </div>
          <div className="container">
            <div className="relative z-10 mx-auto max-w-4xl text-center">
              <Badge className="mb-4 border-none bg-[#C69B3E]/10 px-4 py-1.5 text-[#F0D792]" variant="secondary">
                Areas
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                Dubai Areas & Neighborhoods
              </h1>
              <p className="mt-6 text-lg text-white/65">
                Compare Dubai neighborhoods by lifestyle, yield, and investment potential. Surface the few that actually outperform — not just another card grid.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button className="ore-gradient text-[#152E24]" asChild>
                  <Link href="/contact">Get Area Guidance</Link>
                </Button>
                <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link href="/properties">Browse Properties</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] py-16 md:py-20">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-10">
              <SmallLeadForm
                title="Request tailored area intelligence"
                caption="Tell us your preferred budget, timelines, and districts and we will craft an investment brief for you."
              />
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] pb-8">
          <div className="container">
            <div className="grid gap-6 rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] lg:grid-cols-3 md:p-8">
              <div className="rounded-[24px] border border-[#152E24]/10 bg-[#FAF8F5] p-5">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Top Yield</div>
                <h3 className="mt-2 font-serif text-2xl font-bold">{topYieldAreas[0]?.name}</h3>
                <p className="text-sm text-muted-foreground">Rental yield leader</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {topYieldAreas.map((area) => (
                    <li key={area.slug} className="flex justify-between">
                      <Link href={`/areas/${area.slug}`} className="hover:underline">{area.name}</Link>
                      <span className="font-semibold text-green-600">{formatYieldLabel(area.rentalYield)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-[#152E24]/10 bg-[#FAF8F5] p-5">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Best Value</div>
                <h3 className="mt-2 font-serif text-2xl font-bold">{bestValueAreas[0]?.name}</h3>
                <p className="text-sm text-muted-foreground">Lowest price per sqft</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {bestValueAreas.map((area) => (
                    <li key={area.slug} className="flex justify-between">
                      <Link href={`/areas/${area.slug}`} className="hover:underline">{area.name}</Link>
                      <span className="font-semibold">{formatPriceLabel(area.avgPricePerSqft)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-[#152E24]/10 bg-[#FAF8F5] p-5">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Score Leaders</div>
                <h3 className="mt-2 font-serif text-2xl font-bold">{topScoreAreas[0]?.name}</h3>
                <p className="text-sm text-muted-foreground">Balanced demand + returns</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {topScoreAreas.map((area) => (
                    <li key={area.slug} className="flex justify-between">
                      <Link href={`/areas/${area.slug}`} className="hover:underline">{area.name}</Link>
                      <span className="font-semibold ore-text-gradient">{formatScoreLabel(area.investmentScore)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] pb-20">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-8 lg:p-10">
              <div className="mb-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C69B3E]">Neighborhood intelligence</p>
                <h2 className="mt-2 font-serif text-2xl font-bold text-[#152E24] md:text-3xl">Browse Dubai districts</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {areas.map((area) => (
                  <AreaCard key={area.id} area={area} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
