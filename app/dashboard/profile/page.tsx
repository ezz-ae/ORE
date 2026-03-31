import { Badge } from "@/components/ui/badge"
import { DashboardProfileForm } from "@/components/dashboard-profile-form"
import { getUserProfileByEmail } from "@/lib/ore"

interface DashboardProfilePageProps {
  searchParams?: { email?: string }
}

export default async function DashboardProfilePage({ searchParams }: DashboardProfilePageProps) {
  const email = searchParams?.email
  const profile = email ? await getUserProfileByEmail(email) : null

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-gradient-to-b from-background to-muted/70 p-6">
        <Badge className="mb-3 ore-gradient" variant="secondary">
          Profile & Settings
        </Badge>
        <h1 className="font-serif text-3xl font-bold">Broker Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your details, role, and dashboard preferences.
        </p>
        {!email && (
          <p className="mt-2 text-xs text-muted-foreground">
            Tip: open with <code>?email=your@company.com</code> to load an existing profile.
          </p>
        )}
      </section>

      <DashboardProfileForm initialProfile={profile} />
    </div>
  )
}
