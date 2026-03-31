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
    ? "object-cover transition-transform group-hover:scale-105"
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
      <Card className="overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
      <div className={`relative overflow-hidden bg-muted ${compact ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        <Image
          src={imageSrc}
          alt={property.title}
          fill
          className={imageClass}
        />
        <div className={`absolute left-3 z-10 flex flex-wrap gap-1.5 ${compact ? "top-2" : "top-3"}`}>
          <Badge
            variant="secondary"
            className={`bg-background/95 backdrop-blur-md shadow-sm border-none ${compact ? "text-[10px] px-2 py-0.5" : ""}`}
          >
            {property.type === "off-plan" ? "Off-Plan" : property.type === "secondary" ? "Secondary" : "Commercial"}
          </Badge>
          {property.investmentMetrics.goldenVisaEligible && (
            <Badge className={`ore-gradient border-none shadow-sm ${compact ? "text-[10px] px-2 py-0.5" : ""}`}>
              Golden Visa
            </Badge>
          )}
        </div>
      </div>
      
      <CardContent className={compact ? "p-3" : "p-5"}>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className={`font-serif font-bold group-hover:text-primary transition-colors ${compact ? "text-base line-clamp-2" : "text-xl line-clamp-1"}`}>
            {property.title}
          </h3>
          {roiLabel && (
            <Badge
              variant="outline"
              className={`shrink-0 border-primary/20 bg-primary/5 text-primary ${compact ? "text-[9px] h-4 px-1.5" : "text-[10px] h-5"}`}
            >
              <TrendingUp className="mr-1 h-3 w-3" />
              {roiLabel}
            </Badge>
          )}
        </div>
        
        <div className="mb-4 flex items-center gap-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          <MapPin className="h-3 w-3 text-primary/70" />
          <span className="line-clamp-1">{property.location.area}, Dubai</span>
        </div>

        <div className={`flex items-center text-xs text-muted-foreground border-y border-border/50 ${compact ? "mb-3 gap-3 py-2" : "mb-5 gap-4 py-3"}`}>
          <div className="flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 text-foreground/70" />
            <span>{bedLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="h-4 w-4 text-foreground/70" />
            <span>{bathLabel}</span>
          </div>
          {!compact && shouldShow(property.specifications.sizeSqft) && (
            <div className="flex items-center gap-1.5">
              <Maximize className="h-4 w-4 text-foreground/70" />
              <span>{property.specifications.sizeSqft.toLocaleString()} sqft</span>
            </div>
          )}
        </div>

        <div className={`${compact ? "text-xl" : "text-2xl"} font-bold ore-text-gradient tracking-tight`}>
          {formatPrice(property.price, property.currency)}
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          {rentalYield && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-emerald-600">{rentalYield}%</span>
              <span>yield</span>
            </span>
          )}
          {roiValue && (
            <span className="flex items-center gap-1">
              <span className="font-medium">{roiValue}</span>
              <span>yr ROI</span>
            </span>
          )}
          {property.constructionProgress != null && property.constructionProgress > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-medium">{property.constructionProgress}%</span>
              <span>built</span>
            </span>
          )}
        </div>
        {paymentPlanDescription && (
          <div className="mt-1.5 inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {paymentPlanDescription}
          </div>
        )}
      </CardContent>

      <CardFooter className={compact ? "p-3 pt-0" : "p-5 pt-0"}>
        <div
          className={`w-full rounded-full border border-primary/20 bg-primary/5 text-center font-bold uppercase tracking-widest text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary ${compact ? "px-3 py-2 text-[9px]" : "px-4 py-2.5 text-[10px]"}`}
        >
          Explore Unit
        </div>
      </CardFooter>
    </Card>
    </Link>
  )
}
