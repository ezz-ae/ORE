'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Workflow, Plus, Trash2, Save, Loader2, GitBranch, Users2,
  SlidersHorizontal, ShieldCheck, Power,
} from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import {
  RULE_TRIGGERS, TRIGGER_LABELS, CONDITION_FIELDS, FIELD_LABELS, NUMERIC_FIELDS,
  OPERATOR_LABELS, NUMERIC_OPERATORS, TEXT_OPERATORS,
  ACTION_TYPES, ACTION_LABELS, DISTRIBUTION_STRATEGIES, STRATEGY_LABELS,
  AUTOMATION_STEPS, STEP_LABELS, defaultStepsForDifficulty, defaultConfig,
  type AutomationRule, type Condition, type Action, type WorkspaceAutomationConfig,
  type DifficultyLevel, type AutomationMode, type RuleTrigger, type Operator, type ConditionField, type ActionType,
} from '@/lib/automation/types'

type Agent = { id: string; name: string; email: string; dbRole?: string }
type Section = 'rules' | 'distribution' | 'modes' | 'approvals'

const PRIORITY_OPTIONS = ['hot', 'priority', 'warm', 'cold']
const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'viewing', 'negotiation', 'closed', 'lost']

export default function AutomationSettingsPage() {
  const { ready } = useSessionGuard(['admin', 'ceo', 'director', 'sales_manager'])
  const [section, setSection] = useState<Section>('rules')
  const [agents, setAgents] = useState<Agent[]>([])
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [config, setConfig] = useState<WorkspaceAutomationConfig>(defaultConfig())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    Promise.all([
      fetch('/api/freehold/automation/rules').then((r) => r.json()).catch(() => ({ rules: [] })),
      fetch('/api/freehold/automation/config').then((r) => r.json()).catch(() => ({ config: defaultConfig() })),
      fetch('/api/freehold/team').then((r) => r.json()).catch(() => ({ members: [] })),
    ]).then(([rRes, cRes, tRes]) => {
      if (rRes.rules) setRules(rRes.rules)
      if (cRes.config) setConfig(cRes.config)
      if (tRes.members) setAgents(tRes.members)
    }).finally(() => setLoading(false))
  }, [ready])

  if (!ready) return null

  const brokers = agents.filter((a) => a.dbRole === 'broker' || !a.dbRole)

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-7 sm:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-gold/25 bg-gold/10">
          <Workflow className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Automation & Rules</h1>
          <p className="mt-0.5 text-sm text-slate-400">Lead routing, IF/THEN rules, and AI-vs-manual controls for the Lead Machine</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {([
          { id: 'rules', label: 'Rules', Icon: GitBranch },
          { id: 'distribution', label: 'Lead Distribution', Icon: Users2 },
          { id: 'modes', label: 'Automation Modes', Icon: SlidersHorizontal },
          { id: 'approvals', label: 'Approvals', Icon: ShieldCheck },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setSection(id)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              section === id ? 'border-gold/30 bg-gold/[0.08] text-gold' : 'border-line text-slate-400 hover:text-slate-200'
            }`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : section === 'rules' ? (
        <RulesSection rules={rules} setRules={setRules} brokers={brokers} />
      ) : section === 'distribution' ? (
        <DistributionSection config={config} setConfig={setConfig} brokers={brokers} />
      ) : section === 'modes' ? (
        <ModesSection config={config} setConfig={setConfig} />
      ) : (
        <ApprovalsSection config={config} setConfig={setConfig} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Rules
function blankRule(): AutomationRule {
  return {
    id: '', workspaceId: 'default', name: '', enabled: true, trigger: 'lead.created',
    combinator: 'all', conditions: [], actions: [{ type: 'assign_load_balanced' }],
    sortOrder: 0, stopOnMatch: false, runCount: 0, lastRunAt: null, createdBy: null,
    createdAt: '', updatedAt: '',
  }
}

function RulesSection({ rules, setRules, brokers }: {
  rules: AutomationRule[]; setRules: (r: AutomationRule[]) => void; brokers: Agent[]
}) {
  const [editing, setEditing] = useState<AutomationRule | null>(null)
  const [saving, setSaving] = useState(false)

  async function toggleEnabled(rule: AutomationRule) {
    const next = !rule.enabled
    setRules(rules.map((r) => r.id === rule.id ? { ...r, enabled: next } : r))
    await fetch(`/api/freehold/automation/rules/${rule.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }),
    }).catch(() => {})
  }

  async function remove(rule: AutomationRule) {
    setRules(rules.filter((r) => r.id !== rule.id))
    await fetch(`/api/freehold/automation/rules/${rule.id}`, { method: 'DELETE' }).catch(() => {})
    toast.success('Rule deleted')
  }

  async function save(rule: AutomationRule) {
    if (!rule.name.trim()) { toast.error('Give the rule a name'); return }
    setSaving(true)
    const payload = {
      name: rule.name, trigger: rule.trigger, enabled: rule.enabled, combinator: rule.combinator,
      conditions: rule.conditions, actions: rule.actions, stopOnMatch: rule.stopOnMatch,
    }
    try {
      if (rule.id) {
        const res = await fetch(`/api/freehold/automation/rules/${rule.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error)
        setRules(rules.map((r) => r.id === rule.id ? data.rule : r))
      } else {
        const res = await fetch('/api/freehold/automation/rules', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error)
        setRules([...rules, data.rule])
      }
      toast.success('Rule saved')
      setEditing(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return <RuleEditor rule={editing} setRule={setEditing} onSave={save} onCancel={() => setEditing(null)} brokers={brokers} saving={saving} />
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <p className="text-sm text-slate-400">{rules.length} rule{rules.length === 1 ? '' : 's'}</p>
        <button onClick={() => setEditing(blankRule())}
          className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/15">
          <Plus className="h-4 w-4" /> New rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-[16px] border border-dashed border-line bg-surface p-8 text-center text-sm text-slate-500">
          No rules yet. Create one to auto-route leads, e.g. <span className="text-slate-300">“If source is Meta and budget ≥ 2M → assign to top closers.”</span>
        </div>
      )}

      {rules.map((rule) => (
        <div key={rule.id} className="rounded-[16px] border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{rule.name}</span>
                {!rule.enabled && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-slate-500">Paused</span>}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {TRIGGER_LABELS[rule.trigger]} · {rule.conditions.length} condition{rule.conditions.length === 1 ? '' : 's'} · {rule.actions.length} action{rule.actions.length === 1 ? '' : 's'}
                {rule.runCount > 0 && <> · ran {rule.runCount}×</>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => toggleEnabled(rule)} title={rule.enabled ? 'Pause' : 'Enable'}
                className={`flex h-7 w-7 items-center justify-center rounded-md border ${rule.enabled ? 'border-emerald-400/30 text-emerald-400' : 'border-line text-slate-500'}`}>
                <Power className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setEditing(rule)}
                className="rounded-md border border-line px-3 py-1 text-xs text-slate-300 hover:text-white">Edit</button>
              <button onClick={() => remove(rule)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-red-400/70 hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RuleEditor({ rule, setRule, onSave, onCancel, brokers, saving }: {
  rule: AutomationRule; setRule: (r: AutomationRule) => void
  onSave: (r: AutomationRule) => void; onCancel: () => void; brokers: Agent[]; saving: boolean
}) {
  const update = (patch: Partial<AutomationRule>) => setRule({ ...rule, ...patch })

  function addCondition() {
    update({ conditions: [...rule.conditions, { field: 'lead.source', operator: 'eq', value: '' }] })
  }
  function setCondition(i: number, patch: Partial<Condition>) {
    update({ conditions: rule.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) })
  }
  function addAction() {
    update({ actions: [...rule.actions, { type: 'notify', target: 'management' }] })
  }
  function setAction(i: number, patch: Partial<Action>) {
    update({ actions: rule.actions.map((a, idx) => idx === i ? { ...a, ...patch } : a) })
  }

  const sel = 'rounded-[8px] border border-line-strong bg-surface-2 px-2.5 py-1.5 text-sm text-white outline-none focus:border-gold/40'

  return (
    <div className="space-y-5 rounded-[18px] border border-line bg-surface p-5">
      <input value={rule.name} onChange={(e) => update({ name: e.target.value })} placeholder="Rule name (e.g. Route Russian investors)"
        className="w-full rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40" />

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <span>Trigger</span>
        <select value={rule.trigger} onChange={(e) => update({ trigger: e.target.value as RuleTrigger })} className={sel}>
          {RULE_TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
        </select>
      </div>

      {/* Conditions */}
      <div className="rounded-[12px] border border-line bg-surface-2/40 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            IF
            <select value={rule.combinator} onChange={(e) => update({ combinator: e.target.value as 'all' | 'any' })}
              className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] text-slate-300">
              <option value="all">match all</option>
              <option value="any">match any</option>
            </select>
          </div>
          <button onClick={addCondition} className="flex items-center gap-1 text-xs text-gold/80 hover:text-gold"><Plus className="h-3 w-3" /> condition</button>
        </div>
        {rule.conditions.length === 0 && <p className="py-2 text-xs text-slate-500">No conditions — the rule always fires on this trigger.</p>}
        <div className="space-y-2">
          {rule.conditions.map((c, i) => {
            const numeric = NUMERIC_FIELDS.includes(c.field)
            const ops = numeric ? NUMERIC_OPERATORS : TEXT_OPERATORS
            const noValue = c.operator === 'is_empty' || c.operator === 'is_not_empty'
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select value={c.field} onChange={(e) => setCondition(i, { field: e.target.value as ConditionField })} className={sel}>
                  {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                </select>
                <select value={c.operator} onChange={(e) => setCondition(i, { operator: e.target.value as Operator })} className={sel}>
                  {ops.map((o) => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
                </select>
                {!noValue && (
                  <input value={String(c.value ?? '')} onChange={(e) => setCondition(i, { value: numeric ? Number(e.target.value) : e.target.value })}
                    type={numeric ? 'number' : 'text'} placeholder={c.operator === 'in' || c.operator === 'not_in' ? 'comma,separated' : 'value'}
                    onBlur={(e) => { if ((c.operator === 'in' || c.operator === 'not_in')) setCondition(i, { value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }) }}
                    className="w-36 rounded-[8px] border border-line-strong bg-surface-2 px-2.5 py-1.5 text-sm text-white outline-none focus:border-gold/40" />
                )}
                <button onClick={() => update({ conditions: rule.conditions.filter((_, idx) => idx !== i) })}
                  className="text-slate-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-[12px] border border-line bg-surface-2/40 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">THEN</span>
          <button onClick={addAction} className="flex items-center gap-1 text-xs text-gold/80 hover:text-gold"><Plus className="h-3 w-3" /> action</button>
        </div>
        <div className="space-y-2">
          {rule.actions.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={a.type} onChange={(e) => setAction(i, { type: e.target.value as ActionType })} className={sel}>
                {ACTION_TYPES.map((t) => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
              </select>
              {a.type === 'assign_to_agent' && (
                <select value={a.brokerId ?? ''} onChange={(e) => setAction(i, { brokerId: e.target.value })} className={sel}>
                  <option value="">Select agent…</option>
                  {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {a.type === 'set_priority' && (
                <select value={a.value ?? ''} onChange={(e) => setAction(i, { value: e.target.value })} className={sel}>
                  <option value="">Priority…</option>
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {a.type === 'set_status' && (
                <select value={a.value ?? ''} onChange={(e) => setAction(i, { value: e.target.value })} className={sel}>
                  <option value="">Status…</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {a.type === 'snooze' && (
                <input type="number" value={a.hours ?? 24} onChange={(e) => setAction(i, { hours: Number(e.target.value) })}
                  className="w-24 rounded-[8px] border border-line-strong bg-surface-2 px-2.5 py-1.5 text-sm text-white" placeholder="hours" />
              )}
              {a.type === 'notify' && (
                <input value={a.target ?? ''} onChange={(e) => setAction(i, { target: e.target.value })}
                  className="w-40 rounded-[8px] border border-line-strong bg-surface-2 px-2.5 py-1.5 text-sm text-white" placeholder="management / assigned" />
              )}
              <button onClick={() => update({ actions: rule.actions.filter((_, idx) => idx !== i) })}
                className="text-slate-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-400">
        <input type="checkbox" checked={rule.stopOnMatch} onChange={(e) => update({ stopOnMatch: e.target.checked })} className="accent-gold" />
        Stop processing further rules once this one matches
      </label>

      <div className="flex gap-2">
        <button onClick={() => onSave(rule)} disabled={saving}
          className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save rule
        </button>
        <button onClick={onCancel} className="rounded-full border border-line px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Distribution
function DistributionSection({ config, setConfig, brokers }: {
  config: WorkspaceAutomationConfig; setConfig: (c: WorkspaceAutomationConfig) => void; brokers: Agent[]
}) {
  const [saving, setSaving] = useState(false)
  const d = config.distribution
  const setD = (patch: Partial<typeof d>) => setConfig({ ...config, distribution: { ...d, ...patch } })

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/automation/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ distribution: d }),
      })
      if (!res.ok) throw new Error()
      toast.success('Distribution saved')
    } catch { toast.error('Could not save') } finally { setSaving(false) }
  }

  const sel = 'rounded-[8px] border border-line-strong bg-surface-2 px-2.5 py-2 text-sm text-white outline-none focus:border-gold/40'

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-semibold text-white">Mode</div>
        <div className="flex gap-2">
          {(['manual', 'auto'] as const).map((m) => (
            <button key={m} onClick={() => setD({ mode: m })}
              className={`flex-1 rounded-[10px] border px-4 py-3 text-sm font-medium transition ${
                d.mode === m ? 'border-gold/30 bg-gold/[0.08] text-gold' : 'border-line text-slate-400 hover:text-slate-200'
              }`}>
              {m === 'manual' ? 'Manual — assign by hand' : 'Auto — distribute on arrival'}
            </button>
          ))}
        </div>
      </div>

      {d.mode === 'auto' && (
        <>
          <div className="rounded-[16px] border border-line bg-surface p-5 space-y-4">
            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-300">Strategy</div>
              <select value={d.strategy} onChange={(e) => setD({ strategy: e.target.value as typeof d.strategy })} className={`${sel} w-full`}>
                {DISTRIBUTION_STRATEGIES.map((s) => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}
              </select>
            </div>

            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-300">Eligible agents</div>
              <p className="mb-2 text-xs text-slate-500">Leave all unchecked to include every active broker.</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {brokers.map((b) => {
                  const on = d.pool.includes(b.id)
                  return (
                    <button key={b.id} onClick={() => setD({ pool: on ? d.pool.filter((x) => x !== b.id) : [...d.pool, b.id] })}
                      className={`truncate rounded-[8px] border px-2.5 py-1.5 text-left text-xs transition ${
                        on ? 'border-gold/30 bg-gold/[0.08] text-gold' : 'border-line text-slate-400'
                      }`}>{b.name}</button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-400">
                <span className="mb-1.5 block">Max leads / agent / day (0 = no cap)</span>
                <input type="number" value={d.maxPerAgentPerDay} onChange={(e) => setD({ maxPerAgentPerDay: Number(e.target.value) })} className={`${sel} w-full`} />
              </label>
              <label className="text-sm text-slate-400">
                <span className="mb-1.5 block">Fallback agent</span>
                <select value={d.fallbackBrokerId ?? ''} onChange={(e) => setD({ fallbackBrokerId: e.target.value || null })} className={`${sel} w-full`}>
                  <option value="">None</option>
                  {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input type="checkbox" checked={d.respectWorkingHours} onChange={(e) => setD({ respectWorkingHours: e.target.checked })} className="accent-gold" />
              Only auto-assign during working hours (Asia/Dubai)
            </label>
            {d.respectWorkingHours && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                From <input type="number" min={0} max={23} value={d.workingHoursStart} onChange={(e) => setD({ workingHoursStart: Number(e.target.value) })} className="w-16 rounded-[8px] border border-line-strong bg-surface-2 px-2 py-1 text-white" />
                to <input type="number" min={0} max={23} value={d.workingHoursEnd} onChange={(e) => setD({ workingHoursEnd: Number(e.target.value) })} className="w-16 rounded-[8px] border border-line-strong bg-surface-2 px-2 py-1 text-white" />
              </div>
            )}
          </div>
        </>
      )}

      <button onClick={save} disabled={saving}
        className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save distribution
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Modes
function ModesSection({ config, setConfig }: {
  config: WorkspaceAutomationConfig; setConfig: (c: WorkspaceAutomationConfig) => void
}) {
  const [saving, setSaving] = useState(false)
  const setDifficulty = (difficulty: DifficultyLevel) =>
    setConfig({ ...config, difficulty, steps: defaultStepsForDifficulty(difficulty) })
  const setStep = (step: typeof AUTOMATION_STEPS[number], mode: AutomationMode) =>
    setConfig({ ...config, steps: { ...config.steps, [step]: mode } })

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/automation/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: config.difficulty, steps: config.steps, useInternalData: config.useInternalData }),
      })
      if (!res.ok) throw new Error()
      toast.success('Automation modes saved')
    } catch { toast.error('Could not save') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-line bg-surface p-5">
        <div className="mb-1 text-sm font-semibold text-white">Difficulty preset</div>
        <p className="mb-3 text-xs text-slate-500">Sets sensible defaults below. You can still override any step.</p>
        <div className="flex gap-2">
          {(['beginner', 'standard', 'expert'] as const).map((lvl) => (
            <button key={lvl} onClick={() => setDifficulty(lvl)}
              className={`flex-1 rounded-[10px] border px-4 py-3 text-sm font-medium capitalize transition ${
                config.difficulty === lvl ? 'border-gold/30 bg-gold/[0.08] text-gold' : 'border-line text-slate-400 hover:text-slate-200'
              }`}>{lvl}</button>
          ))}
        </div>
      </div>

      <div className="rounded-[16px] border border-line bg-surface p-5">
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-200">Use internal data for AI</div>
            <div className="mt-0.5 text-xs text-slate-500">Let AI use your leads, performance, and inventory to inform targeting and suggestions.</div>
          </div>
          <button onClick={() => setConfig({ ...config, useInternalData: !config.useInternalData })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${config.useInternalData ? 'bg-gold' : 'bg-surface-3'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${config.useInternalData ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>
      </div>

      <div className="rounded-[16px] border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-semibold text-white">Per-step control</div>
        <div className="space-y-2">
          {AUTOMATION_STEPS.map((step) => (
            <div key={step} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">{STEP_LABELS[step]}</span>
              <div className="flex gap-1">
                {(['manual', 'assisted', 'auto'] as const).map((m) => (
                  <button key={m} onClick={() => setStep(step, m)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                      config.steps[step] === m ? 'bg-gold/15 text-gold' : 'text-slate-500 hover:text-slate-300'
                    }`}>{m}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save modes
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Approvals
function ApprovalsSection({ config, setConfig }: {
  config: WorkspaceAutomationConfig; setConfig: (c: WorkspaceAutomationConfig) => void
}) {
  const [saving, setSaving] = useState(false)
  const a = config.approvals
  const setA = (patch: Partial<typeof a>) => setConfig({ ...config, approvals: { ...a, ...patch } })

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/automation/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvals: a }),
      })
      if (!res.ok) throw new Error()
      toast.success('Approvals saved')
    } catch { toast.error('Could not save') } finally { setSaving(false) }
  }

  const Row = ({ label, hint, value, onChange, max }: { label: string; hint: string; value: number; onChange: (n: number) => void; max: number }) => (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <div>
        <div className="text-sm text-slate-200">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max + 1 }, (_, n) => (
          <button key={n} onClick={() => onChange(n)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${value === n ? 'bg-gold/15 text-gold' : 'text-slate-500 hover:text-slate-300'}`}>
            {n === 0 ? 'None' : `${n}-step`}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-line bg-surface p-5">
        <Row label="Ad launch" hint="Approval steps before a campaign can go live" value={a.adLaunch} onChange={(n) => setA({ adLaunch: n as 0 | 1 | 2 })} max={2} />
        <Row label="Landing publish" hint="Approval steps before a landing page is published" value={a.landingPublish} onChange={(n) => setA({ landingPublish: n as 0 | 1 | 2 })} max={2} />
        <Row label="Lead reassignment" hint="Require approval to reassign a lead away from its agent" value={a.leadReassign} onChange={(n) => setA({ leadReassign: n as 0 | 1 })} max={1} />
        <div className="flex items-center justify-between gap-3 pt-3">
          <div>
            <div className="text-sm text-slate-200">Budget approval threshold</div>
            <div className="mt-0.5 text-xs text-slate-500">Campaign budgets above this (AED) need approval. 0 = never.</div>
          </div>
          <input type="number" value={a.budgetApprovalThreshold} onChange={(e) => setA({ budgetApprovalThreshold: Number(e.target.value) })}
            className="w-32 rounded-[8px] border border-line-strong bg-surface-2 px-2.5 py-2 text-sm text-white outline-none focus:border-gold/40" />
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save approvals
      </button>
    </div>
  )
}
