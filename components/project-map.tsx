import type { Coordinates } from "@/lib/types/project"
import { hasValidCoordinates } from "@/lib/utils/safeDisplay"

interface ProjectMapProps {
  projectName?: string
  area?: string
  coordinates?: Coordinates
}

export function ProjectMap({ projectName, area, coordinates }: ProjectMapProps) {
  const title = projectName || area || "Project location"
  const hasCoords = hasValidCoordinates(coordinates?.lat ?? null, coordinates?.lng ?? null)
  const mapSrc = hasCoords
    ? `https://www.google.com/maps?q=${coordinates?.lat},${coordinates?.lng}&z=15&output=embed`
    : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Project map</p>
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>
        {hasCoords && (
          <span className="rounded-full border border-primary/20 px-3 py-1 text-xs font-semibold uppercase text-primary">
            Live Preview
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-[#0f172a]">
        {hasCoords && mapSrc ? (
          <iframe
            src={mapSrc}
            title={`${title} map`}
            loading="lazy"
            allowFullScreen
            className="h-64 w-full border-0"
          />
        ) : (
          <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Location data not available yet. Check back once the developer shares coordinates.
          </div>
        )}
      </div>
    </div>
  )
}
