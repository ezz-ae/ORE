import Link from "next/link"
import { notFound } from "next/navigation"
import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  getDeveloperBySlug,
  getDevelopers,
  getProjectsByDeveloper,
  getDeveloperStats,
} from "@/lib/ore"
import { shouldShow } from "@/lib/utils/safeDisplay"
import { filterAuthorizedDevelopers, isAuthorizedDeveloper } from "@/lib/utils/authorized"

const fallbackStats = {
  listings: 0,
  active: 0,
  completed: 0,
  avgYield: 0,
  avgScore: 0,
  goldenVisaCount: 0,
  minPrice: 0,
  maxPrice: 0,
  onTimeDeliveryRate: null,
  firstProjectYear: null,
  topAreas: [] as Array<{ area: string; count: number }>,
  flagshipProjects: [] as Array<{ id: string; slug: string; name: string; marketScore: number | null }>,
}

export async function generateStaticParams() {
  const rawDevelopers = await getDevelopers().catch(() => [])
  const developers = filterAuthorizedDevelopers(rawDevelopers)
  return developers
    .map((developer) => ({ slug: developer.slug }))
    .filter((params) => Boolean(params.slug))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const developer = await getDeveloperBySlug(slug).catch(() => null)
  if (!developer) {
    return { title: "Developer Not Found" }
  }
  return {
    title: `${developer.name} | ORE Real Estate`,
    description: developer.description,
  }
}

export default async function DeveloperDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const developer = await getDeveloperBySlug(slug).catch(() => null)

  if (!developer || !isAuthorizedDeveloper(developer)) {
    notFound()
  }

  const developerName = developer.name || "Unknown Developer"
  const [projectsResult, statsResult] = await Promise.allSettled([
    getProjectsByDeveloper(developerName, 6),
    getDeveloperStats(developerName),
  ])

  const developerProjects = projectsResult.status === "fulfilled" ? projectsResult.value : []
  const stats = statsResult.status === "fulfilled" ? statsResult.value : fallbackStats

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      maximumFractionDigits: 0,
    }).format(value)

  const foundedYear = developer.foundedYear || stats.firstProjectYear
  const headquarters = developer.headquarters || "Dubai, UAE"
  const officialWebsite = developer.website || "Not listed"
  const unitsDelivered = developer.completedProjects ?? stats.completed
  const showDelivered = shouldShow(unitsDelivered)
  const showStars = shouldShow(developer.stars)
  const showHonesty = shouldShow(developer.honestyScore)

  return (
    <>
        <section className="relative overflow-hidden border-b border-white/5 bg-[#0A1F17] py-16 md:py-24">
          <div className="absolute inset-0 z-0">
            <div className="absolute right-0 top-0 h-[420px] w-[420px] bg-[radial-gradient(circle_at_50%_50%,rgba(198,155,62,0.16),transparent_55%)] blur-[80px]" />
            <div className="absolute bottom-0 left-0 h-[360px] w-[360px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.10),transparent_55%)] blur-[80px]" />
          </div>
          <div className="container">
            <div className="relative z-10">
            <Badge className="mb-4 border-none bg-[#C69B3E]/10 px-4 py-1.5 text-[#F0D792]" variant="secondary">
              Developer Profile
            </Badge>
            <h1 className="font-serif text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              {developer.name}
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-white/65">
              {developer.description || "Developer profile overview and flagship project activity in Dubai."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/70">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {developer.tier ? `${developer.tier} developer` : "Dubai developer"}
              </span>
              {developerProjects.length > 0 && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {developerProjects.length} projects
                </span>
              )}
              {showDelivered && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {unitsDelivered}+ delivered
                </span>
              )}
              {showStars && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {developer.stars}★ rating
                </span>
              )}
              {showHonesty && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {developer.honestyScore}/10 trust
                </span>
              )}
            </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] py-16 md:py-20">
          <div className="container">
            <div className="grid gap-10 rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] lg:grid-cols-[1.4fr,0.6fr] md:p-8 lg:p-10">
              <div className="space-y-8">
                <div className="rounded-[28px] border border-[#152E24]/10 bg-[#FAF8F5] p-6">
                  <h2 className="font-serif text-3xl font-bold text-[#152E24]">About {developer.name}</h2>
                  <p className="mt-4 text-sm leading-relaxed text-[#152E24]/60">
                    {developer.description ||
                      "A trusted UAE developer delivering premium residential communities across Dubai and beyond."}
                  </p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Track record</div>
                      <div className="mt-2 text-sm text-[#152E24]">
                        {developer.trackRecord || "Strong delivery pipeline with investor-grade projects."}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Top focus areas</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {stats.topAreas.length ? (
                          stats.topAreas.slice(0, 4).map((area) => (
                            <Badge key={area.area} variant="secondary" className="border-none bg-[#C69B3E]/10 text-[#8E6B21]">
                              {area.area}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-[#152E24]/60">Dubai-focused</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-[28px] border border-[#152E24]/10 bg-[#FAF8F5] p-6">
                  <h3 className="mb-3 font-serif text-xl font-semibold text-[#152E24]">Awards</h3>
                  <div className="flex flex-wrap gap-2">
                    {(developer.awards?.length ? developer.awards : ["Top Developer"]).map((award) => (
                      <Badge key={award} variant="secondary" className="border-none bg-white text-[#152E24]">
                        {award}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-3 rounded-[28px] border border-[#152E24]/10 bg-[#FAF8F5] p-6">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Headquarters</div>
                    <div className="text-lg font-semibold text-[#152E24]">{headquarters}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Founded</div>
                    <div className="text-lg font-semibold text-[#152E24]">{foundedYear || "Est. TBD"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#152E24]/40">Website</div>
                    <div className="text-lg font-semibold">
                      <Link href={developer.website || "#"} className="text-[#C69B3E] hover:text-[#8E6B21]">
                        {officialWebsite}
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="rounded-[28px] border border-[#152E24]/10 bg-[#FAF8F5] p-6">
                  <p className="text-sm text-[#152E24]/60">
                    Connect with the developer team for the latest launch updates.
                  </p>
                  <Button className="mt-4 w-full ore-gradient text-[#152E24]" asChild>
                    <Link href="/contact">Request Consultation</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#FAF8F5] pb-20">
          <div className="container">
            <div className="rounded-[32px] border border-[#152E24]/[0.08] bg-white p-6 shadow-[0_24px_80px_-40px_rgba(21,46,36,0.18)] md:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#152E24]">Projects by {developer.name}</h2>
                <p className="text-sm text-[#152E24]/55">Signature developments and communities</p>
              </div>
              <Button variant="outline" className="border-[#152E24]/10 bg-[#FAF8F5] text-[#152E24] hover:border-[#C69B3E]/25 hover:bg-[#C69B3E]/[0.08] hover:text-[#152E24]" asChild>
                <Link href="/projects">View All Projects</Link>
              </Button>
            </div>

            {developerProjects.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-[#152E24]/10 bg-[#FAF8F5] p-8 text-center text-sm text-[#152E24]/55">
                No projects are linked to {developer.name} yet. Explore all projects to find similar launches.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {developerProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
            </div>
          </div>
        </section>

      </>
    )
}
