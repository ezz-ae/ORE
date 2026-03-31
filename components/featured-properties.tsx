import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { getFeaturedProperties } from "@/lib/ore"

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
)

const formatPrice = (price: number, currency: "AED" | "USD") => {
  const locale = currency === "AED" ? "en-AE" : "en-US"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export async function FeaturedProperties() {
  const featuredProperties = await getFeaturedProperties(3)

  if (featuredProperties.length === 0) return null

  return (
    <section className="py-20">
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-[11px] font-semibold text-[#D4AC50] uppercase tracking-[0.2em] mb-2">Curated Selection</p>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-white md:text-4xl">
              Featured Properties
            </h2>
            <p className="mt-2 text-white/40 text-sm">
              Handpicked investment opportunities with exceptional ROI
            </p>
          </div>
          <Button variant="outline" asChild className="hidden md:inline-flex border-white/15 text-white/85 hover:border-[#D4AC50]/30 hover:bg-white/5 hover:text-white rounded-lg gap-2">
            <Link href="/properties">
              View All
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredProperties.map((property) => {
            const imageSrc = property.images?.[0] || "/logo.png"
            const imageClass = property.images?.[0]
              ? "object-cover transition-transform duration-500 group-hover:scale-105"
              : "object-contain bg-white/5 p-6"
            const badges = [
              property.type === "off-plan"
                ? "Off-Plan"
                : property.type === "secondary"
                  ? "Ready"
                  : "Commercial",
            ]

            if (property.investmentMetrics.goldenVisaEligible) {
              badges.push("Golden Visa")
            }

            return (
              <Link
                key={property.id}
                href={`/properties/${property.slug}`}
                className="group block"
                prefetch={false}
              >
                <Card className="overflow-hidden border-white/[0.06] bg-white/[0.04] transition-all hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.06] rounded-2xl">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={imageSrc}
                      alt={property.title}
                      fill
                      className={imageClass}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                    <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-1.5">
                      {badges.map((badge) => (
                        <Badge key={badge} className="border-0 bg-[#C69B3E]/95 text-[#152E24] text-[10px] font-semibold px-2.5 py-0.5 rounded-md">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <div className="mb-3">
                      <h3 className="font-serif text-lg font-semibold line-clamp-1 text-white group-hover:text-[#D4AC50] transition-colors">
                        {property.title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5 text-sm text-white/40">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        <span>{property.location.area}</span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-xl font-bold text-[#D4AC50]">
                        {formatPrice(property.price, property.currency)}
                      </span>
                      <span className="text-xs text-white/30">
                        {property.currency === "AED"
                          ? formatPrice(Math.round(property.price / 3.67), "USD")
                          : formatPrice(Math.round(property.price * 3.67), "AED")}
                      </span>
                    </div>

                    <div className="flex items-center justify-end pt-3 border-t border-white/[0.06]">
                      <div className="inline-flex items-center rounded-lg border border-white/15 px-3 py-2 text-[11px] font-medium text-white/80 transition-colors group-hover:border-[#D4AC50]/30 group-hover:text-white">
                        View Details
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Button variant="outline" asChild className="border-white/15 text-white/85 hover:border-[#D4AC50]/30 hover:bg-white/5 hover:text-white rounded-lg">
            <Link href="/properties">View All Properties</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
