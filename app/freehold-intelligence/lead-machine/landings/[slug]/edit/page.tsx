'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Sparkles, Loader2, ExternalLink, RefreshCw, Eye, EyeOff, FlaskConical, CheckCircle2, AlertTriangle, XCircle, X, Wand2, Send, ChevronDown, ChevronUp, Layers } from 'lucide-react'
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
  sections?: LpSection[]
}

type LpSection = { type: string; data: Record<string, unknown> }

type LpCheck = { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }
type TestReport = { ok: boolean; url?: string; passed?: number; warned?: number; failed?: number; checks: LpCheck[] }

// Fields the AI edit panel is allowed to touch — must match the ai-edit route.
const AI_FIELDS = ['headline', 'subheadline', 'ctaText', 'seoTitle', 'seoDescription'] as const
type AiField = (typeof AI_FIELDS)[number]
type AiTurn = { instruction: string; note: string; fields: AiField[] }

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
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<TestReport | null>(null)
  const [aiOpen, setAiOpen] = useState(true)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiTurns, setAiTurns] = useState<AiTurn[]>([])

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

  // Landing pre-flight — real server-side checks against the live /lp/<slug>.
  async function runTest() {
    setTesting(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}/test`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || t('lpe.test.failed')); return }
      setTest(d as TestReport)
    } catch { toast.error(t('lpe.test.failed')) }
    finally { setTesting(false) }
  }

  // AI chat-to-edit — instruction → Gemini → concrete field edits applied live.
  async function askAi(raw?: string) {
    const instruction = (raw ?? aiInstruction).trim()
    if (!instruction || !form || aiBusy) return
    setAiBusy(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}/ai-edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          current: {
            headline: form.headline,
            subheadline: form.subheadline,
            ctaText: form.ctaText,
            seoTitle: form.seoTitle,
            seoDescription: form.seoDescription,
          },
        }),
      })
      const d = await res.json()
      if (res.status !== 200) { toast.error(d.error || t('lpe.ai.failed')); return }
      if (d.unavailable) { toast.error(t('lpe.ai.unavailable')); return }
      const changes = (d.changes ?? {}) as Partial<Record<AiField, string>>
      const applied = AI_FIELDS.filter((f) => typeof changes[f] === 'string' && changes[f])
      if (applied.length === 0) { toast.error(t('lpe.ai.noChanges')); return }
      for (const f of applied) set(f, changes[f] as string)
      setAiTurns((prev) => [...prev, { instruction, note: String(d.note || ''), fields: applied }].slice(-5))
      setAiInstruction('')
      toast.success(t('lpe.ai.applied').replace('{count}', String(applied.length)))
    } catch { toast.error(t('lpe.ai.failed')) }
    finally { setAiBusy(false) }
  }

  // ── Layout canvas — reorder / show-hide the page's real section blocks ──────
  const [layoutSaving, setLayoutSaving] = useState(false)
  function sectionLabel(type: string) {
    return type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  function setSections(next: LpSection[]) { setForm((prev) => (prev ? { ...prev, sections: next } : prev)) }
  function moveSection(i: number, dir: -1 | 1) {
    if (!form?.sections) return
    const j = i + dir
    if (j < 0 || j >= form.sections.length) return
    const next = [...form.sections]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSections(next)
  }
  function toggleSection(i: number) {
    if (!form?.sections) return
    const next = form.sections.map((s, k) => (k === i ? { ...s, data: { ...s.data, _hidden: !s.data?._hidden } } : s))
    setSections(next)
  }
  async function saveLayout() {
    if (!form?.sections) return
    setLayoutSaving(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: form.sections }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || t('lpe.saveFailed')); return }
      if (d.landing?.sections) setSections(d.landing.sections as LpSection[])
      setPreviewKey((k) => k + 1)
      toast.success(t('lpe.layout.saved'))
    } catch { toast.error(t('lpe.saveFailed')) }
    finally { setLayoutSaving(false) }
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
          <button type="button" onClick={runTest} disabled={testing} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-60">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} {t('lpe.test.run')}
          </button>
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

      {test && (
        <div className="mb-5 rounded-2xl border border-line bg-surface-2/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FlaskConical className="h-4 w-4 text-gold" /> {t('lpe.test.title')}
              <span className="text-xs font-normal text-slate-500">
                {t('lpe.test.summary')
                  .replace('{pass}', String(test.passed ?? 0))
                  .replace('{warn}', String(test.warned ?? 0))
                  .replace('{fail}', String(test.failed ?? 0))}
              </span>
            </div>
            <button type="button" onClick={() => setTest(null)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {test.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-lg bg-surface/60 px-3 py-2">
                {c.status === 'pass' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  : c.status === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">{c.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
        {/* Editor */}
        <div className="space-y-5">
          {/* AI chat-to-edit */}
          <div className="rounded-2xl border border-gold/25 bg-gold/[0.04] p-4">
            <button type="button" onClick={() => setAiOpen((o) => !o)} className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/90">
                <Wand2 className="h-4 w-4" /> {t('lpe.ai.title')}
              </span>
              <ChevronDown className={`h-4 w-4 text-gold/70 transition ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
            {aiOpen && (
              <div className="mt-3 space-y-3">
                <p className="text-[11px] leading-relaxed text-slate-400">{t('lpe.ai.hint')}</p>
                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    className="fld resize-none"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); askAi() } }}
                    placeholder={t('lpe.ai.placeholder')}
                    disabled={aiBusy}
                  />
                  <button
                    type="button"
                    onClick={() => askAi()}
                    disabled={aiBusy || !aiInstruction.trim()}
                    className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-gold px-3.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50"
                  >
                    {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {t('lpe.ai.send')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[t('lpe.ai.chip.punchier'), t('lpe.ai.chip.arabic'), t('lpe.ai.chip.seo')].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => askAi(chip)}
                      disabled={aiBusy}
                      className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-gold/40 hover:text-white disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                {aiTurns.length > 0 && (
                  <ul className="space-y-1.5 border-t border-line/60 pt-3">
                    {aiTurns.map((turn, i) => (
                      <li key={i} className="rounded-lg bg-surface/60 px-3 py-2">
                        <p className="flex items-start gap-1.5 text-[11px] text-slate-400"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold/70" /> {turn.instruction}</p>
                        {turn.note && <p className="mt-1 text-[11px] text-slate-300">{turn.note}</p>}
                        <p className="mt-1 text-[10px] text-slate-500">{t('lpe.ai.updated')}: {turn.fields.map((f) => t(`lpe.f.${f === 'ctaText' ? 'cta' : f === 'seoDescription' ? 'seoDesc' : f}`)).join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Layout canvas — reorder / show-hide the page's real section blocks */}
          {form.sections && form.sections.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface-2/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Layers className="h-4 w-4" /> {t('lpe.layout.title')}
                </span>
                <button type="button" onClick={saveLayout} disabled={layoutSaving} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60">
                  {layoutSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('lpe.layout.save')}
                </button>
              </div>
              <ul className="space-y-1.5">
                {form.sections.map((s, i) => {
                  const hidden = s.data?._hidden === true
                  return (
                    <li key={`${s.type}-${i}`} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${hidden ? 'border-line/60 bg-surface/40 opacity-60' : 'border-line bg-surface/70'}`}>
                      <span className="flex flex-col">
                        <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => moveSection(i, 1)} disabled={i === form.sections!.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{sectionLabel(s.type)}</span>
                      <button type="button" onClick={() => toggleSection(i)} title={hidden ? t('lpe.layout.show') : t('lpe.layout.hide')} className="text-slate-500 hover:text-white">
                        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">{t('lpe.layout.hint')}</p>
            </div>
          )}

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
