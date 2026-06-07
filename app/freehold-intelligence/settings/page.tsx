'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Settings as SettingsIcon, Sparkles, Database, Zap, Shield,
  Check, AlertCircle, ChevronRight, Bell, Globe, Lock, Users,
  Palette, Sliders, Save,
} from 'lucide-react'
import { PageHeader, buttonClass } from '@/components/freehold/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiAction {
  id: string
  label: string
  description: string
  role: 'Owner' | 'Admin'
  enabled: boolean
}

interface CrmField {
  source: string
  target: string
  mapped: boolean
}

interface LmThreshold {
  id: string
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  unit: string
}

// ─── Static data ──────────────────────────────────────────────────────────────

const INITIAL_AI_ACTIONS: AiAction[] = [
  { id: 'send_whatsapp',    label: 'Send WhatsApp messages',        description: 'AI can send WhatsApp messages to leads on your behalf', role: 'Owner', enabled: true  },
  { id: 'post_social',      label: 'Post to social channels',       description: 'AI can publish content to Instagram and LinkedIn',       role: 'Admin', enabled: false },
  { id: 'launch_ad',        label: 'Launch paid ad campaigns',      description: 'AI can create and activate campaigns on Meta and Google', role: 'Owner', enabled: true  },
  { id: 'create_landing',   label: 'Auto-generate landing pages',   description: 'AI can publish new landing pages from inventory data',    role: 'Admin', enabled: true  },
  { id: 'export_crm',       label: 'Export CRM data',               description: 'AI can export leads and contact data to CSV or HubSpot',  role: 'Owner', enabled: false },
  { id: 'assign_leads',     label: 'Auto-assign new leads',         description: 'AI can assign incoming leads to agents based on workload', role: 'Admin', enabled: true  },
]

const INITIAL_CRM_FIELDS: CrmField[] = [
  { source: 'HubSpot Deal Stage',   target: 'Pipeline stage',        mapped: true  },
  { source: 'HubSpot Lead Score',   target: 'Intent score',          mapped: true  },
  { source: 'Meta Lead Form',       target: 'Source: paid social',   mapped: true  },
  { source: 'Google Lead Form',     target: 'Source: paid search',   mapped: true  },
  { source: 'WhatsApp Contact',     target: 'Source: WhatsApp',      mapped: false },
  { source: 'HubSpot Owner',        target: 'Agent assignment',      mapped: false },
]

const INITIAL_THRESHOLDS: LmThreshold[] = [
  { id: 'min_ad_readiness',   label: 'Minimum ad readiness',          description: 'Required before allowing campaign launch',                value: 80, min: 0,  max: 100, step: 5,  unit: '%'   },
  { id: 'min_landing_ready',  label: 'Minimum landing readiness',      description: 'Required before publishing a landing page',               value: 80, min: 0,  max: 100, step: 5,  unit: '%'   },
  { id: 'auto_block_score',   label: 'Auto-block threshold',           description: 'Opportunity score below this is auto-blocked from launch', value: 30, min: 0,  max: 100, step: 5,  unit: 'pts' },
  { id: 'ad_req_expiry',      label: 'Ad request expiry',              description: 'Days before an unreviewed ad request expires',            value: 7,  min: 1,  max: 30,  step: 1,  unit: 'd'   },
  { id: 'lead_sla_hours',     label: 'Lead response SLA',              description: 'Hours until a new lead is flagged as uncontacted',        value: 4,  min: 1,  max: 48,  step: 1,  unit: 'h'   },
  { id: 'max_cpl',            label: 'Max CPL alert threshold',        description: 'CPL above this triggers an alert in the Finance section', value: 120, min: 50, max: 500, step: 10, unit: 'AED' },
]

const NOTIFICATION_SETTINGS = [
  { id: 'new_lead',       label: 'New lead received',              enabled: true  },
  { id: 'cpl_alert',     label: 'CPL exceeds threshold',          enabled: true  },
  { id: 'campaign_paused', label: 'Campaign paused automatically', enabled: false },
  { id: 'budget_80pct',  label: 'Budget 80% consumed',            enabled: true  },
  { id: 'landing_live',  label: 'Landing page goes live',         enabled: false },
  { id: 'lead_overdue',  label: 'Lead SLA breached',              enabled: true  },
]

