'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, BarChart3, Loader2, Save } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Pixels = { metaPixelId: string; googleTagId: string; googleConversionId: string; tiktokPixelId: string }
const EMPTY: Pixels = { metaPixelId: '', googleTagId: '', googleConversionId: '', tiktokPixelId: '' }

// Global tracking pixels — set ONCE here, applied to every landing page. This
// is where the per-page pixel fields moved to: a broker never re-types them.
export default function TrackingIntegrationPage() {
  const t = useT()
  const [pixels, setPixels] = useState<Pixels>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/freehold/integrations/tracking')
      .then((r) => r.json())
      .then((d) => { if (d.pixels) setPixels({ ...EMPTY, ...d.pixels }) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/integrations/tracking', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pixels),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || t('track.saveFailed')); return }
      if (d.pixels) setPixels({ ...EMPTY, ...d.pixels })
      toast.success(t('track.saved'))
    } catch { toast.error(t('track.saveFailed')) } finally { setSaving(false) }
  }

  const set = (k: keyof Pixels, v: string) => setPixels((p) => ({ ...p, [k]: v }))

  const fields: { key: keyof Pixels; label: string; ph: string }[] = [
    { key: 'metaPixelId', label: t('track.metaPixel'), ph: '000000000000000' },
    { key: 'tiktokPixelId', label: t('track.tiktokPixel'), ph: 'C0000000000000000000' },
    { key: 'googleTagId', label: t('track.googleTag'), ph: 'G-XXXXXXX' },
    { key: 'googleConversionId', label: t('track.googleConv'), ph: 'AW-XXXXXXX' },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link href="/freehold-intelligence/integrations" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('track.back')}
      </Link>
      <div className="mt-3 flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/25 bg-violet-400/10"><BarChart3 className="h-4 w-4 text-violet-300" /></div>
        <div>
          <h1 className="text-lg font-semibold text-white">{t('track.title')}</h1>
          <p className="text-xs text-slate-500">{t('track.sub')}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
      ) : (
        <div className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{f.label}</label>
              <input value={pixels[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph}
                className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-slate-500">{t('track.hint')}</p>
          <div className="flex justify-end pt-1">
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('track.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
