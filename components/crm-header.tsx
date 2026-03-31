"use client"

import Image from "next/image"
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#081710]/95 backdrop-blur-xl">
      <div className="container flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/crm/overview"
            className="hidden shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05] sm:flex"
          >
            <Image
              src="/ore-logo-white.png"
              alt="ORE CRM"
              width={140}
              height={56}
              priority
              className="h-8 w-auto"
            />
          </Link>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                className="border border-[#D4AC50]/25 bg-[#D4AC50]/12 text-[#E7C56B] hover:bg-[#D4AC50]/12"
                variant="secondary"
              >
                CRM Workspace
              </Badge>
              <span className="text-xs text-white/55">
                {user.org_title || user.role}
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-white">{current.title}</h1>
            <p className="text-sm text-white/55">{current.subtitle}</p>
          </div>
        </div>

        <div className="hidden md:flex flex-wrap gap-2">
          <Button variant="outline" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06] hover:text-white" asChild>
            <Link href="/crm/leads">Leads</Link>
          </Button>
          <Button variant="outline" className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06] hover:text-white" asChild>
            <Link href="/crm/analytics">Analytics</Link>
          </Button>
          <Button className="ore-gradient border-none text-[#152E24] shadow-[0_18px_36px_rgba(212,172,80,0.24)]" asChild>
            <Link href="/crm/ai-assistant">AI Workspace</Link>
          </Button>
        </div>
      </div>
      <div className="container pb-4 sm:hidden">
        <Link
          href="/crm/overview"
          className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]"
        >
          <Image
            src="/ore-logo-white.png"
            alt="ORE CRM"
            width={132}
            height={52}
            priority
            className="h-7 w-auto"
          />
        </Link>
      </div>
    </header>
  )
}
