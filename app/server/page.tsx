'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, Lock, Mail, Check, Search } from 'lucide-react'
import { login } from '@/lib/freehold/session'
import type { Role } from '@/lib/freehold/session-types'
import { ROLE_COLORS } from '@/lib/freehold/session-types'
import { BRAND, brandName } from '@/lib/freehold/brand'
import { I18nProvider, useT } from '@/lib/i18n/provider'

type Profile = { email: string; name: string; initials: string; role: Role }

type FilterTab = 'all' | 'management' | 'admin' | 'broker'

function inTab(role: Role, t: FilterTab): boolean {
  if (t === 'all') return true
  if (t === 'management') return role === 'ceo' || role === 'director' || role === 'sales_manager' || role === 'marketing'
  return role === t
}

// The login page lives outside the app shell, so it mounts its own i18n
// provider — first visit from an Arabic device opens the sign-in in Arabic.
export default function ServerAuth() {
  return (
    <I18nProvider>
      <ServerAuthInner />
    </I18nProvider>
  )
}

function ServerAuthInner() {
  const t = useT()
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

  // Real team, from the database — only accounts that can actually sign in.
  const [profiles, setProfiles] = useState<Profile[]>([])
  useEffect(() => {
    fetch('/api/auth/roster')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.profiles)) setProfiles(d.profiles) })
      .catch(() => {})
  }, [])

  // Selecting a profile prefills the email only — everyone types their own
  // password (no credentials ever ship to the browser).
  function selectUser(u: Profile) {
    setSelected(u.email)
    setEmail(u.email)
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
  const visible = profiles.filter((u) => inTab(u.role, tab) && (!q || u.name.toLowerCase().includes(q)))
  const tabCount = (t: FilterTab) => profiles.filter((u) => inTab(u.role, t)).length

  const selectedUser = profiles.find((u) => u.email === selected)

  return (
    <div
      className="fi-root flex min-h-screen flex-col items-center justify-center bg-app px-5 py-10"
      style={{ ['--color-gold' as string]: BRAND.accent } as React.CSSProperties}
    >
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, color-mix(in srgb, var(--color-gold) 10%, transparent) 0%, transparent 55%),' +
            'radial-gradient(ellipse 60% 40% at 50% 100%, color-mix(in srgb, var(--color-gold) 4%, transparent) 0%, transparent 50%)',
        }}
      />

      <div className="relative w-full max-w-[460px]">

        {/* Header */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
            <Shield className="h-7 w-7 text-gold" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{BRAND.company} Server</h1>
          <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>
        </div>

        {/* Role selector panel */}
        <div className="mb-4 rounded-2xl border border-line bg-surface shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden">

          {/* Tab row + search */}
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <div className="flex gap-1">
              {(['all', 'management', 'admin', 'broker'] as FilterTab[]).map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => { setTab(ft); setSearch('') }}
                  className={[
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                    tab === ft
                      ? 'bg-surface-3 text-white'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-surface-2',
                  ].join(' ')}
                >
                  {t(`login.tab.${ft}`)}
                  <span className={[
                    'rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
                    tab === ft ? 'bg-surface text-slate-300' : 'bg-surface-2 text-slate-500',
                  ].join(' ')}>
                    {tabCount(ft)}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('login.search')}
                className="w-28 rounded-lg border border-line bg-surface-2 py-1 pl-7 pr-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-line-strong transition-colors"
              />
            </div>
          </div>

          {/* Active-tab description */}
          <div className="border-b border-line px-4 py-2">
            <p className="text-[11px] text-slate-500">{t(`login.tabDesc.${tab}`)}</p>
          </div>

          {/* User grid */}
          <div className="overflow-y-auto max-h-[220px] p-2.5">
            {visible.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-600">{t('login.noResults')}</p>
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
                      title={u.name}
                      className={[
                        'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-all',
                        isSel
                          ? 'bg-surface-2'
                          : 'border-line bg-surface-2 hover:bg-surface-2 hover:border-line-strong',
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
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Auth form */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Lock className="h-3 w-3" />
            {selectedUser ? (
              <span>
                {t('login.signingInAs')}{' '}
                <span style={{ color: ROLE_COLORS[selectedUser.role] }}>{selectedUser.name}</span>
              </span>
            ) : (
              t('login.secureAuth')
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('login.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(false); setSelected(null) }}
                  placeholder="you@freeholdproperty.ae"
                  autoComplete="username"
                  className={[
                    'w-full rounded-xl border bg-surface-2 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-700',
                    error ? 'border-red-500/60' : 'border-line-strong focus:border-gold/50',
                  ].join(' ')}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">{t('login.password')}</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(false) }}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="current-password"
                  className={[
                    'w-full rounded-xl border bg-surface-2 px-4 py-2.5 pr-11 text-sm text-white outline-none transition-colors placeholder:text-slate-700',
                    error ? 'border-red-500/60' : 'border-line-strong focus:border-gold/50',
                  ].join(' ')}
                />
                <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-red-400">{t('login.error')}</p>}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <button type="button" onClick={() => setRemember(r => !r)}
                className={[
                  'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                  remember ? 'border-gold/60 bg-gold text-ink' : 'border-line-strong bg-surface-2',
                ].join(' ')}>
                {remember && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </button>
              <span className="text-sm text-slate-400" onClick={() => setRemember(r => !r)}>{t('login.remember')}</span>
            </label>

            <button
              type="submit"
              disabled={!email || !password || loading}
              className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading ? t('login.verifying') : t('login.signIn')}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-700">
          {brandName} Platform &middot; {BRAND.tagline}
        </p>
      </div>
    </div>
  )
}
