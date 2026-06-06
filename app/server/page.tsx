'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, Lock, Mail, Check } from 'lucide-react'
import { login } from '@/lib/freehold/session'

// NOTE: temporary pre-filled admin credentials — replace with real server auth.
const USERNAME = 'admin@freehold.ae'
const PASSWORD = 'FreeHold_in26'

export default function ServerAuth() {
  const router = useRouter()
  // pre-filled so the owner finds the credentials already there
  const [email, setEmail]       = useState(USERNAME)
  const [password, setPassword] = useState(PASSWORD)
  const [remember, setRemember] = useState(true)
  const [show, setShow]         = useState(false)
  const [error, setError]       = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    setError(false)
    // server-side auth: sets a signed httpOnly cookie, returns the user
    const user = await login(email, password, remember)
    if (user) {
      router.replace(user.home)   // admin → /management, broker → /agent
    } else {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1117] px-6">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
            <Shield className="h-8 w-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Freehold Server</h1>
          <p className="mt-1.5 text-sm text-slate-500">One sign-in — your workspace adapts to your role</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-7 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Lock className="h-3 w-3" /> Secure Authentication
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / username */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(false) }}
                  placeholder="you@freehold.ae"
                  autoComplete="username"
                  className={[
                    'w-full rounded-xl border bg-slate-800/60 py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-700',
                    error ? 'border-red-500/60 focus:border-red-500/80' : 'border-slate-700 focus:border-[#D4AF37]/50',
                  ].join(' ')}
                />
              </div>
            </div>

            {/* Password */}
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

            {/* Remember me */}
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
              {loading ? 'Verifying…' : 'Sign in to Control Panel'}
            </button>
          </form>
        </div>

        <div className="mt-6 space-y-2 text-center">
          <p className="text-xs text-slate-600">
            Admins land on the control panel · Brokers land on their workspace
          </p>
          <p className="text-xs text-slate-700">
            Freehold Intelligence Platform &middot; Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  )
}
