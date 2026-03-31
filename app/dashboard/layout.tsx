import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { DashboardSidebar } from "@/components/dashboard-sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="container py-8">
          <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
            <DashboardSidebar user={{ id: "admin", name: "Admin", role: "admin" }} />
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
