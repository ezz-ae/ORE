"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { MapPin, BedDouble, Bath, Maximize, TrendingUp, ArrowRight, Building2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { Property } from "@/lib/types/project"
import { cn } from "@/lib/utils"
import { isFiniteNumber, shouldShow } from "@/lib/utils/safeDisplay"

const formatRoiLabel = (value?: number | null) => {
  if (!isFiniteNumber(value) || value <= 0) return null
  return `~${value.toFixed(1)} yr ROI`
}

interface PropertyCardProps {
  property: Property
  compact?: boolean
  layout?: "grid" | "list"
}

export function PropertyCard({ property, compact = false, layout = "grid" }: PropertyCardProps) {
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
  const isList = layout === "list"
  const specItems = [
    { icon: BedDouble, label: bedLabel },
    { icon: Bath, label: bathLabel },
    shouldShow(property.specifications.sizeSqft)
      ? { icon: Maximize, label: `${property.specifications.sizeSqft.toLocaleString()} sqft` }
      : null,
    property.type
      ? { icon: Building2, label: property.type === "off-plan" ? "Off-Plan" : property.type === "secondary" ? "Secondary" : "Commercial" }
      : null,
  ].filter(Boolean) as Array<{ icon: typeof BedDouble; label: string }>

  return (
    <Link href={projectUrl} className="group block" prefetch={false}>
      <Card
        className={cn(
          "overflow-hidden rounded-[28px] border-[#152E24]/10 bg-white shadow-[0_20px_60px_-40px_rgba(21,46,36,0.24)] transition-all duration-300 hover:-translate-y-1 hover:border-[#C69B3E]/20 hover:shadow-[0_32px_90px_-45px_rgba(21,46,36,0.32)]",
          isList && "sm:grid sm:grid-cols-[280px_minmax(0,1fr)] sm:items-stretch",
        )}
      >
        <div
          className={cn(
            `relative overflow-hidden bg-[#F5F1E8] ${compact ? "aspect-[16/9]" : "aspect-[4/3]"}`,
            isList && "aspect-auto h-[240px] sm:h-full sm:min-h-[320px]",
          )}
        >
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
              className={`border-none bg-white/90 text-[#152E24] backdrop-blur-md shadow-sm ${compact ? "text-[10px] px-2 py-0.5" : "text-[11px]"}`}
            >
              {property.type === "off-plan" ? "Off-Plan" : property.type === "secondary" ? "Secondary" : "Commercial"}
            </Badge>
            {property.investmentMetrics.goldenVisaEligible && (
              <Badge className={`border-none bg-[#C69B3E] text-[#152E24] shadow-sm ${compact ? "text-[10px] px-2 py-0.5" : "text-[11px]"}`}>
                Golden Visa
              </Badge>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <CardContent
            className={cn(
              compact ? "p-3.5 text-[#152E24]" : "p-5 text-[#152E24]",
              isList && "flex flex-1 flex-col justify-between gap-5 p-5 sm:p-6",
            )}
          >
            <div>
              <div className={cn("mb-2 flex items-start justify-between gap-2", isList && "mb-3 gap-4") }>
                <div className="min-w-0">
                  <h3
                    className={cn(
                      `font-serif font-bold text-[#152E24] transition-colors group-hover:text-[#C69B3E] ${compact ? "text-base line-clamp-2" : "text-lg line-clamp-1"}`,
                      isList && "text-xl line-clamp-2 sm:text-2xl",
                    )}
                  >
                    {property.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#152E24]/55 sm:text-[12px]">
                    <MapPin className="h-3 w-3 text-[#C69B3E]/70" />
                    <span className="line-clamp-1">{property.location.area}, Dubai</span>
                  </div>
                </div>
                {roiLabel && (
                  <Badge
                    variant="outline"
                    className={cn(
                      `shrink-0 border-[#C69B3E]/20 bg-[#C69B3E]/5 text-[#A56F12] font-semibold ${compact ? "text-[9px] h-4 px-1.5" : "text-[10px] h-5"}`,
                      isList && "rounded-full px-2.5 py-1 text-[10px] sm:text-[11px]",
                    )}
                  >
                    <TrendingUp className="mr-0.5 h-3 w-3" />
                    {roiLabel}
                  </Badge>
                )}
              </div>

              {!isList && (
                <div className={`flex items-center border-y border-[#152E24]/10 text-[11px] text-[#152E24]/55 ${compact ? "mb-3 gap-3 py-2" : "mb-4 gap-4 py-2.5"}`}>
                  {specItems.slice(0, 3).map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-[#152E24]/45" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={cn(isList && "grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]") }>
                <div>
                  <div className={cn(`${compact ? "text-lg" : "text-xl"} font-bold tracking-tight text-[#152E24]`, isList && "text-2xl sm:text-3xl")}>
                    {formatPrice(property.price, property.currency)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[#152E24]/62">
                    {rentalYield && (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                        <span className="font-semibold">{rentalYield}%</span>
                        <span>yield</span>
                      </span>
                    )}
                    {roiValue && (
                      <span className="flex items-center gap-1.5 rounded-full bg-[#C69B3E]/10 px-2.5 py-1 text-[#8B5E11]">
                        <span className="font-semibold">{roiValue}</span>
                        <span>yr ROI</span>
                      </span>
                    )}
                    {property.constructionProgress != null && property.constructionProgress > 0 && (
                      <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                        <span className="font-semibold">{property.constructionProgress}%</span>
                        <span>built</span>
                      </span>
                    )}
                  </div>
                  {paymentPlanDescription && (
                    <div className="mt-3 inline-flex max-w-full items-center rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                      <span className="line-clamp-2">{paymentPlanDescription}</span>
                    </div>
                  )}
                </div>

                {isList && (
                  <div className="grid gap-2 rounded-2xl border border-[#152E24]/8 bg-[#FAF8F5] p-4">
                    {specItems.slice(0, 4).map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-2.5 text-sm text-[#152E24]/72">
                        <Icon className="h-4 w-4 text-[#C69B3E]/80" />
                        <span className="font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className={cn(compact ? "p-3.5 pt-0" : "p-5 pt-0", isList && "border-t border-[#152E24]/10 p-5 pt-4 sm:px-6") }>
            <div
              className={cn(
                `w-full rounded-xl border border-[#C69B3E]/20 bg-[#C69B3E]/[0.05] font-semibold uppercase tracking-[0.1em] text-[#A56F12] transition-all group-hover:border-[#C69B3E] group-hover:bg-[#C69B3E] ${compact ? "px-3 py-2 text-[10px]" : "px-4 py-2.5 text-[11px]"}`,
                isList ? "flex items-center justify-between gap-4 px-4 py-3 text-left" : "text-center group-hover:text-[#152E24]",
              )}
            >
              <div>
                <span className={cn("block", isList && "text-[10px] group-hover:text-[#152E24]/75")}>Explore Unit</span>
                {isList && (
                  <span className="mt-1 block text-sm font-medium normal-case tracking-normal text-[#152E24]/65 group-hover:text-[#152E24]">
                    View pricing, availability, payment plan, and full property context.
                  </span>
                )}
              </div>
              {isList && <ArrowRight className="h-4 w-4 shrink-0 text-[#A56F12] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[#152E24]" />}
            </div>
          </CardFooter>
        </div>
      </Card>
    </Link>
  )
}
