/**
 * App registry — the SINGLE source of truth for "what apps exist" in
 * Freehold Intelligence.
 *
 * Both the persistent navigation spine (spaces-nav) and the hub launcher grid
 * (app/freehold-intelligence/page.tsx) read from this list, so the two can
 * never drift apart again. Add or rename an app here and it updates everywhere.
 *
 * Model (Meta Business Suite, not a Google Cloud maze):
 *   - Each entry is a self-contained app workspace with its own internal
 *     navigation and tools (its own layout.tsx).
 *   - Apps connect to each other for input/output (closed loops), they do not
 *     re-implement each other.
 *   - "Management" is system-level, role-aware reporting that aggregates across
 *     apps — it is NOT an app that owns Finance/Inventory/Ads tools.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Users, Megaphone, DollarSign, TrendingUp, Bot, Package,
  ShieldCheck, Settings, BookOpen, BarChart3, UserCircle,
} from 'lucide-react'
import type { Role } from './session-types'
import { MANAGEMENT_ROLES } from './session-types'

export interface AppDef {
  id:    string
  label: string
  sub:   string
  href:  string
  Icon:  LucideIcon
  /** default metric shown on the hub card; pages may override with live data */
  metric: string
  /** default badge count; pages may override with live data */
  badge:  number
  accent: string
  /** hub card border classes */
  card:   string
  /** hub card icon-chip classes */
  icon:   string
  /** only management roles (admin/ceo/director) may see this app */
  managementOnly?: boolean
  /** hidden from brokers */
  brokerHide?: boolean
  /** visible ONLY to brokers — e.g. the personal agent workspace */
  brokerOnly?: boolean
  /** explicit allow-list of roles — single source of truth; when set it takes
   *  precedence over the flags above and MUST match the section's route guard. */
  roles?: Role[]
  /** show in the persistent top spine (defaults true) */
  spine?: boolean
}

// Canonical role lists reused by both nav visibility and route guards.
export const ALL_ROLES: Role[] = ['broker', 'admin', 'sales_manager', 'director', 'ceo', 'marketing']
export const NON_BROKER_ROLES: Role[] = ['admin', 'sales_manager', 'director', 'ceo', 'marketing']
export const MGMT_ROLES: Role[] = ['admin', 'sales_manager', 'director', 'ceo']
export const STUDIO_ROLES: Role[] = ['admin', 'director', 'ceo', 'marketing']
export const SETTINGS_ROLES: Role[] = ['admin', 'director', 'ceo']

