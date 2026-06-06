'use client'

import { useState } from 'react'
import {
  UserPlus, MoreHorizontal, Mail, Phone, CheckCircle,
  Clock, XCircle, Crown, Shield, User, Trash2, ChevronDown,
} from 'lucide-react'

type Role = 'Owner' | 'Admin' | 'Agent' | 'Viewer'
type Status = 'active' | 'invited' | 'suspended'

type TeamMember = {
  id: string
  name: string
  email: string
  phone?: string
  role: Role
  status: Status
  joinedAt: string
  lastActive?: string
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  initials: string
}

const ROLE_META: Record<Role, { Icon: React.ElementType; color: string; desc: string }> = {
  Owner:  { Icon: Crown,  color: 'text-[#D4AF37]',   desc: 'Full access + billing' },
  Admin:  { Icon: Shield, color: 'text-violet-400',   desc: 'Manage team & settings' },
  Agent:  { Icon: User,   color: 'text-sky-400',      desc: 'Own leads & campaigns' },
  Viewer: { Icon: User,   color: 'text-white/40',     desc: 'Read-only access' },
}

const STATUS_META: Record<Status, { label: string; Icon: React.ElementType; color: string }> = {
  active:    { label: 'Active',    Icon: CheckCircle, color: 'text-emerald-400' },
  invited:   { label: 'Invited',   Icon: Clock,       color: 'text-amber-400'   },
  suspended: { label: 'Suspended', Icon: XCircle,     color: 'text-red-400'     },
}

const TIER_COLOR: Record<string, string> = {
  Bronze:   'text-orange-400 bg-orange-400/10 border-orange-400/25',
  Silver:   'text-white/65   bg-white/[0.06]  border-white/15',
  Gold:     'text-[#D4AF37]  bg-[#D4AF37]/10  border-[#D4AF37]/25',
  Platinum: 'text-violet-300 bg-violet-400/10 border-violet-400/25',
}

const INITIAL_MEMBERS: TeamMember[] = [
  { id: 'm1', name: 'Faisal Al Hamdan',  email: 'faisal@freeholdproperty.ae',  role: 'Owner',  status: 'active',    joinedAt: '2023-01-01', lastActive: '2026-06-06', initials: 'FH' },
  { id: 'm2', name: 'Sara Qureshi',      email: 'sara@freeholdproperty.ae',    role: 'Admin',  status: 'active',    joinedAt: '2023-06-15', lastActive: '2026-06-05', initials: 'SQ' },
  { id: 'm3', name: 'Noura Al Hassan',   email: 'noura@freeholdproperty.ae',   role: 'Agent',  status: 'active',    joinedAt: '2024-09-01', lastActive: '2026-06-06', tier: 'Gold',   initials: 'NA' },
  { id: 'm4', name: 'James Cooper',      email: 'james@freeholdproperty.ae',   role: 'Agent',  status: 'active',    joinedAt: '2024-11-01', lastActive: '2026-06-04', tier: 'Silver', initials: 'JC' },
  { id: 'm5', name: 'Priya Sharma',      email: 'priya@freeholdproperty.ae',   role: 'Agent',  status: 'active',    joinedAt: '2025-02-01', lastActive: '2026-06-03', tier: 'Bronze', initials: 'PS' },
  { id: 'm6', name: 'Omar Khalil',       email: 'omar@freeholdproperty.ae',    role: 'Agent',  status: 'active',    joinedAt: '2025-01-15', lastActive: '2026-06-05', tier: 'Silver', initials: 'OK' },
  { id: 'm7', name: 'Lena Weber',        email: 'lena@freeholdproperty.ae',    role: 'Viewer', status: 'invited',   joinedAt: '2026-06-01', initials: 'LW' },
]

const ROLES: Role[] = ['Owner', 'Admin', 'Agent', 'Viewer']

