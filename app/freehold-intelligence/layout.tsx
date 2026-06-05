'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, Megaphone, BarChart2, DollarSign,
  Users, Zap, Settings, BookOpen, ShieldCheck, Link as LinkIcon,
  ChevronRight, Menu, X, Sparkles, Bot, Flag, CheckSquare,
  TrendingUp, Globe,
} from 'lucide-react'

const BASE = '/freehold-intelligence'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  accent?: string
  children?: { label: string; href: string }[]
}

const NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href:  BASE,
    icon:  LayoutDashboard,
    accent: 'text-[#D4AF37]',
  },
  {
    label: 'Inventory',
    href:  `${BASE}/inventory`,
    icon:  Package,
    accent: 'text-sky-300',
  },
  {
    label: 'Ads Live',
    href:  `${BASE}/ads-live`,
    icon:  Megaphone,
    accent: 'text-[#4285F4]',
    children: [
      { label: 'Overview',      href: `${BASE}/ads-live` },
      { label: 'Meta Ads',      href: `${BASE}/ads-live/meta` },
      { label: 'Google Ads',    href: `${BASE}/ads-live/google` },
      { label: 'Ad Preview',    href: `${BASE}/ads-live/preview` },
    ],
  },
  {
    label: 'Finance',
    href:  `${BASE}/finance`,
    icon:  DollarSign,
    accent: 'text-emerald-300',
  },
  {
    label: 'Analytics',
    href:  `${BASE}/analytics`,
    icon:  TrendingUp,
    accent: 'text-violet-300',
  },
  {
    label: 'AI Manager',
    href:  `${BASE}/ai-manager`,
    icon:  Bot,
    accent: 'text-rose-300',
    children: [
      { label: 'Overview',    href: `${BASE}/ai-manager` },
      { label: 'Listings',    href: `${BASE}/ai-manager/listings` },
      { label: 'Areas',       href: `${BASE}/ai-manager/areas` },
      { label: 'Developers',  href: `${BASE}/ai-manager/developers` },
      { label: 'Pages',       href: `${BASE}/ai-manager/pages` },
      { label: 'Topics',      href: `${BASE}/ai-manager/topics` },
    ],
  },
  {
    label: 'CRM',
    href:  `${BASE}/crm`,
    icon:  Users,
    accent: 'text-emerald-300',
    children: [
      { label: 'Leads',       href: `${BASE}/crm` },
      { label: 'Board',       href: `${BASE}/crm/board` },
      { label: 'Pipeline',    href: `${BASE}/crm/pipeline` },
      { label: 'Inbox',       href: `${BASE}/crm/inbox` },
      { label: 'Follow-up',   href: `${BASE}/crm/follow-up` },
      { label: 'Agents',      href: `${BASE}/crm/agents` },
      { label: 'Reports',     href: `${BASE}/crm/reports` },
    ],
  },
  {
    label: 'Lead Machine',
    href:  `${BASE}/lead-machine`,
    icon:  Zap,
    accent: 'text-[#D4AF37]',
    children: [
      { label: 'Overview',    href: `${BASE}/lead-machine` },
      { label: 'Campaigns',   href: `${BASE}/lead-machine/campaigns` },
      { label: 'Google Ads',  href: `${BASE}/lead-machine/google` },
      { label: 'Forms',       href: `${BASE}/lead-machine/forms` },
      { label: 'Targeting',   href: `${BASE}/lead-machine/targeting` },
      { label: 'Creatives',   href: `${BASE}/lead-machine/creatives` },
    ],
  },
]

const BOTTOM_NAV: NavItem[] = [
  { label: 'Integrations', href: `${BASE}/integrations`, icon: LinkIcon },
  { label: 'Milestones',   href: `${BASE}/milestones`,   icon: Flag      },
  { label: 'Tasks',        href: `${BASE}/tasks`,        icon: CheckSquare },
  { label: 'Notebook',     href: `${BASE}/notebook`,     icon: BookOpen  },
  { label: 'Security',     href: `${BASE}/security`,     icon: ShieldCheck },
  { label: 'Settings',     href: `${BASE}/settings`,     icon: Settings  },
]

function SidebarItem({ item, pathname, depth = 0 }: {
  item: NavItem
  pathname: string
  depth?: number
}) {
  const isExact = pathname === item.href
  const isActive = isExact || (item.href !== BASE && pathname.startsWith(item.href))
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = hasChildren && isActive
  const Icon = item.icon

  return (
    <div>
      <Link
        href={item.href}
        className={[
          'flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-all',
          isActive
            ? 'bg-white/[0.06] text-white'
            : 'text-white/45 hover:bg-white/[0.03] hover:text-white/70',
        ].join(' ')}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive && item.accent ? item.accent : 'opacity-60'}`} />
        <span className="flex-1">{item.label}</span>
        {hasChildren && (
          <ChevronRight className={`h-3 w-3 opacity-40 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        )}
      </Link>

      {isExpanded && item.children && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-3">
          {item.children.map((child) => {
            const childActive = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                className={[
                  'flex items-center rounded-[8px] px-2.5 py-1.5 text-[12px] transition-all',
                  childActive
                    ? 'bg-white/[0.05] text-white font-medium'
                    : 'text-white/35 hover:text-white/65',
                ].join(' ')}
              >
                {child.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Sidebar({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#06080A]">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-white/[0.05] px-4">
        <Link
          href={BASE}
          className="flex items-center gap-2 text-[13px] font-semibold text-white/90 transition hover:text-white"
          onClick={onClose}
        >
          <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
          Freehold Intelligence
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-white/30 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {NAV.map((item) => (
            <SidebarItem key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="mt-4 border-t border-white/[0.05] pt-4 space-y-0.5">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[12px] font-medium transition-all',
                  isActive
                    ? 'bg-white/[0.05] text-white/80'
                    : 'text-white/30 hover:bg-white/[0.03] hover:text-white/55',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.05] px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-[11px] text-white/25 transition hover:text-white/50"
        >
          <Globe className="h-3 w-3" /> freeholdproperty.ae
        </Link>
      </div>
    </div>
  )
}

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] flex bg-[#06080A] text-[#F7F2E7] antialiased">
      <style>{`
        body > div > header,
        body > div > footer {
          display: none !important;
        }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="hidden w-[220px] shrink-0 border-r border-white/[0.05] lg:block">
        <Sidebar pathname={pathname} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[240px]">
            <Sidebar pathname={pathname} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.05] px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-white/50 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href={BASE} className="flex items-center gap-2 text-[13px] font-semibold text-white/90">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            Freehold Intelligence
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
