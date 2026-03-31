import Image from "next/image"
import Link from "next/link"
import { MapPin, TrendingUp, Home, CheckCircle2, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { AreaProfile } from "@/lib/types/project"
import { safeNum, safePercent, shouldShow } from "@/lib/utils/safeDisplay"

interface AreaCardProps {
  area: AreaProfile
}

export function AreaCard({ area }: AreaCardProps) {
  const priceLabel = safeNum(area.avgPricePerSqft)
  const priceDisplay = priceLabel === "—" ? "—" : `AED ${priceLabel}`
  const yieldDisplay = safePercent(area.rentalYield)
  const scoreDisplay = shouldShow(area.investmentScore) ? `${area.investmentScore}/10` : "—"
  const listingCount = shouldShow(area.propertyCount) ? `${area.propertyCount}+` : "—"
  return (
    <Link href={`/areas/${area.slug.trim().toLowerCase()}`}>
      <Card className="group overflow-hidden rounded-[28px] border-[#D9CFBD] bg-[linear-gradient(180deg,#FFFDF8_0%,#F6EFE3_100%)] shadow-[0_24px_70px_-40px_rgba(21,46,36,0.24)] transition-all duration-300 hover:-translate-y-1 hover:border-[#C69B3E]/25 hover:shadow-[0_32px_90px_-48px_rgba(21,46,36,0.34)]">
        <div className="relative aspect-video overflow-hidden bg-[#F2EBDD]">
          <Image
            src={area.image}
            alt={area.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            {area.freehold && (
              <Badge className="bg-emerald-600 text-white border-none shadow-sm text-[11px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Freehold
              </Badge>
            )}
            {shouldShow(area.propertyCount) && (
              <Badge variant="secondary" className="border-none bg-white/90 text-[#152E24] backdrop-blur-md shadow-sm text-[11px]">
                {listingCount} listings
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="space-y-4 p-5 text-[#152E24]">
          <div>
            <h3 className="font-serif text-xl font-bold tracking-tight text-[#152E24] transition-colors group-hover:text-[#C69B3E]">{area.name}</h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#152E24]/60">
              {area.description}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_18px_40px_-30px_rgba(21,46,36,0.18)]">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#152E24]/45">
                <Home className="h-3 w-3 text-[#C69B3E]/50" />
                <span>Price/sqft</span>
              </div>
              <div className="text-[13px] font-bold text-[#152E24]">{priceDisplay}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#152E24]/45">
                <TrendingUp className="h-3 w-3 text-[#C69B3E]/50" />
                <span>Yield</span>
              </div>
              <div className="text-[13px] font-bold text-emerald-600">{yieldDisplay}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#152E24]/45">
                <MapPin className="h-3 w-3 text-[#C69B3E]/50" />
                <span>Score</span>
              </div>
              <div className="text-[13px] font-bold text-[#C69B3E]">{scoreDisplay}</div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[20px] bg-[#152E24] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75 transition-colors group-hover:bg-[#10241C]">
            <span>Explore District</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#D4AF37] transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
