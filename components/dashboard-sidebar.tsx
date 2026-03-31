"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Bot,
  FolderKanban,
  PlusCircle,
  Users,
  BarChart3,
  Settings,
  Rocket,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

type DashboardNavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: Array<"admin" | "broker">
  group?: "ai"
}

export const dashboardNavItems: DashboardNavItem[] = [
  { href: "/crm/overview", label: "Overview", icon: LayoutDashboard, roles: ["admin", "broker"] },
  { href: "/crm/leads", label: "Leads", icon: Users, roles: ["admin", "broker"] },
  { href: "/crm/inventory", label: "Inventory", icon: FolderKanban, roles: ["admin", "broker"] },
  { href: "/crm/projects/add", label: "Add Project", icon: PlusCircle, roles: ["admin"] },
  { href: "/crm/landing-pages", label: "Landing Pages", icon: Rocket, roles: ["admin"] },
  { href: "/crm/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "broker"] },
  { href: "/crm/ai-assistant", label: "AI Assistant", icon: Bot, roles: ["admin", "broker"], group: "ai" },
  { href: "/crm/playbook", label: "Playbook", icon: BookOpen, roles: ["admin"], group: "ai" },
  { href: "/crm/profile", label: "Profile", icon: Settings, roles: ["admin", "broker"] },
]

const navGroups = [
  { key: "workspace", label: "Workspace" },
  { key: "ai", label: "AI Screens" },
  { key: "settings", label: "Settings" },
]

export function DashboardSidebar({
  user,
}: {
  user: { id: string; name: string; role: string; org_title?: string | null }
}) {
  const pathname = usePathname()
  const accessRole = user.role === "broker" ? "broker" : "admin"
  const isAiContext = pathname?.startsWith("/crm/ai-assistant") || pathname?.startsWith("/crm/playbook")

  const groupedItems = navGroups
    .map((group) => ({
      ...group,
      items: dashboardNavItems.filter((item) => {
        if (!item.roles.includes(accessRole)) return false
        if (group.key === "workspace") return !item.group && item.href !== "/crm/profile"
        if (group.key === "ai") return item.group === "ai" && (isAiContext || accessRole === "admin" || item.href === "/crm/ai-assistant")
        if (group.key === "settings") return item.href === "/crm/profile"
        return false
      }),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className="hidden rounded-3xl border border-border bg-card/50 p-6 backdrop-blur-sm lg:sticky lg:top-24 lg:block lg:h-fit">
      <div className="mb-8 px-2">
        <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary mb-2">Access Level</div>
        <div className="font-serif text-xl font-bold text-foreground">
          {user.org_title || (user.role.charAt(0).toUpperCase() + user.role.slice(1))}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground font-medium">ID: {user.id.slice(0, 8)}...</div>
      </div>
      <div className="space-y-6">
        {groupedItems.map((group) => (
          <div key={group.key} className="space-y-1.5">
            <div className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {group.label}
            </div>
            <nav className="space-y-1.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "scale-[1.02] bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  )
}
