'use client'

import { useState } from 'react'
import { Crown, Shield, User, Check, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Role = 'Owner' | 'Admin' | 'Agent' | 'Viewer'

type PermGroup = {
  id: string
  labelKey: string
  items: { id: string; labelKey: string; Owner: boolean; Admin: boolean; Agent: boolean; Viewer: boolean }[]
}

const PERM_MATRIX: PermGroup[] = [
  {
    id: 'team',
    labelKey: 'settings.roles.group.team',
    items: [
      { id: 'invite_members',  labelKey: 'settings.perm.invite_members',  Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'manage_roles',    labelKey: 'settings.perm.manage_roles',    Owner: true,  Admin: false, Agent: false, Viewer: false },
      { id: 'remove_members',  labelKey: 'settings.perm.remove_members',  Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    id: 'crm',
    labelKey: 'settings.roles.group.crm',
    items: [
      { id: 'view_all_leads',  labelKey: 'settings.perm.view_all_leads',  Owner: true,  Admin: true,  Agent: false, Viewer: true  },
      { id: 'assign_leads',    labelKey: 'settings.perm.assign_leads',    Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'export_leads',    labelKey: 'settings.perm.export_leads',    Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    id: 'campaigns',
    labelKey: 'settings.roles.group.campaigns',
    items: [
      { id: 'view_campaigns',  labelKey: 'settings.perm.view_campaigns',  Owner: true,  Admin: true,  Agent: true,  Viewer: true  },
      { id: 'create_campaigns',labelKey: 'settings.perm.create_campaigns',Owner: true,  Admin: true,  Agent: true,  Viewer: false },
      { id: 'manage_budget',   labelKey: 'settings.perm.manage_budget',   Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    id: 'finance',
    labelKey: 'settings.roles.group.finance',
    items: [
      { id: 'view_finance',    labelKey: 'settings.perm.view_finance',    Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'manage_invoices', labelKey: 'settings.perm.manage_invoices', Owner: true,  Admin: false, Agent: false, Viewer: false },
      { id: 'agent_credits',   labelKey: 'settings.perm.agent_credits',   Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    id: 'settings',
    labelKey: 'settings.roles.group.settings',
    items: [
      { id: 'edit_settings',   labelKey: 'settings.perm.edit_settings',   Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'manage_api',      labelKey: 'settings.perm.manage_api',      Owner: true,  Admin: false, Agent: false, Viewer: false },
      { id: 'view_audit',      labelKey: 'settings.perm.view_audit',      Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
]

const ROLES: { id: Role; Icon: React.ElementType; color: string; labelKey: string; descKey: string }[] = [
  { id: 'Owner',  Icon: Crown,  color: 'text-gold',       labelKey: 'settings.roles.owner',  descKey: 'settings.roles.owner.desc' },
  { id: 'Admin',  Icon: Shield, color: 'text-violet-400', labelKey: 'settings.roles.admin',  descKey: 'settings.roles.admin.desc' },
  { id: 'Agent',  Icon: User,   color: 'text-sky-400',    labelKey: 'settings.roles.agent',  descKey: 'settings.roles.agent.desc' },
  { id: 'Viewer', Icon: User,   color: 'text-slate-400',  labelKey: 'settings.roles.viewer', descKey: 'settings.roles.viewer.desc' },
]

export default function RolesPage() {
  const t = useT()
  const [expanded, setExpanded] = useState<string[]>(PERM_MATRIX.map((g) => g.id))

  function toggle(label: string) {
    setExpanded((prev) => prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label])
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">{t('settings.roles.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('settings.roles.subtitle')}
        </p>
      </div>

      {/* Role cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROLES.map(({ id, Icon, color, labelKey, descKey }) => (
          <div key={id} className="rounded-[16px] border border-line bg-surface p-4">
            <Icon className={`h-5 w-5 ${color}`} />
            <div className={`mt-2 text-sm font-semibold ${color}`}>{t(labelKey)}</div>
            <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{t(descKey)}</div>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div className="space-y-2">
        {PERM_MATRIX.map((group) => {
          const isOpen = expanded.includes(group.id)
          return (
            <div key={group.id} className="rounded-[16px] border border-line bg-surface overflow-hidden">
              <button
                onClick={() => toggle(group.id)}
                className="flex w-full items-center justify-between px-5 py-3.5"
              >
                <span className="text-sm font-semibold text-slate-300">{t(group.labelKey)}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
              </button>
              {isOpen && (
                <div className="border-t border-line">
                  {/* Header row */}
                  <div className="grid grid-cols-5 gap-0 border-b border-line px-5 py-2">
                    <div className="text-xs text-slate-600 col-span-2">{t('settings.roles.permission')}</div>
                    {ROLES.map(({ id, Icon, color, labelKey }) => (
                      <div key={id} className={`flex items-center justify-center gap-1 text-xs font-medium ${color}`}>
                        <Icon className="h-3 w-3" />
                        <span className="hidden sm:block">{t(labelKey)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Permission rows */}
                  {group.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-5 items-center gap-0 border-b border-line px-5 py-3 last:border-0">
                      <div className="col-span-2 text-sm text-slate-400">{t(item.labelKey)}</div>
                      {ROLES.map(({ id }) => (
                        <div key={id} className="flex items-center justify-center">
                          {item[id] ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400/70" />
                          ) : (
                            <Lock className="h-3 w-3 text-slate-700" />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
