'use client'

import { useState } from 'react'
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
  const [keys, setKeys]       = useState<ApiKey[]>(INITIAL_KEYS)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScopes, setNewScopes] = useState<string[]>([])
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied]   = useState<string | null>(null)
  const [twoFaOn, setTwoFaOn] = useState(true)

  function createKey() {
    if (!newName.trim() || newScopes.length === 0) return
    const newKey: ApiKey = {
      id:        `k${Date.now()}`,
      name:      newName.trim(),
      prefix:    `fh_prod_${Math.random().toString(36).slice(2, 8)}`,
      scopes:    newScopes,
      createdAt: new Date().toISOString().slice(0, 10),
      active:    true,
    }
    setKeys((prev) => [...prev, newKey])
    setNewName('')
    setNewScopes([])
    setShowNew(false)
  }

  function revokeKey(id: string) {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, active: false } : k))
  }

  function deleteKey(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id))
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

      <h1 className="mb-8 text-[20px] font-semibold text-white">Security</h1>

      {/* 2FA */}
      <section className="mb-6 rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-emerald-400/20 bg-emerald-400/10">
              <Smartphone className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-white">Two-factor authentication</div>
              <div className="mt-0.5 text-[12px] text-white/35">Require 2FA for all team members</div>
            </div>
          </div>
          <button
            onClick={() => setTwoFaOn((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${twoFaOn ? 'bg-emerald-400' : 'bg-white/[0.10]'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${twoFaOn ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        {!twoFaOn && (
          <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[12px] text-amber-400/80">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Disabling 2FA reduces account security. All active sessions will remain valid.
          </div>
        )}
      </section>

      {/* API Keys */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/25">
            API keys <span className="ml-1 text-white/40">{activeKeys} active</span>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-3 py-1.5 text-[12px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15"
          >
            <Plus className="h-3.5 w-3.5" /> New key
          </button>
        </div>

        {/* New key form */}
        {showNew && (
          <div className="mb-4 rounded-[16px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-5 space-y-3">
            <input
              type="text"
              placeholder="Key name (e.g. Zapier Integration)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#D4AF37]/40"
            />
            <div>
              <div className="mb-2 text-[11px] text-white/30">Scopes</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleScope(s)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      newScopes.includes(s)
                        ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]'
                        : 'border-white/[0.08] text-white/35 hover:text-white/60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createKey}
                className="flex items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-[#D4AF37]/90">
                <Key className="h-3.5 w-3.5" /> Generate key
              </button>
              <button onClick={() => setShowNew(false)}
                className="rounded-full border border-white/[0.08] px-4 py-2 text-[12px] text-white/35 transition hover:text-white/60">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-[14px] border bg-[#131B2B] px-5 py-4 transition ${k.active ? 'border-white/[0.07]' : 'border-white/[0.04] opacity-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Key className={`h-3.5 w-3.5 shrink-0 ${k.active ? 'text-[#D4AF37]' : 'text-white/20'}`} />
                    <span className="text-[13px] font-semibold text-white">{k.name}</span>
                    {!k.active && <span className="text-[11px] text-red-400/70">Revoked</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="rounded bg-white/[0.05] px-2 py-0.5 text-[12px] font-mono text-white/50">
                      {revealed === k.id ? `${k.prefix}_••••••••••••` : `${k.prefix}...`}
                    </code>
                    <button
                      onClick={() => setRevealed(revealed === k.id ? null : k.id)}
                      className="text-white/20 transition hover:text-white/50"
                    >
                      {revealed === k.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => copy(`${k.prefix}_••••••••••••`, k.id)}
                      className="text-white/20 transition hover:text-white/50"
                    >
                      {copied === k.id ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/30">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {k.lastUsed && (
                    <div className="hidden sm:block text-right">
                      <div className="text-[10px] text-white/20">Last used</div>
                      <div className="text-[11px] text-white/40">{new Date(k.lastUsed).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  )}
                  {k.active ? (
                    <button onClick={() => revokeKey(k.id)}
                      className="rounded-md border border-white/[0.07] px-2.5 py-1 text-[11px] text-red-400/70 transition hover:border-red-400/20 hover:text-red-400">
                      Revoke
                    </button>
                  ) : (
                    <button onClick={() => deleteKey(k.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] text-white/20 transition hover:border-red-400/20 hover:text-red-400">
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
        <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/25">Audit log</div>
        <div className="rounded-[18px] border border-white/[0.07] bg-[#131B2B] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {AUDIT_LOG.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${entry.ok ? 'bg-emerald-400/60' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[13px] font-medium ${entry.ok ? 'text-white/75' : 'text-red-400/90'}`}>{entry.event}</span>
                    <span className="text-[12px] text-white/30 truncate">{entry.detail}</span>
                  </div>
                  <div className="text-[10px] text-white/20">{entry.ip}</div>
                </div>
                <span className="shrink-0 text-[11px] text-white/20 tabular-nums whitespace-nowrap">{entry.time.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
