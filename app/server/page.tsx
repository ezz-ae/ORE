'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, Lock, Mail, Check, Search } from 'lucide-react'
import { login } from '@/lib/freehold/session'
import type { Role } from '@/lib/freehold/session-types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/freehold/session-types'

type UserHint = { email: string; name: string; initials: string; role: Role; password: string }

// Display-only hints (shown in the role selector). Passwords are pre-filled
// on select so each team member can sign in with one click.
const USERS: UserHint[] = [
  // CEO
  { email: 'bashar@freeholdproperty.ae',      name: 'Bashar',       initials: 'BS', role: 'ceo',           password: 'FH_CEO_2026'    },
  // Management
  { email: 'yamen@freeholdproperty.ae',        name: 'Yamen',        initials: 'YA', role: 'director',      password: 'FH_Mgmt_2026'   },
  { email: 'majd@freeholdproperty.ae',         name: 'Majd',         initials: 'MJ', role: 'director',      password: 'FH_Mgmt_2026'   },
  // Admin / Office
  { email: 'admin@freeholdproperty.ae',        name: 'Admin Desk',   initials: 'AD', role: 'admin',         password: 'FH_Admin_2026'  },
  { email: 'info@freeholdproperty.ae',         name: 'Office',       initials: 'OF', role: 'admin',         password: 'FH_Admin_2026'  },
  // Brokers (alphabetical)
  { email: 'ahmad@freeholdproperty.ae',        name: 'Ahmad',        initials: 'AH', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'ali.javed@freeholdproperty.ae',    name: 'Ali Javed',    initials: 'AJ', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'fatemah@freeholdproperty.ae',      name: 'Fatemah',      initials: 'FT', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'hanna@freeholdproperty.ae',        name: 'Hanna',        initials: 'HN', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'ibrahim@freeholdproperty.ae',      name: 'Ibrahim',      initials: 'IB', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'ihab@freeholdproperty.ae',         name: 'Ihab',         initials: 'IH', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'julie@freeholdproperty.ae',        name: 'Julie',        initials: 'JU', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'kashif@freeholdproperty.ae',       name: 'Kashif',       initials: 'KF', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'laila@freeholdproperty.ae',        name: 'Laila',        initials: 'LA', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'maha@freeholdproperty.ae',         name: 'Maha',         initials: 'MA', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'manar@freeholdproperty.ae',        name: 'Manar',        initials: 'MN', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'meera@freeholdproperty.ae',        name: 'Meera',        initials: 'ME', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'milia@freeholdproperty.ae',        name: 'Milia',        initials: 'MI', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'norelly@freeholdproperty.ae',      name: 'Norelly',      initials: 'NR', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'norelly1@freeholdproperty.ae',     name: 'Norelly (2)',  initials: 'N2', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'pravin@freeholdproperty.ae',       name: 'Pravin',       initials: 'PV', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'samah@freeholdproperty.ae',        name: 'Samah',        initials: 'SM', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'shaima@freeholdproperty.ae',       name: 'Shaima',       initials: 'SH', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'taleen@freeholdproperty.ae',       name: 'Taleen',       initials: 'TN', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'talal@freeholdproperty.ae',        name: 'Talal',        initials: 'TL', role: 'broker',        password: 'FH_Broker_2026' },
  { email: 'wissam.farhat@freeholdproperty.ae',name: 'Wissam Farhat',initials: 'WF', role: 'broker',        password: 'FH_Broker_2026' },
]

type FilterTab = 'all' | 'management' | 'admin' | 'broker'

