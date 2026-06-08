import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { getFeaturedProperties } from "@/lib/ore"

const MapPinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
  </svg>
)
const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)
const TrendingUpIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
)

const formatPrice = (price: number, currency: "AED" | "USD") => {
  if (currency === "AED") {
    if (price >= 1_000_000) return `AED ${(price / 1_000_000).toFixed(1)}M`
    if (price >= 1_000) return `AED ${(price / 1_000).toFixed(0)}K`
    return `AED ${price}`
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price)
}

export async function FeaturedProperties() {
  const featuredProperties = await getFeaturedProperties(3)

  if (featuredProperties.length === 0) return null

  return (
    <section className="py-20 md:py-24">
      <div className="container">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-14">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AC50]">Curated Selection</p>
            <h2 className="font-serif text-3xl font-bold text-white md:text-4xl lg:text-5xl">
              Featured Properties
            </h2>
            <p className="mt-3 text-sm text-white/35">
              Handpicked opportunities — exceptional yield, proven developers.
            </p>
          </div>
          <Button
            variant="outline"
            asChild
            className="hidden h-10 gap-2 rounded-full border-white/15 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 hover:border-[#D4AC50]/40 hover:bg-white/[0.04] hover:text-white md:inline-flex"
          >
            <Link href="/properties">
              View All <ArrowRightIcon />
            </Link>
          </Button>
        </div>

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featuredProperties.map((property, idx) => {
            const imageSrc = property.images?.[0] || "/logo.png"
            const hasImage = !!property.images?.[0]
            const type = property.type === "off-plan" ? "Off-Plan" : property.type === "secondary" ? "Ready" : "Commercial"
            const goldenVisa = property.investmentMetrics.goldenVisaEligible
            const yieldEst = property.investmentMetrics.rentalYield
            const isLarge = idx === 0

            return (
              <Link
                key={property.id}
                href={`/properties/${property.slug}`}
                prefetch={false}
                className={`group block ${isLarge ? "md:col-span-2 lg:col-span-1" : ""}`}
              >
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={imageSrc}
                      alt={property.title}
                      fill
                      className={hasImage
                        ? "object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        : "object-contain bg-white/5 p-8"
                      }
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D2319]/80 via-[#0D2319]/10 to-transparent" />

                    {/* Type + GV badges */}
                    <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-[#C69B3E] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#152E24]">
                        {type}
                      </span>
                      {goldenVisa && (
                        <span className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/80 backdrop-blur-sm">
                          Golden Visa
                        </span>
                      )}
                    </div>

                    {/* Yield floating badge bottom-left */}
                    {yieldEst && (
                      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-lg bg-[#0A1F17]/80 px-3 py-1.5 backdrop-blur-sm">
                        <TrendingUpIcon />
                        <span className="text-[11px] font-bold text-[#D4AC50]">{yieldEst}% yield</span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    {/* Title + location */}
                    <div className="mb-4">
                      <h3 className="font-serif text-lg font-semibold leading-snug text-white transition-colors line-clamp-1 group-hover:text-[#D4AC50]">
                        {property.title}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-white/40">
                        <MapPinIcon />
                        <span>{property.location.area}</span>
                        {property.location.district && (
                          <>
                            <span className="text-white/20">·</span>
                            <span>{property.location.district}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Price row */}
                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-[#D4AC50]">
                        {formatPrice(property.price, property.currency)}
                      </span>
                      <span className="text-[11px] text-white/25">
                        {property.currency === "AED"
                          ? formatPrice(Math.round(property.price / 3.67), "USD")
                          : `AED ${(property.price * 3.67 / 1_000_000).toFixed(1)}M`}
                      </span>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                      <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
                        {property.type === "off-plan" && (
                          <span className="flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-[#C69B3E]" />
                            Off-plan
                          </span>
                        )}
                        <span>View details</span>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] text-white/40 transition-all group-hover:border-[#D4AC50]/40 group-hover:text-[#D4AC50]">
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Mobile view-all */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 transition hover:border-[#D4AC50]/40 hover:text-white"
          >
            View all properties <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  )
}
