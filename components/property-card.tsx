"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { MapPin, BedDouble, Bath, Maximize, TrendingUp } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { Property } from "@/lib/types/project"
import { isFiniteNumber, shouldShow } from "@/lib/utils/safeDisplay"

const formatRoiLabel = (value?: number | null) => {
  if (!isFiniteNumber(value) || value <= 0) return null
  return `~${value.toFixed(1)} yr ROI`
}

interface PropertyCardProps {
  property: Property
  compact?: boolean
}

export function PropertyCard({ property, compact = false }: PropertyCardProps) {
  const formatPrice = (price: number, currency: Property["currency"]) => {
    const locale = currency === "AED" ? "en-AE" : "en-US"
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const imageSrc = property.images?.[0] || "/logo.png"
  const imageClass = property.images?.[0]
    ? "object-cover transition-transform duration-500 group-hover:scale-105"
    : "object-contain bg-muted p-6"
  const bedLabel =
    property.specifications.bedrooms === 0
      ? "Studio"
      : `${property.specifications.bedrooms} Bed`
  const bathLabel = `${property.specifications.bathrooms} Bath${
    property.specifications.bathrooms === 1 ? "" : "s"
  }`
  const roiLabel = formatRoiLabel(property.roi ?? property.investmentMetrics.roi)
  const rentalYield =
    typeof property.rentalYield === "number" ? property.rentalYield : property.investmentMetrics.rentalYield
  const roiValue = typeof property.roi === "number" ? property.roi : property.investmentMetrics.roi
  const paymentPlanDescription = property.paymentPlan?.description || null
  const projectUrl = `/properties/${property.slug}`

  return (
    <Link href={projectUrl} className="group block" prefetch={false}>
      <Card className="overflow-hidden hover:shadow-lg hover:border-border">
        <div className={`relative overflow-hidden bg-muted ${compact ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
          <Image
            src={imageSrc}
            alt={property.title}
            fill
            className={imageClass}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <div className={`absolute left-3 z-10 flex flex-wrap gap-1.5 ${compact ? "top-2.5" : "top-3"}`}>
            <Badge
              variant="secondary"
              className={`bg-white/90 text-foreground backdrop-blur-md border-none shadow-sm ${compact ? "text-[10px] px-2 py-0.5" : "text-[11px]"}`}
            >
              {property.type === "off-plan" ? "Off-Plan" : property.type === "secondary" ? "Secondary" : "Commercial"}
            </Badge>
            {property.investmentMetrics.goldenVisaEligible && (
              <Badge className={`bg-[#C69B3E] text-white border-none shadow-sm ${compact ? "text-[10px] px-2 py-0.5" : "text-[11px]"}`}>
                Golden Visa
              </Badge>
            )}
          </div>
        </div>

        <CardContent className={compact ? "p-3.5" : "p-5"}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className={`font-serif font-bold group-hover:text-[#C69B3E] transition-colors ${compact ? "text-base line-clamp-2" : "text-lg line-clamp-1"}`}>
              {property.title}
            </h3>
            {roiLabel && (
              <Badge
                variant="outline"
                className={`shrink-0 border-[#C69B3E]/20 bg-[#C69B3E]/5 text-[#C69B3E] font-semibold ${compact ? "text-[9px] h-4 px-1.5" : "text-[10px] h-5"}`}
              >
                <TrendingUp className="mr-0.5 h-3 w-3" />
                {roiLabel}
              </Badge>
            )}
          </div>

          <div className="mb-3.5 flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <MapPin className="h-3 w-3 text-[#C69B3E]/60" />
            <span className="line-clamp-1">{property.location.area}, Dubai</span>
          </div>

          <div className={`flex items-center text-[11px] text-muted-foreground border-y border-border/40 ${compact ? "mb-3 gap-3 py-2" : "mb-4 gap-4 py-2.5"}`}>
            <div className="flex items-center gap-1.5">
              <BedDouble className="h-3.5 w-3.5 text-foreground/50" />
              <span>{bedLabel}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bath className="h-3.5 w-3.5 text-foreground/50" />
              <span>{bathLabel}</span>
            </div>
            {!compact && shouldShow(property.specifications.sizeSqft) && (
              <div className="flex items-center gap-1.5">
                <Maximize className="h-3.5 w-3.5 text-foreground/50" />
                <span>{property.specifications.sizeSqft.toLocaleString()} sqft</span>
              </div>
            )}
          </div>

          <div className={`${compact ? "text-lg" : "text-xl"} font-bold text-foreground tracking-tight`}>
            {formatPrice(property.price, property.currency)}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted-foreground">
            {rentalYield && (
              <span className="flex items-center gap-1">
                <span className="font-semibold text-emerald-600">{rentalYield}%</span>
                <span>yield</span>
              </span>
            )}
            {roiValue && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">{roiValue}</span>
                <span>yr ROI</span>
              </span>
            )}
            {property.constructionProgress != null && property.constructionProgress > 0 && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">{property.constructionProgress}%</span>
                <span>built</span>
              </span>
            )}
          </div>
          {paymentPlanDescription && (
            <div className="mt-2 inline-flex items-center rounded-lg border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              {paymentPlanDescription}
            </div>
          )}
        </CardContent>

        <CardFooter className={compact ? "p-3.5 pt-0" : "p-5 pt-0"}>
          <div
            className={`w-full rounded-xl border border-[#C69B3E]/15 bg-[#C69B3E]/[0.04] text-center font-semibold uppercase tracking-[0.1em] text-[#C69B3E] transition-all group-hover:bg-[#C69B3E] group-hover:text-white group-hover:border-[#C69B3E] ${compact ? "px-3 py-2 text-[10px]" : "px-4 py-2.5 text-[11px]"}`}
          >
            Explore Unit
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