export default function ServerAuth() {
  const router = useRouter()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [show, setShow]         = useState(false)
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [tab, setTab]           = useState<FilterTab>('all')

  function selectUser(u: UserHint) {
    setSelected(u.email)
    setEmail(u.email)
    setPassword(u.password)
    setError(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    setError(false)
    const user = await login(email, password, remember)
    if (user) {
      router.replace(user.home)
    } else {
      setError(true)
      setLoading(false)
    }
  }

  const q = search.toLowerCase()
  const visible = USERS.filter((u) => {
    const matchesTab =
      tab === 'all' ? true :
      tab === 'management' ? (u.role === 'ceo' || u.role === 'director') :
      tab === 'admin'      ? u.role === 'admin' :
      tab === 'broker'     ? u.role === 'broker' : true
    const matchesSearch = !q || u.name.toLowerCase().includes(q)
    return matchesTab && matchesSearch
  })

  const selectedUser = USERS.find((u) => u.email === selected)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1117] px-5 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-[460px]">

        {/* Header */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
            <Shield className="h-7 w-7 text-[#D4AF37]" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Freehold Server</h1>
          <p className="mt-1 text-sm text-slate-500">Select your profile to sign in</p>
        </div>

        {/* Role selector panel */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl overflow-hidden">

          {/* Tab row + search */}
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
            <div className="flex gap-1">
              {(['all', 'management', 'admin', 'broker'] as FilterTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={[
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors capitalize',
                    tab === t
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60',
                  ].join(' ')}
                >
                  {t === 'management' ? 'Mgmt' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-28 rounded-lg border border-slate-800 bg-slate-800/50 py-1 pl-7 pr-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
              />
            </div>
          </div>

          {/* User grid */}
          <div className="overflow-y-auto max-h-[220px] p-2.5">
            {visible.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-600">No results</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {visible.map((u) => {
                  const color = ROLE_COLORS[u.role]
                  const isSel = selected === u.email
                  return (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => selectUser(u)}
                      title={`${u.name} · ${ROLE_LABELS[u.role]}`}
                      className={[
                        'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-all',
                        isSel
                          ? 'bg-slate-800/90'
                          : 'border-slate-800 bg-slate-800/20 hover:bg-slate-800/50 hover:border-slate-700',
                      ].join(' ')}
                      style={isSel ? { borderColor: color + '55' } : {}}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold"
                        style={{ background: color + '18', borderColor: color + '40', color }}
                      >
                        {u.initials}
                      </div>
                      <div className="w-full min-w-0">
                        <div className="truncate text-[11px] font-medium text-slate-200 leading-tight">{u.name}</div>
                        <div
                          className="mt-0.5 truncate text-[9px] font-semibold leading-tight"
                          style={{ color }}
                        >
                          {ROLE_LABELS[u.role]}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Auth form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Lock className="h-3 w-3" />
            {selectedUser ? (
              <span>
                Signing in as{' '}
                <span style={{ color: ROLE_COLORS[selectedUser.role] }}>{selectedUser.name}</span>
                {' '}·{' '}
                <span style={{ color: ROLE_COLORS[selectedUser.role] }}>{ROLE_LABELS[selectedUser.role]}</span>
              </span>
            ) : (
              'Secure Authentication'
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(false); setSelected(null) }}
                  placeholder="you@freeholdproperty.ae"
                  autoComplete="username"
                  className={[
                    'w-full rounded-xl border bg-slate-800/60 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-700',
                    error ? 'border-red-500/60' : 'border-slate-700 focus:border-[#D4AF37]/50',
                  ].join(' ')}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(false) }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={[
                    'w-full rounded-xl border bg-slate-800/60 px-4 py-2.5 pr-11 text-sm text-white outline-none transition-colors placeholder:text-slate-700',
                    error ? 'border-red-500/60' : 'border-slate-700 focus:border-[#D4AF37]/50',
                  ].join(' ')}
                />
                <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-red-400">Incorrect email or password. Please try again.</p>}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <button type="button" onClick={() => setRemember(r => !r)}
                className={[
                  'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                  remember ? 'border-[#D4AF37]/60 bg-[#D4AF37] text-[#0D1117]' : 'border-slate-700 bg-slate-800/60',
                ].join(' ')}>
                {remember && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </button>
              <span className="text-sm text-slate-400" onClick={() => setRemember(r => !r)}>Remember me</span>
            </label>

            <button
              type="submit"
              disabled={!email || !password || loading}
              className="w-full rounded-xl bg-[#D4AF37] py-2.5 text-sm font-semibold text-[#0D1117] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading ? 'Verifying…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-700">
          Freehold Intelligence Platform &middot; Authorized Personnel Only
        </p>
      </div>
    </div>
  )
}
