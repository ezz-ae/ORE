import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import {
  getDashboardProjectFilters,
  getDashboardProjects,
  type DashboardProjectFilters,
} from "@/lib/ore"

interface DashboardProjectsPageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

const formatCurrency = (value: number | null) => {
  if (!value) return "—"
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function DashboardProjectsPage({ searchParams }: DashboardProjectsPageProps) {
  const filters: DashboardProjectFilters = {
    page: Number(searchParams?.page ?? 1),
    pageSize: 20,
    search: typeof searchParams?.search === "string" ? searchParams.search : "",
    area: typeof searchParams?.area === "string" ? searchParams.area : "",
    developer: typeof searchParams?.developer === "string" ? searchParams.developer : "",
    status: typeof searchParams?.status === "string" ? searchParams.status : "",
    minPrice: searchParams?.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams?.maxPrice ? Number(searchParams.maxPrice) : undefined,
    minRoi: searchParams?.minRoi ? Number(searchParams.minRoi) : undefined,
    sort: typeof searchParams?.sort === "string" ? (searchParams.sort as DashboardProjectFilters["sort"]) : "market",
  }

  const { projects, total } = await getDashboardProjects(filters)
  const { areas, developers } = await getDashboardProjectFilters()
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize || 20)))

  const baseParams = new URLSearchParams()
  if (filters.search) baseParams.set("search", filters.search)
  if (filters.area) baseParams.set("area", filters.area)
  if (filters.developer) baseParams.set("developer", filters.developer)
  if (filters.minPrice) baseParams.set("minPrice", String(filters.minPrice))
  if (filters.maxPrice) baseParams.set("maxPrice", String(filters.maxPrice))
  if (filters.minRoi) baseParams.set("minRoi", String(filters.minRoi))
  if (filters.sort) baseParams.set("sort", filters.sort)
  const baseQuery = baseParams.toString()
  const buildPageHref = (page: number) =>
    `/dashboard/projects${baseQuery ? `?${baseQuery}&page=${page}` : `?page=${page}`}`

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Projects Management
        </Badge>
        <h1 className="font-serif text-3xl font-bold">All Projects</h1>
        <p className="text-sm text-muted-foreground">
          Manage listings, performance, and broker assignments across 3,655 projects.
        </p>
      </section>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-3 lg:grid-cols-6" method="get">
            <Input name="search" placeholder="Search project name" defaultValue={filters.search} />
            <select name="area" defaultValue={filters.area} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="">All areas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <select name="developer" defaultValue={filters.developer} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="">All developers</option>
              {developers.map((developer) => (
                <option key={developer} value={developer}>
                  {developer}
                </option>
              ))}
            </select>
            <Input name="minPrice" type="number" placeholder="Min AED" defaultValue={filters.minPrice ?? ""} />
            <Input name="maxPrice" type="number" placeholder="Max AED" defaultValue={filters.maxPrice ?? ""} />
            <select name="sort" defaultValue={filters.sort} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="market">Sort: Market score</option>
              <option value="roi">Sort: ROI</option>
              <option value="price-low">Sort: Price low</option>
              <option value="price-high">Sort: Price high</option>
            </select>
            <div className="flex gap-2 md:col-span-3 lg:col-span-6">
              <Button type="submit" className="ore-gradient">Apply Filters</Button>
              <Button type="reset" variant="outline" asChild>
                <Link href="/dashboard/projects">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-7 gap-4 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-2">Project</div>
          <div>Area</div>
          <div>Price Range</div>
          <div>ROI</div>
          <div>Units</div>
          <div>Actions</div>
        </div>
        {projects.map((project) => (
          <div
            key={project.id}
            className="grid grid-cols-7 gap-4 border-b border-border px-4 py-4 text-sm last:border-b-0"
          >
            <div className="col-span-2">
              <div className="font-semibold">{project.name}</div>
              <div className="text-xs text-muted-foreground">
                {project.developerName || "Unknown developer"}
              </div>
            </div>
            <div className="text-muted-foreground">{project.area || "Dubai"}</div>
            <div className="text-muted-foreground">
              {formatCurrency(project.priceFrom)} {project.priceTo ? `- ${formatCurrency(project.priceTo)}` : ""}
            </div>
            <div className="text-muted-foreground">{project.expectedRoi ?? "—"}%</div>
            <div className="text-muted-foreground">{project.unitsAvailable || "—"}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/projects/${project.slug}`}>View</Link>
              </Button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No projects match the current filters.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {filters.page} of {totalPages} · {total} projects
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={(filters.page || 1) <= 1} asChild>
            <Link href={buildPageHref(Math.max(1, (filters.page || 1) - 1))}>Previous</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(filters.page || 1) >= totalPages}
            asChild
          >
            <Link href={buildPageHref(Math.min(totalPages, (filters.page || 1) + 1))}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
