'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Settings as SettingsIcon, Sparkles, Database, Zap, Shield,
  AlertCircle, ChevronRight, Bell, Globe, Lock, Users,
  Sliders,
} from 'lucide-react'
import { PageHeader, buttonClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiAction {
  id: string
  role: 'Owner' | 'Admin'
  enabled: boolean
}

interface CrmField {
  id: string
  srcKey: string
  tgtKey: string
  mapped: boolean
}

interface LmThreshold {
  id: string
  value: number
  min: number
  max: number
  step: number
  unit: string
}

// ─── Static data ──────────────────────────────────────────────────────────────

const INITIAL_AI_ACTIONS: AiAction[] = [
  { id: 'send_whatsapp',    role: 'Owner', enabled: true  },
  { id: 'post_social',      role: 'Admin', enabled: false },
  { id: 'launch_ad',        role: 'Owner', enabled: true  },
  { id: 'create_landing',   role: 'Admin', enabled: true  },
  { id: 'export_crm',       role: 'Owner', enabled: false },
  { id: 'assign_leads',     role: 'Admin', enabled: true  },
]

const INITIAL_CRM_FIELDS: CrmField[] = [
  { id: 'hubspot_deal_stage', srcKey: 'hubspot_deal_stage', tgtKey: 'pipeline_stage',     mapped: true  },
  { id: 'hubspot_lead_score', srcKey: 'hubspot_lead_score', tgtKey: 'intent_score',       mapped: true  },
  { id: 'meta_lead_form',     srcKey: 'meta_lead_form',     tgtKey: 'source_paid_social', mapped: true  },
  { id: 'google_lead_form',   srcKey: 'google_lead_form',   tgtKey: 'source_paid_search', mapped: true  },
  { id: 'whatsapp_contact',   srcKey: 'whatsapp_contact',   tgtKey: 'source_whatsapp',    mapped: false },
  { id: 'hubspot_owner',      srcKey: 'hubspot_owner',      tgtKey: 'agent_assignment',   mapped: false },
]

const INITIAL_THRESHOLDS: LmThreshold[] = [
  { id: 'min_ad_readiness',   value: 80,  min: 0,  max: 100, step: 5,  unit: '%'   },
  { id: 'min_landing_ready',  value: 80,  min: 0,  max: 100, step: 5,  unit: '%'   },
  { id: 'auto_block_score',   value: 30,  min: 0,  max: 100, step: 5,  unit: 'pts' },
  { id: 'ad_req_expiry',      value: 7,   min: 1,  max: 30,  step: 1,  unit: 'd'   },
  { id: 'lead_sla_hours',     value: 4,   min: 1,  max: 48,  step: 1,  unit: 'h'   },
  { id: 'max_cpl',            value: 120, min: 50, max: 500, step: 10, unit: 'AED' },
]

const NOTIFICATION_SETTINGS = [
  { id: 'new_lead',        enabled: true  },
  { id: 'cpl_alert',       enabled: true  },
  { id: 'campaign_paused', enabled: false },
  { id: 'budget_80pct',    enabled: true  },
  { id: 'landing_live',    enabled: false },
  { id: 'lead_overdue',    enabled: true  },
]

// Brand fields — `labelKey` maps to the dictionary; `value` is real config data.
const BRAND_SETTINGS = [
  { labelKey: 'settings.brand.companyName',   value: 'Freehold Property Dubai' },
  { labelKey: 'settings.brand.primaryDomain', value: 'freeholdproperty.ae' },
  { labelKey: 'settings.brand.crmTimezone',   value: 'Asia/Dubai (UTC+4)' },
]

// Theme options — `value` is the persisted identifier; `labelKey` is the display label.
const THEME_OPTIONS = [
  { value: 'Dark (current)', labelKey: 'settings.brand.theme.dark',   bg: 'bg-surface'   },
  { value: 'Darker',         labelKey: 'settings.brand.theme.darker', bg: 'bg-black'     },
  { value: 'Navy',           labelKey: 'settings.brand.theme.navy',   bg: 'bg-[#0a0f1e]' },
]

// ─── Toggle component ────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-pressed={on}
      className={[
        'relative h-6 w-11 rounded-full border transition-all duration-200',
        on ? 'border-gold/40 bg-gold/20' : 'border-line-strong bg-surface-2',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full border transition-all duration-200',
          on ? 'left-5 border-gold/60 bg-gold' : 'left-0.5 border-line-strong bg-slate-400',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, accent, title, sub }: {
  icon: React.ElementType
  accent: string
  title: string
  sub: string
}) {
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${accent}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="mt-1 text-sm text-slate-400">{sub}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [aiActions,   setAiActions]   = useState<AiAction[]>(INITIAL_AI_ACTIONS)
  const [crmFields,   setCrmFields]   = useState<CrmField[]>(INITIAL_CRM_FIELDS)
  const [thresholds,  setThresholds]  = useState<LmThreshold[]>(INITIAL_THRESHOLDS)
  const [notifs,      setNotifs]      = useState(NOTIFICATION_SETTINGS)
  const [theme,       setTheme]       = useState('Dark (current)')
  const [brand,       setBrand]       = useState<Record<string, string>>(
    () => Object.fromEntries(BRAND_SETTINGS.map((s) => [s.labelKey, s.value])),
  )
  const [activeTab,   setActiveTab]   = useState<'ai' | 'crm' | 'thresholds' | 'notifications' | 'brand'>('ai')
  const loaded = useRef(false)
  const t = useT()

  // Load saved workspace settings.
  useEffect(() => {
    fetch('/api/freehold/settings', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const s = d?.settings
        if (s?.aiActions) setAiActions(s.aiActions)
        if (s?.crmFields) setCrmFields(s.crmFields)
        if (s?.thresholds) setThresholds(s.thresholds)
        if (s?.notifs) setNotifs(s.notifs)
        if (typeof s?.theme === 'string') setTheme(s.theme)
        if (s?.brand && typeof s.brand === 'object') setBrand((prev) => ({ ...prev, ...s.brand }))
      })
      .catch(() => {})
      .finally(() => { loaded.current = true })
  }, [])

  // Persist (debounced) after initial load.
  useEffect(() => {
    if (!loaded.current) return
    const timer = setTimeout(() => {
      fetch('/api/freehold/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiActions, crmFields, thresholds, notifs, theme, brand }),
      })
        .then((r) => { if (!r.ok) throw new Error() })
        .catch(() => toast.error(t('settings.general.saveError')))
    }, 400)
    return () => clearTimeout(timer)
  }, [aiActions, crmFields, thresholds, notifs, theme, brand, t])

  const unmappedCount = crmFields.filter((f) => !f.mapped).length

  function toggleAiAction(id: string) {
    setAiActions((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }

  function toggleCrmField(idx: number) {
    setCrmFields((prev) => prev.map((f, i) => i === idx ? { ...f, mapped: !f.mapped } : f))
  }

  function updateThreshold(id: string, value: number) {
    setThresholds((prev) => prev.map((th) => th.id === id ? { ...th, value } : th))
  }

  function toggleNotif(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, enabled: !n.enabled } : n))
  }

  const TABS = [
    { id: 'ai'            as const, label: t('settings.general.tab.ai'),            icon: Sparkles },
    { id: 'crm'           as const, label: t('settings.general.tab.crm'),           icon: Database  },
    { id: 'thresholds'    as const, label: t('settings.general.tab.thresholds'),    icon: Sliders   },
    { id: 'notifications' as const, label: t('settings.general.tab.notifications'), icon: Bell      },
    { id: 'brand'         as const, label: t('settings.general.tab.brand'),         icon: Globe     },
  ]

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">

        <PageHeader
          eyebrow={t('settings.general.eyebrow')}
          Icon={SettingsIcon}
          title={t('settings.general.title')}
          subtitle={t('settings.general.subtitle')}
          className="mb-8"
        />

        {/* ── Tab bar ── */}
        <div className="mb-8 flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition',
                activeTab === id
                  ? 'bg-surface-3 text-white'
                  : 'text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── AI Permissions ── */}
        {activeTab === 'ai' && (
          <section>
            <SectionHead
              icon={Sparkles}
              accent="text-gold/80"
              title={t('settings.ai.head.title')}
              sub={t('settings.ai.head.sub')}
            />
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface overflow-hidden">
              {aiActions.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">{t(`settings.ai.${a.id}.label`)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{t(`settings.ai.${a.id}.desc`)}</p>
                    <span className="mt-1 inline-block rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-xs text-slate-500">
                      {t('settings.ai.approval', { role: a.role })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${a.enabled ? 'text-gold' : 'text-slate-500'}`}>
                      {a.enabled ? t('settings.ai.enabled') : t('settings.ai.off')}
                    </span>
                    <Toggle on={a.enabled} onChange={() => toggleAiAction(a.id)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {t('settings.ai.count', { enabled: aiActions.filter((a) => a.enabled).length, total: aiActions.length })}
            </p>
          </section>
        )}

        {/* ── CRM Field Mapping ── */}
        {activeTab === 'crm' && (
          <section>
            <SectionHead
              icon={Database}
              accent="text-gold/80"
              title={t('settings.crm.head.title')}
              sub={t('settings.crm.head.sub')}
            />
            {unmappedCount > 0 && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-sm text-slate-300">
                  {unmappedCount > 1
                    ? t('settings.crm.unmappedMany', { count: unmappedCount })
                    : t('settings.crm.unmappedOne', { count: unmappedCount })}
                </p>
              </div>
            )}
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface overflow-hidden">
              {crmFields.map((f, idx) => (
                <div key={f.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <p className="truncate text-sm text-slate-400">{t(`settings.crm.src.${f.srcKey}`)}</p>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <p className="truncate text-sm font-medium text-slate-100">{t(`settings.crm.tgt.${f.tgtKey}`)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${f.mapped ? 'text-gold' : 'text-amber-400'}`}>
                      {f.mapped ? t('settings.crm.mapped') : t('settings.crm.unmapped')}
                    </span>
                    <Toggle on={f.mapped} onChange={() => toggleCrmField(idx)} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Thresholds ── */}
        {activeTab === 'thresholds' && (
          <section>
            <SectionHead
              icon={Sliders}
              accent="text-gold/80"
              title={t('settings.thresholds.head.title')}
              sub={t('settings.thresholds.head.sub')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {thresholds.map((th) => (
                <div key={th.id} className="rounded-2xl border border-line bg-surface p-5">
                  <p className="text-sm font-medium text-slate-100">{t(`settings.thresholds.${th.id}.label`)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t(`settings.thresholds.${th.id}.desc`)}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="range"
                      min={th.min}
                      max={th.max}
                      step={th.step}
                      value={th.value}
                      onChange={(e) => updateThreshold(th.id, Number(e.target.value))}
                      className="flex-1 accent-gold"
                    />
                    <div className="shrink-0 rounded-xl border border-line-strong bg-surface-2 px-2.5 py-1 text-sm font-semibold tabular-nums text-white min-w-[56px] text-center">
                      {th.value}
                      <span className="ml-0.5 text-xs font-normal text-slate-500">{th.unit}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-600">
                    <span>{th.min}{th.unit}</span>
                    <span>{th.max}{th.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Notifications ── */}
        {activeTab === 'notifications' && (
          <section>
            <SectionHead
              icon={Bell}
              accent="text-slate-400"
              title={t('settings.gnotif.head.title')}
              sub={t('settings.gnotif.head.sub')}
            />
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface overflow-hidden">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">{t(`settings.gnotif.${n.id}`)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${n.enabled ? 'text-gold' : 'text-slate-500'}`}>
                      {n.enabled ? t('settings.gnotif.on') : t('settings.gnotif.off')}
                    </span>
                    <Toggle on={n.enabled} onChange={() => toggleNotif(n.id)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {t('settings.gnotif.count', { enabled: notifs.filter((n) => n.enabled).length, total: notifs.length })}
            </p>
          </section>
        )}

        {/* ── Brand ── */}
        {activeTab === 'brand' && (
          <section>
            <SectionHead
              icon={Globe}
              accent="text-slate-400"
              title={t('settings.brand.head.title')}
              sub={t('settings.brand.head.sub')}
            />
            <div className="space-y-4">
              {BRAND_SETTINGS.map((s) => (
                <div key={s.labelKey} className="rounded-2xl border border-line bg-surface p-5">
                  <label className="block text-xs font-medium text-slate-500 mb-2">{t(s.labelKey)}</label>
                  <input
                    type="text"
                    value={brand[s.labelKey] ?? s.value}
                    onChange={(e) => setBrand((b) => ({ ...b, [s.labelKey]: e.target.value }))}
                    className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/35 focus:outline-none"
                  />
                </div>
              ))}

              {/* Theme */}
              <div className="rounded-2xl border border-line bg-surface p-5">
                <label className="block text-xs font-medium text-slate-500 mb-3">{t('settings.brand.dashboardTheme')}</label>
                <div className="flex gap-3">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setTheme(opt.value); toast.success(t('settings.brand.themeApplied', { theme: t(opt.labelKey) })) }}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className={`h-8 w-8 rounded-lg border border-line-strong ${opt.bg} ${theme === opt.value ? 'ring-gold ring-2' : 'ring-line-strong'}`} />
                      <span className="text-xs text-slate-500">{t(opt.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Access */}
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <label className="text-xs font-medium text-slate-500">{t('settings.brand.accessControl')}</label>
                </div>
                <div className="space-y-2">
                  {[
                    { role: t('settings.brand.access.owner'),      perms: t('settings.brand.access.owner.perms'),      email: 'm@ezz.ae' },
                    { role: t('settings.brand.access.admin'),      perms: t('settings.brand.access.admin.perms'),      email: 'admin@freeholdproperty.ae' },
                    { role: t('settings.brand.access.salesAgent'), perms: t('settings.brand.access.salesAgent.perms'), email: t('settings.brand.access.members', { count: 3 }) },
                  ].map((u) => (
                    <div key={u.role} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{u.role}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                      <span className="rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-sm text-slate-400">
                        {u.perms}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
