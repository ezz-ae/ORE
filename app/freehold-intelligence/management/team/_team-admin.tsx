'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  UserPlus, MoreHorizontal, Pencil, Ban, CheckCircle2, XCircle,
  Coins, Trash2, Loader2, ShieldAlert, X,
} from 'lucide-react'

type Role = 'ceo' | 'director' | 'admin' | 'sales_manager' | 'marketing' | 'broker'
type Status = 'active' | 'suspended' | 'banned'

interface Member {
  id: string
  name: string
  email: string
  dbRole: Role
  status: Status
  suspended: boolean
  banned: boolean
  banReason: string | null
  phone: string | null
  commissionRate: number | null
}

const ROLE_LABEL: Record<Role, string> = {
  ceo: 'CEO', director: 'Director', admin: 'Admin',
  sales_manager: 'Sales Manager', marketing: 'Marketing', broker: 'Agent',
}
const ASSIGNABLE: Role[] = ['director', 'admin', 'sales_manager', 'marketing', 'broker']

const STATUS_STYLE: Record<Status, string> = {
  active:    'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  suspended: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  banned:    'border-red-400/25 bg-red-400/10 text-red-300',
}

const inputCls = 'w-full rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40'

export function TeamAdmin() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)

  function load() {
    fetch('/api/freehold/team', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d.members) setMembers(d.members) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function patch(id: string, body: Record<string, unknown>, okMsg: string) {
    const res = await fetch(`/api/freehold/team/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (res?.ok) { toast.success(okMsg); load() }
    else toast.error(data?.error || 'Update failed')
    setOpenMenu(null)
  }

  async function toggleDisable(m: Member) {
    await patch(m.id, { suspended: !m.suspended }, m.suspended ? 'Member re-enabled' : 'Member disabled')
  }

  async function toggleBan(m: Member) {
    if (m.banned) { await patch(m.id, { banned: false }, 'Ban lifted'); return }
    const reason = window.prompt('Reason for banning this member? (optional)') ?? ''
    await patch(m.id, { banned: true, banReason: reason }, 'Member banned')
  }

  async function openCredit(m: Member) {
    setOpenMenu(null)
    const raw = window.prompt(`Open / add credits for ${m.name} (number of credits):`)
    if (raw == null) return
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a positive amount'); return }
    const res = await fetch('/api/freehold/credits/admin/allocate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brokerId: m.id, amount, note: 'Opened from Management → Team' }),
    }).catch(() => null)
    if (res?.ok) toast.success(`Added ${amount} credits to ${m.name}`)
    else toast.error('Could not allocate credits')
  }

  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.name}? This cannot be undone.`)) return
    setMembers((prev) => prev.filter((x) => x.id !== m.id))
    setOpenMenu(null)
    const res = await fetch(`/api/freehold/team/${m.id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) toast.success('Member removed'); else { toast.error('Could not remove'); load() }
  }

  return (
    <section className="rounded-[18px] border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Team management</h2>
          <p className="mt-0.5 text-xs text-slate-500">Create, edit, disable, ban, and fund team members</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/15">
          <UserPlus className="h-4 w-4" /> New member
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="relative flex items-center gap-3 rounded-[12px] border border-line bg-surface-2/40 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{m.name}</span>
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-slate-400">{ROLE_LABEL[m.dbRole] ?? m.dbRole}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">{m.email}</span>
                  {m.phone && <span>· {m.phone}</span>}
                  {m.commissionRate != null && <span>· {m.commissionRate}% comm.</span>}
                  {m.banned && m.banReason && <span className="text-red-400/70">· {m.banReason}</span>}
                </div>
              </div>
              <button onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line text-slate-400 hover:text-white">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {openMenu === m.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                  <div className="absolute right-3 top-12 z-50 w-48 rounded-[12px] border border-line-strong bg-surface py-1 shadow-xl">
                    <MenuItem icon={Pencil} label="Edit details" onClick={() => { setEditing(m); setOpenMenu(null) }} />
                    {m.dbRole === 'broker' && <MenuItem icon={Coins} label="Open credit" onClick={() => openCredit(m)} />}
                    <MenuItem icon={m.suspended ? CheckCircle2 : XCircle} label={m.suspended ? 'Re-enable' : 'Disable'} onClick={() => toggleDisable(m)} tone="amber" />
                    <MenuItem icon={m.banned ? ShieldAlert : Ban} label={m.banned ? 'Lift ban' : 'Ban'} onClick={() => toggleBan(m)} tone="red" />
                    <div className="my-1 border-t border-line" />
                    <MenuItem icon={Trash2} label="Remove" onClick={() => remove(m)} tone="red" />
                  </div>
                </>
              )}
            </div>
          ))}
          {members.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No team members yet.</p>}
        </div>
      )}

      {showCreate && <CreateMemberModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {editing && <EditMemberModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </section>
  )
}

function MenuItem({ icon: Icon, label, onClick, tone }: { icon: React.ElementType; label: string; onClick: () => void; tone?: 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-400/80 hover:text-red-400' : tone === 'amber' ? 'text-amber-400/80 hover:text-amber-400' : 'text-slate-400 hover:text-white'
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition hover:bg-surface-2 ${color}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

function CreateMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('broker')
  const [phone, setPhone] = useState('')
  const [commission, setCommission] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!name.trim() || !email.trim()) { toast.error('Name and email are required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create')
      // Apply optional phone/commission via PATCH on the new member.
      const id = data?.member?.id
      if (id && (phone.trim() || commission.trim())) {
        await fetch(`/api/freehold/team/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), commissionRate: commission.trim() || null }),
        }).catch(() => {})
      }
      toast.success(`${name.trim()} added`)
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create')
    } finally { setSaving(false) }
  }

  return (
    <Modal title="New team member" onClose={onClose}>
      <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inputCls} placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={inputCls} placeholder="Commission %" type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
      </div>
      <p className="text-xs text-slate-500">A default password is set on creation; the member can reset it. Disabled/banned members cannot sign in.</p>
      <button onClick={create} disabled={saving}
        className="flex items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create member
      </button>
    </Modal>
  )
}

function EditMemberModal({ member, onClose, onSaved }: { member: Member; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [role, setRole] = useState<Role>(member.dbRole)
  const [phone, setPhone] = useState(member.phone ?? '')
  const [commission, setCommission] = useState(member.commissionRate != null ? String(member.commissionRate) : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/freehold/team/${member.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), role,
          phone: phone.trim(), commissionRate: commission.trim() === '' ? null : commission.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save')
      toast.success('Member updated')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  const isOwner = member.dbRole === 'ceo'

  return (
    <Modal title={`Edit ${member.name}`} onClose={onClose}>
      <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isOwner}>
        {(isOwner ? (['ceo'] as Role[]) : ASSIGNABLE).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={inputCls} placeholder="Commission %" type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
      </div>
      <button onClick={save} disabled={saving}
        className="flex items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Save changes
      </button>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[18px] border border-line-strong bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  )
}
