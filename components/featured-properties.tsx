import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { getFeaturedProperties } from "@/lib/entrestate"

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
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Featured Properties
            </h2>
            <p className="mt-2 text-muted-foreground">
              Handpicked investment opportunities with exceptional ROI
            </p>
          </div>
          <Button variant="outline" asChild className="hidden md:inline-flex">
            <Link href="/properties">View All Properties</Link>
          </Button>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {featuredProperties.map((property) => {
            const imageSrc = property.images?.[0] || "/logo.png"
            const imageClass = property.images?.[0]
              ? "object-cover transition-transform group-hover:scale-105"
              : "object-contain bg-muted p-6"
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
              <Card
                key={property.id}
                className="group overflow-hidden border-border transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <Image
                    src={imageSrc}
                    alt={property.title}
                    fill
                    className={imageClass}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 z-10" />
                  <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <Badge key={badge} className="ore-gradient">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>
              
                <CardContent className="p-6">
                  <div className="mb-3">
                    <h3 className="font-serif text-xl font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                      {property.title}
                    </h3>
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <MapPinIcon className="h-3.5 w-3.5" />
                      <span>{property.location.area}</span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="font-serif text-2xl font-bold ore-text-gradient">
                      {formatPrice(property.price, property.currency)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {property.currency === "AED"
                        ? formatPrice(Math.round(property.price / 3.67), "USD")
                        : formatPrice(Math.round(property.price * 3.67), "AED")}
                      </span>
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-border">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/properties/${property.slug}`}>View Details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Button variant="outline" asChild>
            <Link href="/properties">View All Properties</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
