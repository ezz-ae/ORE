'use client'

/**
 * Ads Machine — floating verdict notifier + CRM lead chip.
 *
 * MachineVerdictNotifier polls the session user's own unanswered verdict
 * questions (GET /api/freehold/ads/machine/my-verdicts) on mount and every
 * 2 minutes. With pending questions it renders a small floating pill on the
 * bottom-START corner (opposite the Toaster / What's-New popover, which live
 * on the end side); clicking it opens a compact popover where each question is
 * answered with one tap. New rows since the last poll fire ONE sonner toast
 * (first new lead's name) — a ref Set of seen ids guarantees no re-toast.
 * Zero pending → renders nothing at all.
 *
 * MachineVerdictLeadChip is the CRM lead-360 banner: if my-verdicts contains a
 * row for THAT lead it shows the machine's question inline with the same
 * one-tap answers. Both POST to the same my-verdicts route and remove
 * optimistically (restoring the row if the server rejects the answer).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Bot, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { VerdictQueueItem } from '@/lib/freehold/ads-machine'

const POLL_MS = 120_000

type Answer = { verdict: 'yes' | 'no' } | { score: number }

async function postAnswer(rowId: string, answer: Answer): Promise<boolean> {
  try {
    const res = await fetch('/api/freehold/ads/machine/my-verdicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdictRowId: rowId, ...answer }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** One compact verdict question: confirm-kind → Yes/No with the machine's
 * suggestion visually pre-highlighted; score-kind → a 0–10 button row. */
export function VerdictQuestionRow({
  item,
  busy,
  onAnswer,
}: {
  item: VerdictQueueItem
  busy: boolean
  onAnswer: (item: VerdictQueueItem, answer: Answer) => void
}) {
  const t = useT()
  const question =
    item.questionKind === 'confirm'
      ? t('lm.machine.q.confirm', { name: item.leadName })
      : t('lm.machine.q.score', { name: item.leadName })

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-white">{item.leadName}</span>
        {item.leadPhoneMasked && (
          <span className="font-mono text-[11px] text-slate-500" dir="ltr">{item.leadPhoneMasked}</span>
        )}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-slate-500">
        {[item.machineName, item.projectSlug, item.trialLabel].filter(Boolean).join(' · ')}
      </div>
      <p className="mt-2 text-sm text-slate-200">{question}</p>

      {item.questionKind === 'confirm' ? (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer(item, { verdict: 'yes' })}
            className={[
              'rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50',
              item.suggestedVerdict === 'yes'
                ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40'
                : 'border-line bg-surface-2 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-300',
            ].join(' ')}
          >
            {t('lm.machine.queue.yes')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer(item, { verdict: 'no' })}
            className={[
              'rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50',
              item.suggestedVerdict === 'no'
                ? 'border-red-400/50 bg-red-400/15 text-red-300 ring-1 ring-red-400/40'
                : 'border-line bg-surface-2 text-slate-300 hover:border-red-400/40 hover:text-red-300',
            ].join(' ')}
          >
            {t('lm.machine.queue.no')}
          </button>
          {item.suggestedVerdict && (
            <span className="text-[10px] text-slate-500">{t('lm.machine.queue.suggested')}</span>
          )}
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {Array.from({ length: 11 }, (_, s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onAnswer(item, { score: s })}
              className="h-7 w-7 rounded-lg border border-line bg-surface-2 text-xs font-semibold text-slate-300 transition hover:border-gold/40 hover:text-gold disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function MachineVerdictNotifier() {
  const t = useT()
  const [items, setItems] = useState<VerdictQueueItem[]>([])
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Ids we have already toasted about — never re-toast a seen question.
  const seenIds = useRef<Set<string>>(new Set())

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/ads/machine/my-verdicts', { cache: 'no-store' })
      if (!res.ok) { setItems([]); return } // signed out / forbidden → nothing, honestly
      const d = await res.json()
      const rows: VerdictQueueItem[] = Array.isArray(d?.verdicts) ? d.verdicts : []
      const fresh = rows.filter((r) => !seenIds.current.has(r.id))
      if (fresh.length > 0) {
        // ONE toast per poll, named after the first new lead.
        toast(t('lm.machine.notifier.toast', { name: fresh[0].leadName }))
        for (const r of fresh) seenIds.current.add(r.id)
      }
      setItems(rows)
    } catch { /* transient network failure — keep the last honest state */ }
  }, [t])

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  async function answer(item: VerdictQueueItem, ans: Answer) {
    setBusyId(item.id)
    // Optimistic remove; restore on failure.
    setItems((prev) => prev.filter((r) => r.id !== item.id))
    const ok = await postAnswer(item.id, ans)
    if (!ok) {
      toast.error(t('lm.machine.queue.answerFailed'))
      setItems((prev) => (prev.some((r) => r.id === item.id) ? prev : [item, ...prev]))
    }
    setBusyId(null)
  }

  if (items.length === 0) return null

  return (
    <>
      {open && (
        <div className="fixed bottom-32 start-4 z-[185] flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-line bg-app shadow-2xl md:bottom-16">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bot className="h-4 w-4 text-gold" />
              {t('lm.machine.notifier.title')}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('lm.machine.notifier.close')}
              className="rounded-lg p-1 text-slate-500 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-start gap-2 border-b border-amber-400/20 bg-amber-400/[0.06] px-4 py-2">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-relaxed text-amber-200/90">{t('lm.machine.queue.warning')}</p>
          </div>
          <div className="space-y-2 overflow-y-auto p-3">
            {items.map((item) => (
              <VerdictQuestionRow key={item.id} item={item} busy={busyId === item.id} onAnswer={answer} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 start-4 z-[180] inline-flex items-center gap-2 rounded-full border border-gold/30 bg-chrome px-4 py-2.5 text-xs font-semibold text-gold shadow-xl transition hover:bg-gold/10 md:bottom-4"
      >
        <Bot className="h-4 w-4" />
        {t('lm.machine.notifier.pill', { n: String(items.length) })}
      </button>
    </>
  )
}

/** CRM lead-360 chip: the machine's open question about THIS lead, answerable
 * inline. Renders nothing when the machine has no question for the lead. */
export function MachineVerdictLeadChip({ leadId }: { leadId: string }) {
  const t = useT()
  const [items, setItems] = useState<VerdictQueueItem[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/freehold/ads/machine/my-verdicts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return
        const rows: VerdictQueueItem[] = Array.isArray(d?.verdicts) ? d.verdicts : []
        setItems(rows.filter((r) => r.leadId === leadId))
      })
      .catch(() => {})
    return () => { active = false }
  }, [leadId])

  async function answer(item: VerdictQueueItem, ans: Answer) {
    setBusyId(item.id)
    setItems((prev) => prev.filter((r) => r.id !== item.id))
    const ok = await postAnswer(item.id, ans)
    if (!ok) {
      toast.error(t('lm.machine.queue.answerFailed'))
      setItems((prev) => (prev.some((r) => r.id === item.id) ? prev : [item, ...prev]))
    }
    setBusyId(null)
  }

  if (items.length === 0) return null

  return (
    <div className="rounded-[18px] border border-amber-400/25 bg-amber-400/[0.05] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
        <Bot className="h-3.5 w-3.5" />
        {t('lm.machine.chip.title')}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-amber-200/70">{t('lm.machine.queue.warning')}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <VerdictQuestionRow key={item.id} item={item} busy={busyId === item.id} onAnswer={answer} />
        ))}
      </div>
    </div>
  )
}
