import { Badge } from "@/components/ui/badge"
import { SectionShell } from "@/components/lp/section-shell"

interface AmenitiesSectionProps {
  data: Record<string, unknown>
}

export function AmenitiesSection({ data }: AmenitiesSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Amenities"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) || "Lifestyle infrastructure offered in this campaign."
  const items = Array.isArray(data.items)
    ? data.items.map((item) => (typeof item === "string" ? item : "")).filter(Boolean)
    : []

  return (
    <SectionShell id="amenities" title={title} subtitle={subtitle}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="px-3 py-1 text-sm">
            {item}
          </Badge>
        ))}
      </div>
    </SectionShell>
  )
}
