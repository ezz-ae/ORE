import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { DashboardProjectsExport } from "@/components/dashboard-projects-export"
import Link from "next/link"
import {
  getDashboardProjectFilters,
  getDashboardProjects,
  type DashboardProjectFilters,
} from "@/lib/ore"

interface DashboardProjectsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const filters: DashboardProjectFilters = {
    page: Number(resolvedSearchParams?.page ?? 1),
    pageSize: 20,
    search: typeof resolvedSearchParams?.search === "string" ? resolvedSearchParams.search : "",
    area: typeof resolvedSearchParams?.area === "string" ? resolvedSearchParams.area : "",
    developer: typeof resolvedSearchParams?.developer === "string" ? resolvedSearchParams.developer : "",
    status: typeof resolvedSearchParams?.status === "string" ? resolvedSearchParams.status : "",
    minPrice: resolvedSearchParams?.minPrice ? Number(resolvedSearchParams.minPrice) : undefined,
    maxPrice: resolvedSearchParams?.maxPrice ? Number(resolvedSearchParams.maxPrice) : undefined,
    minRoi: resolvedSearchParams?.minRoi ? Number(resolvedSearchParams.minRoi) : undefined,
    sort:
      typeof resolvedSearchParams?.sort === "string"
        ? (resolvedSearchParams.sort as DashboardProjectFilters["sort"])
        : "market",
  }

  const { projects, total } = await getDashboardProjects(filters)
  const { areas, developers } = await getDashboardProjectFilters()
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize || 20)))

  const baseParams = new URLSearchParams()
  if (filters.search) baseParams.set("search", filters.search)
  if (filters.area) baseParams.set("area", filters.area)
  if (filters.developer) baseParams.set("developer", filters.developer)
  if (filters.status) baseParams.set("status", filters.status)
  if (filters.minPrice) baseParams.set("minPrice", String(filters.minPrice))
  if (filters.maxPrice) baseParams.set("maxPrice", String(filters.maxPrice))
  if (filters.minRoi) baseParams.set("minRoi", String(filters.minRoi))
  if (filters.sort) baseParams.set("sort", filters.sort)
  const baseQuery = baseParams.toString()
  const buildPageHref = (page: number) =>
    `/crm/inventory${baseQuery ? `?${baseQuery}&page=${page}` : `?page=${page}`}`

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Inventory Management
        </Badge>
        <h1 className="font-serif text-3xl font-bold">Project Inventory</h1>
        <p className="text-sm text-muted-foreground">
          View all inventory and launch campaign landing pages per project.
        </p>
      </section>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-3 lg:grid-cols-7" method="get">
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
            <select name="status" defaultValue={filters.status} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="">All status</option>
              <option value="selling">Selling</option>
              <option value="sold-out">Sold out</option>
              <option value="coming-soon">Coming soon</option>
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
                <Link href="/crm/inventory">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardProjectsExport projects={projects} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/crm/landing-pages/create">Create Landing Page</Link>
          </Button>
          <Button className="ore-gradient" asChild>
            <Link href="/crm/projects/add">Add New Project</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <div className="font-semibold">{project.name}</div>
                <div className="text-xs text-muted-foreground">
                  {project.area || "Dubai"} · {project.developerName || "Developer not added yet"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-semibold capitalize">{project.status || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">ROI</div>
                  <div className="font-semibold">{project.expectedRoi ?? "—"}%</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Price</div>
                  <div className="font-semibold">
                    {formatCurrency(project.priceFrom)} {project.priceTo ? `- ${formatCurrency(project.priceTo)}` : ""}
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href={`/crm/projects/add?slug=${encodeURIComponent(project.slug)}`}>
                    Edit Listing
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href={`/crm/landing-pages/create?projectSlug=${encodeURIComponent(project.slug)}`}>
                    Create Campaign Page
                  </Link>
                </Button>
                <Button size="sm" className="w-full ore-gradient" asChild>
                  <Link href={`/projects/${project.slug}`}>Open Public Page</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            No properties match the current filters.
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[1024px]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1.4fr_0.7fr_0.7fr_1.6fr] gap-4 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Project</div>
              <div>Area</div>
              <div>Status</div>
              <div>Price Range</div>
              <div>ROI</div>
              <div>Units</div>
              <div>Actions</div>
            </div>
            {projects.map((project) => (
              <div
                key={project.id}
                className="grid grid-cols-[2fr_1fr_1fr_1.4fr_0.7fr_0.7fr_1.6fr] gap-4 border-b border-border px-4 py-4 text-sm last:border-b-0"
              >
                <div>
                  <div className="font-semibold">{project.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {project.developerName || "Unknown developer"}
                  </div>
                </div>
                <div className="text-muted-foreground">{project.area || "Dubai"}</div>
                <div className="text-muted-foreground capitalize">
                  {project.status || "—"}
                </div>
                <div className="text-muted-foreground">
                  {formatCurrency(project.priceFrom)} {project.priceTo ? `- ${formatCurrency(project.priceTo)}` : ""}
                </div>
                <div className="text-muted-foreground">{project.expectedRoi ?? "—"}%</div>
                <div className="text-muted-foreground">{project.unitsAvailable || "—"}</div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/crm/projects/add?slug=${encodeURIComponent(project.slug)}`}>
                      Edit
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/crm/landing-pages/create?projectSlug=${encodeURIComponent(project.slug)}`}>
                      Create LP
                    </Link>
                  </Button>
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
        </div>
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
