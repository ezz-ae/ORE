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
      <Card className="group overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
        <div className="aspect-video relative overflow-hidden bg-muted">
          <Image
            src={area.image}
            alt={area.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute top-4 left-4 flex flex-wrap gap-1.5 z-10">
            {area.freehold && (
              <Badge className="bg-green-600 text-white border-none shadow-sm h-6">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Freehold
              </Badge>
            )}
            {shouldShow(area.propertyCount) && (
              <Badge variant="secondary" className="bg-background/95 backdrop-blur-md shadow-sm border-none h-6">
                {listingCount} listings
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="font-serif text-2xl font-bold group-hover:text-primary transition-colors tracking-tight">{area.name}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mt-2 font-light">
              {area.description}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-[10px] font-bold uppercase tracking-[0.1em] pt-6 border-t border-border/50">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground/80">
                <Home className="h-3.5 w-3.5 text-primary/70" />
                <span>Price</span>
              </div>
              <div className="text-xs font-bold text-foreground">{priceDisplay}</div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground/80">
                <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
                <span>Yield</span>
              </div>
              <div className="text-xs font-bold text-green-600">{yieldDisplay}</div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground/80">
                <MapPin className="h-3.5 w-3.5 text-primary/70" />
                <span>Score</span>
              </div>
              <div className="text-xs font-bold ore-text-gradient">{scoreDisplay}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
