import { Settings as SettingsIcon, Sparkles, Database, Zap, Shield, ToggleRight, AlertCircle } from 'lucide-react'

const aiActions = [
  { id: 'send_whatsapp',   label: 'Send WhatsApp messages',       role: 'Owner',  enabled: true  },
  { id: 'post_social',     label: 'Post to social channels',      role: 'Admin',  enabled: false },
  { id: 'launch_ad',       label: 'Launch paid ad campaigns',     role: 'Owner',  enabled: true  },
  { id: 'create_landing',  label: 'Auto-generate landing pages',  role: 'Admin',  enabled: true  },
  { id: 'export_crm',      label: 'Export CRM data',              role: 'Owner',  enabled: false },
]

const memoryItems = [
  { label: 'Pinned context blocks', value: '4 active', status: 'active' },
  { label: 'Long-term memory',      value: 'Enabled — 90 day rolling', status: 'active' },
  { label: 'Cross-session recall',  value: 'On for Notebook + CRM', status: 'active' },
  { label: 'Auto-summarise threads', value: 'After 20 messages', status: 'active' },
]

const crmFields = [
  { source: 'HubSpot Deal Stage',     target: 'Pipeline stage',       mapped: true  },
  { source: 'HubSpot Lead Score',     target: 'Intent score',         mapped: true  },
  { source: 'Meta Lead Form',         target: 'Source: paid social',  mapped: true  },
  { source: 'WhatsApp Contact',       target: 'Source: WhatsApp',     mapped: false },
  { source: 'HubSpot Owner',          target: 'Agent assignment',     mapped: false },
]

const lmRequirements = [
  { label: 'Minimum ad readiness to allow launch',    value: 80, unit: '%'  },
  { label: 'Minimum landing readiness to go live',    value: 80, unit: '%'  },
  { label: 'Auto-block threshold (opportunity score)', value: 30, unit: 'pts' },
  { label: 'Days before ad request expires',          value: 7,  unit: 'd'  },
]

function Tag({ on }: { on: boolean }) {
  return on
    ? <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">Enabled</span>
    : <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-white/35">Off</span>
}

function MappedTag({ on }: { on: boolean }) {
  return on
    ? <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">Mapped</span>
    : <span className="flex items-center gap-1 rounded-full bg-[#D4AF37]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#F8E7AE]">
        <AlertCircle className="h-2.5 w-2.5" /> Unmapped
      </span>
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:pt-16">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <SettingsIcon className="h-3.5 w-3.5" /> Settings
        </div>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
          How the server
          <br />
          <span className="text-white/40">behaves for you.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-[1.65] text-white/60">
          Four configuration layers — AI permissions, memory, CRM field mapping, and Lead Machine thresholds. Production wiring completes in V1.
        </p>
      </section>

      {/* AI Action Approval */}
      <section className="mt-16">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
          <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" /> AI Action Approval
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Which actions require sign-off.
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/50">
          When enabled, the AI must receive Owner or Admin approval before executing these externally.
        </p>
        <div className="mt-6 overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          {aiActions.map((a, i) => (
            <div
              key={a.id}
              className={[
                'flex items-center justify-between gap-5 px-6 py-4',
                i < aiActions.length - 1 ? 'border-b border-white/[0.05]' : '',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-white/85">{a.label}</p>
                <p className="mt-0.5 text-[12px] text-white/35">Requires {a.role} approval</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Tag on={a.enabled} />
                <ToggleRight className={`h-5 w-5 transition-colors ${a.enabled ? 'text-emerald-400' : 'text-white/20'}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notebook Memory */}
      <section className="mt-16">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
          <Database className="h-3.5 w-3.5 text-sky-400" /> Notebook Memory
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          What the AI remembers.
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/50">
          Pin context, set retention windows, and control recall scope across sessions.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {memoryItems.map((m) => (
            <div key={m.label} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/35">{m.label}</p>
              <p className="mt-2 text-[15px] font-semibold text-white">{m.value}</p>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-sky-400/60" style={{ width: '75%' }} />
              </div>
            </div>
          ))}
        </div>
        <button className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.04] px-5 py-2.5 text-[13px] font-medium text-red-300/70 transition hover:border-red-400/35 hover:text-red-300">
          Clear long-term memory
        </button>
      </section>

      {/* CRM Source Mapping */}
      <section className="mt-16">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
          <Database className="h-3.5 w-3.5 text-emerald-400" /> CRM Source Mapping
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          How data routes in.
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/50">
          Map HubSpot fields and lead origins to internal CRM intelligence layers.
        </p>
        <div className="mt-6 overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0A0D10]">
          {crmFields.map((f, i) => (
            <div
              key={f.source}
              className={[
                'flex items-center justify-between gap-5 px-6 py-4',
                i < crmFields.length - 1 ? 'border-b border-white/[0.05]' : '',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <p className="truncate text-[13px] text-white/65">{f.source}</p>
                <span className="text-[11px] text-white/20">→</span>
                <p className="truncate text-[13px] font-medium text-white/85">{f.target}</p>
              </div>
              <div className="shrink-0">
                <MappedTag on={f.mapped} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-white/30">2 fields unmapped — connect them in HubSpot integration settings.</p>
      </section>

      {/* Lead Machine Requirements */}
      <section className="mt-16">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
          <Zap className="h-3.5 w-3.5 text-[#D4AF37]" /> Lead Machine Requirements
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Minimum bars for launch.
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/50">
          Readiness thresholds that gate landing generation, ad requests, and campaign launch.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {lmRequirements.map((r) => (
            <div key={r.label} className="rounded-[18px] border border-white/[0.06] bg-[#0A0D10] p-5">
              <p className="text-[12px] leading-snug text-white/50">{r.label}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[#D4AF37]/70"
                      style={{ width: `${r.unit === '%' ? r.value : Math.min((r.value / 30) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-[22px] font-semibold tabular-nums text-white">
                  {r.value}<span className="text-[14px] font-normal text-white/35 ml-0.5">{r.unit}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Session info */}
      <section className="mt-16 rounded-[20px] border border-white/[0.05] bg-white/[0.015] px-6 py-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/30">
          <Shield className="h-3 w-3" /> Session
        </div>
        <p className="mt-2 text-[14px] text-white/50">
          Changes here are scoped to your Owner session. Production backend wiring — live toggles, persistent storage — completes in V1.
        </p>
      </section>

    </div>
  )
}
