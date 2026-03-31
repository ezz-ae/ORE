import { Badge } from "@/components/ui/badge"
import { query } from "@/lib/db"
import { CreateLandingPageForm } from "@/components/crm/create-landing-page-form"

type ProjectOptionRow = {
  slug: string | null
  name: string | null
  area: string | null
}

export default async function CreateLandingPageScreen() {
  const rows = await query<ProjectOptionRow>(
    `SELECT slug, name, area
     FROM gc_projects
     WHERE status = 'selling'
     ORDER BY COALESCE(market_score, NULLIF(payload->>'sortScore', '')::numeric) DESC NULLS LAST
     LIMIT 500`,
  )

  const projects = rows
    .map((row) => ({
      slug: row.slug || "",
      name: row.name || row.slug || "Project",
      area: row.area || "Dubai",
    }))
    .filter((row) => row.slug)

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Create Landing Page
        </Badge>
        <h1 className="font-serif text-3xl font-bold">New Campaign Page</h1>
        <p className="text-sm text-muted-foreground">
          Select any project from inventory and create a dedicated /lp campaign page in one step.
        </p>
      </section>

      <CreateLandingPageForm projects={projects} />
    </div>
  )
}
