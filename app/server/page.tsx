'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, Lock, Mail, Check } from 'lucide-react'
import { login } from '@/lib/freehold/session'
import type { Role } from '@/lib/freehold/session-types'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/freehold/session-types'

// Hint cards — display only, no passwords. Keeps the UI informative.
const USERS: { email: string; name: string; initials: string; role: Role; password: string }[] = [
  { email: 'm@freehold.ae',         name: 'Mubarak',       initials: 'MB', role: 'ceo',           password: 'CEO_in26'       },
  { email: 'director@freehold.ae',  name: 'Omar Al Rashid',initials: 'OR', role: 'director',      password: 'Director_in26'  },
  { email: 'admin@freehold.ae',     name: 'Admin Desk',    initials: 'AD', role: 'admin',         password: 'FreeHold_in26'  },
  { email: 'sales@freehold.ae',     name: 'Khalid Hassan', initials: 'KH', role: 'sales_manager', password: 'Sales_in26'     },
  { email: 'marketing@freehold.ae', name: 'Layla Nasser',  initials: 'LN', role: 'marketing',     password: 'Marketing_in26' },
  { email: 'ahmad@freehold.ae',     name: 'Ahmad Khalil',  initials: 'AK', role: 'broker',        password: 'Broker_in26'    },
]

export default function ServerAuth() {
  const router = useRouter()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [remember, setRemember]     = useState(true)
  const [show, setShow]             = useState(false)
  const [error, setError]           = useState(false)
  const [loading, setLoading]       = useState(false)
  const [selected, setSelected]     = useState<string | null>(null)

  function selectUser(u: typeof USERS[0]) {
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

  const selectedUser = USERS.find((u) => u.email === selected)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1117] px-6 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-[440px]">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
            <Shield className="h-8 w-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Freehold Server</h1>
          <p className="mt-1.5 text-sm text-slate-500">Select your profile — your workspace adapts to your role</p>
        </div>

        {/* Role selector */}
        <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-xl">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Who are you signing in as?
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {USERS.map((u) => {
              const color = ROLE_COLORS[u.role]
              const isSelected = selected === u.email
              return (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => selectUser(u)}
                  className={[
                    'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all',
                    isSelected
                      ? 'border-opacity-60 bg-slate-800/80'
                      : 'border-slate-800 bg-slate-800/20 hover:bg-slate-800/50 hover:border-slate-700',
                  ].join(' ')}
                  style={isSelected ? { borderColor: color + '60', boxShadow: `0 0 0 1px ${color}20` } : {}}
                >
                  {/* Avatar */}
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold"
                    style={{ background: color + '18', borderColor: color + '40', color }}
                  >
                    {u.initials}
                  </div>
                  {/* Name */}
                  <div className="min-w-0 w-full">
                    <div className="truncate text-xs font-medium text-slate-200">{u.name}</div>
                    <div
                      className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: color + '20', color }}
                    >
                      {ROLE_LABELS[u.role]}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Login form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-7 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Lock className="h-3 w-3" />
            {selectedUser
              ? <span>Signing in as <span style={{ color: ROLE_COLORS[selectedUser.role] }}>{selectedUser.name}</span> · {ROLE_LABELS[selectedUser.role]}</span>
              : 'Secure Authentication'
            }
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(false); setSelected(null) }}
                  placeholder="you@freehold.ae"
                  autoComplete="username"
                  className={[
                    'w-full rounded-xl border bg-slate-800/60 py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-700',
                    error ? 'border-red-500/60 focus:border-red-500/80' : 'border-slate-700 focus:border-[#D4AF37]/50',
                  ].join(' ')}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(false) }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={[
                    'w-full rounded-xl border bg-slate-800/60 px-4 py-3 pr-11 text-sm text-white outline-none transition-colors placeholder:text-slate-700',
                    error ? 'border-red-500/60 focus:border-red-500/80' : 'border-slate-700 focus:border-[#D4AF37]/50',
                  ].join(' ')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-400">Incorrect email or password. Please try again.</p>}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <button
                type="button"
                onClick={() => setRemember(r => !r)}
                className={[
                  'flex h-4.5 w-4.5 items-center justify-center rounded border transition-colors',
                  remember ? 'border-[#D4AF37]/60 bg-[#D4AF37] text-[#0D1117]' : 'border-slate-700 bg-slate-800/60',
                ].join(' ')}
              >
                {remember && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>
              <span className="text-sm text-slate-400" onClick={() => setRemember(r => !r)}>Remember me on this device</span>
            </label>

            <button
              type="submit"
              disabled={!email || !password || loading}
              className="w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-semibold text-[#0D1117] transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
            >
              {loading ? 'Verifying…' : 'Sign in to your workspace'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-700">
          Freehold Intelligence Platform &middot; Authorized Personnel Only
        </p>
      </div>
    </div>
  )
}
