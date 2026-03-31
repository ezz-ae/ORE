import { CrmFooter } from "@/components/crm-footer"
import { CrmHeader } from "@/components/crm-header"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav"
import { getSessionUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) {
    redirect("/crm/login")
  }

  return (
    <div className="crm-shell dark flex min-h-screen flex-col bg-background text-foreground">
      <CrmHeader user={user} />
      <main className="flex-1 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.03),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted))_72%,hsl(var(--background)))]">
        <div className="container py-4 pb-28 lg:pb-6 md:py-6">
          <DashboardMobileNav userRole={user.role} />
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <DashboardSidebar user={user} />
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </main>
      <CrmFooter />
    </div>
  )
}
