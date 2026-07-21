'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bot, Plus, Copy, Check, Trash2, Loader2, KeyRound, ShieldCheck, Terminal, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import { ROLE_LABELS, type Role } from '@/lib/freehold/session-types'

type ApiToken = { id: string; name: string; role: Role; prefix: string; createdAt: string; lastUsedAt: string | null }

export default function ConnectAiPage() {
  const t = useT()
  const { user } = useSession()
  const [tokens, setTokens] = useState<ApiToken[] | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState<{ raw: string; name: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const endpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'
  const roleLabel = user ? ROLE_LABELS[user.role] : ''

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/freehold/api-tokens', { cache: 'no-store' })
      const d = await r.json()
      setTokens(Array.isArray(d.tokens) ? d.tokens : [])
    } catch { setTokens([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    if (creating) return
    setCreating(true)
    try {
      const r = await fetch('/api/freehold/api-tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const d = await r.json()
      if (!r.ok || !d.raw) { toast.error(t('settings.connect.failCreate')); return }
      setFresh({ raw: d.raw, name: d.token?.name || name.trim() })
      setName('')
      toast.success(t('settings.connect.created'))
      load()
    } catch { toast.error(t('settings.connect.failCreate')) }
    finally { setCreating(false) }
  }

  async function revoke(id: string) {
    try {
      const r = await fetch(`/api/freehold/api-tokens?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!r.ok) { toast.error(t('settings.connect.failRevoke')); return }
      toast.success(t('settings.connect.revoked'))
      setTokens((prev) => (prev ? prev.filter((x) => x.id !== id) : prev))
    } catch { toast.error(t('settings.connect.failRevoke')) }
  }

  function copy(value: string, key: string) {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key); toast.success(t('settings.connect.copied'))
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    }).catch(() => {})
  }

  const CLIENTS = [
    { key: 'claude', Icon: Sparkles, color: 'text-gold' },
    { key: 'gpt', Icon: Bot, color: 'text-emerald-400' },
    { key: 'gemini', Icon: Terminal, color: 'text-violet-400' },
  ] as const

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">
      <div className="mb-7">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white"><Bot className="h-5 w-5 text-gold" /> {t('settings.connect.title')}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t('settings.connect.subtitle')}</p>
      </div>

      {/* Endpoint */}
      <section className="mb-5 rounded-2xl border border-gold/15 bg-gold/[0.04] p-4">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.connect.endpointLabel')}</div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-gold">{endpoint}</code>
          <button type="button" onClick={() => copy(endpoint, 'endpoint')} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-slate-300 transition hover:text-white">
            {copied === 'endpoint' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {t('settings.connect.copyEndpoint')}
          </button>
        </div>
      </section>

      {/* Capability note */}
      <section className="mb-6 rounded-2xl border border-line bg-surface-2/50 p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> {t('settings.connect.readsTitle')}</div>
        <p className="text-[13px] leading-relaxed text-slate-400">{t('settings.connect.readsBody')}</p>
        {user && <p className="mt-2 text-[12px] text-slate-500">{t('settings.connect.roleNote', { role: roleLabel })}</p>}
      </section>

      {/* Tokens */}
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><KeyRound className="h-3.5 w-3.5 text-gold" /> {t('settings.connect.tokenSectionTitle')}</div>
        <p className="mb-3 text-[12px] leading-relaxed text-slate-500">{t('settings.connect.tokenHint', { role: roleLabel })}</p>

        {/* Just-created token — shown once */}
        {fresh && (
          <div className="mb-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">{fresh.name} · {t('settings.connect.oneTimeWarn')}</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm text-white" dir="ltr">{fresh.raw}</code>
              <button type="button" onClick={() => copy(fresh.raw, 'fresh')} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20">
                {copied === 'fresh' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {t('settings.connect.copyToken')}
              </button>
            </div>
            <button type="button" onClick={() => setFresh(null)} className="mt-2 text-[11px] text-slate-400 hover:text-white">{t('settings.connect.dismiss')}</button>
          </div>
        )}

        {/* Create */}
        <div className="mb-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('settings.connect.newPlaceholder')}
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />
          <button type="button" onClick={create} disabled={creating} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('settings.connect.create')}
          </button>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-line bg-surface divide-y divide-line">
          {tokens === null ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : tokens.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">{t('settings.connect.empty')}</div>
          ) : tokens.map((tok) => (
            <div key={tok.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-200">{tok.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                  <code className="font-mono" dir="ltr">{tok.prefix}…</code>
                  <span>· {ROLE_LABELS[tok.role] ?? tok.role}</span>
                  <span>· {tok.lastUsedAt ? `${t('settings.connect.lastUsedPrefix')} ${new Date(tok.lastUsedAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}` : t('settings.connect.lastUsedNever')}</span>
                </div>
              </div>
              <button type="button" onClick={() => revoke(tok.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/10">
                <Trash2 className="h-3.5 w-3.5" /> {t('settings.connect.revoke')}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* How to connect */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.connect.howTitle')}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {CLIENTS.map(({ key, Icon, color }) => (
            <div key={key} className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Icon className={`h-4 w-4 ${color}`} /> {t(`settings.connect.${key}Title`)}</div>
              <p className="text-[12px] leading-relaxed text-slate-400">{t(`settings.connect.${key}Steps`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
