"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { dashboardNavItems } from "@/components/dashboard-sidebar"
import { cn } from "@/lib/utils"

export function DashboardMobileNav({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const accessRole = userRole === "broker" ? "broker" : "admin"
  
  // Focus on top 4 actions for the mobile bottom bar
  const mainItems = dashboardNavItems
    .filter((item) => item.roles.includes(accessRole) && item.href !== "/crm/profile" && item.href !== "/crm/playbook")
    .slice(0, 4)

  // Add profile as the rightmost item
  const profileItem = dashboardNavItems.find(item => item.href === "/crm/profile")
  if (profileItem && profileItem.roles.includes(accessRole)) {
    mainItems.push(profileItem)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#081710]/95 pb-safe shadow-[0_-16px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-around px-1 py-3">
        {mainItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 min-w-[64px] rounded-xl px-2 py-1.5 transition-all duration-200",
                isActive
                  ? "bg-[#D4AC50]/14 text-[#E7C56B]"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
              <span className="text-[10px] font-semibold tracking-wide leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
