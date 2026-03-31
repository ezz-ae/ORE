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
} from "@/lib/entrestate"
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
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <Badge className="mb-4 ore-gradient" variant="secondary">
              Developer Profile
            </Badge>
            <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              {developer.name}
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
              {developer.description || "Developer profile overview and flagship project activity in Dubai."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="rounded-full border border-border px-3 py-1">
                {developer.tier ? `${developer.tier} developer` : "Dubai developer"}
              </span>
              {developerProjects.length > 0 && (
                <span className="rounded-full border border-border px-3 py-1">
                  {developerProjects.length} projects
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[1.4fr,0.6fr]">
              <div className="space-y-8">
                <div className="rounded-3xl border border-border bg-card p-6">
                  <h2 className="font-serif text-3xl font-bold">About {developer.name}</h2>
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                    {developer.description ||
                      "A trusted UAE developer delivering premium residential communities across Dubai and beyond."}
                  </p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Track record</div>
                      <div className="mt-2 text-sm text-foreground">
                        {developer.trackRecord || "Strong delivery pipeline with investor-grade projects."}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Top focus areas</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {stats.topAreas.length ? (
                          stats.topAreas.slice(0, 4).map((area) => (
                            <Badge key={area.area} variant="secondary">
                              {area.area}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Dubai-focused</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-border bg-card p-6">
                  <h3 className="font-serif text-xl font-semibold mb-3">Awards</h3>
                  <div className="flex flex-wrap gap-2">
                    {(developer.awards?.length ? developer.awards : ["Top Developer"]).map((award) => (
                      <Badge key={award} variant="secondary">
                        {award}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-card p-6 space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Headquarters</div>
                    <div className="text-lg font-semibold">{headquarters}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Founded</div>
                    <div className="text-lg font-semibold">{foundedYear || "Est. TBD"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Website</div>
                    <div className="text-lg font-semibold">
                      <Link href={developer.website || "#"} className="text-primary">
                        {officialWebsite}
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-border bg-card p-6">
                  <p className="text-sm text-muted-foreground">
                    Connect with the developer team for the latest launch updates.
                  </p>
                  <Button className="mt-4 w-full ore-gradient text-black" asChild>
                    <Link href="/contact">Request Consultation</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/40">
          <div className="container">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold">Projects by {developer.name}</h2>
                <p className="text-sm text-muted-foreground">Signature developments and communities</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/projects">View All Projects</Link>
              </Button>
            </div>

            {developerProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
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
        </section>

      </>
    )
}
