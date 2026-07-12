'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Sparkles, Wand2, Check, Download } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { CREATIVE_FORMATS } from '@/lib/creative-studio/constants'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'

// The image-only creative formats — the smart form generates stills; video
// formats stay on the node canvas.
const IMAGE_FORMATS = CREATIVE_FORMATS.filter((f) => f.kind === 'image')

type Presenter = {
  id: string
  name: string
  tagline: string
  gender: string
  ethnicity: string
  ageRange: string
  faceUrl: string | null
}

/**
 * Smart-form generation mode — the one-screen alternative to the Creative
 * Studio node canvas. A broker picks a presenter, a property and a format,
 * optionally writes a brief, hits Generate and saves the result to the Drive.
 * The heavy lifting (prompt composition, presenter-face reuse) lives in the
 * quick-generate API; this is just the form.
 */
export default function QuickClient({ properties }: { properties: InventoryProperty[] }) {
  const t = useT()

  const [presenters, setPresenters] = useState<Presenter[]>([])
  const [presenterId, setPresenterId] = useState('')          // '' = none
  const [propertyId, setPropertyId] = useState('')
  const [format, setFormat] = useState<string>('insta_ad')
  const [brief, setBrief] = useState('')

  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [usedPresenter, setUsedPresenter] = useState(false)

  // Load the account's presenter personas (+ any saved reusable face) on mount.
  useEffect(() => {
    let alive = true
    fetch('/api/freehold/creative-studio/presenters', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d.presenters)) setPresenters(d.presenters as Presenter[]) })
      .catch(() => { /* form still works without presenters */ })
    return () => { alive = false }
  }, [])

  const property = useMemo(() => properties.find((p) => p.id === propertyId) ?? null, [properties, propertyId])

  async function generate() {
    setGenerating(true)
    try {
      const p = property
      const res = await fetch('/api/freehold/creative-studio/quick-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presenterId: presenterId || undefined,
          projectName: p?.name,
          area: p?.area,
          developer: p?.developer,
          unitType: p?.type,
          price: p?.startingPriceAED ? String(p.startingPriceAED) : undefined,
          brief: brief.trim() || undefined,
          format,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.url) { toast.error(d.error || t('cs.quick.failed')); return }
      setUrl(d.url as string)
      setUsedPresenter(Boolean(d.usedPresenter))
    } catch {
      toast.error(t('cs.quick.failed'))
    } finally {
      setGenerating(false)
    }
  }

  async function saveToDrive() {
    if (!url) return
    setSaving(true)
    const title = property?.name || 'Creative'
    try {
      // Google/Imagen returns a data: URL (save-image); the premium fal provider
      // returns an https URL — save that via the generic library POST instead.
      const res = url.startsWith('data:')
        ? await fetch('/api/freehold/drive/save-image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, dataUrl: url }),
          })
        : await fetch('/api/freehold/library', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'image', title, url }),
          })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !(d.item)) { toast.error(d.error || t('cs.quick.failed')); return }
      toast.success(t('cs.quick.saved'))
    } catch {
      toast.error(t('cs.quick.failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/15 text-gold"><Wand2 className="h-4 w-4" /></span>
            {t('cs.quick.title')}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{t('cs.quick.subtitle')}</p>
        </div>
        <Link href="/freehold-intelligence/creative-studio"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white">
          <Sparkles className="h-3.5 w-3.5" /> {t('cs.quick.openCanvas')}
        </Link>
      </div>

      <div className="space-y-4">
        {/* Presenter */}
        <section className="rounded-xl border border-line bg-surface-2 p-4">
          <label className="mb-2.5 block text-[13px] font-semibold text-slate-200">{t('cs.quick.presenter')}</label>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setPresenterId('')}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${presenterId === '' ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line bg-surface text-slate-300 hover:text-white'}`}>
              {t('cs.quick.none')}
            </button>
            {presenters.map((p) => {
              const active = presenterId === p.id
              return (
                <button key={p.id} type="button" onClick={() => setPresenterId(p.id)}
                  className={`inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 text-start transition ${active ? 'border-gold/50 bg-gold/10' : 'border-line bg-surface hover:border-white/20'}`}>
                  {p.faceUrl ? (
                    <span className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.faceUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      <span className="absolute -bottom-1 -end-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-surface-2" title={t('cs.quick.reusable')}>
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    </span>
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-[11px] font-semibold text-slate-400">
                      {p.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className={`block text-xs font-semibold ${active ? 'text-gold' : 'text-slate-200'}`}>{p.name}</span>
                    <span className="block text-[10px] text-slate-500">{p.faceUrl ? t('cs.quick.reusable') : t('cs.quick.noFace')}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Property */}
        <section className="rounded-xl border border-line bg-surface-2 p-4">
          <label htmlFor="q-property" className="mb-2.5 block text-[13px] font-semibold text-slate-200">{t('cs.quick.property')}</label>
          <select id="q-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40">
            <option value="">{t('cs.quick.noProperty')}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.area}</option>
            ))}
          </select>
        </section>

        {/* Format */}
        <section className="rounded-xl border border-line bg-surface-2 p-4">
          <label className="mb-2.5 block text-[13px] font-semibold text-slate-200">{t('cs.quick.format')}</label>
          <div className="flex flex-wrap gap-2.5">
            {IMAGE_FORMATS.map((f) => {
              const active = format === f.value
              return (
                <button key={f.value} type="button" onClick={() => setFormat(f.value)}
                  className={`rounded-xl border px-3.5 py-2.5 text-start transition ${active ? 'border-gold/50 bg-gold/10' : 'border-line bg-surface hover:border-white/20'}`}>
                  <span className={`block text-xs font-semibold ${active ? 'text-gold' : 'text-slate-200'}`}>{f.label}</span>
                  <span className="block text-[10px] text-slate-500">{f.hint}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Brief */}
        <section className="rounded-xl border border-line bg-surface-2 p-4">
          <label htmlFor="q-brief" className="mb-2.5 block text-[13px] font-semibold text-slate-200">{t('cs.quick.brief')}</label>
          <textarea id="q-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={3}
            placeholder={t('cs.quick.briefPh')}
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-gold/40" />
        </section>

        {/* Generate */}
        <button type="button" onClick={generate} disabled={generating}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50 sm:w-auto sm:min-w-[240px]">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('cs.quick.generating')}</> : <><Wand2 className="h-4 w-4" /> {t('cs.quick.generate')}</>}
        </button>

        {/* Result */}
        {url && (
          <section className="rounded-xl border border-line bg-surface-2 p-4">
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="mx-auto max-h-[60vh] w-full object-contain rounded-xl" />
            </div>
            {presenterId && !usedPresenter && (
              <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                {t('cs.quick.noPresenterUsed')}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button type="button" onClick={saveToDrive} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('cs.quick.save')}
              </button>
              <button type="button" onClick={generate} disabled={generating}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:text-white disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {t('cs.quick.regenerate')}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
