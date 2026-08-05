'use client'

/**
 * Branded short links — create fhp.ae/l/{code} links for landing pages,
 * brochures, agent bios or any long URL, and watch the real click count. The
 * short URL is also the ideal QR target (shorter → less dense → scans cleanly).
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { ArrowLeft, Link2, Loader2, Copy, Check, Trash2, QrCode, ArrowUpRight, Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import { getBrandSiteUrl } from '@/lib/freehold/brand'

interface ShortLink {
  code: string
  targetUrl: string
  createdBy: string | null
  clicks: number
  createdAt: string
}

export default function ShortLinksPage() {
  const { t } = useI18n()
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState('')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)

  const base = getBrandSiteUrl().replace(/\/$/, '')
  const shortUrl = (c: string) => `${base}/l/${c}`

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/short-links', { cache: 'no-store' })
      const d = await res.json().catch(() => null)
      if (res.ok && Array.isArray(d?.links)) setLinks(d.links as ShortLink[])
    } catch { /* keep last */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    if (!target.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/freehold/short-links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: target.trim(), code: code.trim() || undefined }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { toast.error(d?.error || t('lm.links.createFailed')); return }
      setTarget(''); setCode('')
      toast.success(t('lm.links.created'))
      await load()
    } catch { toast.error(t('lm.links.createFailed')) } finally { setCreating(false) }
  }

  async function copy(c: string) {
    try {
      await navigator.clipboard.writeText(shortUrl(c))
      setCopied(c); setTimeout(() => setCopied((x) => (x === c ? null : x)), 1500)
    } catch { toast.error(t('lm.links.copyFailed')) }
  }

  async function downloadQr(c: string) {
    try {
      const dataUrl = await QRCode.toDataURL(shortUrl(c), { margin: 1, width: 512, color: { dark: '#000000', light: '#ffffff' } })
      const a = document.createElement('a')
      a.href = dataUrl; a.download = `qr-${c}.png`; a.click()
    } catch { toast.error(t('lm.links.qrFailed')) }
  }

  async function remove(c: string) {
    setBusyCode(c)
    try {
      const res = await fetch(`/api/freehold/short-links?code=${encodeURIComponent(c)}`, { method: 'DELETE' })
      if (!res.ok) { toast.error(t('lm.links.deleteFailed')); return }
      setLinks((prev) => prev.filter((l) => l.code !== c))
    } catch { toast.error(t('lm.links.deleteFailed')) } finally { setBusyCode(null) }
  }

  const inputCls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-gold/40'

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/inventory/landings" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('lm.links.back')}
      </Link>

      <div className="mt-5 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/10 text-gold"><Link2 className="h-4.5 w-4.5" /></span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{t('lm.links.title')}</h1>
          <p className="text-xs text-slate-500">{t('lm.links.subtitle', { host: base.replace(/^https?:\/\//, '') })}</p>
        </div>
      </div>

      {/* Create */}
      <div className="mt-6 rounded-[18px] border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t('lm.links.targetPh')} dir="ltr"
            onKeyDown={(e) => { if (e.key === 'Enter') create() }} className={inputCls} />
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-xs text-slate-500" dir="ltr">/l/</span>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} placeholder={t('lm.links.codePh')} dir="ltr"
              className={`${inputCls} w-full sm:w-36`} />
          </div>
        </div>
        <button type="button" onClick={create} disabled={creating || !target.trim()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t('lm.links.create')}
        </button>
        <p className="mt-2 text-[11px] text-slate-500">{t('lm.links.hint')}</p>
      </div>

      {/* List */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
        ) : links.length === 0 ? (
          <div className="rounded-[18px] border border-line bg-surface-2/40 px-5 py-10 text-center text-sm text-slate-500">{t('lm.links.empty')}</div>
        ) : (
          <div className="space-y-2.5">
            {links.map((l) => (
              <div key={l.code} className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-surface p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gold" dir="ltr">{base.replace(/^https?:\/\//, '')}/l/{l.code}</span>
                    <button type="button" onClick={() => copy(l.code)} title={t('lm.links.copy')} className="text-slate-500 transition hover:text-white">
                      {copied === l.code ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <a href={l.targetUrl} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-slate-500 transition hover:text-slate-300" dir="ltr" title={l.targetUrl}>
                    {l.targetUrl}
                  </a>
                </div>
                <div className="text-end">
                  <div className="text-sm font-semibold tabular-nums text-white">{l.clicks.toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('lm.links.clicks')}</div>
                </div>
                <div className="flex items-center gap-1">
                  <a href={shortUrl(l.code)} target="_blank" rel="noreferrer" title={t('lm.links.open')} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white">
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <button type="button" onClick={() => downloadQr(l.code)} title={t('lm.links.qr')} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white">
                    <QrCode className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(l.code)} disabled={busyCode === l.code} title={t('lm.links.delete')}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50">
                    {busyCode === l.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
