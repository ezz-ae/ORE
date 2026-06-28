'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Key, Shield, Copy, Eye, EyeOff, CheckCircle,
  Plus, Trash2, AlertCircle, Lock, Smartphone,
} from 'lucide-react'

type ApiKey = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  lastUsed?: string
  active: boolean
}

const INITIAL_KEYS: ApiKey[] = [
  { id: 'k1', name: 'Production — Lead Machine', prefix: 'fh_prod_7x3k', scopes: ['leads:read', 'campaigns:write'], createdAt: '2026-01-10', lastUsed: '2026-06-06', active: true },
  { id: 'k2', name: 'HubSpot Sync',              prefix: 'fh_prod_9m2n', scopes: ['crm:read', 'crm:write'],        createdAt: '2026-03-22', lastUsed: '2026-06-05', active: true },
  { id: 'k3', name: 'Analytics Export',          prefix: 'fh_prod_4p1q', scopes: ['analytics:read'],               createdAt: '2026-05-01', lastUsed: '2026-05-28', active: false },
]

const AUDIT_LOG = [
  { time: '2026-06-06 09:14', event: 'Login',             detail: 'faisal@freeholdproperty.ae',  ip: '88.99.120.44',   ok: true  },
  { time: '2026-06-05 17:32', event: 'API key used',      detail: 'Production — Lead Machine',   ip: '35.180.12.7',    ok: true  },
  { time: '2026-06-05 09:00', event: 'Login',             detail: 'sara@freeholdproperty.ae',    ip: '77.241.18.93',   ok: true  },
  { time: '2026-06-04 22:11', event: 'Failed login',      detail: 'unknown@gmail.com',           ip: '193.104.201.50', ok: false },
  { time: '2026-06-04 14:05', event: 'Settings changed',  detail: 'Lead pool quotas updated',    ip: '88.99.120.44',   ok: true  },
  { time: '2026-06-03 10:44', event: 'API key created',   detail: 'HubSpot Sync',                ip: '88.99.120.44',   ok: true  },
]

const ALL_SCOPES = ['leads:read', 'leads:write', 'crm:read', 'crm:write', 'campaigns:read', 'campaigns:write', 'analytics:read', 'finance:read']

