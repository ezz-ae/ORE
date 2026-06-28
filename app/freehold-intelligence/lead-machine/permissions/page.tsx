'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Lock, ChevronDown, ChevronUp, Shield, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Permission =
  | 'view_campaigns'
  | 'create_campaigns'
  | 'manage_budget'
  | 'view_attribution'
  | 'manage_landings'
  | 'manage_creatives'
  | 'view_leads'
  | 'export_leads'
  | 'manage_requirements'
  | 'view_competitor'

type AgentPerms = {
  id: string
  name: string
  initials: string
  tier: string
  perms: Record<Permission, boolean>
}

const PERM_GROUPS: { groupKey: string; items: { id: Permission; labelKey: string; descKey: string }[] }[] = [
  {
    groupKey: 'lm.permissions.group.campaigns',
    items: [
      { id: 'view_campaigns',   labelKey: 'lm.permissions.perm.view_campaigns.label',   descKey: 'lm.permissions.perm.view_campaigns.desc'   },
      { id: 'create_campaigns', labelKey: 'lm.permissions.perm.create_campaigns.label', descKey: 'lm.permissions.perm.create_campaigns.desc' },
      { id: 'manage_budget',    labelKey: 'lm.permissions.perm.manage_budget.label',    descKey: 'lm.permissions.perm.manage_budget.desc'    },
    ],
  },
  {
    groupKey: 'lm.permissions.group.attribution',
    items: [
      { id: 'view_attribution', labelKey: 'lm.permissions.perm.view_attribution.label', descKey: 'lm.permissions.perm.view_attribution.desc' },
    ],
  },
  {
    groupKey: 'lm.permissions.group.assets',
    items: [
      { id: 'manage_landings',  labelKey: 'lm.permissions.perm.manage_landings.label',  descKey: 'lm.permissions.perm.manage_landings.desc'  },
      { id: 'manage_creatives', labelKey: 'lm.permissions.perm.manage_creatives.label', descKey: 'lm.permissions.perm.manage_creatives.desc' },
    ],
  },
  {
    groupKey: 'lm.permissions.group.leads',
    items: [
      { id: 'view_leads',   labelKey: 'lm.permissions.perm.view_leads.label',   descKey: 'lm.permissions.perm.view_leads.desc'   },
      { id: 'export_leads', labelKey: 'lm.permissions.perm.export_leads.label', descKey: 'lm.permissions.perm.export_leads.desc' },
    ],
  },
  {
    groupKey: 'lm.permissions.group.settings',
    items: [
      { id: 'manage_requirements', labelKey: 'lm.permissions.perm.manage_requirements.label', descKey: 'lm.permissions.perm.manage_requirements.desc' },
      { id: 'view_competitor',     labelKey: 'lm.permissions.perm.view_competitor.label',     descKey: 'lm.permissions.perm.view_competitor.desc'     },
    ],
  },
]

const DEFAULT_GOLD: Record<Permission, boolean> = {
  view_campaigns: true, create_campaigns: true,  manage_budget: true,
  view_attribution: true, manage_landings: true, manage_creatives: true,
  view_leads: true, export_leads: true, manage_requirements: false, view_competitor: false,
}
const DEFAULT_SILVER: Record<Permission, boolean> = {
  view_campaigns: true, create_campaigns: true,  manage_budget: false,
  view_attribution: true, manage_landings: false, manage_creatives: true,
  view_leads: true, export_leads: false, manage_requirements: false, view_competitor: false,
}
const DEFAULT_BRONZE: Record<Permission, boolean> = {
  view_campaigns: true, create_campaigns: false, manage_budget: false,
  view_attribution: false, manage_landings: false, manage_creatives: false,
  view_leads: true, export_leads: false, manage_requirements: false, view_competitor: false,
}

// suppress unused-variable warnings for the tier defaults
void DEFAULT_GOLD
void DEFAULT_SILVER

