import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, ArrowRight } from "lucide-react"
import type { DeveloperProfile } from "@/lib/types/project"
import { safeNum, safeScore, shouldShow } from "@/lib/utils/safeDisplay"

interface DeveloperCardProps {
  developer: DeveloperProfile
}

export function DeveloperCard({ developer }: DeveloperCardProps) {
  const showCompleted = shouldShow(developer.completedProjects)
  const showStars = shouldShow(developer.stars)
  const showHonesty = shouldShow(developer.honestyScore)

  return (
    <Link href={`/developers/${developer.slug}`}>
      <Card className="group overflow-hidden hover:shadow-lg hover:border-border">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#C69B3E]/10 bg-[#C69B3E]/[0.04] shadow-sm shrink-0">
              <Building2 className="h-5 w-5 text-[#C69B3E]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-lg font-bold text-foreground group-hover:text-[#C69B3E] transition-colors truncate">{developer.name}</div>
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {developer.tier ? `${developer.tier} Tier` : "Official Developer"}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {developer.description}
          </p>

          <div className="mt-5 rounded-xl border border-border/40 bg-muted/30 p-3.5">
            <div className="text-[10px] uppercase font-semibold tracking-[0.1em] text-[#C69B3E] mb-1">Track Record</div>
            <p className="text-[13px] text-foreground font-medium line-clamp-2 leading-relaxed">{developer.trackRecord}</p>
          </div>

          <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-[#C69B3E] transition-colors">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Verified Partner
            </span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
