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
  { href: "/dashboard", label: "Command Dashboard", icon: Gauge },
  { href: "/market", label: "Market Database", icon: Database },
  { href: "/ads-studio", label: "Ads Studio", icon: Megaphone },
  { href: "/crm", label: "CRM Core", icon: Users },
  { href: "/notebook", label: "Market Notebook", icon: BookOpen },
  { href: "/cloud", label: "Market Cloud", icon: Cloud },
  { href: "/owner-session", label: "Owner Session", icon: Building2 },
  { href: "/agent-network", label: "Agent Network", icon: Network },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/demo", label: "Operating Flow", icon: PlaySquare },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function CommandShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="freehold-command">
      <div className="fh-shell">
        <aside className="fh-sidebar">
          <Link href="/dashboard" className="fh-brand" aria-label="Freehold Intelligence Command Center">
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
              Internal intelligence data. The system works without external services and only uses Gemini server-side if
              a key is configured.
            </p>
          </div>
        </aside>
        <main className="fh-main">
          <div className="fh-topbar">
            <p className="fh-topbar-title">Private company cockpit</p>
            <div className="fh-button-row">
              <span className="fh-status gold">Internal intelligence data</span>
              <Link className="fh-btn primary" href="/demo">
                Open operating flow
              </Link>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
