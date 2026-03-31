import { Badge } from "@/components/ui/badge"
import { getAreas } from "@/lib/ore"
import { filterAuthorizedAreas } from "@/lib/utils/authorized"
import { AreasGuideClient } from "@/components/areas-guide-client"

export default async function AreasGuidePage() {
  const rawAreas = await getAreas().catch(() => [])
  const areas = filterAuthorizedAreas(rawAreas)

  return (
    <>
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-background to-muted py-16">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="mb-4 ore-gradient" variant="secondary">
                Area Guide
              </Badge>
              <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Dubai Areas & Neighborhoods
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Comprehensive guide to Dubai’s most sought-after locations. Compare areas, explore lifestyle options, and find your perfect neighborhood.
              </p>
            </div>
          </div>
        </section>
        <AreasGuideClient areas={areas} />
    </>
  )
}
