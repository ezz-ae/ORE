'use client'

import { useState } from 'react'
import {
  Sparkles, ChevronRight, CheckCircle, AlertCircle,
  Zap, BookOpen, Users, Globe, Settings,
} from 'lucide-react'
import { agentConnections, agentPipelineLeads, type AgentConnection } from '@/src/features/freehold-intelligence/agent'
import { useSession } from '@/lib/freehold/use-session'
import { useI18n } from '@/lib/i18n/provider'


const CATEGORY_META: Record<AgentConnection['category'], { labelKey: string; color: string }> = {
  crm:        { labelKey: 'agent.catCrm',        color: 'text-orange-400' },
  ads:        { labelKey: 'agent.catAds',        color: 'text-blue-400'   },
  social:     { labelKey: 'agent.catSocial',     color: 'text-pink-400'   },
  ai:         { labelKey: 'agent.catAi',         color: 'text-violet-400' },
  portal:     { labelKey: 'agent.catPortals',    color: 'text-sky-400'    },
  automation: { labelKey: 'agent.catAutomation', color: 'text-amber-400'  },
  messaging:  { labelKey: 'agent.catMessaging',  color: 'text-emerald-400'},
}

const criticalLeads = agentPipelineLeads.filter((l) => l.urgency === 'critical').length
const activeLeads   = agentPipelineLeads.filter((l) => l.pipelineStage !== 'closed' && l.pipelineStage !== 'lost').length

type Route = 'apps' | 'inventory' | 'frontend'

const ROUTES: { id: Route; labelKey: string; Icon: React.ElementType; descKey: string; color: string }[] = [
  { id: 'apps',      labelKey: 'agent.routeApps',      Icon: Zap,      descKey: 'agent.routeAppsDesc',      color: 'text-gold' },
  { id: 'inventory', labelKey: 'agent.routeInventory', Icon: BookOpen, descKey: 'agent.routeInventoryDesc', color: 'text-violet-400' },
  { id: 'frontend',  labelKey: 'agent.routeListings',  Icon: Globe,    descKey: 'agent.routeListingsDesc',  color: 'text-sky-400'    },
]


export default function AgentAIPage() {
  const { user } = useSession()
  const { t, locale } = useI18n()
  const [connections, setConnections] = useState<AgentConnection[]>(agentConnections)
  const [activeRoute, setActiveRoute] = useState<Route>('apps')
  const [settingUp, setSettingUp]     = useState<string | null>(null)

  const connected = connections.filter((c) => c.status === 'connected').length
  const needsSetup = connections.filter((c) => c.status === 'needs_setup').length

  async function connect(id: string) {
    setSettingUp(id)
    try {
      // Each connection type in production would open an OAuth flow or API-key entry.
      // We ping the server-ai endpoint to acknowledge the connection intent and log it.
      await fetch('/api/freehold/server-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Agent connection initiated: ${id}`,
          role: 'sales_agent',
          context: { action: 'connection_setup', connectionId: id },
        }),
      })
    } catch {
      // Non-blocking — connection setup proceeds regardless
    } finally {
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'connected', lastSync: new Date().toISOString() } : c,
        ),
      )
      setSettingUp(null)
    }
  }

  const grouped = (['crm', 'ads', 'portal', 'messaging', 'social', 'ai', 'automation'] as AgentConnection['category'][]).reduce(
    (acc, cat) => {
      const items = connections.filter((c) => c.category === cat)
      if (items.length) acc[cat] = items
      return acc
    },
    {} as Record<string, AgentConnection[]>,
  )

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('agent.myAi')}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {user?.name ? t('agent.personalAgentNamed', { name: user.name }) : t('agent.personalAgent')} — {t('agent.connectionsLive', { connected, total: connections.length })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <span className="text-sm font-medium text-gold">{t('agent.agentActive')}</span>
        </div>
      </section>

      {/* Three-route map */}
      <section className="mt-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.agentRoutes')}</div>
        <div className="grid grid-cols-3 gap-3">
          {ROUTES.map(({ id, labelKey, Icon, descKey, color }) => (
            <button
              key={id}
              onClick={() => setActiveRoute(id)}
              className={`flex flex-col rounded-[18px] border p-4 text-left transition ${
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

      {/* Connections */}
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

        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => {
            const cm = CATEGORY_META[cat as AgentConnection['category']]
            return (
              <div key={cat}>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wider ${cm.color}`}>{t(cm.labelKey)}</div>
                <div className="space-y-2">
                  {items.map((conn) => {
                    const isSettingUp = settingUp === conn.id
                    return (
                      <div
                        key={conn.id}
                        className={`flex items-center gap-4 rounded-[14px] border px-4 py-3.5 transition ${
                          conn.status === 'connected'
                            ? 'border-line bg-surface-2'
                            : 'border-line bg-transparent opacity-70'
                        }`}
                      >
                        <span className="text-[20px]">{conn.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-300">{conn.name}</div>
                          {conn.status === 'connected' && conn.lastSync && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              {t('agent.synced', { time: new Date(conn.lastSync).toLocaleTimeString(locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) })}
                            </div>
                          )}
                          {conn.status === 'needs_setup' && (
                            <div className="mt-0.5 text-xs text-amber-400/70">{t('agent.notConnected')}</div>
                          )}
                        </div>
                        {conn.status === 'connected' ? (
                          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <button
                            onClick={() => connect(conn.id)}
                            disabled={isSettingUp}
                            className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-400 transition hover:bg-amber-400/20 disabled:opacity-50"
                          >
                            {isSettingUp ? t('agent.connecting') : t('agent.connect')}
                            {!isSettingUp && <ChevronRight className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Agent knowledge */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('agent.agentKnowledge')}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { Icon: Users,    labelKey: 'agent.knowledgeLeadsLabel',     valueKey: 'agent.knowledgeLeadsValue',     color: 'text-sky-400'    },
            { Icon: BookOpen, labelKey: 'agent.knowledgeInventoryLabel', valueKey: 'agent.knowledgeInventoryValue', color: 'text-violet-400' },
            { Icon: Settings, labelKey: 'agent.knowledgeProfileLabel',   valueKey: 'agent.knowledgeProfileValue',   color: 'text-gold'  },
          ].map(({ Icon, labelKey, valueKey, color }) => (
            <div key={labelKey} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3">
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
              <div>
                <div className={`text-sm font-medium ${color}`}>{t(valueKey)}</div>
                <div className="mt-0.5 text-xs text-slate-500">{t(labelKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>


    </div>
  )
}
