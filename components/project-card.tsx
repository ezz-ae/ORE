import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BedDouble, Bath, MapPin, Ruler } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { Project } from "@/lib/types/project"
const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

interface ProjectCardProps {
  project: Project
}

const getPriceRange = (project: Project) => {
  const units = Array.isArray(project.units) ? project.units : []
  const prices = units.flatMap((unit) => [unit.priceFrom, unit.priceTo]).filter((p) => p > 0)
  if (!prices.length) {
    return "Price on Request"
  }
  const minPrice = Math.min(...prices)
  return `From ${formatPrice(minPrice)}`
}

const getPrimaryUnit = (project: Project) => {
  const units = Array.isArray(project.units) ? project.units : []
  if (!units.length) return null
  const pricedUnits = units.filter((unit) => Number.isFinite(unit.priceFrom) && unit.priceFrom > 0)
  if (!pricedUnits.length) return units[0]
  return pricedUnits.reduce((best, unit) => (unit.priceFrom < best.priceFrom ? unit : best))
}

const formatBedroomLabel = (bedrooms?: number) => {
  if (typeof bedrooms !== "number") return null
  return bedrooms === 0 ? "Studio" : `${bedrooms} Bed`
}

const formatBathLabel = (baths?: number) => {
  if (typeof baths !== "number") return null
  return `${baths} Bath${baths === 1 ? "" : "s"}`
}

export function ProjectCard({ project }: ProjectCardProps) {
  const investmentHighlights = project.investmentHighlights || ({} as Project["investmentHighlights"])
  const location = project.location || ({} as Project["location"])
  const projectSlug = project.slug ? `/projects/${project.slug}` : "/projects"
  const statusLabel =
    project.status === "launching"
      ? "Launching"
      : project.status === "selling"
        ? "Selling"
        : project.status === "completed"
          ? "Completed"
          : "Sold Out"

  const primaryUnit = getPrimaryUnit(project)
  const bedrooms = formatBedroomLabel(primaryUnit?.bedrooms)
  const baths = formatBathLabel(
    typeof primaryUnit?.baths === "number" ? primaryUnit.baths : primaryUnit?.bathrooms,
  )
  const area = primaryUnit?.sizeFrom ? `${primaryUnit.sizeFrom.toLocaleString()} sq.ft` : null

  return (
    <Link href={projectSlug} className="group block" prefetch={false}>
      <Card className="overflow-hidden hover:shadow-lg hover:border-border">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={project.heroImage || "/logo.png"}
            alt={project.name || "Project"}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
            <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur-md border-none shadow-sm text-[11px]">
              {statusLabel}
            </Badge>
            {investmentHighlights.goldenVisaEligible && (
              <Badge className="bg-[#C69B3E] text-white border-none shadow-sm text-[11px]">
                Golden Visa
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-5">
          <div className="mb-3">
            <h3 className="font-serif text-lg font-bold line-clamp-1 group-hover:text-[#C69B3E] transition-colors">
              {project.name || "Project"}
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground mt-1.5">
              <MapPin className="h-3 w-3 text-[#C69B3E]/60" />
              <span className="line-clamp-1">{location.area || "Dubai"}</span>
            </div>
          </div>

          <div className="mb-4">
            <p className="font-bold text-xl text-foreground tracking-tight">{getPriceRange(project)}</p>
          </div>

          {(bedrooms || baths || area) && (
            <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground mb-5 pt-3.5 border-t border-border/40">
              {bedrooms && (
                <div className="flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5 text-foreground/50" />
                  <span>{bedrooms}</span>
                </div>
              )}
              {baths && (
                <div className="flex items-center gap-1.5">
                  <Bath className="h-3.5 w-3.5 text-foreground/50" />
                  <span>{baths}</span>
                </div>
              )}
              {area && (
                <div className="flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-foreground/50" />
                  <span>{area}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-[#C69B3E]/70 group-hover:text-[#C69B3E] transition-colors pt-3.5 border-t border-border/40">
            <span>Explore Development</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
