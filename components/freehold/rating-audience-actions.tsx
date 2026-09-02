'use client'

/**
 * The three buttons that move the rating loop's audiences.
 *
 * Deliberately thin: every rule about WHAT goes in an audience lives in
 * seed-cohort.ts and rating-actions.ts, and every decision about whether the
 * seed is big enough to model lives in rating-audiences.ts. This file only
 * asks the server to run them and says what came back.
 *
 * Uploading a contact list takes real time, which is why these are actions a
 * person takes rather than something a page does on load — a screen that
 * silently pushed thousands of hashed contacts to Meta every time somebody
 * opened it would be spending an account's match rate on curiosity.
 */
import { useState } from 'react'
import { Loader2, RefreshCw, ShieldMinus, Users } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Job = 'audiences' | 'exclusion' | null

export default function RatingAudienceActions() {
  const t = useT()
  const [busy, setBusy] = useState<Job>(null)
  const [said, setSaid] = useState<string>('')
  const [failed, setFailed] = useState(false)

  async function run(job: Exclude<Job, null>, url: string) {
    if (busy) return
    setBusy(job); setSaid(''); setFailed(false)
    try {
      const r = await fetch(url, { method: 'POST' })
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (!r.ok) {
        setFailed(true)
        setSaid(String(d.error ?? t('lm.rating.actionFailed')))
        return
      }
      // REPORT WHAT META ACCEPTED, never what was sent. The uploader returns
      // the matched count, and matched is always lower than uploaded — saying
      // "3,000 added" over 1,400 matches is the kind of number that gets
      // believed and then acted on.
      if (job === 'exclusion') {
        setSaid(t('lm.rating.exclusionBuilt', { n: String(Number(d.uploaded ?? 0)) }))
      } else {
        const made = d.lookalikeCreated === true
        setSaid(made ? t('lm.rating.lookalikeMade') : t('lm.rating.audiencesRefreshed'))
      }
    } catch {
      setFailed(true); setSaid(t('lm.rating.actionFailed'))
    } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button" disabled={busy !== null}
        // The RATING-driven sync: it rebuilds both cohorts from the current
        // ratings and creates the lookalike only once the seed is genuinely
        // big enough. Not /audiences/seed, which is the manual named-list
        // upload and takes its own ratios.
        onClick={() => run('audiences', '/api/freehold/ads/rating-loop')}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50"
      >
        {busy === 'audiences' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
        {t('lm.rating.sendToAudience')}
      </button>

      <button
        type="button" disabled={busy !== null}
        onClick={() => run('exclusion', '/api/freehold/ads/audiences/crm-exclusion')}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50"
      >
        {busy === 'exclusion' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldMinus className="h-3.5 w-3.5" />}
        {t('lm.rating.refreshExclusion')}
      </button>

      {said && (
        <span className={`inline-flex items-center gap-1.5 text-xs ${failed ? 'text-rose-300' : 'text-emerald-300'}`}>
          <RefreshCw className="h-3 w-3" /> {said}
        </span>
      )}
    </div>
  )
}
