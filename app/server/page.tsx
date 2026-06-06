'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, Lock } from 'lucide-react'

const PASSCODE = 'FreeHold_in26'
const SESSION_KEY = 'fh_mgmt_auth'

export default function ServerAuth() {
  const router = useRouter()
  const [code, setCode]       = useState('')
  const [show, setShow]       = useState(false)
  const [error, setError]     = useState(false)
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code || loading) return
    setLoading(true)
    setTimeout(() => {
      if (code === PASSCODE) {
        sessionStorage.setItem(SESSION_KEY, '1')
        router.replace('/management')
      } else {
        setError(true)
        setLoading(false)
      }
    }, 500)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1117] px-6">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-[360px]">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
            <Shield className="h-8 w-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Freehold Admin</h1>
          <p className="mt-1.5 text-sm text-slate-500">Server Control Panel — Restricted Access</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-7 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Lock className="h-3 w-3" /> Secure Authentication
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Access Code</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={code}
                  onChange={e => { setCode(e.target.value); setError(false) }}
                  placeholder="Enter your access code"
                  autoFocus
                  autoComplete="off"
                  className={[
                    'w-full rounded-xl border bg-slate-800/60 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-700 pr-11',
                    error
                      ? 'border-red-500/60 focus:border-red-500/80'
                      : 'border-slate-700 focus:border-[#D4AF37]/50',
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
              {error && <p className="mt-2 text-xs text-red-400">Incorrect access code. Please try again.</p>}
            </div>

            <button
              type="submit"
              disabled={!code || loading}
              className="w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-semibold text-[#0D1117] transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
            >
              {loading ? 'Verifying…' : 'Enter Control Panel'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-700">
          Freehold Intelligence Platform &middot; Authorized Personnel Only
        </p>
      </div>
    </div>
  )
}
