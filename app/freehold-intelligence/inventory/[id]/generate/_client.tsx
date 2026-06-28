'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Check, ArrowLeft, Eye, Globe, ChevronDown, ChevronUp,
  RotateCcw, Phone, Loader2, ExternalLink,
} from 'lucide-react'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { useT } from '@/lib/i18n/provider'

type TFn = (key: string, vars?: Record<string, string | number>) => string

function fmtPrice(n: number | null): string {
  if (n === null) return 'Competitive Pricing'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

type Section = 'hero' | 'highlights' | 'payment' | 'form' | null

interface LandingConfig {
  headline: string
  subheadline: string
  highlights: [string, string, string, string]
  ctaText: string
  leadFields: { name: boolean; phone: boolean; email: boolean; nationality: boolean; budget: boolean }
  showPaymentPlan: boolean
  template: 'investor' | 'luxury' | 'end_user'
}

function buildConfig(prop: InventoryProperty): LandingConfig {
  return {
    headline: `Invest in ${prop.name}`,
    subheadline: `${prop.area} · ${prop.developer} · From ${fmtPrice(prop.startingPriceAED)}`,
    highlights: [
      prop.roi !== null ? `Up to ${prop.roi.toFixed(1)}% annual rental yield` : 'Strong rental returns in prime Dubai',
      `${prop.bedrooms} bedroom ${prop.type}s${prop.sizeRange ? ` · ${prop.sizeRange}` : ''}`,
      prop.paymentPlan ? `${prop.paymentPlan} payment plan` : 'Flexible payment options available',
      prop.handoverYear ? `Handover ${prop.handoverYear} — ${prop.availableUnits ?? 'limited'} units available` : `Prime location in ${prop.area}, Dubai`,
    ],
    ctaText: 'Request Brochure & Pricing',
    leadFields: { name: true, phone: true, email: true, nationality: false, budget: false },
    showPaymentPlan: !!prop.paymentPlan,
    template: 'investor',
  }
}

const AI_VARIANTS: Record<string, (p: InventoryProperty) => Partial<LandingConfig>> = {
  investor: (p) => ({
    headline: `${p.name}: ${p.roi ? p.roi.toFixed(1) + '% Yield Investment' : 'Prime Investment Opportunity'}`,
    subheadline: `${p.developer} · ${p.area} · ${p.bedrooms} BR · From ${fmtPrice(p.startingPriceAED)}`,
    highlights: [
      p.roi ? `${p.roi.toFixed(1)}% projected net rental yield — above Dubai average` : 'Above-average returns in established Dubai corridor',
      `${p.bedrooms} bedroom residences — high tenant demand in ${p.area}`,
      p.paymentPlan ? `${p.paymentPlan} — developer-backed payment plan` : 'Competitive pricing with flexible payment options',
      `Golden Visa eligible — AED 2M+ threshold met in most configurations`,
    ] as [string, string, string, string],
    ctaText: 'Get Investment Analysis',
  }),
  luxury: (p) => ({
    headline: `${p.name} — Exclusive ${p.area} Living`,
    subheadline: `Crafted by ${p.developer} · ${p.bedrooms} residences · ${p.sizeRange}`,
    highlights: [
      `Prestigious ${p.area} address — among Dubai's most sought-after locations`,
      `${p.bedrooms} bedroom ${p.type}s designed for discerning lifestyles`,
      `Award-winning ${p.developer} craftsmanship and build quality`,
      `Exceptional views and world-class amenities included`,
    ] as [string, string, string, string],
    ctaText: 'Schedule Private Viewing',
  }),
  end_user: (p) => ({
    headline: `Your New Home in ${p.area}`,
    subheadline: `Move-in ready ${p.type}s by ${p.developer} — from ${fmtPrice(p.startingPriceAED)}`,
    highlights: [
      `${p.bedrooms} bedroom homes — ideal for families and professionals`,
      `${p.area}: vibrant community with schools, retail, and lifestyle`,
      p.paymentPlan ? `Easy ${p.paymentPlan} — own your home today` : 'Competitive pricing and flexible financing available',
      p.handoverYear ? `Ready ${p.handoverYear} — start your life in Dubai now` : 'Ready to move — no waiting required',
    ] as [string, string, string, string],
    ctaText: 'Book a Viewing',
  }),
}

function PhonePreview({ prop, config, t }: { prop: InventoryProperty; config: LandingConfig; t: TFn }) {
  return (
    <div className="mx-auto w-[260px] rounded-[36px] border-[5px] border-white/15 bg-surface shadow-2xl overflow-hidden">
      <div className="flex justify-center py-2">
        <div className="h-1.5 w-12 rounded-full bg-white/10" />
      </div>
      <div className="h-[520px] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-center justify-between bg-surface px-3 py-2 border-b border-line">
          <span className="text-[7px] font-bold tracking-wide text-gold">FREEHOLD</span>
          <span className="flex items-center gap-0.5 rounded-full border border-gold/20 px-1.5 py-0.5 text-[6px] text-gold">
            <Phone className="h-2 w-2" /> {t('inv.gen.preview.call')}
          </span>
        </div>
        <div className="px-4 pt-6 pb-4" style={{ background: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(212,175,55,0.15) 0%, transparent 60%)' }}>
          <div className="flex gap-1 mb-2 flex-wrap">
            <span className="rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[6px] text-gold">{prop.area}</span>
            <span className="rounded-full border border-white/[0.10] bg-surface-2 px-1.5 py-0.5 text-[6px] text-slate-400">{prop.developer}</span>
          </div>
          <div className="text-xs font-bold text-white leading-tight">{config.headline}</div>
          <div className="mt-0.5 text-[7px] text-slate-500">{config.subheadline}</div>
          <button className="mt-3 w-full rounded-[6px] bg-gold py-1.5 text-[7px] font-bold text-ink">
            {config.ctaText} →
          </button>
        </div>
        <div className="grid grid-cols-4 border-y border-line bg-[#0D1321]">
          {[prop.bedrooms + 'BR', prop.sizeRange?.split('–')[0] || '—', prop.roi ? prop.roi.toFixed(1)+'%' : '—', String(prop.handoverYear || '—')].map((v, i) => (
            <div key={i} className="border-r border-line last:border-r-0 py-2 text-center">
              <div className="text-[9px] font-semibold text-slate-300">{v}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-4 space-y-1.5">
          {config.highlights.slice(0, 3).map((h, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-[8px] border border-line bg-surface-2 px-2 py-1.5">
              <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-gold/30 bg-gold/10 flex items-center justify-center">
                <Check className="h-1.5 w-1.5 text-gold" />
              </div>
              <span className="text-[7px] text-slate-400 leading-tight">{h}</span>
            </div>
          ))}
        </div>
        <div className="mx-4 mb-4 rounded-[12px] border border-gold/15 bg-surface p-3">
          <div className="text-[8px] font-bold text-white mb-2">{t('inv.gen.preview.requestPricing')}</div>
          {([t('inv.gen.preview.fullName'), t('inv.gen.preview.phoneWhatsapp'), config.leadFields.email ? t('inv.gen.preview.email') : null] as (string | null)[]).filter(Boolean).map((f) => (
            <div key={f!} className="mb-1.5 h-5 rounded-[4px] border border-white/[0.10] bg-surface-2 px-1.5 flex items-center">
              <span className="text-[6px] text-slate-600">{f}…</span>
            </div>
          ))}
          <div className="mt-2 rounded-[6px] bg-gold py-1.5 text-center text-[7px] font-bold text-ink">
            {config.ctaText}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionPanel({
  title, open, onToggle, children,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface-2 overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={onToggle}
      >
        <span className="text-sm font-medium text-white">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {open && <div className="border-t border-line px-5 pb-5 pt-4">{children}</div>}
    </div>
  )
}

export function GenerateClient({ prop }: { prop: InventoryProperty }) {
  const t = useT()
  const [config, setConfig] = useState<LandingConfig>(() => buildConfig(prop))
  const [open, setOpen] = useState<Section>('hero' as Section)
  const [redesigning, setRedesigning] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishStep, setPublishStep] = useState('')
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null)
  const [pendingAuth, setPendingAuth] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiBox, setShowAiBox] = useState(false)

  function toggleSection(s: Exclude<Section, null>) {
    setOpen((prev) => (prev === s ? null : s))
  }

  function aiRedesign(variant: 'investor' | 'luxury' | 'end_user') {
    setRedesigning(true)
    setTimeout(() => {
      const patch = AI_VARIANTS[variant](prop)
      setConfig((prev) => ({ ...prev, ...patch, template: variant }))
      setRedesigning(false)
    }, 1400)
  }

  function handleCustomAi() {
    if (!aiPrompt.trim()) return
    setRedesigning(true)
    setTimeout(() => {
      const variant = aiPrompt.toLowerCase().includes('luxury') ? 'luxury'
        : aiPrompt.toLowerCase().includes('end user') || aiPrompt.toLowerCase().includes('family') ? 'end_user'
        : 'investor'
      const patch = AI_VARIANTS[variant](prop)
      setConfig((prev) => ({ ...prev, ...patch, template: variant }))
      setAiPrompt('')
      setShowAiBox(false)
      setRedesigning(false)
    }, 1600)
  }

  async function regenerateAi() {
    if (!publishedSlug) return
    setAiGenerating(true)
    try {
      await fetch('/api/crm/landing-pages/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: prop.slug,
          audience: config.template,
          slug: publishedSlug,
        }),
      })
    } finally {
      setAiGenerating(false)
    }
  }

  async function publish() {
    setPublishing(true)
    setPublishError('')
    try {
      setPublishStep(t('inv.gen.step.creating'))
      const createRes = await fetch('/api/crm/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: prop.slug,
          campaignName: config.template,
          headline: config.headline,
          subheadline: config.subheadline,
          ctaText: config.ctaText,
          status: 'published',
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData?.error || t('inv.gen.err.createFailed'))

      setPendingAuth(Boolean(createData.pendingPublish))
      const newSlug: string = createData.slug
      setPublishStep(t('inv.gen.step.generating'))

      await fetch('/api/crm/landing-pages/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: prop.slug,
          audience: config.template,
          slug: newSlug,
        }),
      }).catch(() => null)

      setPublishedSlug(newSlug)
      setPublishedUrl(`/lp/${newSlug}`)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : t('inv.gen.err.publishFailed'))
    } finally {
      setPublishStep('')
      setPublishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7">
        <Link
          href={`/freehold-intelligence/inventory/${prop.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t('inv.gen.back', { name: prop.name })}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold text-white">{t('inv.gen.editorTitle')}</h1>
            <p className="mt-1 text-xs text-slate-500">{prop.name} · {prop.area} · {prop.developer}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {publishedUrl && (
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs text-slate-400 transition hover:text-slate-100"
              >
                <Eye className="h-3.5 w-3.5" /> {t('inv.gen.viewLivePage')}
              </a>
            )}
            <button
              onClick={publish}
              disabled={publishing || !!publishedUrl}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition ${
                publishedUrl
                  ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                  : 'bg-gold text-ink hover:bg-[#F0CB67]'
              }`}
            >
              {publishing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {publishStep || t('inv.gen.publishing')}</>
              ) : publishedUrl ? (
                <><Check className="h-3.5 w-3.5" /> {t('inv.gen.published')}</>
              ) : (
                <><Globe className="h-3.5 w-3.5" /> {t('inv.gen.createPublish')}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {publishedUrl && (
        <div className={`mb-6 flex flex-wrap items-center gap-3 rounded-[14px] border px-5 py-3.5 ${pendingAuth ? 'border-amber-400/25 bg-amber-400/[0.05]' : 'border-emerald-400/20 bg-emerald-400/[0.05]'}`}>
          <Check className={`h-4 w-4 shrink-0 ${pendingAuth ? 'text-amber-400' : 'text-emerald-400'}`} />
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium ${pendingAuth ? 'text-amber-300' : 'text-emerald-300'}`}>
              {pendingAuth ? t('inv.gen.pendingAuth') : t('inv.gen.isLive')}
            </span>
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
              className={`font-mono text-xs underline underline-offset-2 ${pendingAuth ? 'text-amber-400/80 hover:text-amber-400' : 'text-emerald-400/80 hover:text-emerald-400'}`}>
              freeholdproperty.ae{publishedUrl}
            </a>
          </div>
          <button
            onClick={regenerateAi}
            disabled={aiGenerating}
            className="shrink-0 flex items-center gap-1 rounded-full border border-gold/20 px-3 py-1 text-xs text-gold/70 transition hover:bg-gold/10 disabled:opacity-50"
          >
            {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            {aiGenerating ? t('inv.gen.regenerating') : t('inv.gen.regenAi')}
          </button>
          {publishedSlug && (
            <Link
              href={`/crm/landing-pages/${publishedSlug}`}
              className="shrink-0 flex items-center gap-1 rounded-full border border-white/[0.12] px-3 py-1 text-xs text-slate-400 transition hover:text-slate-200"
            >
              {t('inv.gen.editInCrm')}
            </Link>
          )}
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 rounded-full border border-emerald-400/20 px-3 py-1 text-xs text-emerald-400/70 hover:bg-emerald-400/10">
            {t('inv.gen.open')} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {publishError && (
        <div className="mb-6 rounded-[14px] border border-red-400/20 bg-red-400/[0.05] px-5 py-3.5 text-sm text-red-300">
          {publishError}
        </div>
      )}

      <div className="flex gap-8 items-start">
        <div className="flex-1 min-w-0 space-y-3">

          <div className="rounded-[16px] border border-gold/20 bg-gold/[0.04] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="text-sm font-medium text-gold">{t('inv.gen.aiFullRedesign')}</span>
              </div>
              <button
                onClick={() => setShowAiBox(!showAiBox)}
                className="text-xs text-slate-500 hover:text-slate-400 transition"
              >
                {showAiBox ? t('inv.gen.usePresets') : t('inv.gen.customPrompt')}
              </button>
            </div>
            {!showAiBox ? (
              <div className="flex flex-wrap gap-2">
                {(['investor', 'luxury', 'end_user'] as const).map((v) => (
                  <button key={v} onClick={() => aiRedesign(v)} disabled={redesigning}
                    className="rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1.5 text-xs capitalize text-gold/80 transition hover:bg-gold/15 disabled:opacity-50">
                    {redesigning ? '…' : t(`inv.gen.preset.${v}`)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomAi()}
                  placeholder={t('inv.gen.customAiPlaceholder')}
                  className="flex-1 rounded-[10px] border border-white/[0.10] bg-surface-2 px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-gold/30"
                />
                <button onClick={handleCustomAi} disabled={redesigning || !aiPrompt.trim()}
                  className="rounded-[10px] bg-gold px-4 py-2 text-xs font-medium text-ink transition hover:bg-[#F0CB67] disabled:opacity-50">
                  {redesigning ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
            {redesigning && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gold/60">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Redesigning all sections…
              </div>
            )}
          </div>

          <SectionPanel title="Hero Section" open={open === 'hero'} onToggle={() => toggleSection('hero')}>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Headline</label>
                <input value={config.headline} onChange={(e) => setConfig((p) => ({ ...p, headline: e.target.value }))}
                  className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Subheadline</label>
                <input value={config.subheadline} onChange={(e) => setConfig((p) => ({ ...p, subheadline: e.target.value }))}
                  className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/30" />
              </div>
            </div>
          </SectionPanel>

          <SectionPanel title="Key Highlights" open={open === 'highlights'} onToggle={() => toggleSection('highlights')}>
            <div className="space-y-3">
              {config.highlights.map((h, i) => (
                <div key={i}>
                  <label className="mb-1 block text-xs text-slate-500">Highlight {i + 1}</label>
                  <input value={h}
                    onChange={(e) => {
                      const next = [...config.highlights] as [string, string, string, string]
                      next[i] = e.target.value
                      setConfig((p) => ({ ...p, highlights: next }))
                    }}
                    className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-sm text-white outline-none focus:border-gold/30" />
                </div>
              ))}
            </div>
          </SectionPanel>

          <SectionPanel title="Payment Plan" open={open === 'payment'} onToggle={() => toggleSection('payment')}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-200">Show payment plan section</div>
                <div className="text-xs text-slate-500">{prop.paymentPlan ?? 'No plan configured for this property'}</div>
              </div>
              <button
                onClick={() => setConfig((p) => ({ ...p, showPaymentPlan: !p.showPaymentPlan }))}
                className={`relative h-6 w-11 rounded-full border transition ${
                  config.showPaymentPlan ? 'border-gold/40 bg-gold/20' : 'border-white/[0.1] bg-surface-2'
                }`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full border transition-all ${
                  config.showPaymentPlan ? 'left-5 border-gold/60 bg-gold' : 'left-0.5 border-white/20 bg-white/30'
                }`} />
              </button>
            </div>
          </SectionPanel>

          <SectionPanel title="Lead Form" open={open === 'form'} onToggle={() => toggleSection('form')}>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">CTA Button Text</label>
                <input value={config.ctaText} onChange={(e) => setConfig((p) => ({ ...p, ctaText: e.target.value }))}
                  className="w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/30" />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Form Fields</div>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(config.leadFields) as [keyof typeof config.leadFields, boolean][]).map(([key, val]) => (
                    <label key={key}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition select-none ${
                        val ? 'border-gold/30 bg-gold/[0.07] text-gold/90' : 'border-line text-slate-500'
                      }`}>
                      <input type="checkbox" className="sr-only" checked={val}
                        onChange={() => setConfig((p) => ({ ...p, leadFields: { ...p.leadFields, [key]: !val } }))} />
                      {val && <Check className="h-3 w-3 text-gold" />}
                      {key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </SectionPanel>

          <div className="rounded-[16px] border border-line bg-surface-2 px-5 py-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-600">Property Data</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {[
                ['Status', prop.status.replace('_', ' ')],
                ['Bedrooms', prop.bedrooms + ' BR'],
                ['Size', prop.sizeRange],
                ['Price from', fmtPrice(prop.startingPriceAED)],
                ['ROI', prop.roi ? prop.roi.toFixed(1) + '%' : '—'],
                ['Ad Readiness', prop.adReadiness + '%'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-300 capitalize">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:block shrink-0 sticky top-6">
          <div className="mb-3 text-center text-xs text-slate-600 uppercase tracking-wider">Live Preview</div>
          <PhonePreview prop={prop} config={config} t={t} />
          {publishedUrl && (
            <div className="mt-4 text-center">
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-2 text-xs text-emerald-400 transition hover:bg-emerald-400/10">
                <Eye className="h-3.5 w-3.5" /> Open live page
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