export default function SecurityPage() {
  const [keys, setKeys]       = useState<ApiKey[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScopes, setNewScopes] = useState<string[]>([])
  const [revealed, setRevealed] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied]   = useState<string | null>(null)
  const [twoFaOn, setTwoFaOn] = useState(true)

  function loadKeys() {
    fetch('/api/freehold/settings/api-keys', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.keys) return
        setKeys(d.keys.map((k: { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; lastUsedAt?: string; revoked: boolean }) => ({
          id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes || [],
          createdAt: (k.createdAt || '').slice(0, 10), lastUsed: k.lastUsedAt ? k.lastUsedAt.slice(0, 10) : undefined,
          active: !k.revoked,
        })))
      }).catch(() => {})
  }
  useEffect(() => {
    loadKeys()
    fetch('/api/freehold/settings', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.settings && typeof d.settings.twoFa === 'boolean') setTwoFaOn(d.settings.twoFa) })
      .catch(() => {})
  }, [])

  async function createKey() {
    if (!newName.trim() || newScopes.length === 0) return
    try {
      const res = await fetch('/api/freehold/settings/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), scopes: newScopes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setNewSecret(data.secret)
      setRevealed(data.id)
      setNewName(''); setNewScopes([]); setShowNew(false)
      loadKeys()
      toast.success('API key created — copy it now, it won’t be shown again')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create key')
    }
  }

  async function revokeKey(id: string) {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, active: false } : k))
    await fetch(`/api/freehold/settings/api-keys/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function deleteKey(id: string) {
    revokeKey(id)
    setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  function setTwoFa(v: boolean) {
    setTwoFaOn(v)
    fetch('/api/freehold/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twoFa: v }),
    }).catch(() => {})
  }

  function toggleScope(scope: string) {
    setNewScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope])
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const activeKeys = keys.filter((k) => k.active).length

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <h1 className="mb-8 text-xl font-semibold text-white">Security</h1>

      {/* 2FA */}
      <section className="mb-6 rounded-[18px] border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-emerald-400/20 bg-emerald-400/10">
              <Smartphone className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Two-factor authentication</div>
              <div className="mt-0.5 text-xs text-slate-500">Require 2FA for all team members</div>
            </div>
          </div>
          <button
            onClick={() => setTwoFa(!twoFaOn)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${twoFaOn ? 'bg-emerald-400' : 'bg-surface-3'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${twoFaOn ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        {!twoFaOn && (
          <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-xs text-amber-400/80">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Disabling 2FA reduces account security. All active sessions will remain valid.
          </div>
        )}
      </section>

      {/* One-time secret reveal */}
      {newSecret && (
        <section className="mb-4 rounded-[14px] border border-emerald-400/25 bg-emerald-400/[0.05] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Key className="h-4 w-4" /> New API key — copy it now</div>
          <p className="mt-1 text-xs text-slate-400">This secret is shown once and never again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-slate-200">{newSecret}</code>
            <button onClick={() => { copy(newSecret, 'new'); }} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20">
              {copied === 'new' ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => setNewSecret(null)} className="rounded-lg border border-line px-3 py-2 text-xs text-slate-400 hover:text-slate-200">Done</button>
          </div>
        </section>
      )}

      {/* API Keys */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            API keys <span className="ml-1 text-slate-400">{activeKeys} active</span>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.07] px-3 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/15"
          >
            <Plus className="h-3.5 w-3.5" /> New key
          </button>
        </div>

        {/* New key form */}
        {showNew && (
          <div className="mb-4 rounded-[16px] border border-gold/20 bg-gold/[0.04] p-5 space-y-3">
            <input
              type="text"
              placeholder="Key name (e.g. Zapier Integration)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40"
            />
            <div>
              <div className="mb-2 text-xs text-slate-500">Scopes</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleScope(s)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      newScopes.includes(s)
                        ? 'border-gold/40 bg-gold/15 text-gold'
                        : 'border-line-strong text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createKey}
                className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/90">
                <Key className="h-3.5 w-3.5" /> Generate key
              </button>
              <button onClick={() => setShowNew(false)}
                className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-[14px] border bg-surface px-5 py-4 transition ${k.active ? 'border-line' : 'border-line opacity-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Key className={`h-3.5 w-3.5 shrink-0 ${k.active ? 'text-gold' : 'text-slate-600'}`} />
                    <span className="text-sm font-semibold text-white">{k.name}</span>
                    {!k.active && <span className="text-xs text-red-400/70">Revoked</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="rounded bg-surface-2 px-2 py-0.5 text-xs font-mono text-slate-400">
                      {revealed === k.id ? `${k.prefix}_••••••••••••` : `${k.prefix}...`}
                    </code>
                    <button
                      onClick={() => setRevealed(revealed === k.id ? null : k.id)}
                      className="text-slate-600 transition hover:text-slate-400"
                    >
                      {revealed === k.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => copy(`${k.prefix}_••••••••••••`, k.id)}
                      className="text-slate-600 transition hover:text-slate-400"
                    >
                      {copied === k.id ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-slate-500">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {k.lastUsed && (
                    <div className="hidden sm:block text-right">
                      <div className="text-xs text-slate-600">Last used</div>
                      <div className="text-xs text-slate-400">{new Date(k.lastUsed).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  )}
                  {k.active ? (
                    <button onClick={() => revokeKey(k.id)}
                      className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-red-400/70 transition hover:border-red-400/20 hover:text-red-400">
                      Revoke
                    </button>
                  ) : (
                    <button onClick={() => deleteKey(k.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-line-strong text-slate-600 transition hover:border-red-400/20 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Audit log */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Audit log</div>
        <div className="rounded-[18px] border border-line bg-surface overflow-hidden">
          <div className="divide-y divide-line">
            {AUDIT_LOG.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${entry.ok ? 'bg-emerald-400/60' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${entry.ok ? 'text-slate-100' : 'text-red-400/90'}`}>{entry.event}</span>
                    <span className="text-xs text-slate-400 truncate">{entry.detail}</span>
                  </div>
                  <div className="text-xs text-slate-600">{entry.ip}</div>
                </div>
                <span className="shrink-0 text-xs text-slate-600 tabular-nums whitespace-nowrap">{entry.time.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
