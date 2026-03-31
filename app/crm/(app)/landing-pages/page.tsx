import Link from "next/link"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSessionUser, isAdminRole } from "@/lib/auth"
import { getLandingPagesForDashboard } from "@/lib/landing-pages"
import { LandingPagesList } from "@/components/crm/landing-pages-list"

export default async function CrmLandingPagesPage() {
  const user = await getSessionUser()
  if (!user) redirect("/crm/login")
  if (!isAdminRole(user.role)) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
          <Badge className="mb-3" variant="secondary">
            Campaign Landing Pages
          </Badge>
          <h1 className="font-serif text-3xl font-bold">Access limited</h1>
          <p className="text-sm text-muted-foreground">Only admins can manage campaign landing pages.</p>
        </section>
      </div>
    )
  }

  const pages = await getLandingPagesForDashboard(200)

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="mb-3 ore-gradient" variant="secondary">
              Campaign Landing Pages
            </Badge>
            <h1 className="font-serif text-3xl font-bold">LP Campaign Control</h1>
            <p className="text-sm text-muted-foreground">
              Manage your property campaign pages, track who visited, and see which page is bringing real enquiries.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/crm/inventory">Open Inventory</Link>
            </Button>
            <Button className="ore-gradient" asChild>
              <Link href="/crm/landing-pages/create">Create Landing Page</Link>
            </Button>
          </div>
        </div>
      </section>
      <LandingPagesList initialPages={pages} />
    </div>
  )
}
