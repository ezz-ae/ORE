'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Copy, CheckCircle2, ExternalLink, Search, Link2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

interface Profile {
  handle: string; displayName: string; title: string; phone: string
  whatsapp: string; email: string; bio: string; projectSlugs: string[]
}
interface InventoryOption { slug: string; name: string; area: string }

const EMPTY: Profile = { handle: '', displayName: '', title: '', phone: '', whatsapp: '', email: '', bio: '', projectSlugs: [] }

export default function AgentBioEditorPage() {
  const { t } = useI18n()
  const [p, setP] = useState<Profile>(EMPTY)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inv, setInv] = useState<InventoryOption[]>([])
  const [invQuery, setInvQuery] = useState('')

  useEffect(() => {
    fetch('/api/freehold/agent/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile) setP({ ...EMPTY, ...d.profile })
        setPublicUrl(d?.publicUrl ?? null)
        setQr(d?.qrDataUrl ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInv((d?.properties || []).map((x: Record<string, unknown>) => ({
        slug: String(x.slug || ''), name: String(x.name || ''), area: String(x.area || ''),
      })).filter((x: InventoryOption) => x.slug && x.name)))
      .catch(() => {})
  }, [])

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }))
  const toggleProject = (slug: string) =>
    setP((prev) => ({
      ...prev,
      projectSlugs: prev.projectSlugs.includes(slug)
        ? prev.projectSlugs.filter((s) => s !== slug)
        : [...prev.projectSlugs, slug].slice(0, 24),
    }))

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/freehold/agent/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d?.profile) {
        setP({ ...EMPTY, ...d.profile }); setPublicUrl(d.publicUrl ?? null); setQr(d.qrDataUrl ?? null); setSaved(true)
      }
    } finally { setSaving(false) }
  }

  const invFiltered = useMemo(() => {
    const q = invQuery.trim().toLowerCase()
    const list = q ? inv.filter((x) => `${x.name} ${x.area}`.toLowerCase().includes(q)) : inv
    return list.slice(0, 60)
  }, [inv, invQuery])

  const input = 'w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40'
  const label = 'mb-1 block text-xs font-medium text-slate-400'

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
        <Link2 className="h-4 w-4" /> {t('agent.bioLink')}
      </div>
      <h1 className="text-2xl font-semibold text-white">{t('agent.bioShareable')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('agent.bioIntro')}</p>

      {/* Link + QR */}
      {publicUrl && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
          {qr && <img src={qr} alt="QR code" className="h-28 w-28 shrink-0 rounded-lg bg-white p-1.5" />}
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">{t('agent.bioPublicLink')}</div>
            <div className="mt-1 truncate text-sm font-medium text-white">{publicUrl}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(publicUrl).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/25"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('agent.bioCopied') : t('agent.bioCopyLink')}
              </button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/25">
                <ExternalLink className="h-3.5 w-3.5" /> {t('agent.bioPreview')}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Fields */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className={label}>{t('agent.bioDisplayName')}</label><input className={input} value={p.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder={t('agent.bioDisplayNamePh')} /></div>
        <div><label className={label}>{t('agent.bioTitle')}</label><input className={input} value={p.title} onChange={(e) => set('title', e.target.value)} placeholder={t('agent.bioTitlePh')} /></div>
        <div><label className={label}>{t('agent.bioWhatsapp')}</label><input className={input} value={p.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+9715…" /></div>
        <div><label className={label}>{t('agent.bioPhone')}</label><input className={input} value={p.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+9714…" /></div>
        <div className="sm:col-span-2"><label className={label}>{t('agent.bioEmail')}</label><input className={input} value={p.email} onChange={(e) => set('email', e.target.value)} placeholder="you@company.com" /></div>
        <div className="sm:col-span-2"><label className={label}>{t('agent.bioBio')}</label><textarea className={`${input} min-h-[80px] resize-none`} value={p.bio} onChange={(e) => set('bio', e.target.value)} placeholder={t('agent.bioBioPh')} /></div>
      </div>

      {/* Project picker */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <label className={label}>{t('agent.bioFeatured')} <span className="text-slate-600">{t('agent.bioSelected', { count: p.projectSlugs.length })}</span></label>
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className={`${input} ps-9`} value={invQuery} onChange={(e) => setInvQuery(e.target.value)} placeholder={t('agent.bioSearchInv')} />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-1.5">
          {invFiltered.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">{t('agent.bioNoProjects')}</div>
          ) : invFiltered.map((x) => {
            const on = p.projectSlugs.includes(x.slug)
            return (
              <button key={x.slug} onClick={() => toggleProject(x.slug)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition ${on ? 'bg-gold/10 text-gold' : 'text-slate-300 hover:bg-surface-2'}`}>
                <span className="min-w-0"><span className="block truncate">{x.name}</span><span className="block truncate text-xs text-slate-500">{x.area}</span></span>
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-gold bg-gold text-ink' : 'border-line-strong'}`}>{on && <CheckCircle2 className="h-3 w-3" />}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {t('agent.bioSave')}
        </button>
        {saved && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {t('agent.bioSaved')}</span>}
      </div>
    </div>
  )
}
