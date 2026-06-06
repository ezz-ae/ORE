'use client'

import { useState } from 'react'
import {
  Sparkles, ChevronRight, CheckCircle, AlertCircle,
  Zap, BookOpen, Users, Globe, Settings,
} from 'lucide-react'
import { agentConnections, agentProfile, agentPipelineLeads, type AgentConnection } from '@/src/features/freehold-intelligence/agent'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const CATEGORY_META: Record<AgentConnection['category'], { label: string; color: string }> = {
  crm:        { label: 'CRM',        color: 'text-orange-400' },
  ads:        { label: 'Ads',        color: 'text-blue-400'   },
  social:     { label: 'Social',     color: 'text-pink-400'   },
  ai:         { label: 'AI',         color: 'text-violet-400' },
  portal:     { label: 'Portals',    color: 'text-sky-400'    },
  automation: { label: 'Automation', color: 'text-amber-400'  },
  messaging:  { label: 'Messaging',  color: 'text-emerald-400'},
}

const criticalLeads = agentPipelineLeads.filter((l) => l.urgency === 'critical').length
const activeLeads   = agentPipelineLeads.filter((l) => l.pipelineStage !== 'closed' && l.pipelineStage !== 'lost').length

type Route = 'apps' | 'inventory' | 'frontend'

const ROUTES: { id: Route; label: string; Icon: React.ElementType; desc: string; color: string }[] = [
  { id: 'apps',      label: 'Apps',      Icon: Zap,      desc: 'Your pipeline, wallet, campaigns, and achievements',  color: 'text-[#D4AF37]' },
  { id: 'inventory', label: 'Inventory', Icon: BookOpen, desc: 'NotebookLM — sources, AI chat, content studio',       color: 'text-violet-400' },
  { id: 'frontend',  label: 'Listings',  Icon: Globe,    desc: 'PropertyFinder, Bayut, Dubizzle, your landing pages', color: 'text-sky-400'    },
]


export default function AgentAIPage() {
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
          <h1 className="text-xl font-semibold text-white">My AI</h1>
          <p className="mt-1 text-sm text-slate-400">
            {agentProfile.name}'s personal agent — {connected} of {connections.length} connections live
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-4 py-2">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-sm font-medium text-[#D4AF37]">Agent active</span>
        </div>
      </section>

      {/* Three-route map */}
      <section className="mt-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Agent routes</div>
        <div className="grid grid-cols-3 gap-3">
          {ROUTES.map(({ id, label, Icon, desc, color }) => (
            <button
              key={id}
              onClick={() => setActiveRoute(id)}
              className={`flex flex-col rounded-[18px] border p-4 text-left transition ${
                activeRoute === id
                  ? 'border-slate-600 bg-slate-800/60'
                  : 'border-slate-800 bg-slate-800/50 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`h-5 w-5 ${color}`} />
              <div className={`mt-2 text-sm font-semibold ${activeRoute === id ? 'text-white' : 'text-slate-400'}`}>{label}</div>
              <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{desc}</div>
              {activeRoute === id && (
                <div className={`mt-2 text-xs font-medium ${color}`}>Active ·</div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Connections */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Connections</div>
          {needsSetup > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {needsSetup} need setup
            </div>
          )}
        </div>

        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => {
            const cm = CATEGORY_META[cat as AgentConnection['category']]
            return (
              <div key={cat}>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wider ${cm.color}`}>{cm.label}</div>
                <div className="space-y-2">
                  {items.map((conn) => {
                    const isSettingUp = settingUp === conn.id
                    return (
                      <div
                        key={conn.id}
                        className={`flex items-center gap-4 rounded-[14px] border px-4 py-3.5 transition ${
                          conn.status === 'connected'
                            ? 'border-slate-800 bg-slate-800/50'
                            : 'border-slate-800/50 bg-transparent opacity-70'
                        }`}
                      >
                        <span className="text-[20px]">{conn.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-300">{conn.name}</div>
                          {conn.status === 'connected' && conn.lastSync && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              Synced {new Date(conn.lastSync).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}
                            </div>
                          )}
                          {conn.status === 'needs_setup' && (
                            <div className="mt-0.5 text-xs text-amber-400/70">Not connected</div>
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
                            {isSettingUp ? 'Connecting…' : 'Connect'}
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
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Agent knowledge</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { Icon: Users,    label: 'Leads + pipeline',    value: '8 leads tracked',         color: 'text-sky-400'    },
            { Icon: BookOpen, label: 'Inventory notes',      value: '3 notes · 8 sources',     color: 'text-violet-400' },
            { Icon: Settings, label: 'Profile & expertise',  value: 'Palm Expert · Gold tier', color: 'text-[#D4AF37]'  },
          ].map(({ Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-3 rounded-[14px] border border-slate-800 bg-slate-800/50 px-4 py-3">
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
              <div>
                <div className={`text-sm font-medium ${color}`}>{value}</div>
                <div className="mt-0.5 text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent AI — real CRM Advisor */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Ask your agent</div>
        <AiPrompt
          skill="crm_advisor"
          placeholder="How many critical leads? Draft a WhatsApp? Who to call first?"
          suggestions={[
            'How many critical leads do I have right now?',
            'Draft a WhatsApp for my offer lead.',
            'Which connection needs setup?',
            'Summarise my Palm Jumeirah performance.',
          ]}
          context={{
            agent: { name: agentProfile.name, tier: agentProfile.tier, title: agentProfile.title },
            pipeline: { activeLeads, criticalLeads },
            leads: agentPipelineLeads.slice(0, 8).map(l => ({
              name: l.name, stage: l.pipelineStage, urgency: l.urgency,
              property: l.property, note: l.note,
            })),
            connections: connections.map(c => ({ name: c.name, status: c.status, category: c.category })),
          }}
        />
      </section>

    </div>
  )
}
