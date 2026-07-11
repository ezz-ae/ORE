'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Sparkles, Loader2, ExternalLink, RefreshCw, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useT, useI18n } from '@/lib/i18n/provider'

type Landing = {
  slug: string
  projectSlug: string
  headline: string
  subheadline: string
  heroImage: string
  ctaText: string
  status: 'draft' | 'published'
  publishFrom: string
  publishTo: string
  seoTitle: string
  seoDescription: string
  ogImage: string
  metaPixelId: string
  googleTagId: string
  googleConversionId: string
  tiktokPixelId: string
  updatedAt: string | null
}

export default function LandingEditorPage() {
  const t = useT()
  const { dir } = useI18n()
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || '')

  const [form, setForm] = useState<Landing | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regen, setRegen] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}`, { cache: 'no-store' })
      const d = await res.json()
      if (res.ok && d.landing) setForm(d.landing as Landing)
      else setNotFound(true)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }, [slug])

  useEffect(() => { if (slug) load() }, [slug, load])

  function set<K extends keyof Landing>(k: K, v: Landing[K]) {
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev))
  }

  async function save(nextStatus?: 'draft' | 'published') {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: nextStatus ?? form.status }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || t('lpe.saveFailed')); return }
      if (d.landing) setForm(d.landing as Landing)
      setPreviewKey((k) => k + 1)
      toast.success(d.landing?.status === 'pending_publish' ? t('lpe.pendingPublish') : t('lpe.saved'))
    } catch { toast.error(t('lpe.saveFailed')) }
    finally { setSaving(false) }
  }

  async function regenerate() {
    if (!form) return
    setRegen(true)
    try {
      const res = await fetch('/api/crm/landing-pages/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug: form.projectSlug || slug, slug, audience: 'generic' }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || d.detail || t('lpe.regenFailed')); return }
      await load()
      setPreviewKey((k) => k + 1)
      toast.success(t('lpe.regenDone'))
    } catch { toast.error(t('lpe.regenFailed')) }
    finally { setRegen(false) }
  }

  if (loading) return <div className="flex items-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
  if (notFound || !form) return (
    <div className="mx-auto max-w-md p-10 text-center">
      <p className="text-sm text-slate-400">{t('lpe.notFound')}</p>
      <Link href="/freehold-intelligence/lead-machine/landings" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold hover:opacity-80"><ArrowLeft className="h-4 w-4" /> {t('lpe.backToLandings')}</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" dir={dir}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/freehold-intelligence/lead-machine/landings" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> {t('lpe.backToLandings')}</Link>
          <h1 className="mt-2 truncate text-xl font-semibold text-white">{t('lpe.title')}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">/lp/{slug}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${form.status === 'published' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>{t(`lpe.status.${form.status}`)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={regenerate} disabled={regen} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60">
            {regen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {t('lpe.regen')}
          </button>
          <button type="button" onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('lpe.save')}
          </button>
          <button type="button" onClick={() => save(form.status === 'published' ? 'draft' : 'published')} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-60">
            {form.status === 'published' ? t('lpe.unpublish') : t('lpe.publish')}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
        {/* Editor */}
        <div className="space-y-5">
          <Section title={t('lpe.grp.content')}>
            <Field label={t('lpe.f.headline')}><input className="fld" value={form.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
            <Field label={t('lpe.f.subheadline')}><textarea rows={2} className="fld resize-none" value={form.subheadline} onChange={(e) => set('subheadline', e.target.value)} /></Field>
            <Field label={t('lpe.f.cta')}><input className="fld" value={form.ctaText} onChange={(e) => set('ctaText', e.target.value)} /></Field>
            <Field label={t('lpe.f.heroImage')}>
              <input className="fld" value={form.heroImage} onChange={(e) => set('heroImage', e.target.value)} placeholder="https://…" />
              {form.heroImage && form.heroImage !== '/logo.png' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.heroImage} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" />
              )}
            </Field>
          </Section>

          <Section title={t('lpe.grp.seo')}>
            <Field label={t('lpe.f.seoTitle')}><input className="fld" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} /></Field>
            <Field label={t('lpe.f.seoDesc')}><textarea rows={2} className="fld resize-none" value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} /></Field>
            <Field label={t('lpe.f.ogImage')}><input className="fld" value={form.ogImage} onChange={(e) => set('ogImage', e.target.value)} placeholder="https://…" /></Field>
          </Section>

          <Section title={t('lpe.grp.tracking')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('lpe.f.metaPixel')}><input className="fld" value={form.metaPixelId} onChange={(e) => set('metaPixelId', e.target.value)} placeholder="000000000000000" /></Field>
              <Field label={t('lpe.f.tiktokPixel')}><input className="fld" value={form.tiktokPixelId} onChange={(e) => set('tiktokPixelId', e.target.value)} /></Field>
              <Field label={t('lpe.f.googleTag')}><input className="fld" value={form.googleTagId} onChange={(e) => set('googleTagId', e.target.value)} placeholder="G-XXXXXXX" /></Field>
              <Field label={t('lpe.f.googleConv')}><input className="fld" value={form.googleConversionId} onChange={(e) => set('googleConversionId', e.target.value)} placeholder="AW-XXXXXXX" /></Field>
            </div>
          </Section>

          <Section title={t('lpe.grp.schedule')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('lpe.f.publishFrom')}><input type="datetime-local" className="fld" value={form.publishFrom} onChange={(e) => set('publishFrom', e.target.value)} /></Field>
              <Field label={t('lpe.f.publishTo')}><input type="datetime-local" className="fld" value={form.publishTo} onChange={(e) => set('publishTo', e.target.value)} /></Field>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">{t('lpe.scheduleHint')}</p>
          </Section>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><Eye className="h-3.5 w-3.5" /> {t('lpe.livePreview')}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"><RefreshCw className="h-3 w-3" /> {t('lpe.refresh')}</button>
              <a href={`/lp/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gold/70 hover:text-gold">{t('lpe.openTab')} <ExternalLink className="h-3 w-3" /></a>
            </div>
          </div>
          <iframe key={previewKey} src={`/lp/${slug}`} title="preview" className="h-[70vh] w-full rounded-xl border border-line bg-white lg:h-[calc(100%-2rem)]" />
          <p className="mt-2 text-[11px] text-slate-600">{t('lpe.previewNote')}</p>
        </div>
      </div>

      <style jsx>{`.fld{width:100%;border-radius:12px;border:1px solid var(--line,#26262b);background:var(--surface-2,#151518);padding:10px 12px;font-size:14px;color:#fff;outline:none}.fld::placeholder{color:#64748b}.fld:focus{border-color:rgba(212,175,55,.4)}`}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold/80">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
