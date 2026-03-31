import { PropertyFilters } from "@/components/property-filters"
import { MobilePropertyFilters } from "@/components/mobile-property-filters"
import { PropertyCard } from "@/components/property-card"
import { PropertiesToolbar } from "@/components/properties-toolbar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getDashboardProjectFilters, getPropertyListing } from "@/lib/ore"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dubai Properties for Sale | ORE Real Estate",
  description: "Browse over 3500+ luxury properties and investment opportunities in Dubai. Filter by location, price, and property type to find your perfect home.",
  openGraph: {
    title: "Dubai Properties for Sale | ORE Real Estate",
    description: "Browse over 3500+ luxury properties and investment opportunities in Dubai.",
    images: ["/logo_blsck.png"],
  },
}
export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = Number(params.page || 1)
  const pageSize = 12
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

  const listingPromise = getPropertyListing({
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
  })

  const [filterOptions, listingResult] = await Promise.all([
    getDashboardProjectFilters().catch(() => ({ areas: [] as string[], developers: [] as string[] })),
    listingPromise,
  ])
  const { properties, total } = listingResult
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const areaNames = Array.from(new Set(filterOptions.areas.filter((name) => Boolean(name))))
  const developerNames = Array.from(new Set(filterOptions.developers.filter((name) => Boolean(name))))
  const buildPageLink = (nextPage: number) => {
    const q = new URLSearchParams()
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value == null) return
      if (Array.isArray(value)) {
        q.set(key, value.join(","))
      } else {
        q.set(key, value)
      }
    })
    q.set("page", String(nextPage))
    return `/properties?${q.toString()}`
  }

  return (
    <>
        {/* Header */}
        <section className="relative overflow-hidden border-b border-border/10 bg-[#0a0a0a] py-16 md:py-20">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.15)_0%,transparent_50%)] rounded-full blur-[80px] mix-blend-screen animate-pulse" />
          </div>
          <div className="container relative z-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur-sm mb-4">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-[#D4AF37] mr-2"></span>
                  Live Inventory
                </div>
                <h1 className="font-serif text-4xl font-bold md:text-5xl text-white">Dubai <span className="text-[#AA8122]">Properties</span></h1>
                <p className="mt-4 text-lg text-white/70 font-light max-w-xl">
                  Explore thousands of premium residential and commercial investment opportunities across the UAE.
                </p>
              </div>
              <Button className="ore-gradient text-black font-semibold h-12 px-8" asChild>
                <Link href="/chat">Ask AI Assistant</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Filters & Results */}
        <section className="py-8">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
              {/* Filters Sidebar */}
              <aside className="hidden lg:block">
                <div className="sticky top-24">
                  <PropertyFilters
                    collapsible
                    defaultOpen={false}
                    areas={areaNames}
                    developers={developerNames}
                  />
                </div>
              </aside>

              {/* Results */}
              <div id="properties-results" className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                   <div className="lg:hidden">
                     <MobilePropertyFilters
                       areas={areaNames}
                       developers={developerNames}
                     />
                   </div>
                   <div className="flex-1">
                     <PropertiesToolbar total={total} page={page} pageSize={pageSize} sort={sort} view={view} />
                   </div>
                </div>

                {/* Properties Grid */}
                <div
                  className={
                    view === "list"
                      ? "grid gap-6"
                      : "grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
                  }
                >
                  {properties.length > 0 ? (
                    properties.map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))
                  ) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                      <div className="mb-4 rounded-full bg-muted p-6">
                        <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold">No properties found</h3>
                      <p className="mt-2 text-muted-foreground max-w-xs">
                        Try adjusting your filters or search criteria to find what you're looking for.
                      </p>
                      <Button variant="outline" className="mt-8" asChild>
                        <Link href="/properties">Clear All Filters</Link>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    href={buildPageLink(Math.max(1, page - 1))}
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition hover:border-foreground hover:text-foreground",
                      page <= 1 && "pointer-events-none opacity-50"
                    )}
                  >
                    Previous
                  </Link>
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx) => (
                      <Link
                        key={`${p}-${idx}`}
                        href={buildPageLink(p)}
                        className={cn(
                          "inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition",
                          p === page
                            ? "border-secondary bg-secondary text-secondary-foreground"
                            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                        )}
                        aria-current={p === page ? "page" : undefined}
                      >
                        {p}
                      </Link>
                    ))}
                  <Link
                    href={buildPageLink(Math.min(totalPages, page + 1))}
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition hover:border-foreground hover:text-foreground",
                      page >= totalPages && "pointer-events-none opacity-50"
                    )}
                  >
                    Next
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
