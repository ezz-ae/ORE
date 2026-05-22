import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, BedDouble, Bath, MapPin, Ruler, Sparkles } from "lucide-react"
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
  if (!prices.length) return "Price on request"
  return `From ${formatPrice(Math.min(...prices))}`
}

const getPrimaryUnit = (project: Project) => {
  const units = Array.isArray(project.units) ? project.units : []
  if (!units.length) return null
  const pricedUnits = units.filter((u) => Number.isFinite(u.priceFrom) && u.priceFrom > 0)
  if (!pricedUnits.length) return units[0]
  return pricedUnits.reduce((best, u) => (u.priceFrom < best.priceFrom ? u : best))
}

const formatBedroomLabel = (n?: number) => (typeof n !== "number" ? null : n === 0 ? "Studio" : `${n} BR`)
const formatBathLabel = (n?: number) => (typeof n !== "number" ? null : `${n} Bath${n === 1 ? "" : "s"}`)

const STATUS_STYLE: Record<string, { label: string; tone: string }> = {
  launching: { label: "Launching", tone: "border-[#D4AC50]/40 bg-[#D4AC50]/20 text-[#F0D792]" },
  selling: { label: "Selling", tone: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" },
  completed: { label: "Completed", tone: "border-white/15 bg-white/10 text-white" },
  sold_out: { label: "Sold Out", tone: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
}

export function ProjectCard({ project }: ProjectCardProps) {
  const highlights = project.investmentHighlights || ({} as Project["investmentHighlights"])
  const location = project.location || ({} as Project["location"])
  const projectSlug = project.slug ? `/projects/${project.slug}` : "/projects"
  const status = STATUS_STYLE[project.status ?? "selling"] || STATUS_STYLE.selling
  const developerName =
    typeof (project as { developer?: { name?: string } }).developer === "object"
      ? (project as { developer?: { name?: string } }).developer?.name
      : undefined

  const primary = getPrimaryUnit(project)
  const bedrooms = formatBedroomLabel(primary?.bedrooms)
  const baths = formatBathLabel(
    typeof primary?.baths === "number" ? primary.baths : primary?.bathrooms,
  )
  const area = primary?.sizeFrom ? `${primary.sizeFrom.toLocaleString()} sqft` : null
  const specs = [bedrooms, baths, area].filter(Boolean) as string[]

  return (
    <Link href={projectSlug} className="group block" prefetch={false}>
      <article className="relative isolate overflow-hidden rounded-[28px] bg-[#0A0D10] ring-1 ring-white/[0.06] shadow-[0_32px_100px_-48px_rgba(0,0,0,0.6)] transition-all duration-300 hover:ring-[#D4AC50]/30 hover:-translate-y-1.5">
        {/* Cinematic image — taller than property */}
        <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/4]">
          <Image
            src={project.heroImage || "/logo.png"}
            alt={project.name || "Project"}
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[900ms] group-hover:scale-[1.08]"
          />
          {/* Editorial overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D10] via-[#0A0D10]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0D10]/50 via-transparent to-transparent" />

          {/* Status chip — top-right */}
          <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur-md ${status.tone}`}>
              {status.label}
            </span>
            {highlights.goldenVisaEligible && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AC50]/40 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F0D792] backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                Golden Visa
              </span>
            )}
          </div>

          {/* Title block — bottom-left overlaid */}
          <div className="absolute inset-x-5 bottom-5 z-10">
            {developerName && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4AC50]/80">
                {developerName}
              </p>
            )}
            <h3 className="mt-1.5 font-serif text-[22px] font-semibold leading-[1.1] text-white line-clamp-2 transition-colors group-hover:text-[#F0D792] sm:text-[24px]">
              {project.name || "Project"}
            </h3>
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-white/65">
              <MapPin className="h-3.5 w-3.5 text-[#D4AC50]/70" />
              <span className="line-clamp-1">{location.area || "Dubai"}</span>
            </div>
          </div>
        </div>

        {/* Lower bar — price + specs */}
        <div className="grid gap-3 p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Starting Price</p>
              <p className="mt-0.5 truncate text-[19px] font-bold leading-none text-white sm:text-[21px]">
                {getPriceRange(project)}
              </p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75 transition-colors group-hover:border-[#D4AC50]/40 group-hover:bg-[#D4AC50]/10 group-hover:text-[#F0D792]">
              Explore
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>

          {specs.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.05] pt-3.5 text-[11px] text-white/55">
              {bedrooms && (
                <span className="flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5 text-white/30" />
                  {bedrooms}
                </span>
              )}
              {baths && (
                <span className="flex items-center gap-1.5">
                  <Bath className="h-3.5 w-3.5 text-white/30" />
                  {baths}
                </span>
              )}
              {area && (
                <span className="flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-white/30" />
                  {area}
                </span>
              )}
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}
