"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Building2,
  Cloud,
  Database,
  FileBarChart,
  Gauge,
  Megaphone,
  Network,
  PlaySquare,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"
import { cnCommand } from "@/src/lib/freehold-format"

const navItems = [
  { href: "/freehold-intelligence", label: "Control Apps", icon: Gauge },
  { href: "/freehold-intelligence/apps/market", label: "Market Database", icon: Database },
  { href: "/ads-studio", label: "Ads Studio", icon: Megaphone },
  { href: "/freehold-intelligence/apps/crm", label: "CRM Core", icon: Users },
  { href: "/notebook", label: "Market Notebook", icon: BookOpen },
  { href: "/cloud", label: "Market Cloud", icon: Cloud },
  { href: "/agent-network", label: "Agent Network", icon: Network },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function CommandShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="freehold-command">
      <div className="fh-shell">
        <aside className="fh-sidebar">
          <Link href="/freehold-intelligence" className="fh-brand" aria-label="Freehold Intelligence Command Center">
            <div className="fh-brand-mark">FI</div>
            <div>
              <p className="fh-brand-title">Freehold Intelligence Command Center</p>
              <p className="fh-brand-subtitle">Freehold Real Estate Operating System 2026</p>
            </div>
          </Link>
          <nav className="fh-nav" aria-label="Freehold command navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link key={item.href} href={item.href} className={cnCommand("fh-nav-link", active && "active")}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
          <div className="fh-sidebar-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <p className="mt-2">
              Internal control-room data. Public market URLs now route here instead of exposing operator apps on the
              public site.
            </p>
          </div>
        </aside>
        <main className="fh-main">
          <div className="fh-topbar">
            <p className="fh-topbar-title">Private company cockpit</p>
            <div className="fh-button-row">
              <span className="fh-status gold">Internal intelligence data</span>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
