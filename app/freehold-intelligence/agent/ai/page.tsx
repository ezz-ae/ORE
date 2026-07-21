'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, ChevronRight, CheckCircle, AlertCircle,
  Zap, BookOpen, Users, Globe, MapPin,
} from 'lucide-react'
import { useSession } from '@/lib/freehold/use-session'
import { useI18n } from '@/lib/i18n/provider'

type IntegrationState = 'connected' | 'partial' | 'disconnected'
type IntegrationCategory = 'ads' | 'messaging' | 'ai' | 'crm'

interface WorkspaceIntegration {
  id: string
  name: string
  category: IntegrationCategory
  state: IntegrationState
}

interface AgentSummary {
  leads: { total: number; open: number; hot: number }
  focus: { slug: string; name: string; leads: number; closedDeals: number }[]
  integrations: WorkspaceIntegration[]
  aiConfigured: boolean
}

const CATEGORY_META: Record<IntegrationCategory, { labelKey: string; color: string }> = {
  crm:       { labelKey: 'agent.catCrm',       color: 'text-orange-400'  },
  ads:       { labelKey: 'agent.catAds',       color: 'text-fuchsia-400' },
  ai:        { labelKey: 'agent.catAi',        color: 'text-violet-400'  },
  messaging: { labelKey: 'agent.catMessaging', color: 'text-emerald-400' },
}

type Route = 'apps' | 'inventory' | 'frontend'

const ROUTES: { id: Route; labelKey: string; Icon: React.ElementType; descKey: string; color: string }[] = [
  { id: 'apps',      labelKey: 'agent.routeApps',      Icon: Zap,      descKey: 'agent.routeAppsDesc',      color: 'text-gold' },
  { id: 'inventory', labelKey: 'agent.routeInventory', Icon: BookOpen, descKey: 'agent.routeInventoryDesc', color: 'text-violet-400' },
  { id: 'frontend',  labelKey: 'agent.routeListings',  Icon: Globe,    descKey: 'agent.routeListingsDesc',  color: 'text-teal-400'    },
]

// Each route opens onto the real surfaces the agent operates in — so selecting
// a route actually changes the workspace it points you into.
const ROUTE_ACTIONS: Record<Route, { key: string; href: string }[]> = {
  apps: [
    { key: 'agent.act.crm',        href: '/freehold-intelligence/crm' },
    { key: 'agent.act.adsMachine', href: '/freehold-intelligence/lead-machine/ads-machine' },
    { key: 'agent.act.analytics',  href: '/freehold-intelligence/analytics' },
    { key: 'agent.act.notebook',   href: '/freehold-intelligence/notebook' },
  ],
  inventory: [
    { key: 'agent.act.browse',      href: '/freehold-intelligence/inventory' },
    { key: 'agent.act.dataQuality', href: '/freehold-intelligence/inventory/data-quality' },
    { key: 'agent.act.offPlan',     href: '/freehold-intelligence/inventory/off-plan' },
  ],
  frontend: [
    { key: 'agent.act.landings',   href: '/freehold-intelligence/lead-machine/landings' },
    { key: 'agent.act.shortLinks', href: '/freehold-intelligence/lead-machine/links' },
    { key: 'agent.act.catalogue',  href: '/properties' },
  ],
}

