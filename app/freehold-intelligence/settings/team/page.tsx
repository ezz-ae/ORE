'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  UserPlus, MoreHorizontal, Mail, CheckCircle,
  Clock, XCircle, Crown, Shield, User, Trash2, ChevronDown, Loader2,
} from 'lucide-react'

type Role = 'Owner' | 'Admin' | 'Agent' | 'Viewer'
type Status = 'active' | 'invited' | 'suspended'

type TeamMember = {
  id: string
  name: string
  email: string
  role: Role
  status: Status
  joinedAt: string
  lastActive?: string | null
  initials: string
}

const ROLE_META: Record<Role, { Icon: React.ElementType; color: string; desc: string }> = {
  Owner:  { Icon: Crown,  color: 'text-gold',        desc: 'Full access + billing' },
  Admin:  { Icon: Shield, color: 'text-violet-400',  desc: 'Manage team & settings' },
  Agent:  { Icon: User,   color: 'text-sky-400',     desc: 'Own leads & campaigns' },
  Viewer: { Icon: User,   color: 'text-slate-400',   desc: 'Read-only access' },
}

const STATUS_META: Record<Status, { label: string; Icon: React.ElementType; color: string }> = {
  active:    { label: 'Active',    Icon: CheckCircle, color: 'text-emerald-400' },
  invited:   { label: 'Invited',   Icon: Clock,       color: 'text-amber-400'   },
  suspended: { label: 'Suspended', Icon: XCircle,     color: 'text-red-400'     },
}

const ROLES: Role[] = ['Owner', 'Admin', 'Agent', 'Viewer']

export default function TeamPage() {
  const [members, setMembers]         = useState<TeamMember[]>([])
  const [loading, setLoading]         = useState(true)
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<Role>('Agent')
  const [openMenu, setOpenMenu]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/freehold/team')
      .then((r) => r.json())
      .then((data) => {
        if (data.members) setMembers(data.members)
      })
      .finally(() => setLoading(false))
  }, [])

  const uiToDbRole = (role: string): string =>
    role === 'Owner' ? 'ceo' : role === 'Admin' ? 'admin' : 'broker'

  function refetch() {
    fetch('/api/freehold/team', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => { if (data.members) setMembers(data.members) })
      .catch(() => {})
  }

  async function invite() {
    if (!inviteEmail.trim()) return
    const n = inviteEmail.split('@')[0]
    try {
      const res = await fetch('/api/freehold/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, email: inviteEmail.trim(), role: uiToDbRole(inviteRole) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to invite')
      toast.success(`Invited ${inviteEmail.trim()}`)
      setInviteEmail('')
      setShowInvite(false)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite')
    }
  }

  function changeRole(id: string, role: Role) {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m))
    setOpenMenu(null)
    fetch(`/api/freehold/team/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: uiToDbRole(role) }),
    }).then((r) => { if (r.ok) toast.success('Role updated'); else toast.error('Could not update role') }).catch(() => {})
  }

  function toggleSuspend(id: string) {
    let nextSuspended = false
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        nextSuspended = m.status !== 'suspended'
        return { ...m, status: nextSuspended ? 'suspended' : 'active' }
      }),
    )
    setOpenMenu(null)
    fetch(`/api/freehold/team/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: nextSuspended }),
    }).catch(() => {})
  }

  async function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    setOpenMenu(null)
    const res = await fetch(`/api/freehold/team/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res && res.ok) toast.success('Member removed'); else toast.error('Could not remove member')
  }

  const active  = members.filter((m) => m.status === 'active').length
  const invited = members.filter((m) => m.status === 'invited').length
  const agents  = members.filter((m) => m.role === 'Agent').length

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Team</h1>
          <p className="mt-1 text-sm text-slate-400">
            {loading ? 'Loading…' : `${active} active · ${invited > 0 ? `${invited} invited · ` : ''}${agents} agents`}
          </p>
        </div>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/15"
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="mb-6 rounded-[18px] border border-gold/20 bg-gold/[0.04] p-5 space-y-3">
          <div className="text-sm font-semibold text-white">Invite team member</div>
          <div className="flex gap-3 flex-col sm:flex-row">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40"
            />
            <div className="relative">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="appearance-none rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-gold/40"
              >
                {ROLES.filter((r) => r !== 'Owner').map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={invite}
              className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/90">
              <Mail className="h-3.5 w-3.5" /> Send invite
            </button>
            <button onClick={() => setShowInvite(false)}
              className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">
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
            <div key={role} className="rounded-[12px] border border-line bg-surface px-3 py-2.5">
              <rm.Icon className={`h-4 w-4 ${rm.color}`} />
              <div className={`mt-1.5 text-sm font-semibold ${rm.color}`}>{role}</div>
              <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{rm.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading team…</span>
        </div>
      )}

      {/* Member list */}
      {!loading && (
        <div className="space-y-2">
          {members.map((member) => {
            const rm = ROLE_META[member.role]
            const sm = STATUS_META[member.status]

            return (
              <div
                key={member.id}
                className={`relative rounded-[16px] border bg-surface px-5 py-4 transition ${
                  member.status === 'suspended' ? 'border-red-400/10 opacity-60' : 'border-line'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    member.role === 'Owner' ? 'bg-gold/20 text-gold' :
                    member.role === 'Admin' ? 'bg-violet-400/15 text-violet-300' :
                    'bg-surface-2 text-slate-400'
                  }`}>
                    {member.initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">{member.name}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
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
                      <span className={`text-xs font-medium ${rm.color}`}>{member.role}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${sm.color}`}>
                      <sm.Icon className="h-3 w-3" />
                      <span className="hidden sm:block">{sm.label}</span>
                    </div>
                    {member.role !== 'Owner' && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-line-strong text-slate-500 transition hover:border-line-strong hover:text-slate-300"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenu === member.id && (
                          <div className="absolute right-0 top-9 z-50 w-44 rounded-[12px] border border-line-strong bg-surface py-1 shadow-xl">
                            {ROLES.filter((r) => r !== 'Owner' && r !== member.role).map((r) => {
                              const RoleIcon = ROLE_META[r].Icon
                              return (
                                <button key={r} onClick={() => changeRole(member.id, r)}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-400 transition hover:bg-surface-2 hover:text-white">
                                  <RoleIcon className={`h-3.5 w-3.5 ${ROLE_META[r].color}`} />
                                  Set as {r}
                                </button>
                              )
                            })}
                            <div className="my-1 border-t border-line" />
                            <button onClick={() => toggleSuspend(member.id)}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-amber-400/80 transition hover:bg-surface-2 hover:text-amber-400">
                              <XCircle className="h-3.5 w-3.5" />
                              {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
                            <button onClick={() => removeMember(member.id)}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-400/80 transition hover:bg-surface-2 hover:text-red-400">
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
      )}

      {/* Close menu on outside click */}
      {openMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  )
}
