import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin, ShieldCheck } from "lucide-react"
import { ProjectCard } from "@/components/project-card"
import { PropertyCard } from "@/components/property-card"
import { SmallLeadForm } from "@/components/small-lead-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAreaBySlug, getAreas, getProjectsByArea, getPropertiesByArea } from "@/lib/ore"
import { filterAuthorizedAreas, isAuthorizedAreaSlug } from "@/lib/utils/authorized"
import { safeNum, safePercent, shouldShow } from "@/lib/utils/safeDisplay"

export async function generateStaticParams() {
  const rawAreas = await getAreas().catch(() => [])
  const areas = filterAuthorizedAreas(rawAreas)
  return areas.map((area) => ({ slug: area.slug }))
}

export default async function AreaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  const slug = typeof rawSlug === "string" ? rawSlug.trim() : ""

  if (!slug || !isAuthorizedAreaSlug(slug)) {
    notFound()
  }

  const area = await getAreaBySlug(slug).catch(() => null)

  if (!area) {
    notFound()
  }

  const areaName = area.name || "Dubai"
  const [projectsResult, propertiesResult] = await Promise.allSettled([
    getProjectsByArea(areaName, 6),
    getPropertiesByArea(areaName, 6),
  ])

  const areaProjects = projectsResult.status === "fulfilled" ? projectsResult.value : []
  const areaProperties = propertiesResult.status === "fulfilled" ? propertiesResult.value : []
  const formatPriceLabel = (value?: number) => {
    const formatted = safeNum(value)
    return formatted === "—" ? "—" : `AED ${formatted}`
  }
  const formatYieldLabel = (value?: number) => safePercent(value)
  const formatScoreLabel = (value?: number) => (shouldShow(value) ? `${value}/10` : "—")
  const formatListingsLabel = (value?: number) =>
    shouldShow(value) ? `${value}+ listings` : "—"
  const formatListingCount = (value?: number) => (shouldShow(value) ? `${value}+` : "—")

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <section className="relative h-[55vh] min-h-[420px]">
          <Image src={area.image} alt={area.name} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        </section>

        <section className="relative z-10 -mt-20 bg-[#FAF8F5] pb-8">
          <div className="container">
            <div className="grid gap-6 rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:grid-cols-[1.5fr,1fr] md:items-center md:p-8 lg:p-10">
            <div className="space-y-4">
              <Badge className="border-none ore-gradient text-[#152E24]" variant="secondary">
                Dubai Area Guide
              </Badge>
              <h1 className="font-serif text-4xl font-bold text-[#152E24] md:text-5xl lg:text-6xl">
                {area.name}
              </h1>
                <h2 className="font-serif text-3xl font-bold text-[#152E24]">About {area.name}</h2>
                <p className="text-base leading-relaxed text-[#152E24]/60">
                  {area.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {area.lifestyleTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="border-none bg-[#C69B3E]/10 text-xs text-[#8E6B21]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-[24px] border border-[#152E24]/10 bg-[#FAF8F5] p-4">
                <div className="text-center">
                <div className="text-2xl font-bold ore-text-gradient">{formatPriceLabel(area.avgPricePerSqft)}</div>
                  <div className="text-xs text-[#152E24]/45">Avg. Price/sqft</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{formatYieldLabel(area.rentalYield)}</div>
                  <div className="text-xs text-[#152E24]/45">Rental Yield</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold ore-text-gradient">{formatScoreLabel(area.investmentScore)}</div>
                  <div className="text-xs text-[#152E24]/45">Investment Score</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] pb-6">
          <div className="container">
            <div className="grid gap-4 rounded-[28px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:grid-cols-3">
              <Card className="border-[#152E24]/10 bg-[#FAF8F5] shadow-none">
                <CardContent className="p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Liquidity</div>
                  <div className="text-xl font-semibold text-[#152E24]">{formatListingsLabel(area.propertyCount)}</div>
                  <p className="text-sm text-[#152E24]/60">
                    Depth of available inventory signals easier entry and exit.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-[#152E24]/10 bg-[#FAF8F5] shadow-none">
                <CardContent className="p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Yield Signal</div>
                  <div className="text-xl font-semibold text-green-600">{formatYieldLabel(area.rentalYield)}</div>
                  <p className="text-sm text-[#152E24]/60">
                    Income-led returns with rental demand anchored by nearby landmarks.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-[#152E24]/10 bg-[#FAF8F5] shadow-none">
                <CardContent className="p-4 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Ownership</div>
                  <div className="text-xl font-semibold text-[#152E24]">{area.freehold ? "Freehold" : "Leasehold"}</div>
                  <p className="text-sm text-[#152E24]/60">
                    Suitable for international buyers seeking title security.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] py-10 md:py-14">
          <div className="container">
            <div className="grid gap-10 rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] lg:grid-cols-[2fr,1fr] md:p-8 lg:p-10">
              <div className="space-y-10">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#152E24]">Why Invest in {area.name}</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {area.investmentReasons.map((reason) => (
                      <div key={reason} className="flex items-start gap-2 rounded-[24px] border border-[#152E24]/10 bg-[#FAF8F5] p-4 text-[#152E24]">
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-[#C69B3E]" />
                        <span className="text-sm text-[#152E24]/70">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-serif text-xl font-semibold text-[#152E24]">Key Landmarks</h3>
                  <div className="mt-4 space-y-3">
                    {area.landmarks.map((landmark) => (
                      <div
                        key={landmark.name}
                        className="flex items-center justify-between rounded-[24px] border border-[#152E24]/10 bg-[#FAF8F5] p-4"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#C69B3E]" />
                          <span className="font-medium text-[#152E24]">{landmark.name}</span>
                        </div>
                        <span className="text-sm text-[#152E24]/55">{landmark.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <Card className="h-fit border-[#152E24]/10 bg-[#FAF8F5] shadow-none">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-serif text-xl font-semibold text-[#152E24]">Area Snapshot</h3>
                    <div className="space-y-3 text-sm text-[#152E24]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#152E24]/55">Freehold</span>
                        <span className="font-medium">{area.freehold ? "Yes" : "No"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#152E24]/55">Lifestyle</span>
                        <span className="font-medium">{area.lifestyleTags.join(", ")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#152E24]/55">Active Listings</span>
                        <span className="font-medium">{formatListingCount(area.propertyCount)}</span>
                      </div>
                    </div>
                    <Button className="w-full ore-gradient text-[#152E24]" asChild>
                      <Link href="/contact">Request Area Consultation</Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="h-fit border-[#152E24]/10 bg-[#FAF8F5] shadow-none">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-serif text-xl font-semibold text-[#152E24]">Market Intelligence</h3>
                    <p className="text-sm text-[#152E24]/60">
                      Connect {area.name} insights with Dubai-wide market reports and trends.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="border-[#152E24]/10 bg-white text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
                        <Link href="/market/areas">Compare Dubai Areas</Link>
                      </Button>
                      <Button variant="outline" className="border-[#152E24]/10 bg-white text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
                        <Link href="/market/trends">Market Trends & Reports</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] pb-6">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-8 lg:p-10">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#152E24]">Projects in {area.name}</h2>
                  <p className="text-sm text-[#152E24]/55">Select developments available in this area</p>
                </div>
                <Button variant="outline" className="border-[#152E24]/10 bg-[#FAF8F5] text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
                  <Link href="/projects">View All Projects</Link>
                </Button>
              </div>

              {areaProjects.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[#152E24]/10 bg-[#FAF8F5] p-8 text-center text-sm text-[#152E24]/55">
                  No projects are linked to {area.name} yet. Browse all projects to discover nearby launches.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {areaProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] pb-6">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-8 lg:p-10">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#152E24]">Properties in {area.name}</h2>
                  <p className="text-sm text-[#152E24]/55">Live listings and investment opportunities</p>
                </div>
                <Button variant="outline" className="border-[#152E24]/10 bg-[#FAF8F5] text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
                  <Link href="/properties">View All Properties</Link>
                </Button>
              </div>

              {areaProperties.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[#152E24]/10 bg-[#FAF8F5] p-8 text-center text-sm text-[#152E24]/55">
                  No active properties listed yet.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {areaProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] py-6 md:py-10">
          <div className="container">
            <div className="rounded-[32px] bg-[#152E24] px-6 py-12 text-center text-white shadow-[0_32px_100px_-50px_rgba(21,46,36,0.7)] md:px-10">
              <h2 className="font-serif text-3xl font-bold">Need Guidance on {area.name}?</h2>
              <p className="mt-4 text-lg text-white/70">
                Speak with our team for tailored investment recommendations.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button className="ore-gradient text-[#152E24]" asChild>
                  <Link href="/contact">Schedule Consultation</Link>
                </Button>
                <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                  <Link href="/chat">Ask the AI Assistant</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] py-12">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-10">
              <SmallLeadForm
                source={area.name}
                title={`Lead a briefing on ${area.name}`}
                caption="Drop your budget and area priorities so our brokers can craft a tailored Dubai investment plan."
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
