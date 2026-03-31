import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, ArrowRight } from "lucide-react"
import type { DeveloperProfile } from "@/lib/types/project"
import { shouldShow } from "@/lib/utils/safeDisplay"

interface DeveloperCardProps {
  developer: DeveloperProfile
}

export function DeveloperCard({ developer }: DeveloperCardProps) {
  const showCompleted = shouldShow(developer.completedProjects)
  const showStars = shouldShow(developer.stars)
  const showHonesty = shouldShow(developer.honestyScore)
  const tierLabel = developer.tier ? `${developer.tier} Tier` : "Official Developer"
  const signalLabel = showCompleted
    ? `${developer.completedProjects}+ delivered`
    : showHonesty
      ? `${developer.honestyScore}/10 trust`
      : showStars
        ? `${developer.stars}★ reputation`
        : "Verified performance"

  return (
    <Link href={`/developers/${developer.slug}`}>
      <Card className="group overflow-hidden rounded-[28px] border-[#D9CFBD] bg-[linear-gradient(180deg,#FFFDF8_0%,#F6EFE3_100%)] shadow-[0_24px_70px_-40px_rgba(21,46,36,0.24)] transition-all duration-300 hover:-translate-y-1 hover:border-[#C69B3E]/25 hover:shadow-[0_32px_90px_-48px_rgba(21,46,36,0.34)]">
        <div className="h-1 w-full ore-gradient opacity-80" />
        <CardContent className="p-6 text-[#152E24]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#C69B3E]/15 bg-white shadow-sm shadow-[#C69B3E]/10">
              <Building2 className="h-5 w-5 text-[#C69B3E]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-lg font-bold text-[#152E24] transition-colors group-hover:text-[#C69B3E]">
                {developer.name}
              </div>
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#152E24]/45">
                {tierLabel}
              </div>
            </div>
          </div>

          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#152E24]/65">
            {developer.description}
          </p>

          <div className="mt-5 rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_18px_40px_-30px_rgba(21,46,36,0.18)]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C69B3E]">Track Record</div>
            <p className="line-clamp-3 text-[13px] font-medium leading-relaxed text-[#152E24]">{developer.trackRecord}</p>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-[20px] bg-[#152E24] px-4 py-3 text-[11px] font-semibold text-white/75 transition-colors group-hover:bg-[#10241C]">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {signalLabel}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-[#D4AF37] transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
