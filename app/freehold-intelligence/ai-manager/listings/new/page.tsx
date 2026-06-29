'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, ArrowLeft, Check, Image, Save } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const PROPERTY_TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'commercial']
const STATUSES = ['offPlan', 'ready', 'underConstruction', 'comingSoon', 'soldOut']

export default function NewListingPage() {
  const t = useT()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<{ generating: boolean; generated: boolean }>({
    generating: false,
    generated: false,
  })

  function handleGenerate() {
    setState({ generating: true, generated: false })
    setTimeout(() => {
      setState({ generating: false, generated: true })
    }, 1200)
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

      {/* Step 1 */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-slate-400">1</span>
          <h2 className="text-sm font-semibold text-slate-100">{t('plistnew.step1.title')}</h2>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {['name', 'area', 'developer', 'price'].map((field) => (
              <div key={field}>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t(`plistnew.field.${field}.label`)}</label>
                <input
                  type="text"
                  placeholder={t(`plistnew.field.${field}.ph`)}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-500/40 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.type.label')}</label>
              <select className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-slate-300 focus:border-rose-500/40 focus:outline-none">
                <option value="">{t('plistnew.field.type.ph')}</option>
                {PROPERTY_TYPES.map((pt) => <option key={pt}>{t(`plistnew.type.${pt}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.status.label')}</label>
              <select className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-slate-300 focus:border-rose-500/40 focus:outline-none">
                <option value="">{t('plistnew.field.status.ph')}</option>
                {STATUSES.map((s) => <option key={s}>{t(`plistnew.statusOpt.${s}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.bedrooms.label')}</label>
              <input
                type="text"
                placeholder={t('plistnew.field.bedrooms.ph')}
                className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-500/40 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-slate-400">2</span>
          <h2 className="text-sm font-semibold text-slate-100">{t('plistnew.step2.title')}</h2>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-6 space-y-5">
          <button
            onClick={handleGenerate}
            disabled={state.generating}
            className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/20 disabled:opacity-60"
          >
            {state.generating ? (
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

          {state.generated && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 text-xs text-gold">
                <Check className="h-3.5 w-3.5" />
                {t('plistnew.contentSuccess')}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.description.label')}</label>
                <textarea
                  rows={5}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-slate-100 focus:border-rose-500/40 focus:outline-none resize-none"
                  defaultValue={t('plistnew.field.description.value')}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.features.label')}</label>
                <textarea
                  rows={4}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-slate-100 focus:border-rose-500/40 focus:outline-none resize-none"
                  defaultValue={t('plistnew.field.features.value')}
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
                  className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-slate-100 focus:border-rose-500/40 focus:outline-none resize-none"
                  defaultValue={t('plistnew.field.seo.value')}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Step 3 */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm font-bold text-slate-400">3</span>
          <h2 className="text-sm font-semibold text-slate-100">{t('plistnew.step3.title')}</h2>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] bg-surface-2 py-10 gap-3">
            <Image className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-500">{t('plistnew.dropzone')}</p>
            <input
              type="file"
              ref={fileRef}
              multiple
              className="hidden"
              onChange={(e) => toast.success(t('plistnew.toast.filesAdded', { n: e.target.files?.length ?? 0 }))}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-white/[0.10] bg-surface-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-100 transition"
            >
              {t('plistnew.chooseFiles')}
            </button>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{t('plistnew.field.imageCount.label')}</label>
            <input
              type="number"
              placeholder="0"
              className="w-28 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-500/40 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          onClick={() => { toast.success(t('plistnew.toast.savedDraft')); router.push('/freehold-intelligence/ai-manager/listings') }}
          className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-surface-2 px-5 py-2.5 text-sm font-medium text-slate-400 transition hover:text-white"
        >
          <Save className="h-4 w-4" />
          {t('plistnew.saveDraft')}
        </button>
        <button
          onClick={() => { toast.success(t('plistnew.toast.published')); router.push('/freehold-intelligence/ai-manager/listings') }}
          className="flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rose-500/80"
        >
          <Check className="h-4 w-4" />
          {t('plistnew.publish')}
        </button>
      </div>

    </div>
  )
}
