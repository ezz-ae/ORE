'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Key, Shield, Copy, Eye, EyeOff, CheckCircle,
  Plus, Trash2, AlertCircle, Lock, Smartphone,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

type ApiKey = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  lastUsed?: string
  active: boolean
}

const ALL_SCOPES = ['leads:read', 'leads:write', 'crm:read', 'crm:write', 'campaigns:read', 'campaigns:write', 'analytics:read', 'finance:read']

type AuditRow = { id: string; event: string; detail: string; actor: string; time: string }

export default function SecurityPage() {
  const { t, locale } = useI18n()
  const [keys, setKeys]       = useState<ApiKey[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScopes, setNewScopes] = useState<string[]>([])
  const [revealed, setRevealed] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied]   = useState<string | null>(null)
  const [audit, setAudit]     = useState<AuditRow[]>([])

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
    // Real audit trail from the shared activity log (same source the Security
    // dashboard uses) — no fabricated logins/IPs.
    fetch('/api/freehold/crm/activity', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!Array.isArray(d?.activity)) return
        setAudit(d.activity.slice(0, 12).map((r: { id: string; activity_type: string; created_at: string; lead_name: string | null; actor?: string | null }) => ({
          id: String(r.id),
          event: r.activity_type,
          detail: r.lead_name ?? '—',
          actor: r.actor ?? '—',
          time: r.created_at,
        })))
      })
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
      toast.success(t('settings.security.keyCreated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.security.keyCreateFailed'))
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

      <h1 className="mb-8 text-xl font-semibold text-white">{t('settings.security.title')}</h1>

      {/* 2FA */}
      <section className="mb-6 rounded-[18px] border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-emerald-400/20 bg-emerald-400/10">
              <Smartphone className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{t('settings.security.2fa.title')}</div>
              <div className="mt-0.5 text-xs text-slate-500">{t('settings.security.2fa.sub')}</div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-slate-400">
            {t('settings.security.2fa.comingSoon')}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-xs text-slate-500">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {t('settings.security.2fa.notYet')}
        </div>
      </section>

      {/* One-time secret reveal */}
      {newSecret && (
        <section className="mb-4 rounded-[14px] border border-emerald-400/25 bg-emerald-400/[0.05] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Key className="h-4 w-4" /> {t('settings.security.newKey.title')}</div>
          <p className="mt-1 text-xs text-slate-400">{t('settings.security.newKey.sub')}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-slate-200">{newSecret}</code>
            <button onClick={() => { copy(newSecret, 'new'); }} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20">
              {copied === 'new' ? t('settings.security.copied') : t('settings.security.copy')}
            </button>
            <button onClick={() => setNewSecret(null)} className="rounded-lg border border-line px-3 py-2 text-xs text-slate-400 hover:text-slate-200">{t('settings.security.done')}</button>
          </div>
        </section>
      )}

      {/* API Keys */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('settings.security.apiKeys')} <span className="ml-1 text-slate-400">{t('settings.security.activeCount', { count: activeKeys })}</span>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.07] px-3 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/15"
          >
            <Plus className="h-3.5 w-3.5" /> {t('settings.security.newKeyBtn')}
          </button>
        </div>

        {/* New key form */}
        {showNew && (
          <div className="mb-4 rounded-[16px] border border-gold/20 bg-gold/[0.04] p-5 space-y-3">
            <input
              type="text"
              placeholder={t('settings.security.keyNamePlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40"
            />
            <div>
              <div className="mb-2 text-xs text-slate-500">{t('settings.security.scopes')}</div>
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
                <Key className="h-3.5 w-3.5" /> {t('settings.security.generateKey')}
              </button>
              <button onClick={() => setShowNew(false)}
                className="rounded-full border border-line-strong px-4 py-2 text-xs text-slate-400 transition hover:text-slate-100">
                {t('settings.security.cancel')}
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
                    {!k.active && <span className="text-xs text-red-400/70">{t('settings.security.revoked')}</span>}
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
                      <div className="text-xs text-slate-600">{t('settings.security.lastUsed')}</div>
                      <div className="text-xs text-slate-400">{new Date(k.lastUsed).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</div>
                    </div>
                  )}
                  {k.active ? (
                    <button onClick={() => revokeKey(k.id)}
                      className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-red-400/70 transition hover:border-red-400/20 hover:text-red-400">
                      {t('settings.security.revoke')}
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
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.security.auditLog')}</div>
        <div className="rounded-[18px] border border-line bg-surface overflow-hidden">
          {audit.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">{t('settings.security.auditEmpty')}</div>
          ) : (
            <div className="divide-y divide-line">
              {audit.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/60" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-100 capitalize">{entry.event.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-400 truncate">{entry.detail}</span>
                    </div>
                    <div className="text-xs text-slate-600">{entry.actor}</div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {new Date(entry.time).toLocaleDateString(locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
