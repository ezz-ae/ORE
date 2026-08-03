'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Check, Loader2, PackagePlus } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// Manual "add a real project to Inventory" — the capability existed at the data
// layer (upsertDashboardProject via POST /api/crm/projects) but had no UI entry
// point, which is the "add listing not working" report. This form creates a real
// project that then appears in Inventory, listings and filters, and can get a
// landing page.
const STATUSES = ['selling', 'off-plan', 'ready', 'coming-soon', 'sold-out']

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export default function NewProjectPage() {
  const t = useT()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', slug: '', area: '', developer: '', status: 'selling',
    priceFrom: '', priceTo: '', roi: '', paymentPlan: '', handoverDate: '',
    heroImage: '', description: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  function onName(v: string) {
    setForm((p) => ({ ...p, name: v, slug: slugTouched ? p.slug : slugify(v) }))
  }

  async function save() {
    const name = form.name.trim()
    const slug = (form.slug.trim() || slugify(name))
    if (!name) { toast.error(t('invnew.toast.nameRequired')); return }
    if (!slug) { toast.error(t('invnew.toast.slugRequired')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/crm/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, slug,
          area: form.area.trim() || null,
          developer: form.developer.trim() || null,
          status: form.status,
          priceFrom: form.priceFrom.trim() || null,
          priceTo: form.priceTo.trim() || null,
          roi: form.roi.trim() || null,
          paymentPlan: form.paymentPlan.trim() || null,
          handoverDate: form.handoverDate.trim() || null,
          heroImage: form.heroImage.trim() || null,
          description: form.description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('invnew.toast.failed'))
      toast.success(t('invnew.toast.created'))
      router.push(`/freehold-intelligence/inventory/${encodeURIComponent(data?.project?.slug || slug)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('invnew.toast.failed'))
    } finally { setSaving(false) }
  }

  const inputCls =
    'w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/40 focus:outline-none'
  const labelCls = 'mb-1.5 block text-xs font-medium text-slate-400'

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link
        href="/freehold-intelligence/inventory"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t('invnew.back')}
      </Link>

      <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-slate-400/80">
        <PackagePlus className="h-3.5 w-3.5" /> {t('invnew.eyebrow')}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-white">{t('invnew.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('invnew.subtitle')}</p>

      <div className="mt-8 space-y-4 rounded-2xl border border-line bg-surface-2 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t('invnew.field.name')}</label>
            <input value={form.name} onChange={(e) => onName(e.target.value)} placeholder={t('invnew.ph.name')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.slug')}</label>
            <input value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value) }} placeholder={t('invnew.ph.slug')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.area')}</label>
            <input value={form.area} onChange={(e) => set('area', e.target.value)} placeholder={t('invnew.ph.area')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.developer')}</label>
            <input value={form.developer} onChange={(e) => set('developer', e.target.value)} placeholder={t('invnew.ph.developer')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.status')}</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s} className="bg-surface">{t(`invnew.status.${s}`)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.handover')}</label>
            <input value={form.handoverDate} onChange={(e) => set('handoverDate', e.target.value)} placeholder={t('invnew.ph.handover')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.priceFrom')}</label>
            <input type="number" min={0} value={form.priceFrom} onChange={(e) => set('priceFrom', e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.priceTo')}</label>
            <input type="number" min={0} value={form.priceTo} onChange={(e) => set('priceTo', e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.roi')}</label>
            <input type="number" min={0} step="0.1" value={form.roi} onChange={(e) => set('roi', e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('invnew.field.paymentPlan')}</label>
            <input value={form.paymentPlan} onChange={(e) => set('paymentPlan', e.target.value)} placeholder={t('invnew.ph.paymentPlan')} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('invnew.field.heroImage')}</label>
          <input value={form.heroImage} onChange={(e) => set('heroImage', e.target.value)} placeholder={t('invnew.ph.heroImage')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t('invnew.field.description')}</label>
          <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('invnew.ph.description')} className={`${inputCls} resize-none`} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t('invnew.save')}
        </button>
        <Link
          href="/freehold-intelligence/inventory"
          className="rounded-xl border border-line-strong px-5 py-2.5 text-sm text-slate-400 transition hover:text-white"
        >
          {t('invnew.cancel')}
        </Link>
      </div>
    </div>
  )
}
