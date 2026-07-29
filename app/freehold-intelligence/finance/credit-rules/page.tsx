'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bot, Plus, Loader2, Trash2, Shield, Activity, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { SPEND_TEMPLATES, getSpendTemplate, recommendSpendTemplate, type SpendTemplateKey } from '@/lib/meta/spend-templates'

type Rule = {
  id: string; enabled: boolean; scope: string
  maxDailyBudgetAED: number; maxIncreasePerActionAED: number
  requireCplBelowAED?: number; requireQualityAtLeast?: number; requireMinLeads?: number
}
type Decision = {
  id: string; projectSlug: string; campaignId: string | null; brokerId: string
  action: string; outcome: string; reason: string
  spendBeforeAED: number | null; spendAfterAED: number | null; createdAt: string
}

const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-AE')}`
const num = (v: string): number | undefined => { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) ? n : undefined }

const OUTCOME_STYLE: Record<string, string> = {
  auto: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.08]',
  capped: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.08]',
  blocked: 'text-slate-300 border-line bg-surface',
}

export default function CreditRulesPage() {
  const t = useT()
  const [rules, setRules] = useState<Rule[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ scope: '', maxDailyBudgetAED: '', maxIncreasePerActionAED: '', requireCplBelowAED: '', requireQualityAtLeast: '', requireMinLeads: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, d] = await Promise.all([
        fetch('/api/freehold/ads/spend-rules', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({})),
        fetch('/api/freehold/ads/decisions', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({})),
      ])
      setRules(Array.isArray(r.rules) ? r.rules : [])
      setDecisions(Array.isArray(d.decisions) ? d.decisions : [])
    } catch { /* leave empty */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function addRule() {
    const maxDaily = num(form.maxDailyBudgetAED); const maxInc = num(form.maxIncreasePerActionAED)
    if (!maxDaily || !maxInc) { toast.error(t('cr.form.needCaps')); return }
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/ads/spend-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: form.scope.trim() || 'all',
          maxDailyBudgetAED: maxDaily, maxIncreasePerActionAED: maxInc,
          requireCplBelowAED: num(form.requireCplBelowAED),
          requireQualityAtLeast: num(form.requireQualityAtLeast),
          requireMinLeads: num(form.requireMinLeads),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || t('cr.form.failed')); return }
      toast.success(t('cr.form.saved'))
      setForm({ scope: '', maxDailyBudgetAED: '', maxIncreasePerActionAED: '', requireCplBelowAED: '', requireQualityAtLeast: '', requireMinLeads: '' })
      load()
    } catch { toast.error(t('cr.form.failed')) } finally { setSaving(false) }
  }

  async function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id))
    await fetch(`/api/freehold/ads/spend-rules/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  // Load a logical preset into the builder — the admin reviews and saves it.
  function applyTemplate(key: SpendTemplateKey) {
    const v = getSpendTemplate(key).values
    setForm({
      scope: '',
      maxDailyBudgetAED: String(v.maxDailyBudgetAED),
      maxIncreasePerActionAED: String(v.maxIncreasePerActionAED),
      requireCplBelowAED: String(v.requireCplBelowAED ?? ''),
      requireQualityAtLeast: String(v.requireQualityAtLeast ?? ''),
      requireMinLeads: String(v.requireMinLeads ?? ''),
    })
    toast.success(t('cr.tpl.loaded', { name: t(`cr.tpl.${key}.name`) }))
  }
  const recommended = recommendSpendTemplate({ hasExistingRules: rules.length > 0 })

  const field = 'w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-gold/30'
  const lbl = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500'

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-5 sm:px-6">
      <PageHeader eyebrow={t('cr.eyebrow')} Icon={Bot} title={t('cr.title')} subtitle={t('cr.subtitle')} />

      {/* Start from a template — logical presets, not account math */}
      <div className="mt-6">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
          <Sparkles className="h-3.5 w-3.5" /> {t('cr.tpl.heading')}
        </div>
        <p className="mb-3 text-[11px] leading-snug text-slate-500">{t('cr.tpl.sub')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SPEND_TEMPLATES.map((tpl) => {
            const rec = tpl.key === recommended
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => applyTemplate(tpl.key)}
                className={`rounded-2xl border p-3.5 text-left transition hover:border-gold/40 ${rec ? 'border-gold/40 bg-gold/[0.05]' : 'border-line bg-surface/50'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{t(`cr.tpl.${tpl.key}.name`)}</span>
                  {rec && (
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gold">
                      {t('cr.tpl.recommended')}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{t(`cr.tpl.${tpl.key}.why`)}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-slate-400">{t('cr.tpl.upTo', { daily: aed(tpl.values.maxDailyBudgetAED) })}</span>
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-slate-400">{t('cr.tpl.cpl', { v: aed(tpl.values.requireCplBelowAED ?? 0) })}</span>
                </div>
                <span className="mt-2.5 inline-block text-[11px] font-semibold text-gold">{t('cr.tpl.use')} →</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Rule builder */}
      <div className="mt-6 rounded-2xl border border-line bg-surface-2/40 p-4">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold"><Shield className="h-3.5 w-3.5" /> {t('cr.builder.title')}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><label className={lbl}>{t('cr.f.scope')}</label><input className={field} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder={t('cr.f.scopePh')} /></div>
          <div><label className={lbl}>{t('cr.f.maxDaily')}</label><input className={field} inputMode="numeric" value={form.maxDailyBudgetAED} onChange={(e) => setForm({ ...form, maxDailyBudgetAED: e.target.value })} placeholder="500" /></div>
          <div><label className={lbl}>{t('cr.f.maxInc')}</label><input className={field} inputMode="numeric" value={form.maxIncreasePerActionAED} onChange={(e) => setForm({ ...form, maxIncreasePerActionAED: e.target.value })} placeholder="150" /></div>
          <div><label className={lbl}>{t('cr.f.cplBelow')}</label><input className={field} inputMode="numeric" value={form.requireCplBelowAED} onChange={(e) => setForm({ ...form, requireCplBelowAED: e.target.value })} placeholder="120" /></div>
          <div><label className={lbl}>{t('cr.f.qualityAtLeast')}</label><input className={field} inputMode="numeric" value={form.requireQualityAtLeast} onChange={(e) => setForm({ ...form, requireQualityAtLeast: e.target.value })} placeholder="60" /></div>
          <div><label className={lbl}>{t('cr.f.minLeads')}</label><input className={field} inputMode="numeric" value={form.requireMinLeads} onChange={(e) => setForm({ ...form, requireMinLeads: e.target.value })} placeholder="5" /></div>
        </div>
        <button type="button" onClick={addRule} disabled={saving} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t('cr.builder.add')}
        </button>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">{t('cr.builder.hint')}</p>
      </div>

      {/* Active rules */}
      <h2 className="mt-8 text-sm font-semibold text-white">{t('cr.rules.title')}</h2>
      {loading ? (
        <div className="mt-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
      ) : rules.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-6 text-center text-xs text-slate-500">{t('cr.rules.empty')}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface/50 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  {r.scope === 'all' ? t('cr.rules.allProjects') : r.scope}
                  <span className="rounded-full border border-gold/25 bg-gold/[0.06] px-2 py-0.5 text-[10px] text-gold">{t('cr.rules.upTo', { daily: aed(r.maxDailyBudgetAED), move: aed(r.maxIncreasePerActionAED) })}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {t('cr.rules.if')} {[
                    r.requireCplBelowAED != null ? t('cr.rules.cplUnder', { v: aed(r.requireCplBelowAED) }) : null,
                    r.requireQualityAtLeast != null ? t('cr.rules.qualityOver', { v: String(r.requireQualityAtLeast) }) : null,
                    r.requireMinLeads != null ? t('cr.rules.minLeads', { v: String(r.requireMinLeads) }) : null,
                  ].filter(Boolean).join(' · ') || t('cr.rules.always')}
                </p>
              </div>
              <button type="button" onClick={() => removeRule(r.id)} title={t('cr.rules.remove')} className="shrink-0 text-slate-500 transition hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* AI decision feed */}
      <h2 className="mt-8 flex items-center gap-1.5 text-sm font-semibold text-white"><Activity className="h-4 w-4 text-gold" /> {t('cr.feed.title')}</h2>
      <p className="mt-0.5 text-[11px] text-slate-500">{t('cr.feed.subtitle')}</p>
      {decisions.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-6 text-center text-xs text-slate-500">{t('cr.feed.empty')}</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {decisions.map((d) => (
            <div key={d.id} className="rounded-xl border border-line bg-surface/50 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${OUTCOME_STYLE[d.outcome] ?? OUTCOME_STYLE.blocked}`}>{t(`cr.action.${d.action}`)}</span>
                <span className="text-[11px] text-slate-400">{d.projectSlug || '—'}</span>
                <span className="ml-auto text-[10px] text-slate-600">{d.brokerId}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{d.reason}</p>
              {(d.spendBeforeAED != null || d.spendAfterAED != null) && (
                <p className="mt-1 text-[10px] text-slate-500">{aed(d.spendBeforeAED ?? 0)} → {aed(d.spendAfterAED ?? 0)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