export const APPS: AppDef[] = [
  {
    id: 'crm', label: 'CRM', sub: 'Leads · Agents · Pipeline',
    href: '/freehold-intelligence/crm', Icon: Users,
    metric: '415 leads · 12 urgent', badge: 12, accent: '#D4AF37',
    card: 'border-[#D4AF37]/15 hover:border-[#D4AF37]/35',
    icon: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20',
  },
  {
    id: 'ads', label: 'Ads', sub: 'Meta · Google · Forms · Live',
    href: '/freehold-intelligence/ads', Icon: Megaphone,
    metric: 'Campaigns · creatives · attribution', badge: 0, accent: '#60A5FA',
    card: 'border-blue-400/15 hover:border-blue-400/30',
    icon: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    brokerHide: true,
  },
  {
    id: 'inventory', label: 'Inventory', sub: 'Properties · Projects · Off-plan',
    href: '/freehold-intelligence/inventory', Icon: Package,
    metric: 'properties · landings', badge: 0, accent: '#FBBF24',
    card: 'border-amber-400/15 hover:border-amber-400/30',
    icon: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  {
    id: 'finance', label: 'Finance', sub: 'Invoices · Payments · Credits',
    href: '/freehold-intelligence/finance', Icon: DollarSign,
    metric: 'AED 31.3K · 73% budget', badge: 1, accent: '#34D399',
    card: 'border-emerald-400/15 hover:border-emerald-400/30',
    icon: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    roles: MGMT_ROLES,
  },
  {
    id: 'ai-manager', label: 'Web Studio', sub: 'Listings · SEO · Auto-content',
    href: '/freehold-intelligence/ai-manager', Icon: Bot,
    metric: 'Content · data quality', badge: 0, accent: '#38BDF8',
    card: 'border-sky-400/15 hover:border-sky-400/30',
    icon: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    roles: STUDIO_ROLES,
  },
  {
    id: 'analytics', label: 'Analytics', sub: 'Traffic · Conversions · Pages',
    href: '/freehold-intelligence/analytics', Icon: TrendingUp,
    metric: 'visitors · 30d', badge: 0, accent: '#A78BFA',
    card: 'border-violet-400/15 hover:border-violet-400/30',
    icon: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
    brokerHide: true,
  },
  {
    id: 'notebook', label: 'Notebook', sub: 'Research · Offers · Exports',
    href: '/freehold-intelligence/notebook', Icon: BookOpen,
    metric: 'AI research workspace', badge: 0, accent: '#F472B6',
    card: 'border-pink-400/15 hover:border-pink-400/30',
    icon: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  },
  {
    id: 'integrations', label: 'Integrations', sub: 'Meta · Google · HubSpot · Zapier',
    href: '/freehold-intelligence/integrations', Icon: ShieldCheck,
    metric: '8 connected · 2 pending', badge: 0, accent: 'rgba(255,255,255,0.4)',
    card: 'border-slate-800 hover:border-white/[0.15]',
    icon: 'text-slate-400 bg-slate-800/40 border-slate-800',
    roles: STUDIO_ROLES,
  },
  {
    id: 'settings', label: 'Settings', sub: 'Team · Roles · Billing',
    href: '/freehold-intelligence/settings', Icon: Settings,
    metric: '3 users active', badge: 0, accent: 'rgba(255,255,255,0.4)',
    card: 'border-slate-800 hover:border-white/[0.15]',
    icon: 'text-slate-400 bg-slate-800/40 border-slate-800',
    roles: SETTINGS_ROLES,
  },
  {
    id: 'management', label: 'Management', sub: 'Company-wide reporting · Team · ROI',
    href: '/freehold-intelligence/management', Icon: BarChart3,
    metric: 'System-level reporting', badge: 0, accent: '#D4AF37',
    card: 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40',
    icon: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/25',
    managementOnly: true,
  },
  // The broker's personal workspace — only brokers see this tab.
  // Managers can still visit /agent but don't need a spine tab for it.
  {
    id: 'agent', label: 'My Workspace', sub: 'Leads · Campaigns · Credits · AI',
    href: '/freehold-intelligence/agent', Icon: UserCircle,
    metric: 'My pipeline', badge: 0, accent: '#60A5FA',
    card: 'border-blue-400/15 hover:border-blue-400/30',
    icon: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    brokerOnly: true,
  },
]

/** Whether a role may access an app — single source of truth for nav + guards. */
export function appAllowsRole(a: AppDef, role?: Role): boolean {
  if (a.roles)          return !!role && a.roles.includes(role)
  if (a.brokerOnly)     return role === 'broker'
  if (a.managementOnly) return role ? MANAGEMENT_ROLES.includes(role) : false
  if (a.brokerHide)     return role !== 'broker'
  return true
}

/** Resolve the allow-list of roles for a section id (for route guards). */
export function rolesForApp(id: string): Role[] {
  const a = APPS.find((x) => x.id === id)
  if (!a) return ALL_ROLES
  if (a.roles)          return a.roles
  if (a.brokerOnly)     return ['broker']
  if (a.managementOnly) return MANAGEMENT_ROLES
  if (a.brokerHide)     return NON_BROKER_ROLES
  return ALL_ROLES
}

/** Apps a given role is allowed to see. */
export function visibleApps(role?: Role): AppDef[] {
  return APPS.filter((a) => appAllowsRole(a, role))
}

/** Apps shown in the persistent navigation spine for a role. */
export function spineApps(role?: Role): AppDef[] {
  return visibleApps(role).filter((a) => a.spine !== false)
}
