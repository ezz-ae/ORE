import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PropertyFilters } from "@/components/property-filters"
import { MobilePropertyFilters } from "@/components/mobile-property-filters"
import { PropertiesToolbar } from "@/components/properties-toolbar"
import { getDashboardProjectFilters, getProjectsForGrid, getProjectsForGridCount } from "@/lib/data"
import Link from "next/link"
import { Metadata } from "next"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "New Projects & Master Communities in Dubai",
  description: "Explore live Freehold project inventory, off-plan developments, and master-planned communities in Dubai with area, developer, price, and status filters.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "New Projects & Master Communities in Dubai | Freehold",
    description: "Explore live Freehold project inventory and off-plan developments in Dubai.",
    images: ["/og-image.png"],
  },
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = Number(params.page || 1)
  const pageSize = 24
  const sort = typeof params.sort === "string" ? params.sort : "score"
  const viewParam = typeof params.view === "string" ? params.view : "grid"
  const view = viewParam === "list" ? "list" : "grid"
  const areas = typeof params.areas === "string" ? params.areas.split(",").filter(Boolean) : []
  const bedrooms = typeof params.beds === "string" ? params.beds.split(",").filter(Boolean) : []
  const propertyType = typeof params.type === "string" ? params.type : undefined
  const status = typeof params.status === "string" ? params.status : undefined
  const developer = typeof params.developer === "string" ? params.developer : undefined
  const minPrice = params.minPrice ? Number(params.minPrice) : undefined
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : undefined
  const freeholdOnly = params.freehold === "true"
  const goldenVisa = params.goldenVisa === "true"

  const filters = {
    page,
    pageSize,
    sort: sort as "score" | "newest" | "price-low" | "price-high" | "roi" | "yield",
    areas,
    bedrooms,
    propertyType,
    status,
    developer,
    minPrice,
    maxPrice,
    freeholdOnly,
    goldenVisa,
  }

  const [filterOptions, projects, total] = await Promise.all([
    getDashboardProjectFilters().catch(() => ({ areas: [] as string[], developers: [] as string[] })),
    getProjectsForGrid(pageSize, filters),
    getProjectsForGridCount(filters),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const areaNames = Array.from(new Set(filterOptions.areas.filter(Boolean)))
  const developerNames = Array.from(new Set(filterOptions.developers.filter(Boolean)))
  const buildPageLink = (nextPage: number) => {
    const q = new URLSearchParams()
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value == null) return
      q.set(key, Array.isArray(value) ? value.join(",") : value)
    })
    q.set("page", String(nextPage))
    return `/projects?${q.toString()}#projects-results`
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/10 bg-[#0A1F17] py-16 md:py-24">
        <div className="absolute inset-0 z-0 opacity-50">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.05)_0%,transparent_50%)] rounded-full blur-[80px] mix-blend-screen" />
          <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.2)_0%,transparent_50%)] rounded-full blur-[80px] mix-blend-screen animate-pulse" />
        </div>
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center flex flex-col items-center">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur-sm mb-6">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#C69B3E] mr-2"></span>
              Live Freehold Inventory
            </div>
            <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-white leading-tight">
              Dubai Projects <br/>
              <span className="italic text-[#D4AF37]">& Communities</span>
            </h1>
            <p className="mt-6 text-lg text-white/70 font-light max-w-2xl mx-auto">
              Filter live Freehold projects by area, developer, budget, status, bedroom mix, and investment angle.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button className="ore-gradient text-black font-semibold" asChild>
                <Link href="/contact">Schedule Consultation</Link>
              </Button>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/chat">Ask AI About Projects</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#152E24] py-16 md:py-20">
        <div className="container">
          <div className="rounded-[36px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_28px_90px_-55px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-8 lg:p-10">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="secondary" className="mb-4 rounded-full border-none bg-[#C69B3E]/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0D792]">
                  Project Inventory
                </Badge>
                <h2 className="font-serif text-2xl font-bold text-white md:text-3xl">Filtered Developments</h2>
                <p className="mt-2 text-sm text-white/60">
                  {total.toLocaleString("en-AE")} projects match the current Freehold filters.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.05] text-white/75 hover:border-[#C69B3E]/25 hover:bg-white/[0.08] hover:text-white"
                asChild
              >
                <Link href="/properties">Browse Properties</Link>
              </Button>
            </div>

            <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
              <aside className="hidden lg:block">
                <div className="sticky top-24">
                  <PropertyFilters collapsible defaultOpen={false} areas={areaNames} developers={developerNames} basePath="/projects" resultAnchor="projects-results" />
                </div>
              </aside>

              <div id="projects-results" className="min-w-0">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="lg:hidden">
                    <MobilePropertyFilters areas={areaNames} developers={developerNames} basePath="/projects" resultAnchor="projects-results" />
                  </div>
                  <div className="flex-1">
                    <PropertiesToolbar total={total} page={page} pageSize={pageSize} sort={sort} view={view} basePath="/projects" noun="projects" />
                  </div>
                </div>

                {projects.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-white/15 bg-black/15 py-20 text-center text-white/60">
                    No projects match these filters. Clear filters or widen the budget range.
                  </div>
                )}

                {totalPages > 1 ? (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <Link
                      href={buildPageLink(Math.max(1, page - 1))}
                      className={cn(
                        "inline-flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/70 transition hover:border-[#C69B3E]/25 hover:text-white",
                        page <= 1 && "pointer-events-none opacity-50",
                      )}
                    >
                      Previous
                    </Link>
                    <span className="px-3 text-sm text-white/55">Page {page} of {totalPages}</span>
                    <Link
                      href={buildPageLink(Math.min(totalPages, page + 1))}
                      className={cn(
                        "inline-flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/70 transition hover:border-[#C69B3E]/25 hover:text-white",
                        page >= totalPages && "pointer-events-none opacity-50",
                      )}
                    >
                      Next
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