const TIER_COLOR: Record<string, string> = {
  Bronze:   'text-orange-400 border-orange-400/25 bg-orange-400/10',
  Silver:   'text-slate-300   border-white/15      bg-surface-2',
  Gold:     'text-gold  border-gold/25  bg-gold/10',
  Platinum: 'text-violet-300 border-violet-400/25 bg-violet-400/10',
}

export default function PermissionsPage() {
  const t = useT()
  const [agents, setAgents]     = useState<AgentPerms[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string>('')
  const [saved, setSaved]       = useState<string[]>([])

  useEffect(() => {
    fetch('/api/freehold/team')
      .then((r) => r.json())
      .then((data) => {
        if (data.members) {
          const brokers = data.members
            .filter((m: any) => m.dbRole === 'broker')
            .map((m: any): AgentPerms => ({
              id:       m.id,
              name:     m.name,
              initials: m.initials,
              tier:     'Bronze',
              perms:    { ...DEFAULT_BRONZE },
            }))
          setAgents(brokers)
          if (brokers.length > 0) setExpanded(brokers[0].id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function toggle(agentId: string, perm: Permission) {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, perms: { ...a.perms, [perm]: !a.perms[perm] } } : a,
      ),
    )
  }

  function saveAgent(agentId: string) {
    setSaved((prev) => [...prev, agentId])
    setTimeout(() => setSaved((prev) => prev.filter((x) => x !== agentId)), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[20px] font-semibold text-white">{t('lm.permissions.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('lm.permissions.subtitle')}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">{t('lm.permissions.loading')}</span>
        </div>
      )}

      {/* Agent list */}
      <div className="space-y-3">
        {!loading && agents.map((agent) => {
          const tc = TIER_COLOR[agent.tier] ?? TIER_COLOR.Bronze
          const isOpen = expanded === agent.id
          const permCount = Object.values(agent.perms).filter(Boolean).length
          const isSaved = saved.includes(agent.id)

          return (
            <div
              key={agent.id}
              className={`rounded-[20px] border bg-surface transition ${isOpen ? 'border-white/15' : 'border-line'}`}
            >
              {/* Agent row */}
              <button
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpanded(isOpen ? '' : agent.id)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">
                  {agent.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-white">{agent.name}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tc}`}>
                      {agent.tier}
                    </span>
                    <span className="text-xs text-slate-600">{t('lm.permissions.permActive', { n: String(permCount) })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSaved && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
                </div>
              </button>

              {/* Permission groups */}
              {isOpen && (
                <div className="border-t border-line px-5 pb-5 pt-4">
                  <div className="space-y-5">
                    {PERM_GROUPS.map((group) => (
                      <div key={group.groupKey}>
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          {t(group.groupKey)}
                        </div>
                        <div className="space-y-2">
                          {group.items.map((item) => {
                            const on = agent.perms[item.id]
                            return (
                              <label
                                key={item.id}
                                className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3 transition hover:border-white/10"
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggle(agent.id, item.id)}
                                  className="sr-only"
                                />
                                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                                  on ? 'border-gold/60 bg-gold/20' : 'border-white/[0.10] bg-transparent'
                                }`}>
                                  {on ? (
                                    <CheckCircle className="h-3.5 w-3.5 text-gold" />
                                  ) : (
                                    <Lock className="h-3 w-3 text-slate-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium ${on ? 'text-white' : 'text-slate-500'}`}>
                                    {t(item.labelKey)}
                                  </div>
                                  <div className="text-xs text-slate-600">{t(item.descKey)}</div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <button
                      onClick={() => saveAgent(agent.id)}
                      className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/90"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      {t('lm.permissions.save')}
                    </button>
                    <button
                      onClick={() => setExpanded('')}
                      className="rounded-full border border-line px-4 py-2 text-xs text-slate-500 transition hover:text-slate-400"
                    >
                      {t('lm.permissions.close')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
