"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const titleMap: Record<string, { title: string; subtitle: string }> = {
  "/crm/overview": { title: "CRM Overview", subtitle: "Focused execution, not homepage clutter." },
  "/crm/ai-assistant": { title: "AI Workspace", subtitle: "Broker and operator tools in one place." },
  "/crm/inventory": { title: "Inventory", subtitle: "Listings and project performance." },
  "/crm/projects/add": { title: "Project Editor", subtitle: "Create and update listings cleanly." },
  "/crm/landing-pages": { title: "Landing Pages", subtitle: "Campaign pages and conversion tracking." },
  "/crm/leads": { title: "Lead Queue", subtitle: "Pipeline, assignment, and follow-up control." },
  "/crm/analytics": { title: "Analytics", subtitle: "Lead, campaign, and pipeline reporting." },
  "/crm/playbook": { title: "Playbook", subtitle: "Internal CRM operating procedures." },
  "/crm/profile": { title: "Profile & Access", subtitle: "Accounts, roles, and team permissions." },
}

export function CrmHeader({
  user,
}: {
  user: { name: string; role: string; org_title?: string | null }
}) {
  const pathname = usePathname()
  const current =
    (pathname && pathname.startsWith("/crm/landing-pages/") && pathname !== "/crm/landing-pages/create"
      ? { title: "Landing Page Editor", subtitle: "Publish, schedule, and refine campaign pages." }
      : null) ||
    titleMap[pathname || ""] || {
    title: "ORE CRM",
    subtitle: "Internal workspace",
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="container flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="ore-gradient border-none" variant="secondary">
              CRM
            </Badge>
            <span className="text-xs text-muted-foreground">
              {user.org_title || user.role}
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">{current.title}</h1>
          <p className="text-sm text-muted-foreground">{current.subtitle}</p>
        </div>

        <div className="hidden md:flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/crm/leads">Leads</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/crm/analytics">Analytics</Link>
          </Button>
          <Button className="ore-gradient text-white border-none" asChild>
            <Link href="/crm/ai-assistant">AI Workspace</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
