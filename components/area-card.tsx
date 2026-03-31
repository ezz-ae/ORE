import Image from "next/image"
import Link from "next/link"
import { MapPin, TrendingUp, Home, CheckCircle2 } from "lucide-react"
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
      <Card className="group overflow-hidden hover:shadow-lg hover:border-border">
        <div className="aspect-video relative overflow-hidden bg-muted">
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
              <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur-md border-none shadow-sm text-[11px]">
                {listingCount} listings
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="font-serif text-xl font-bold group-hover:text-[#C69B3E] transition-colors tracking-tight">{area.name}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mt-1.5">
              {area.description}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/40">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <Home className="h-3 w-3 text-[#C69B3E]/50" />
                <span>Price/sqft</span>
              </div>
              <div className="text-[13px] font-bold text-foreground">{priceDisplay}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-[#C69B3E]/50" />
                <span>Yield</span>
              </div>
              <div className="text-[13px] font-bold text-emerald-600">{yieldDisplay}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <MapPin className="h-3 w-3 text-[#C69B3E]/50" />
                <span>Score</span>
              </div>
              <div className="text-[13px] font-bold text-[#C69B3E]">{scoreDisplay}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
