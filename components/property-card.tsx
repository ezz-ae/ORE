"use client"

import { Badge } from "@/components/ui/badge"
import { MapPin, BedDouble, Bath, Maximize, TrendingUp, ArrowUpRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { Property } from "@/lib/types/project"
import { cn } from "@/lib/utils"
import { isFiniteNumber, shouldShow } from "@/lib/utils/safeDisplay"

const formatRoiLabel = (value?: number | null) => {
  if (!isFiniteNumber(value) || value <= 0) return null
  return `${value.toFixed(1)} yr ROI`
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
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const imageSrc = property.images?.[0] || "/logo.png"
  const hasRealImage = Boolean(property.images?.[0])
  const bedLabel =
    property.specifications.bedrooms === 0 ? "Studio" : `${property.specifications.bedrooms} Bed`
  const bathLabel = `${property.specifications.bathrooms} Bath${
    property.specifications.bathrooms === 1 ? "" : "s"
  }`
  const roiLabel = formatRoiLabel(property.roi ?? property.investmentMetrics.roi)
  const rentalYield =
    typeof property.rentalYield === "number" ? property.rentalYield : property.investmentMetrics.rentalYield
  const projectUrl = `/properties/${property.slug}`
  const isList = layout === "list"
  const typeLabel =
    property.type === "off-plan" ? "Off-Plan" : property.type === "secondary" ? "Secondary" : "Commercial"

  return (
    <Link href={projectUrl} className="group block" prefetch={false}>
      <article
        className={cn(
          "relative overflow-hidden rounded-[24px] bg-[#0F1F18] text-white transition-all duration-300",
          "shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.04]",
          "hover:-translate-y-1 hover:ring-[#C69B3E]/30 hover:shadow-[0_36px_100px_-40px_rgba(0,0,0,0.65)]",
          isList && "sm:grid sm:grid-cols-[300px_minmax(0,1fr)]",
        )}
      >
        {/* Image — full-bleed, taller, with cinematic gradient */}
        <div
          className={cn(
            "relative overflow-hidden bg-[#0A1F17]",
            compact ? "aspect-[16/10]" : "aspect-[5/4]",
            isList && "aspect-auto h-full min-h-[260px] sm:min-h-[320px]",
          )}
        >
          <Image
            src={imageSrc}
            alt={property.title}
            fill
            sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "object-cover transition-transform duration-700 group-hover:scale-[1.06]",
              !hasRealImage && "object-contain p-10 opacity-60",
            )}
          />
          {/* Cinematic vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1F18] via-[#0F1F18]/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#0F1F18]/60" />

          {/* Top chips */}
          <div className={cn("absolute left-4 top-4 z-10 flex flex-wrap gap-1.5", compact && "left-3 top-3")}>
            <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
              {typeLabel}
            </span>
            {property.investmentMetrics.goldenVisaEligible && (
              <span className="rounded-full border border-[#D4AC50]/30 bg-[#D4AC50]/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F0D792] backdrop-blur-md">
                Golden Visa
              </span>
            )}
          </div>

          {/* Floating price tag — bottom-left of image */}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#F0D792]">From</p>
              <p className="mt-0.5 truncate text-[22px] font-bold leading-none text-white sm:text-[26px]">
                {formatPrice(property.price, property.currency)}
              </p>
            </div>
            {roiLabel && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 backdrop-blur-md">
                <TrendingUp className="h-3 w-3" />
                {roiLabel}
              </span>
            )}
          </div>
        </div>

        {/* Body — dark with gold edge */}
        <div className="flex min-w-0 flex-col">
          <div className={cn("p-5", compact && "p-4", isList && "p-6")}>
            <h3
              className={cn(
                "font-serif font-semibold leading-tight text-white transition-colors group-hover:text-[#F0D792]",
                compact ? "text-[15px] line-clamp-2" : "text-[17px] line-clamp-2",
                isList && "text-[22px]",
              )}
            >
              {property.title}
            </h3>

            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-white/45">
              <MapPin className="h-3 w-3 text-[#D4AC50]" />
              <span className="line-clamp-1">{property.location.area}, Dubai</span>
            </div>

            {/* Spec strip */}
            <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3.5 text-[11px] text-white/55">
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5 text-white/35" />
                {bedLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <Bath className="h-3.5 w-3.5 text-white/35" />
                {bathLabel}
              </span>
              {shouldShow(property.specifications.sizeSqft) && (
                <span className="flex items-center gap-1.5">
                  <Maximize className="h-3.5 w-3.5 text-white/35" />
                  {property.specifications.sizeSqft.toLocaleString()} sqft
                </span>
              )}
            </div>

            {/* Yield chip (only when present) */}
            {rentalYield ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                <span className="font-semibold">{rentalYield}%</span>
                <span className="text-emerald-200/70">avg rental yield</span>
              </div>
            ) : null}
          </div>

          {/* Footer CTA — gold sweep on hover */}
          <div className="mt-auto flex items-center justify-between border-t border-white/[0.05] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60 transition-colors group-hover:text-[#F0D792]">
            <span>View Property</span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#F0D792]" />
          </div>
        </div>
      </article>
    </Link>
  )
}
