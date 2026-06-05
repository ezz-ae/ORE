'use client'

import { useState } from 'react'
import {
  Settings as SettingsIcon, Sparkles, Database, Zap, Shield,
  Check, AlertCircle, ChevronRight, Bell, Globe, Lock, Users,
  Palette, Sliders, Save,
} from 'lucide-react'

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
        on ? 'border-[#D4AF37]/40 bg-[#D4AF37]/20' : 'border-white/[0.12] bg-white/[0.04]',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full border transition-all duration-200',
          on ? 'left-5 border-[#D4AF37]/60 bg-[#D4AF37]' : 'left-0.5 border-white/20 bg-white/30',
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
      <div className={`flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] ${accent}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="mt-1 text-sm text-white/40">{sub}</p>
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

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-white/35 mb-3">
              <SettingsIcon className="h-3.5 w-3.5 text-[#D4AF37]" /> System Settings
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white/90">Settings</h1>
            <p className="mt-1 text-sm text-white/40">Configure AI permissions, data mapping, and platform thresholds</p>
          </div>
          <button
            onClick={handleSave}
            className={[
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition',
              saved
                ? 'border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border border-white/[0.08] bg-white/[0.04] text-white/70 hover:border-[#D4AF37]/30 hover:text-white',
            ].join(' ')}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="mb-8 flex flex-wrap gap-1 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition',
                activeTab === id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/70',
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
              accent="text-[#D4AF37]/80"
              title="AI Action Permissions"
              sub="Control which actions the AI can take autonomously on your behalf"
            />
            <div className="divide-y divide-white/[0.04] rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
              {aiActions.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/85">{a.label}</p>
                    <p className="mt-0.5 text-xs text-white/35">{a.description}</p>
                    <span className="mt-1 inline-block rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[12px] text-white/35">
                      {a.role} approval
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${a.enabled ? 'text-[#D4AF37]' : 'text-white/30'}`}>
                      {a.enabled ? 'Enabled' : 'Off'}
                    </span>
                    <Toggle on={a.enabled} onChange={() => toggleAiAction(a.id)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/25">
              {aiActions.filter((a) => a.enabled).length} of {aiActions.length} actions enabled
            </p>
          </section>
        )}

        {/* ── CRM Field Mapping ── */}
        {activeTab === 'crm' && (
          <section>
            <SectionHead
              icon={Database}
              accent="text-[#D4AF37]/80"
              title="CRM Field Mapping"
              sub="Map external data sources to internal CRM intelligence fields"
            />
            {unmappedCount > 0 && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-sm text-white/70">
                  {unmappedCount} field{unmappedCount > 1 ? 's' : ''} unmapped — toggle to configure
                </p>
              </div>
            )}
            <div className="divide-y divide-white/[0.04] rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
              {crmFields.map((f, idx) => (
                <div key={f.source} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <p className="truncate text-sm text-white/60">{f.source}</p>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
                    <p className="truncate text-sm font-medium text-white/85">{f.target}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${f.mapped ? 'text-[#D4AF37]' : 'text-amber-400'}`}>
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
              accent="text-[#D4AF37]/80"
              title="Lead Machine Thresholds"
              sub="Minimum bars for landing generation, ad requests, and campaign launch"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {thresholds.map((t) => (
                <div key={t.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                  <p className="text-sm font-medium text-white/80">{t.label}</p>
                  <p className="mt-0.5 text-xs text-white/35">{t.description}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="range"
                      min={t.min}
                      max={t.max}
                      step={t.step}
                      value={t.value}
                      onChange={(e) => updateThreshold(t.id, Number(e.target.value))}
                      className="flex-1 accent-[#D4AF37]"
                    />
                    <div className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-sm font-semibold tabular-nums text-white/90 min-w-[56px] text-center">
                      {t.value}
                      <span className="ml-0.5 text-xs font-normal text-white/35">{t.unit}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-[12px] text-white/25">
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
              accent="text-white/55/80"
              title="Notification Triggers"
              sub="Choose which platform events generate alerts in your dashboard"
            />
            <div className="divide-y divide-white/[0.04] rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/85">{n.label}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${n.enabled ? 'text-[#D4AF37]' : 'text-white/30'}`}>
                      {n.enabled ? 'On' : 'Off'}
                    </span>
                    <Toggle on={n.enabled} onChange={() => toggleNotif(n.id)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/25">
              {notifs.filter((n) => n.enabled).length} of {notifs.length} notifications active
            </p>
          </section>
        )}

        {/* ── Brand ── */}
        {activeTab === 'brand' && (
          <section>
            <SectionHead
              icon={Globe}
              accent="text-white/55/80"
              title="Brand & Identity"
              sub="Core identity settings used across campaigns, landing pages, and AI-generated content"
            />
            <div className="space-y-4">
              {BRAND_SETTINGS.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                  <label className="block text-xs font-medium text-white/40 mb-2">{s.label}</label>
                  <input
                    type="text"
                    defaultValue={s.value}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/85 placeholder:text-white/25 focus:border-[#D4AF37]/35 focus:outline-none"
                  />
                </div>
              ))}

              {/* Theme */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <label className="block text-xs font-medium text-white/40 mb-3">Dashboard Theme</label>
                <div className="flex gap-3">
                  {[
                    { label: 'Dark (current)', bg: 'bg-[#111318]', ring: 'ring-[#D4AF37] ring-2' },
                    { label: 'Darker',         bg: 'bg-black',     ring: 'ring-white/10' },
                    { label: 'Navy',           bg: 'bg-[#0a0f1e]', ring: 'ring-white/10' },
                  ].map((t) => (
                    <button key={t.label} className="flex flex-col items-center gap-1.5">
                      <div className={`h-8 w-8 rounded-lg border border-white/10 ${t.bg} ${t.ring}`} />
                      <span className="text-[12px] text-white/35">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Access */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="h-3.5 w-3.5 text-white/30" />
                  <label className="text-xs font-medium text-white/40">Access Control</label>
                </div>
                <div className="space-y-2">
                  {[
                    { role: 'Owner (you)',     perms: 'Full access',           email: 'm@ezz.ae' },
                    { role: 'Admin',           perms: 'All except billing',    email: 'admin@freeholdproperty.ae' },
                    { role: 'Sales Agent',     perms: 'CRM + Lead Machine',    email: '3 members' },
                  ].map((u) => (
                    <div key={u.role} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white/80">{u.role}</p>
                        <p className="text-xs text-white/35">{u.email}</p>
                      </div>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[13px] text-white/40">
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
