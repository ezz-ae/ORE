'use client'

/**
 * WHAT YOUR RATINGS ARE DOING — the loop, on screen, with real numbers.
 *
 * Brokers started rating leads. Ten seconds a lead, several hundred leads, and
 * no evidence anywhere that any of it reached Meta. A rating that changes
 * nothing is worse than no rating, and a team that cannot see the effect stops
 * doing it inside a week — which costs the single strongest signal this
 * product has.
 *
 * So the four steps are drawn, each with the number it stands on:
 *
 *   Rated       40 of 571 · 12 worth having · 9 junk
 *   Told Meta   12 of 12 sent
 *   Seeded      74 of 100 matched
 *   Targeting   nothing attached yet          [Attach]
 *
 * NO STEP IS GREEN WITHOUT ITS EVIDENCE. A lookalike built from a dozen people
 * reads WAITING, not done — Meta accepts that request and produces something
 * indistinguishable from open targeting, which is the worst outcome because it
 * looks precise. And the seed count is what Meta MATCHED, never what we
 * uploaded: reporting the upload is reporting our own intention.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, ArrowRight, CircleDashed, AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { LoopStep, LoopStepId } from '@/lib/freehold/rating-loop'

const TONE: Record<string, string> = {
  done: 'text-emerald-300',
  waiting: 'text-amber-200',
  blocked: 'text-rose-300',
  idle: 'text-slate-500',
}

export default function RatingLoopWidget() {
  const t = useT()
  const [steps, setSteps] = useState<LoopStep[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const d = await fetch('/api/freehold/ads/rating-loop', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setSteps(Array.isArray(d?.steps) ? d.steps : [])
  }, [])

  useEffect(() => { void load() }, [load])

  async function sync() {
    if (busy) return
    setBusy(true); setNote('')
    try {
      const r = await fetch('/api/freehold/ads/rating-loop', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setNote(d?.error || t('loop.syncFailed')); return }
      // REPORT WHAT META MATCHED, not that a request returned 200. A sync that
      // matched nobody is a real outcome and the operator is owed it.
      setNote(t('loop.synced', {
        seed: Number(d?.seedMatched) || 0,
        avoid: Number(d?.suppressionMatched) || 0,
      }))
      await load()
    } catch { setNote(t('loop.syncFailed')) } finally { setBusy(false) }
  }

  if (!steps) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-white">{t('loop.title')}</h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t('loop.sub')}</p>

      <div className="mt-4 space-y-2.5">
        {steps.map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 ${TONE[s.state]}`}>
              {s.state === 'done' ? <Check className="h-3.5 w-3.5" />
                : s.state === 'blocked' ? <AlertTriangle className="h-3.5 w-3.5" />
                : s.state === 'waiting' ? <ArrowRight className="h-3.5 w-3.5" />
                : <CircleDashed className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-slate-200">{t(`loop.step.${s.id}`)}</div>
              {/* The numbers the state stands on — never a claim without them. */}
              <div className={`text-[11px] leading-snug ${TONE[s.state]}`}>
                {t(`loop.said.${s.id}.${s.state}`, s.vars as Record<string, string | number>)}
              </div>
            </div>
            {s.action === 'sync' && (
              <button type="button" onClick={() => void sync()} disabled={busy}
                className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : t('loop.act.sync')}
              </button>
            )}
            {s.action === 'attach' && (
              <a href="/freehold-intelligence/lead-machine/campaigns/new"
                className="shrink-0 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-gold/40 hover:text-white">
                {t('loop.act.attach')}
              </a>
            )}
          </div>
        ))}
      </div>

      {note && <p className="mt-3 text-[11px] text-slate-400">{note}</p>}
    </div>
  )
}

export type { LoopStep, LoopStepId }
