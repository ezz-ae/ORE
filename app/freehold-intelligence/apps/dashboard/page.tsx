import Link from "next/link"
import { BarChart3, Bot, FolderKanban, LayoutDashboard, UserCog } from "lucide-react"

const dashboardApps = [
  { href: "/dashboard/overview", label: "Dashboard Overview", icon: LayoutDashboard, copy: "Operating overview and internal command metrics." },
  { href: "/dashboard/projects", label: "Projects Admin", icon: FolderKanban, copy: "Project management and admin inventory surfaces." },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, copy: "Business and channel performance summaries." },
  { href: "/dashboard/ai-assistant", label: "AI Assistant", icon: Bot, copy: "Internal AI assistance for command workflows." },
  { href: "/dashboard/profile", label: "Profile", icon: UserCog, copy: "Account, access and operator settings." },
]

export default function ControlRoomDashboardAppPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Control Room / Dashboard App</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">Dashboard workspace</h1>
        <p className="mt-4 max-w-3xl text-white/65">Dashboard routes are grouped here as internal apps, so the control room acts as the single launch surface.</p>
      </section>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {dashboardApps.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#D4AF37]/50 hover:bg-white/[0.06]">
              <Icon className="h-6 w-6 text-[#D4AF37]" />
              <h2 className="mt-5 text-xl font-semibold">{item.label}</h2>
              <p className="mt-3 text-sm leading-6 text-white/60">{item.copy}</p>
              <span className="mt-5 inline-flex text-sm font-medium text-[#D4AF37]">Open workspace</span>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
