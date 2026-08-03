'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, ArrowLeft, Check, Save, Info } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const PROPERTY_TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial']
const STATUSES = ['offPlan', 'ready', 'underConstruction', 'comingSoon', 'soldOut']

export default function NewListingPage() {
  const t = useT()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', area: '', developer: '', price: '', type: '', status: '', bedrooms: '' })
  const [content, setContent] = useState({ description: '', features: '', seo: '' })
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  async function handleGenerate() {
    if (!form.name.trim()) { toast.error(t('plistnew.toast.nameFirst')); return }
    setGenerating(true)
    try {
      const facts = [form.name, form.area && `in ${form.area}`, form.developer && `by ${form.developer}`,
        form.type, form.status, form.bedrooms && `${form.bedrooms} bedrooms`, form.price && `priced ${form.price}`]
        .filter(Boolean).join(', ')
      const prompt = `Write publication-ready copy for this Dubai property listing: ${facts}.\n`
        + `Return three clearly separated sections with these exact headers:\n`
        + `## DESCRIPTION\n(2 short paragraphs)\n## FEATURES\n(5-7 bullet points)\n## SEO\n(a single meta description under 160 characters)`
      const res = await fetch('/api/freehold/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok || !data?.text) throw new Error(data?.error || 'failed')
      const text: string = data.text
      const grab = (h: string, next: string[]) => {
        const re = new RegExp(`##\\s*${h}\\s*([\\s\\S]*?)(?=##\\s*(?:${next.join('|')})|$)`, 'i')
        return (text.match(re)?.[1] ?? '').trim()
      }
      const description = grab('DESCRIPTION', ['FEATURES', 'SEO']) || text
      const features = grab('FEATURES', ['SEO'])
      const seo = grab('SEO', []).slice(0, 160)
      setContent({ description, features, seo })
      setGenerated(true)
    } catch {
      toast.error(t('plistnew.toast.genFailed'))
    } finally { setGenerating(false) }
  }

  async function save(status: 'draft' | 'published') {
    if (!form.name.trim()) { toast.error(t('plistnew.toast.nameFirst')); return }
    setSaving(true)
    try {
      const body = [
        content.description && `## Description\n${content.description}`,
        content.features && `## Features\n${content.features}`,
        content.seo && `## SEO\n${content.seo}`,
        `## Details\n- Area: ${form.area || '—'}\n- Developer: ${form.developer || '—'}\n- Type: ${form.type || '—'}\n- Status: ${form.status || '—'}\n- Bedrooms: ${form.bedrooms || '—'}\n- Price: ${form.price || '—'}`,
      ].filter(Boolean).join('\n\n')
      const res = await fetch('/api/freehold/web-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'listing', name: form.name.trim(), slug: form.name.trim(), body, status }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || 'failed') }
      toast.success(status === 'published' ? t('plistnew.toast.published') : t('plistnew.toast.savedDraft'))
      router.push('/freehold-intelligence/ai-manager/listings')
    } catch {
      toast.error(t('plistnew.toast.saveFailed'))
    } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Back + Header */}
      <Link
        href="/freehold-intelligence/ai-manager/listings"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('plistnew.back')}
      </Link>

      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-slate-400/80 mb-3">
        <Sparkles className="h-3.5 w-3.5" />
        {t('plistnew.eyebrow')}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {t('plistnew.title')}
      </h1>

      {/* Scope distinction — this page ≠ ad landing pages */}
      <div className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-xs text-slate-300">
        <Info className="h-3.5 w-3.5 shrink-0 text-gold" />
        <span>{t('plistnew.scope.note')}</span>
        <Link
          href="/freehold-intelligence/lead-machine/landings"
          className="font-semibold text-gold transition hover:text-gold-bright"
        >
          {t('plistnew.scope.link')}
        </Link>
      </div>

      {/* Step 1 */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">1</span>
          <h2 className="text-sm font-semibold text-slate-100">{t('plistnew.step1.title')}</h2>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(['name', 'area', 'developer', 'price'] as const).map((field) => (
              <div key={field}>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t(`plistnew.field.${field}.label`)}</label>
                <input
                  type="text"
                  value={form[field]}
                  onChange={(e) => set(field, e.target.value)}
                  placeholder={t(`plistnew.field.${field}.ph`)}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.type.label')}</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-slate-300 focus:border-gold/40 focus:outline-none">
                <option value="">{t('plistnew.field.type.ph')}</option>
                {PROPERTY_TYPES.map((pt) => <option key={pt} value={t(`plistnew.type.${pt}`)}>{t(`plistnew.type.${pt}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.status.label')}</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-slate-300 focus:border-gold/40 focus:outline-none">
                <option value="">{t('plistnew.field.status.ph')}</option>
                {STATUSES.map((s) => <option key={s} value={t(`plistnew.statusOpt.${s}`)}>{t(`plistnew.statusOpt.${s}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.bedrooms.label')}</label>
              <input
                type="text"
                value={form.bedrooms}
                onChange={(e) => set('bedrooms', e.target.value)}
                placeholder={t('plistnew.field.bedrooms.ph')}
                className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-sm font-bold text-gold">2</span>
          <h2 className="text-sm font-semibold text-slate-100">{t('plistnew.step2.title')}</h2>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-6 space-y-5">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60"
          >
            {generating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-400/30 border-t-rose-400" />
                {t('plistnew.generating')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t('plistnew.generate')}
              </>
            )}
          </button>

          {generated && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 text-xs text-gold">
                <Check className="h-3.5 w-3.5" />
                {t('plistnew.contentSuccess')}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.description.label')}</label>
                <textarea
                  rows={5}
                  value={content.description}
                  onChange={(e) => setContent((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-slate-100 focus:border-gold/40 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.features.label')}</label>
                <textarea
                  rows={4}
                  value={content.features}
                  onChange={(e) => setContent((p) => ({ ...p, features: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-slate-100 focus:border-gold/40 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  {t('plistnew.field.seo.label')}
                  <span className="ml-1 text-slate-500">{t('plistnew.field.seo.limit')}</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={160}
                  value={content.seo}
                  onChange={(e) => setContent((p) => ({ ...p, seo: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-slate-100 focus:border-gold/40 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save('draft')}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-surface-2 px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {t('plistnew.saveDraft')}
        </button>
        <button
          onClick={() => save('published')}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          {t('plistnew.publish')}
        </button>
      </div>

    </div>
  )
}