export default function AgentAIPage() {
  const { user } = useSession()
  const { t } = useI18n()
  const [summary, setSummary] = useState<AgentSummary | null>(null)
  const [inventoryCount, setInventoryCount] = useState<number | null>(null)
  const [activeRoute, setActiveRoute] = useState<Route>('apps')
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fail = () => { if (!cancelled) setLoadFailed(true) }
    const asJson = (r: Response) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }
    fetch('/api/freehold/agent/summary')
      .then(asJson)
      .then(d => { if (!cancelled && Array.isArray(d?.integrations)) setSummary(d) })
      .catch(fail)
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then(asJson)
      .then(d => { if (!cancelled && Array.isArray(d?.properties)) setInventoryCount(d.properties.length) })
      .catch(fail)
    return () => { cancelled = true }
  }, [])

  const integrations = summary?.integrations ?? []
  const connected = integrations.filter((c) => c.state === 'connected').length
  const needsSetup = integrations.filter((c) => c.state !== 'connected').length

  const grouped = (['crm', 'ads', 'messaging', 'ai'] as IntegrationCategory[]).reduce(
    (acc, cat) => {
      const items = integrations.filter((c) => c.category === cat)
      if (items.length) acc[cat] = items
      return acc
    },
    {} as Record<IntegrationCategory, WorkspaceIntegration[]>,
  )

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {loadFailed && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t('agent.integrationsLoadFailed')}
        </div>
      )}

      {/* Header */}
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('agent.myAi')}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {user?.name ? t('agent.personalAgentNamed', { name: user.name }) : t('agent.personalAgent')}
            {summary && <> — {t('agent.connectionsLive', { connected, total: integrations.length })}</>}
          </p>
        </div>
        {/* Honest availability: only claim the AI is ready when a provider is configured */}
        {summary?.aiConfigured && (
          <div className="flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium text-gold">{t('agent.aiReady')}</span>
          </div>
        )}
        {summary && !summary.aiConfigured && (
          <div className="flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-4 py-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">{t('agent.aiNotConfigured')}</span>
          </div>
        )}
      </section>

      {/* Three-route map */}
      <section className="mt-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.agentRoutes')}</div>
        <div className="grid grid-cols-3 gap-3">
          {ROUTES.map(({ id, labelKey, Icon, descKey, color }) => (
            <button
              key={id}
              onClick={() => setActiveRoute(id)}
              className={`flex flex-col rounded-[18px] border p-4 text-start transition ${
                activeRoute === id
                  ? 'border-line-strong bg-surface-2'
                  : 'border-line bg-surface-2 hover:bg-surface-2'
              }`}
            >
              <Icon className={`h-5 w-5 ${color}`} />
              <div className={`mt-2 text-sm font-semibold ${activeRoute === id ? 'text-white' : 'text-slate-400'}`}>{t(labelKey)}</div>
              <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{t(descKey)}</div>
              {activeRoute === id && (
                <div className={`mt-2 text-xs font-medium ${color}`}>{t('agent.activeDot')}</div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Route actions — real deep-links into the selected domain */}
      <section className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.routeActionsTitle')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROUTE_ACTIONS[activeRoute].map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              className="flex items-center justify-between gap-2 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-sm text-slate-300 transition hover:border-gold/30 hover:text-white"
            >
              <span>{t(key)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      </section>

      {/* Connections — real workspace integration status */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.connections')}</div>
          {needsSetup > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {t('agent.needSetup', { count: needsSetup })}
            </div>
          )}
        </div>

        {summary ? (
          <div className="space-y-5">
            {(Object.entries(grouped) as [IntegrationCategory, WorkspaceIntegration[]][]).map(([cat, items]) => {
              const cm = CATEGORY_META[cat]
              return (
                <div key={cat}>
                  <div className={`mb-2 text-xs font-semibold uppercase tracking-wider ${cm.color}`}>{t(cm.labelKey)}</div>
                  <div className="space-y-2">
                    {items.map((conn) => (
                      <div
                        key={conn.id}
                        className={`flex items-center gap-4 rounded-[14px] border px-4 py-3.5 transition ${
                          conn.state === 'connected'
                            ? 'border-line bg-surface-2'
                            : 'border-line bg-transparent opacity-70'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-300">{conn.name}</div>
                          <div className={`mt-0.5 text-xs ${
                            conn.state === 'connected' ? 'text-emerald-400/70'
                            : conn.state === 'partial' ? 'text-amber-400/70'
                            : 'text-slate-500'
                          }`}>
                            {conn.state === 'connected' ? t('agent.connected')
                              : conn.state === 'partial' ? t('agent.partiallyConnected')
                              : t('agent.notConnected')}
                          </div>
                        </div>
                        {conn.state === 'connected' ? (
                          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <Link
                            href="/freehold-intelligence/integrations"
                            className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-400 transition hover:bg-amber-400/20"
                          >
                            {t('agent.setUpInIntegrations')}
                            <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          !loadFailed && (
            <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-6 text-center text-sm text-slate-500">
              {t('agent.connectionsLoading')}
            </div>
          )
        )}
      </section>

      {/* Agent knowledge — counts wired to real data */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.agentKnowledge')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              Icon: Users, labelKey: 'agent.knowledgeLeadsLabel', color: 'text-teal-400',
              value: summary ? t('agent.leadsTracked', { count: summary.leads.total }) : '—',
            },
            {
              Icon: BookOpen, labelKey: 'agent.knowledgeInventoryLabel', color: 'text-violet-400',
              value: inventoryCount != null ? t('agent.projectsAvailable', { count: inventoryCount }) : '—',
            },
            {
              Icon: MapPin, labelKey: 'agent.knowledgeProfileLabel', color: 'text-gold',
              value: summary ? (summary.focus[0]?.name ?? t('agent.noFocusYet')) : '—',
            },
          ].map(({ Icon, labelKey, value, color }) => (
            <div key={labelKey} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
              <div className="min-w-0">
                <div className={`text-sm font-medium truncate ${color}`}>{value}</div>
                <div className="mt-0.5 text-xs text-slate-500">{t(labelKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
