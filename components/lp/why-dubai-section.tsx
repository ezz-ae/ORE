import { Card, CardContent } from "@/components/ui/card"
import { SectionShell } from "@/components/lp/section-shell"

interface WhyDubaiSectionProps {
  data: Record<string, unknown>
}

const DEFAULT_POINTS = [
  {
    title: "0% Annual Property Tax",
    description: "Dubai keeps recurring holding costs low for long-term investors.",
  },
  {
    title: "Strong Rental Demand",
    description: "High global migration supports sustained leasing activity across key zones.",
  },
  {
    title: "Investor-Friendly Regulation",
    description: "Clear ownership frameworks and transparent transfer processes increase confidence.",
  },
  {
    title: "Global Connectivity",
    description: "Strategic location and major airports make Dubai attractive for international buyers.",
  },
  {
    title: "Currency Stability",
    description: "AED peg to USD supports predictable pricing for global capital allocation.",
  },
  {
    title: "Premium Lifestyle Infrastructure",
    description: "Healthcare, education, retail, and hospitality continue to improve market depth.",
  },
]

export function WhyDubaiSection({ data }: WhyDubaiSectionProps) {
  const title = (typeof data.title === "string" && data.title) || "Why Dubai"
  const subtitle =
    (typeof data.subtitle === "string" && data.subtitle) ||
    "Market fundamentals that support investor demand regardless of a single project's dataset."

  const customPoints = Array.isArray(data.points)
    ? data.points
        .map((point) => (point && typeof point === "object" ? (point as Record<string, unknown>) : null))
        .filter(Boolean)
        .map((point) => ({
          title: typeof point?.title === "string" ? point.title : "",
          description: typeof point?.description === "string" ? point.description : "",
        }))
        .filter((point) => point.title && point.description)
    : []

  const points = customPoints.length ? customPoints : DEFAULT_POINTS

  return (
    <SectionShell id="why-dubai" title={title} subtitle={subtitle}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {points.map((point) => (
          <Card key={point.title}>
            <CardContent className="p-6">
              <p className="font-serif text-xl font-semibold">{point.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{point.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionShell>
  )
}
