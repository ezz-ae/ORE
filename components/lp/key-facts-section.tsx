import { SectionShell } from "@/components/lp/section-shell"
import { MapPin, Building2, Calendar, Layers } from "lucide-react"

interface KeyFactsSectionProps {
  data: Record<string, unknown>
}

const isZeroLike = (value: unknown) => {
  if (typeof value === "number") return value === 0
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === "-" || normalized === "0" || normalized === "0%" || normalized === "0.0%") {
    return true
  }
  const numericToken = normalized.replace(/[^0-9.-]/g, "")
  if (!numericToken) return false
  const parsed = Number(numericToken)
  return Number.isFinite(parsed) && parsed === 0
}

const LABEL_ICONS: Record<string, typeof MapPin> = {
  area: MapPin,
  location: MapPin,
  developer: Building2,
  project: Layers,
  "starting price": Building2,
  price: Building2,
  handover: Calendar,
  completion: Calendar,
  status: Layers,
}

const getIcon = (label: string) => {
  const key = label.toLowerCase()
  for (const [k, Icon] of Object.entries(LABEL_ICONS)) {
    if (key.includes(k)) return Icon
  }
  return Layers
}

export function KeyFactsSection({ data }: KeyFactsSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Key Facts"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Quick campaign fundamentals for decision making."
  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
        .filter(Boolean)
        .filter((item) => !isZeroLike(item?.value))
    : []

  if (!items.length) return null

  return (
    <SectionShell id="key-facts" title={title} subtitle={subtitle}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, idx) => {
          const label = typeof item?.label === "string" ? item.label : "Fact"
          const value =
            typeof item?.value === "string"
              ? item.value
              : typeof item?.value === "number"
                ? String(item.value)
                : "-"
          const Icon = getIcon(label)
          return (
            <div
              key={`${label}-${idx}`}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-primary/3 blur-2xl transition-all group-hover:bg-primary/8" />
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/5">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-1.5 font-serif text-2xl font-bold leading-tight text-foreground">
                {value}
              </p>
            </div>
          )
        })}
      </div>
    </SectionShell>
  )
}
