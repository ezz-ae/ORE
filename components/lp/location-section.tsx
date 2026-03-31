import { Card, CardContent } from "@/components/ui/card"
import { SectionShell } from "@/components/lp/section-shell"

interface LocationSectionProps {
  data: Record<string, unknown>
}

export function LocationSection({ data }: LocationSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Location & Positioning"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Commercial positioning points derived from the listing and campaign."
  const area = (typeof data.area === "string" && data.area) || "Dubai"
  const developer = (typeof data.developer === "string" && data.developer) || "ORE"
  const highlights = Array.isArray(data.highlights)
    ? data.highlights.map((item) => (typeof item === "string" ? item : "")).filter(Boolean)
    : []

  return (
    <SectionShell id="location" title={title} subtitle={subtitle}>
      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Area</p>
            <p className="mt-2 font-serif text-3xl font-bold ore-text-gradient">{area}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Developer</p>
            <p className="mt-2 font-serif text-3xl font-bold ore-text-gradient">{developer}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaign Use</p>
            <p className="mt-2 font-serif text-3xl font-bold ore-text-gradient">Qualification</p>
          </CardContent>
        </Card>
      </div>
      {highlights.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {highlights.map((highlight) => (
            <Card key={highlight} className="border-border/70">
              <CardContent className="p-4 text-sm font-medium">{highlight}</CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </SectionShell>
  )
}
