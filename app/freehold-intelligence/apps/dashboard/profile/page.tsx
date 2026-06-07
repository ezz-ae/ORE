'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, UserCog, Shield, Users, ArrowUpRight, CheckCircle2, Bell } from 'lucide-react'
import { currentServerUser, getRoleScope, crmAgentRoster } from '@/src/features/freehold-intelligence/server-session'

const ACCOUNT_LEVELS: Record<string, { label: string; description: string }> = {
  owner:    { label: 'Owner',    description: 'Full access — all modules, all data, all configuration.' },
  admin:    { label: 'Admin',    description: 'Operational access — users, tasks, approvals, configuration.' },
  operator: { label: 'Operator', description: 'Module access — campaigns, CRM, lead machine, content.' },
  agent:    { label: 'Agent',    description: 'Scoped access — assigned leads, client messages, project details.' },
  viewer:   { label: 'Viewer',   description: 'Read-only — approved summaries, reports, public data.' },
}

export default function DashboardProfilePage() {
  const scope = getRoleScope(currentServerUser.role)
  const accountLevel = ACCOUNT_LEVELS[currentServerUser.accountLevel]

  const [notifications, setNotifications] = useState({
    emailAlerts:    true,
    whatsappAlerts: true,
    dailyDigest:    false,
    weeklyReport:   true,
    leadAlerts:     true,
    systemAlerts:   false,
  })

  function toggleNotif(key: keyof typeof notifications) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const [flash, setFlash] = useState(false)
  function saveNotifications() {
    setFlash(true)
    setTimeout(() => setFlash(false), 2000)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/apps/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard App
      </Link>

      <section className="mt-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium uppercase tracking-wider text-gold/85 flex items-center gap-2">
            <UserCog className="h-3.5 w-3.5" /> Profile & Access
          </div>
          <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-xs font-medium text-slate-400">
            In progress — team management coming in V1.1
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Account & permissions<br /><span className="text-slate-500">role-gated access.</span>
        </h1>
      </section>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">

          {/* Account card */}
          <div className="rounded-[22px] border border-line bg-surface p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/25 to-gold/5 text-[20px] font-semibold text-gold">
                {currentServerUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[22px] font-semibold text-white">{currentServerUser.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>{accountLevel?.label}</span>
                  <span className="text-slate-600">·</span>
                  <span>{currentServerUser.role.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            <p className="mt-5 text-[14px] leading-relaxed text-slate-400">{accountLevel?.description}</p>
          </div>

          {/* Role scope */}
          <div className="rounded-[22px] border border-line bg-surface p-6">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <Shield className="h-3 w-3" /> Role scope
            </div>
            <p className="mt-1 text-xs text-slate-500">Surfaces and data visible to a {currentServerUser.role.replace('_', ' ')}.</p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {scope.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gold/60" />
                  <span className="text-xs text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned modules */}
          <div className="rounded-[22px] border border-line bg-surface p-6">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <CheckCircle2 className="h-3 w-3" /> Assigned modules
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {currentServerUser.assignedModules.map((mod) => (
                <span key={mod} className="rounded-full border border-gold/20 bg-gold/[0.08] px-3 py-1 text-xs font-medium text-gold/80">
                  {mod.replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Flash toast */}
          {flash && (
            <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-400/30 bg-surface px-5 py-2.5 text-sm font-medium text-gold shadow-xl backdrop-blur">
              Preferences saved
            </div>
          )}

          {/* Notifications card */}
          <div className="rounded-[22px] border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                <Bell className="h-3 w-3" /> Notification preferences
              </div>
              <button
                type="button"
                onClick={saveNotifications}
                className="rounded-full border border-gold/25 bg-gold/[0.08] px-3 py-1 text-sm font-medium text-gold/80 transition hover:bg-gold/15"
              >
                Save
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {([
                { key: 'emailAlerts',    label: 'Email alerts',           note: 'Hot leads and critical system alerts'       },
                { key: 'whatsappAlerts', label: 'WhatsApp alerts',        note: 'Instant messages for urgent lead events'    },
                { key: 'dailyDigest',    label: 'Daily digest',           note: 'Morning summary of the previous day'        },
                { key: 'weeklyReport',   label: 'Weekly report',          note: 'Sunday performance summary across all apps' },
                { key: 'leadAlerts',     label: 'New lead notifications', note: 'Alert on each inbound lead in the CRM'      },
                { key: 'systemAlerts',   label: 'System alerts',          note: 'Infra status changes, auth events'          },
              ] as { key: keyof typeof notifications; label: string; note: string }[]).map(({ key, label, note }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleNotif(key)}
                  className="flex w-full items-center justify-between gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-left transition hover:border-white/10"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-100">{label}</div>
                    <div className="text-sm text-slate-500">{note}</div>
                  </div>
                  <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${notifications[key] ? 'bg-gold' : 'bg-surface-2'}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${notifications[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Sidebar: team */}
        <aside className="space-y-4">
          <div className="rounded-[20px] border border-line bg-surface p-5">
            <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              <Users className="h-3 w-3" /> Sales team
            </div>
            <div className="space-y-3">
              {crmAgentRoster.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 text-sm font-semibold text-gold">
                      {agent.initials}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-slate-500">{agent.role}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${
                    agent.status === 'available' ? 'text-gold' :
                    agent.status === 'overloaded' ? 'text-red-300' : 'text-[#F8E7AE]'
                  }`}>
                    {agent.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/freehold-intelligence/crm/assignment"
              className="mt-4 flex items-center gap-1 text-sm text-gold/60 transition hover:text-gold"
            >
              Manage assignments <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-[20px] border border-gold/15 bg-gold/[0.04] p-5">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">Coming in V1.1</div>
            <div className="mt-3 space-y-2 text-xs text-slate-400">
              <div>· Invite team members</div>
              <div>· Role assignment interface</div>
              <div>· Module-level permission overrides</div>
              <div>· Session and activity audit</div>
            </div>
          </div>
        </aside>
      </div>

    </div>
  )
}
