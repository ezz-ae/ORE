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
 * Four steps, one line each, numbers doing the talking:
 *
 *   Rated            40 of 571 · 12 good · 9 junk
 *   Sent to Meta     12 of 12
 *   Audience         74 of 100 matched              [Build]
 *   In campaigns     Nothing to attach
 *
 * IT USED TO EXPLAIN ITSELF THREE TIMES. A subtitle about our own methodology,
 * a step label that was a full sentence, and a line under it restating that
 * sentence in longer words — then three more stacked lines repeating the
 * counts. Nobody reads a panel that talks that much, and an unread panel
 * protects nothing. Two words and a count carry every row.
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
import { SEED_SIGNALS, AVOID_SIGNALS, type CohortEvidence } from '@/lib/freehold/seed-cohort'

const TONE: Record<string, string> = {
  done: 'text-emerald-300',
  waiting: 'text-amber-200',
  blocked: 'text-rose-300',
  idle: 'text-slate-500',
}

export default function RatingLoopWidget() {
  const t = useT()
  const [steps, setSteps] = useState<LoopStep[] | null>(null)
  const [evidence, setEvidence] = useState<CohortEvidence | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const d = await fetch('/api/freehold/ads/rating-loop', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setSteps(Array.isArray(d?.steps) ? d.steps : [])
    setEvidence((d?.evidence as CohortEvidence | null) ?? null)
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
      {/* NO SUBTITLE. It used to explain the panel's own methodology — "every
          step below is counted, not estimated" — which is a sentence about us,
          not about their leads, and nobody reads it twice. */}
      <h2 className="text-sm font-semibold text-white">{t('loop.title')}</h2>

      <div className="mt-3 space-y-1.5">
        {steps.map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 ${TONE[s.state]}`}>
              {s.state === 'done' ? <Check className="h-3.5 w-3.5" />
                : s.state === 'blocked' ? <AlertTriangle className="h-3.5 w-3.5" />
                : s.state === 'waiting' ? <ArrowRight className="h-3.5 w-3.5" />
                : <CircleDashed className="h-3.5 w-3.5" />}
            </span>
            {/* ONE LINE: the step, then its numbers. The label used to be a
                sentence ("The ones who were worth it become an audience to
                copy — the rest become a list to avoid") and the line under it
                said the same thing again in longer words. Two words and a
                count carry it. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] text-slate-200">{t(`loop.step.${s.id}`)}</span>
              <span className={`text-[11px] tabular-nums ${TONE[s.state]}`}>
                {t(`loop.said.${s.id}.${s.state}`, s.vars as Record<string, string | number>)}
              </span>
              {/* The makeup, on the SAME line — and it is the proof the seed
                  is not just the rating column reshaped. It used to be three stacked
                  lines under the step, which restated the counts already
                  above them. */}
              {s.id === 'seeded' && evidence && (
                <span className="flex flex-wrap items-baseline gap-x-2 text-[10px] text-slate-500">
                  <SignalLine label={t('loop.made.seed')} counts={evidence.seed} keys={SEED_SIGNALS} t={t} />
                  <SignalLine label={t('loop.made.avoid')} counts={evidence.avoid} keys={AVOID_SIGNALS} t={t} />
                  {evidence.seedBeyondRatings > 0 && (
                    <span>{t('loop.made.beyond', { n: evidence.seedBeyondRatings })}</span>
                  )}
                </span>
              )}
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

/** One cohort's makeup — only the signals that actually have somebody behind
 *  them. A zero is printed nowhere: "0 blocked" is noise on a busy screen and
 *  a row of zeroes reads as a broken panel. */
function SignalLine({ label, counts, keys, t }: {
  label: string
  counts: Record<string, number>
  keys: readonly string[]
  t: (k: string, v?: Record<string, string | number>) => string
}) {
  const present = keys.filter((k) => (counts[k] ?? 0) > 0)
  if (present.length === 0) return null
  return (
    <span>
      <span className="text-slate-600">{label}</span>{' '}
      {present.map((k, i) => (
        <span key={k}>
          {i > 0 && <span className="text-slate-700">·</span>}
          <span className="text-slate-400">{counts[k]}</span> {t(`loop.sig.${k}`)}{' '}
        </span>
      ))}
    </span>
  )
}

export type { LoopStep, LoopStepId }
