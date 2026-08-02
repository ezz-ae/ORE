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
  compact = false,
}: {
  /** null = every Meta-form lead in the CRM, combined. */
  formId: string | null
  formName: string
  contactable: number
  qualified: number
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

  const seedCount = scope === 'qualified' ? qualified : contactable
  const lookalikeBlocked = lookalike && seedCount < 100

  async function create() {
    if (!armed) { setArmed(true); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/meta/forms/audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, formName, scope, lookalike, ratio, country: 'AE', confirm: true }),
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

      {/* Scope: which leads seed the audience */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {([
          { key: 'qualified' as const, count: qualified, labelKey: 'pforms.aud.scopeQualified' },
          { key: 'all' as const, count: contactable, labelKey: 'pforms.aud.scopeAll' },
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