const BRAND_SETTINGS = [
  { label: 'Company Name',   value: 'Freehold Property Dubai' },
  { label: 'Primary Domain', value: 'freeholdproperty.ae' },
  { label: 'WhatsApp Number', value: '+971 50 XXX XXXX' },
  { label: 'CRM Timezone',   value: 'Asia/Dubai (UTC+4)' },
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
  const [saved,       setSaved]       = useState(false)
  const [theme,       setTheme]       = useState('Dark (current)')
  const [activeTab,   setActiveTab]   = useState<'ai' | 'crm' | 'thresholds' | 'notifications' | 'brand'>('ai')

  const unmappedCount = crmFields.filter((f) => !f.mapped).length

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function toggleAiAction(id: string) {
    setAiActions((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a))
  }

  function toggleCrmField(idx: number) {
    setCrmFields((prev) => prev.map((f, i) => i === idx ? { ...f, mapped: !f.mapped } : f))
  }

  function updateThreshold(id: string, value: number) {
    setThresholds((prev) => prev.map((t) => t.id === id ? { ...t, value } : t))
  }

  function toggleNotif(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, enabled: !n.enabled } : n))
  }

  const TABS = [
    { id: 'ai'            as const, label: 'AI Permissions', icon: Sparkles },
    { id: 'crm'           as const, label: 'CRM Mapping',    icon: Database  },
    { id: 'thresholds'    as const, label: 'Thresholds',     icon: Sliders   },
    { id: 'notifications' as const, label: 'Notifications',  icon: Bell      },
    { id: 'brand'         as const, label: 'Brand',          icon: Globe     },
  ]

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">

        <PageHeader
          eyebrow="System Settings"
          Icon={SettingsIcon}
          title="Settings"
          subtitle="Configure AI permissions, data mapping, and platform thresholds"
          actions={
            <button
              onClick={handleSave}
              className={saved ? buttonClass('primary', 'md') : buttonClass('secondary', 'md')}
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? 'Saved' : 'Save Changes'}
            </button>
          }
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
              title="AI Action Permissions"
              sub="Control which actions the AI can take autonomously on your behalf"
            />
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface overflow-hidden">
              {aiActions.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">{a.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>
                    <span className="mt-1 inline-block rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-xs text-slate-500">
                      {a.role} approval
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${a.enabled ? 'text-gold' : 'text-slate-500'}`}>
                      {a.enabled ? 'Enabled' : 'Off'}
                    </span>
                    <Toggle on={a.enabled} onChange={() => toggleAiAction(a.id)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {aiActions.filter((a) => a.enabled).length} of {aiActions.length} actions enabled
            </p>
          </section>
        )}

        {/* ── CRM Field Mapping ── */}
        {activeTab === 'crm' && (
          <section>
            <SectionHead
              icon={Database}
              accent="text-gold/80"
              title="CRM Field Mapping"
              sub="Map external data sources to internal CRM intelligence fields"
            />
            {unmappedCount > 0 && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-sm text-slate-300">
                  {unmappedCount} field{unmappedCount > 1 ? 's' : ''} unmapped — toggle to configure
                </p>
              </div>
            )}
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface overflow-hidden">
              {crmFields.map((f, idx) => (
                <div key={f.source} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <p className="truncate text-sm text-slate-400">{f.source}</p>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <p className="truncate text-sm font-medium text-slate-100">{f.target}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${f.mapped ? 'text-gold' : 'text-amber-400'}`}>
                      {f.mapped ? 'Mapped' : 'Unmapped'}
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
              title="Lead Machine Thresholds"
              sub="Minimum bars for landing generation, ad requests, and campaign launch"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {thresholds.map((t) => (
                <div key={t.id} className="rounded-2xl border border-line bg-surface p-5">
                  <p className="text-sm font-medium text-slate-100">{t.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="range"
                      min={t.min}
                      max={t.max}
                      step={t.step}
                      value={t.value}
                      onChange={(e) => updateThreshold(t.id, Number(e.target.value))}
                      className="flex-1 accent-gold"
                    />
                    <div className="shrink-0 rounded-xl border border-line-strong bg-surface-2 px-2.5 py-1 text-sm font-semibold tabular-nums text-white min-w-[56px] text-center">
                      {t.value}
                      <span className="ml-0.5 text-xs font-normal text-slate-500">{t.unit}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-600">
                    <span>{t.min}{t.unit}</span>
                    <span>{t.max}{t.unit}</span>
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
              title="Notification Triggers"
              sub="Choose which platform events generate alerts in your dashboard"
            />
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface overflow-hidden">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">{n.label}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${n.enabled ? 'text-gold' : 'text-slate-500'}`}>
                      {n.enabled ? 'On' : 'Off'}
                    </span>
                    <Toggle on={n.enabled} onChange={() => toggleNotif(n.id)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {notifs.filter((n) => n.enabled).length} of {notifs.length} notifications active
            </p>
          </section>
        )}

        {/* ── Brand ── */}
        {activeTab === 'brand' && (
          <section>
            <SectionHead
              icon={Globe}
              accent="text-slate-400"
              title="Brand & Identity"
              sub="Core identity settings used across campaigns, landing pages, and AI-generated content"
            />
            <div className="space-y-4">
              {BRAND_SETTINGS.map((s) => (
                <div key={s.label} className="rounded-2xl border border-line bg-surface p-5">
                  <label className="block text-xs font-medium text-slate-500 mb-2">{s.label}</label>
                  <input
                    type="text"
                    defaultValue={s.value}
                    className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-gold/35 focus:outline-none"
                  />
                </div>
              ))}

              {/* Theme */}
              <div className="rounded-2xl border border-line bg-surface p-5">
                <label className="block text-xs font-medium text-slate-500 mb-3">Dashboard Theme</label>
                <div className="flex gap-3">
                  {[
                    { label: 'Dark (current)', bg: 'bg-surface' },
                    { label: 'Darker',         bg: 'bg-black'     },
                    { label: 'Navy',           bg: 'bg-[#0a0f1e]' },
                  ].map((t) => (
                    <button
                      key={t.label}
                      onClick={() => { setTheme(t.label); toast.success(t.label + ' theme applied') }}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className={`h-8 w-8 rounded-lg border border-line-strong ${t.bg} ${theme === t.label ? 'ring-gold ring-2' : 'ring-line-strong'}`} />
                      <span className="text-xs text-slate-500">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Access */}
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <label className="text-xs font-medium text-slate-500">Access Control</label>
                </div>
                <div className="space-y-2">
                  {[
                    { role: 'Owner (you)',     perms: 'Full access',           email: 'm@ezz.ae' },
                    { role: 'Admin',           perms: 'All except billing',    email: 'admin@freeholdproperty.ae' },
                    { role: 'Sales Agent',     perms: 'CRM + Lead Machine',    email: '3 members' },
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