export default function TeamPage() {
  const [members, setMembers]       = useState<TeamMember[]>(INITIAL_MEMBERS)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<Role>('Agent')
  const [openMenu, setOpenMenu]       = useState<string | null>(null)

  function invite() {
    if (!inviteEmail.trim()) return
    const initials = inviteEmail.slice(0, 2).toUpperCase()
    setMembers((prev) => [
      ...prev,
      {
        id: `m${Date.now()}`,
        name: inviteEmail.split('@')[0],
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'invited',
        joinedAt: new Date().toISOString().slice(0, 10),
        initials,
      },
    ])
    setInviteEmail('')
    setShowInvite(false)
  }

  function changeRole(id: string, role: Role) {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m))
    setOpenMenu(null)
  }

  function toggleSuspend(id: string) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: m.status === 'suspended' ? 'active' : 'suspended' } : m,
      ),
    )
    setOpenMenu(null)
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    setOpenMenu(null)
  }

  const active    = members.filter((m) => m.status === 'active').length
  const invited   = members.filter((m) => m.status === 'invited').length
  const agents    = members.filter((m) => m.role === 'Agent').length

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-white">Team</h1>
          <p className="mt-1 text-[13px] text-white/35">
            {active} active · {invited > 0 ? `${invited} invited · ` : ''}{agents} agents
          </p>
        </div>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-4 py-2 text-[13px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15"
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="mb-6 rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-5 space-y-3">
          <div className="text-[13px] font-semibold text-white">Invite team member</div>
          <div className="flex gap-3 flex-col sm:flex-row">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/30 outline-none focus:border-[#D4AF37]/40"
            />
            <div className="relative">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="appearance-none rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 pr-8 text-[13px] text-white outline-none focus:border-[#D4AF37]/40"
              >
                {ROLES.filter((r) => r !== 'Owner').map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={invite}
              className="flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-[#D4AF37]/90">
              <Mail className="h-3.5 w-3.5" /> Send invite
            </button>
            <button onClick={() => setShowInvite(false)}
              className="rounded-full border border-white/[0.08] px-4 py-2 text-[12px] text-white/35 transition hover:text-white/60">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Role descriptions */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ROLES.map((role) => {
          const rm = ROLE_META[role]
          return (
            <div key={role} className="rounded-[12px] border border-white/[0.06] bg-[#131B2B] px-3 py-2.5">
              <rm.Icon className={`h-4 w-4 ${rm.color}`} />
              <div className={`mt-1.5 text-[12px] font-semibold ${rm.color}`}>{role}</div>
              <div className="mt-0.5 text-[10px] text-white/25 leading-relaxed">{rm.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {members.map((member) => {
          const rm = ROLE_META[member.role]
          const sm = STATUS_META[member.status]
          const tc = member.tier ? TIER_COLOR[member.tier] : null

          return (
            <div
              key={member.id}
              className={`relative rounded-[16px] border bg-[#131B2B] px-5 py-4 transition ${
                member.status === 'suspended' ? 'border-red-400/10 opacity-60' : 'border-white/[0.07]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  member.role === 'Owner' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' :
                  member.role === 'Admin' ? 'bg-violet-400/15 text-violet-300' :
                  'bg-white/[0.07] text-white/50'
                }`}>
                  {member.initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-white truncate">{member.name}</span>
                    {tc && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tc}`}>
                        {member.tier}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/30 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.email}
                    </span>
                    {member.lastActive && (
                      <span>Active {new Date(member.lastActive).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-1.5">
                    <rm.Icon className={`h-3.5 w-3.5 ${rm.color}`} />
                    <span className={`text-[12px] font-medium ${rm.color}`}>{member.role}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] ${sm.color}`}>
                    <sm.Icon className="h-3 w-3" />
                    <span className="hidden sm:block">{sm.label}</span>
                  </div>
                  {member.role !== 'Owner' && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] text-white/30 transition hover:border-white/20 hover:text-white/60"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === member.id && (
                        <div className="absolute right-0 top-9 z-50 w-44 rounded-[12px] border border-white/[0.10] bg-[#1A2338] py-1 shadow-xl">
                          {ROLES.filter((r) => r !== 'Owner' && r !== member.role).map((r) => {
                            const RoleIcon = ROLE_META[r].Icon
                            return (
                              <button key={r} onClick={() => changeRole(member.id, r)}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-white/60 transition hover:bg-white/[0.05] hover:text-white">
                                <RoleIcon className={`h-3.5 w-3.5 ${ROLE_META[r].color}`} />
                                Set as {r}
                              </button>
                            )
                          })}
                          <div className="my-1 border-t border-white/[0.07]" />
                          <button onClick={() => toggleSuspend(member.id)}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-amber-400/80 transition hover:bg-white/[0.05] hover:text-amber-400">
                            <XCircle className="h-3.5 w-3.5" />
                            {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                          <button onClick={() => removeMember(member.id)}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-red-400/80 transition hover:bg-white/[0.05] hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Close menu on outside click */}
      {openMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  )
}
