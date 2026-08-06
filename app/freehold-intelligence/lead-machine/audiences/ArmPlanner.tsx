'use client'

/**
 * HOW THE BUDGET WOULD BE SPLIT, AND WHY.
 *
 * The arm planner has been complete and unreachable. This is its surface, and
 * it is deliberately a READ: it shows the split, the reasoning and everything
 * the plan could not establish. Nothing here launches. A planner that spends
 * money because someone opened a screen is not a planner.
 *
 * The caveats are not a footnote — they are the point. A plan that hides what
 * it did not know reads as confidence and is a guess, which is the same
 * mistake as a cost-per-lead of 0.00 on an ad set with no leads.
 */

import { useState } from 'react'
import { Loader2, Layers, AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface Arm { id: string; label: string; kind: string; rationale: string; share: number; dailyBudgetAed: number }
interface Evidence {
  level: number; verdict: string | null; lift: number | null
  narrowingPower: number | null; judged: number; tooRare: number; sentence: string
}
interface Plan {
  headline: string
  arms: Arm[]
  skipped: Array<{ level: number; reason: string }>
  evidence: Evidence[]
  budget: { dailyAed: number; unallocatedAed: number; minPerArmAed: number }
  caveats: string[]
}

export default function ArmPlanner({
  audiences,
}: {
  audiences: Array<{ id: string; name: string; kind: string }>
}) {
  const t = useT()
  const [audienceId, setAudienceId] = useState('')
  const [budget, setBudget] = useState(300)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    if (!audienceId) return
    setLoading(true); setErr(null); setPlan(null)
    try {
      const res = await fetch('/api/freehold/ads/audiences/arms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audienceId, dailyBudgetAed: budget }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('lm.aud.arms.failed'))
      setPlan(data as Plan)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('lm.aud.arms.failed'))
    } finally { setLoading(false) }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
        <Layers className="h-4 w-4 text-gold" /> {t('lm.aud.arms.title')}
      </div>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.arms.sub')}</p>

      <div className="mt-4 flex flex-wrap items-end gap-2.5">
        <select
          value={audienceId}
          onChange={(e) => setAudienceId(e.target.value)}
          className="min-w-[220px] rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40"
        >
          <option value="">{t('lm.aud.arms.pick')}</option>
          {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={50}
            step={50}
            value={budget}
            onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
            className="w-28 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40"
          />
          <span className="text-[12px] text-slate-500">{t('lm.aud.arms.perDay')}</span>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading || !audienceId}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t('lm.aud.arms.plan')}
        </button>
      </div>

      {err && <p className="mt-3 text-[12px] text-red-400">{err}</p>}

      {plan && (
        <div className="mt-5 space-y-4">
          <p className="text-[12.5px] leading-relaxed text-slate-300">{plan.headline}</p>

          {/* The split. Each arm says what it adds and why it earns its share. */}
          <div className="space-y-2">
            {plan.arms.map((a) => (
              <div key={a.id} className="rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-white">{a.label}</span>
                  <span className="shrink-0 text-[12px] font-semibold text-gold">
                    AED {a.dailyBudgetAed}
                    <span className="ms-1.5 text-[11px] font-normal text-slate-500">
                      {Math.round(a.share * 100)}%
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{a.rationale}</p>
              </div>
            ))}
            {plan.arms.length === 0 && (
              <p className="text-[12px] text-slate-500">{t('lm.aud.arms.none')}</p>
            )}
          </div>

          {/* Levels that were deliberately NOT given an arm. Shown as
              prominently as the arms: a decision not to spend is a decision. */}
          {plan.skipped.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t('lm.aud.arms.skipped')}
              </div>
              {plan.skipped.map((s) => (
                <p key={s.level} className="text-[11.5px] leading-relaxed text-slate-400">{s.reason}</p>
              ))}
            </div>
          )}

          {/* What the funnel has and has not proven, level by level. */}
          {plan.evidence.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t('lm.aud.arms.evidence')}
              </div>
              {plan.evidence.map((e) => (
                <p key={e.level} className="text-[11.5px] leading-relaxed text-slate-400">
                  <span className="text-slate-300">{t(`lm.aud.arms.level.${e.level}`)}</span> — {e.sentence}
                </p>
              ))}
            </div>
          )}

          {/* THE CAVEATS. Not a footnote: a plan that hides what it did not
              know reads as confidence and is a guess. */}
          {plan.caveats.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" /> {t('lm.aud.arms.caveats')}
              </div>
              <div className="mt-2 space-y-1.5">
                {plan.caveats.map((c) => (
                  <p key={c} className="text-[11.5px] leading-relaxed text-amber-100/80">{c}</p>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-600">{t('lm.aud.arms.readOnly')}</p>
        </div>
      )}
    </section>
  )
}
