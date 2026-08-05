'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Lock, ChevronDown, ChevronUp, Shield, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { TeamSignpost } from '@/components/freehold/team-signpost'
import {
  PERM_GROUPS, permsWithDefaults, deriveTier, TIER_COLOR,
  type Permission,
} from '@/lib/freehold/broker-permissions-ui'

// The permission catalogue, the Bronze floor and the tier derivation now live
// in lib/freehold/broker-permissions-ui.ts — shared with the Team app's
// Permissions tab, so both screens toggle and save exactly the same map.
type AgentPerms = {
  id: string
  name: string
  initials: string
  perms: Record<Permission, boolean>
}

export default function PermissionsPage() {
  const t = useT()
  const [agents, setAgents]     = useState<AgentPerms[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string>('')
  const [saved, setSaved]       = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/freehold/team').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/freehold/lead-machine/permissions').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([teamData, permData]) => {
      const stored: Record<string, Record<string, boolean>> = permData?.perms ?? {}
      if (teamData?.members) {
        const brokers = teamData.members
          .filter((m: any) => m.dbRole === 'broker')
          .map((m: any): AgentPerms => ({
            id: m.id,
            name: m.name,
            initials: m.initials,
            // Real stored permissions, merged over the shared defaults for any
            // permission the stored map doesn't yet carry.
            perms: permsWithDefaults(stored[m.id]),
          }))
        setAgents(brokers)
        if (brokers.length > 0) setExpanded(brokers[0].id)
      }
    }).finally(() => setLoading(false))
  }, [])

  function toggle(agentId: string, perm: Permission) {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, perms: { ...a.perms, [perm]: !a.perms[perm] } } : a,
      ),
    )
  }

  async function saveAgent(agentId: string) {
    const agent = agents.find((a) => a.id === agentId)
    if (!agent) return
    try {
      const res = await fetch('/api/freehold/lead-machine/permissions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brokerId: agentId, perms: agent.perms }),
      })
      if (!res.ok) throw new Error()
      setSaved((prev) => [...prev, agentId])
      setTimeout(() => setSaved((prev) => prev.filter((x) => x !== agentId)), 2000)
    } catch {
      toast.error(t('lm.permissions.saveFailed'))
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[20px] font-semibold text-white">{t('lm.permissions.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('lm.permissions.subtitle')}
        </p>
        <TeamSignpost className="mt-4" />
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
          const isOpen = expanded === agent.id
          const permCount = Object.values(agent.perms).filter(Boolean).length
          const tier = deriveTier(permCount)
          const tc = TIER_COLOR[tier]
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
                      {tier}
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
                      className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright"
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
