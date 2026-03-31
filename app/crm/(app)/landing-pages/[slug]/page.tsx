import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSessionUser, isAdminRole } from "@/lib/auth"
import { getLandingPageForEditor } from "@/lib/landing-pages"
import { EditLandingPageForm } from "@/components/crm/edit-landing-page-form"

export default async function EditLandingPagePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/crm/login")
  if (!isAdminRole(user.role)) redirect("/crm/landing-pages")

  const { slug } = await params
  const landingPage = await getLandingPageForEditor(slug)
  if (!landingPage) notFound()

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="mb-3 ore-gradient" variant="secondary">
              Edit Landing Page
            </Badge>
            <h1 className="font-serif text-3xl font-bold">{landingPage.headline}</h1>
            <p className="text-sm text-muted-foreground">
              Manage publishing, schedule, and campaign messaging for <span className="font-medium text-foreground">/lp/{landingPage.slug}</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/crm/landing-pages">Back to List</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/lp/${landingPage.slug}`} target="_blank">Open Public Page</Link>
            </Button>
          </div>
        </div>
      </section>

      <EditLandingPageForm landingPage={landingPage} />
    </div>
  )
}
