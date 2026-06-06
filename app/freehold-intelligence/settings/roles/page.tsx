'use client'

import { useState } from 'react'
import { Crown, Shield, User, Check, Lock, ChevronDown, ChevronUp } from 'lucide-react'

type Role = 'Owner' | 'Admin' | 'Agent' | 'Viewer'

type PermGroup = {
  label: string
  items: { id: string; label: string; Owner: boolean; Admin: boolean; Agent: boolean; Viewer: boolean }[]
}

const PERM_MATRIX: PermGroup[] = [
  {
    label: 'Team',
    items: [
      { id: 'invite_members',  label: 'Invite members',    Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'manage_roles',    label: 'Manage roles',      Owner: true,  Admin: false, Agent: false, Viewer: false },
      { id: 'remove_members',  label: 'Remove members',    Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    label: 'CRM',
    items: [
      { id: 'view_all_leads',  label: 'View all leads',    Owner: true,  Admin: true,  Agent: false, Viewer: true  },
      { id: 'assign_leads',    label: 'Assign leads',      Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'export_leads',    label: 'Export leads',      Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    label: 'Campaigns & Ads',
    items: [
      { id: 'view_campaigns',  label: 'View campaigns',    Owner: true,  Admin: true,  Agent: true,  Viewer: true  },
      { id: 'create_campaigns',label: 'Create campaigns',  Owner: true,  Admin: true,  Agent: true,  Viewer: false },
      { id: 'manage_budget',   label: 'Manage budget',     Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'view_finance',    label: 'View finance',      Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'manage_invoices', label: 'Manage invoices',   Owner: true,  Admin: false, Agent: false, Viewer: false },
      { id: 'agent_credits',   label: 'Allocate credits',  Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'edit_settings',   label: 'Edit settings',     Owner: true,  Admin: true,  Agent: false, Viewer: false },
      { id: 'manage_api',      label: 'Manage API keys',   Owner: true,  Admin: false, Agent: false, Viewer: false },
      { id: 'view_audit',      label: 'View audit log',    Owner: true,  Admin: true,  Agent: false, Viewer: false },
    ],
  },
]

const ROLES: { id: Role; Icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'Owner',  Icon: Crown,  color: 'text-[#D4AF37]',  desc: 'Full access, billing, API' },
  { id: 'Admin',  Icon: Shield, color: 'text-violet-400', desc: 'Team, campaigns, CRM' },
  { id: 'Agent',  Icon: User,   color: 'text-sky-400',    desc: 'Own pipeline & ads' },
  { id: 'Viewer', Icon: User,   color: 'text-white/35',   desc: 'Read-only access' },
]

export default function RolesPage() {
  const [expanded, setExpanded] = useState<string[]>(PERM_MATRIX.map((g) => g.label))

  function toggle(label: string) {
    setExpanded((prev) => prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label])
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-8">
        <h1 className="text-[20px] font-semibold text-white">Roles & Permissions</h1>
        <p className="mt-1 text-[13px] text-white/35">
          System-level role definitions. Assign roles to team members in the Team tab.
        </p>
      </div>

      {/* Role cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROLES.map(({ id, Icon, color, desc }) => (
          <div key={id} className="rounded-[16px] border border-white/[0.07] bg-[#131B2B] p-4">
            <Icon className={`h-5 w-5 ${color}`} />
            <div className={`mt-2 text-[14px] font-semibold ${color}`}>{id}</div>
            <div className="mt-0.5 text-[11px] text-white/25 leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div className="space-y-2">
        {PERM_MATRIX.map((group) => {
          const isOpen = expanded.includes(group.label)
          return (
            <div key={group.label} className="rounded-[16px] border border-white/[0.07] bg-[#131B2B] overflow-hidden">
              <button
                onClick={() => toggle(group.label)}
                className="flex w-full items-center justify-between px-5 py-3.5"
              >
                <span className="text-[13px] font-semibold text-white/70">{group.label}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-white/20" /> : <ChevronDown className="h-4 w-4 text-white/20" />}
              </button>
              {isOpen && (
                <div className="border-t border-white/[0.05]">
                  {/* Header row */}
                  <div className="grid grid-cols-5 gap-0 border-b border-white/[0.04] px-5 py-2">
                    <div className="text-[11px] text-white/20 col-span-2">Permission</div>
                    {ROLES.map(({ id, Icon, color }) => (
                      <div key={id} className={`flex items-center justify-center gap-1 text-[11px] font-medium ${color}`}>
                        <Icon className="h-3 w-3" />
                        <span className="hidden sm:block">{id}</span>
                      </div>
                    ))}
                  </div>
                  {/* Permission rows */}
                  {group.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-5 items-center gap-0 border-b border-white/[0.03] px-5 py-3 last:border-0">
                      <div className="col-span-2 text-[13px] text-white/60">{item.label}</div>
                      {ROLES.map(({ id }) => (
                        <div key={id} className="flex items-center justify-center">
                          {item[id] ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400/70" />
                          ) : (
                            <Lock className="h-3 w-3 text-white/15" />
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
