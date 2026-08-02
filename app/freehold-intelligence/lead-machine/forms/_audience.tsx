'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users2, Sparkles, AlertCircle, CheckCircle2, ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/**
 * The one-click audience builder — a form's leads turned into a Meta Custom
 * Audience, optionally with a ready-to-go Lookalike on top. Scope 'qualified'
 * seeds only value-rated ≥6 leads: the audience OF the leads a human judged
 * worth buying more of. Two-step click (arm → confirm) because this uploads
 * hashed contact data to Meta and that should never happen by accident.
 */
export function FormAudienceBuilder({
  formId,
  formName,
  contactable,
  qualified,
  forms,
  compact = false,
}: {
  /** null = every Meta-form lead in the CRM, combined. */
  formId: string | null
  formName: string
  contactable: number
  qualified: number
  /** When given, the builder offers a per-form selection — "lookalike from
   *  THESE forms" instead of all-or-nothing. Counts come per form. */
  forms?: Array<{ id: string; name: string; contactable: number; qualified: number }>
  compact?: boolean
}) {
  const t = useT()
  const [scope, setScope] = useState<'all' | 'qualified'>(qualified >= 20 ? 'qualified' : 'all')
  const [lookalike, setLookalike] = useState(true)
  const [ratio, setRatio] = useState(0.03)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ name: string; uploaded: number; lookalike: boolean } | null>(null)
  // Selection: all forms in by default; unticking narrows the seed.
  const [selected, setSelected] = useState<Set<string>>(() => new Set((forms ?? []).map((f) => f.id)))

  const allSelected = !forms || selected.size === forms.length
  const picked = forms?.filter((f) => selected.has(f.id)) ?? null
  const effContactable = forms && !allSelected ? picked!.reduce((s, f) => s + f.contactable, 0) : contactable
  const effQualified = forms && !allSelected ? picked!.reduce((s, f) => s + f.qualified, 0) : qualified
  const seedCount = scope === 'qualified' ? effQualified : effContactable
  const lookalikeBlocked = lookalike && seedCount < 100

  function toggleForm(id: string) {
    setArmed(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function create() {
    if (!armed) { setArmed(true); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/meta/forms/audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId,
          // Explicit subset → send the ids; full selection keeps the broad
          // mode (formId / null) so unknown forms are still included.
          formIds: forms && !allSelected ? [...selected] : undefined,
          formName: forms && !allSelected ? t('pforms.aud.selectedForms', { n: String(selected.size) }) : formName,
          scope, lookalike, ratio, country: 'AE', confirm: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('pforms.aud.failed'))
      setDone({ name: data.audience?.name ?? formName, uploaded: data.uploaded ?? seedCount, lookalike: Boolean(data.lookalikeAudienceId) })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pforms.aud.failed'))
    } finally {
      setBusy(false)
      setArmed(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-[20px] border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{t(done.lookalike ? 'pforms.aud.doneLookalike' : 'pforms.aud.doneCustom')}</div>
            <p className="mt-1 text-xs text-slate-400">
              {t('pforms.aud.doneDetail', { name: done.name, n: String(done.uploaded) })}
            </p>
            <Link
              href="/freehold-intelligence/lead-machine/audiences"
              className="mt-2 inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold"
            >
              {t('pforms.aud.viewAudiences')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Users2 className="h-3.5 w-3.5 text-gold/60" /> {t('pforms.aud.title')}
      </div>
      {!compact && <p className="mt-2 text-xs leading-relaxed text-slate-500">{t('pforms.aud.desc')}</p>}

      {/* Which forms feed the seed — tick exactly the ones you want. */}
      {forms && forms.length > 1 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{t('pforms.aud.pickForms')}</span>
            <span className="tabular-nums">{selected.size}/{forms.length}</span>
          </div>
          <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto pe-1">
            {forms.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-[11px] text-slate-300 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={selected.has(f.id)}
                  onChange={() => toggleForm(f.id)}
                  className="h-3 w-3 accent-[#c9a557]"
                />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{f.qualified}/{f.contactable}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Scope: which leads seed the audience */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {([
          // Counts must reflect the CURRENT form selection, not the full
          // portfolio — otherwise the tile shows one seed size while the gates
          // and the confirm button act on the (smaller) selected subset.
          { key: 'qualified' as const, count: effQualified, labelKey: 'pforms.aud.scopeQualified' },
          { key: 'all' as const, count: effContactable, labelKey: 'pforms.aud.scopeAll' },
        ]).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setScope(s.key); setArmed(false) }}
            className={`rounded-[12px] border px-3 py-2 text-start transition ${
              scope === s.key ? 'border-gold/40 bg-gold/10' : 'border-line bg-surface-2 hover:border-line-strong'
            }`}
          >
            <div className={`text-sm font-semibold tabular-nums ${scope === s.key ? 'text-gold-bright' : 'text-slate-300'}`}>{s.count}</div>
            <div className="text-[11px] text-slate-500">{t(s.labelKey)}</div>
          </button>
        ))}
      </div>

      {/* Lookalike on top */}
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={lookalike}
          onChange={(e) => { setLookalike(e.target.checked); setArmed(false) }}
          className="h-3.5 w-3.5 accent-[#c9a557]"
        />
        <Sparkles className="h-3.5 w-3.5 text-gold/60" />
        {t('pforms.aud.lookalike')}
        {lookalike && (
          <select
            value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))}
            className="ms-auto rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-slate-300"
          >
            <option value={0.01}>1%</option>
            <option value={0.03}>3%</option>
            <option value={0.05}>5%</option>
          </select>
        )}
      </label>

      {/* Honest gates, stated before the click */}
      {seedCount < 20 && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          {t(scope === 'qualified' ? 'pforms.aud.needQualified' : 'pforms.aud.needContacts', { n: String(seedCount) })}
        </p>
      )}
      {seedCount >= 20 && lookalikeBlocked && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          {t('pforms.aud.lookalikeFloor', { n: String(seedCount) })}
        </p>
      )}
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-red-300">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" /> {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || seedCount < 20 || lookalikeBlocked}
        onClick={create}
        className={`mt-3 w-full rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          armed ? 'bg-gold text-ink hover:bg-gold-bright' : 'border border-gold/40 bg-gold/10 text-gold-bright hover:bg-gold/20'
        }`}
      >
        {busy
          ? t('pforms.aud.building')
          : armed
            ? t('pforms.aud.confirm', { n: String(seedCount) })
            : t(lookalike ? 'pforms.aud.createLookalike' : 'pforms.aud.createCustom')}
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{t('pforms.aud.privacy')}</p>
    </div>
  )
}
