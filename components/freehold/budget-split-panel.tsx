'use client'

/**
 * WHERE THE NEXT DIRHAM SHOULD GO.
 *
 * The machine moves budget one decision at a time — pause a loser, raise a
 * winner into spare headroom. Nobody has ever been shown the whole cap at once
 * with a view on how it ought to be arranged.
 *
 * Two numbers per row and they are deliberately different: the TARGET, and what
 * it should run at TOMORROW. A budget change over a fifth re-enters Meta's
 * learning phase, so a big cut is a glide over several days — and a panel that
 * showed only the target would be inviting somebody to type it in and reset the
 * learning on every ad set they own.
 *
 * Apply writes tomorrow's number, not the target. One campaign, one ad set, one
 * click. A campaign with several ad sets is shown and not applied: splitting a
 * budget across ad sets is a different decision and not one to make on
 * somebody's behalf without asking which.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { SplitAction, SplitReason } from '@/lib/freehold/budget-split'

interface Plan {
  campaignId: string
  name: string
  action: SplitAction
  reason: SplitReason
  currentAed: number
  targetAed: number
  stepAed: number
  glideDays: number
  saturated: boolean
  frequency: number
  adSetIds: string[]
  channel: 'meta' | 'google'
}

interface Response {
  connected: boolean
  live?: number
  capAed?: number
  capIsConfigured?: boolean
  costPerLeadAed?: number | null
  perArmAed?: number | null
  supportedArms?: number | null
  tomorrowAed?: number
  overCapAed?: number
  plans?: Plan[]
  error?: string
}

const TONE: Record<SplitAction, string> = {
  raise: 'text-emerald-300', lower: 'text-amber-200',
  starve: 'text-rose-300', hold: 'text-slate-400',
}

const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`

export default function BudgetSplitPanel() {
  const t = useT()
  const [data, setData] = useState<Response | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const d = await fetch('/api/ads/budget-split', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setData(d)
  }, [])
  useEffect(() => { void load() }, [load])

  async function apply(p: Plan) {
    if (p.adSetIds.length !== 1) return
    setBusy(p.campaignId)
    setErr('')
    const res = await fetch(`/api/meta/adsets/${p.adSetIds[0]}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      // TOMORROW'S NUMBER, never the target. Writing the target would reset
      // the learning phase this whole module exists to protect.
      body: JSON.stringify({ dailyBudgetAED: p.stepAed }),
    }).then((r) => r.json()).catch(() => null)
    setBusy(null)
    if (res?.error) { setErr(String(res.error)); return }
    setDone((s) => new Set(s).add(p.campaignId))
    void load()
  }

  if (!data) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }
  if (!data.connected || data.error || !data.plans?.length) return null

  const moves = data.plans.filter((p) => p.action !== 'hold')

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-white">{t('split.title')}</h3>

      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
        {data.supportedArms !== null && data.supportedArms !== undefined && data.perArmAed
          ? t('split.said.carries', {
              cap: aed(data.capAed ?? 0), n: data.supportedArms,
              live: data.live ?? 0, perArm: aed(data.perArmAed),
            })
          : t('split.said.noPrice', { cap: aed(data.capAed ?? 0), live: data.live ?? 0 })}
      </p>

      {moves.length === 0 && (
        <p className="mt-3 text-[12px] text-emerald-300">{t('split.settled')}</p>
      )}

      <ul className="mt-4 space-y-3">
        {data.plans.map((p) => (
          <li key={p.campaignId} className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-slate-200">{p.name}</span>
              <span className={`block text-[11px] tabular-nums ${TONE[p.action]}`}>
                {p.action === 'starve'
                  ? t('split.row.starve', { current: aed(p.currentAed) })
                  : t('split.row.move', { current: aed(p.currentAed), step: aed(p.stepAed) })}
              </span>
              <span className="block text-[10px] leading-snug text-slate-500">
                {t(`split.why.${p.reason}`, {
                  target: aed(p.targetAed), days: p.glideDays,
                  freq: p.frequency ? p.frequency.toFixed(1) : '—',
                })}
              </span>
            </span>

            {/* A button that cannot do the thing is worse than no button. With
                more than one ad set the panel says which, and stops. */}
            {p.action !== 'hold' && p.action !== 'starve' && (
              done.has(p.campaignId)
                ? <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-emerald-300">
                    <Check className="h-2.5 w-2.5" />{t('split.applied')}
                  </span>
                : p.adSetIds.length === 1
                  ? <button type="button" disabled={busy === p.campaignId} onClick={() => void apply(p)}
                      className="shrink-0 rounded-lg border border-line-strong bg-surface-2 px-2 py-1 text-[10px] font-semibold text-slate-200 transition hover:border-gold/40 hover:text-white disabled:opacity-50">
                      {busy === p.campaignId
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        : t('split.apply', { step: aed(p.stepAed) })}
                    </button>
                  // A button that cannot do the thing is worse than no
                  // button. Google budgets live on the campaign, not on ad
                  // sets, so this panel plans them and says where to set them.
                  : <span className="shrink-0 text-[10px] text-slate-500">
                      {p.channel === 'google'
                        ? t('split.onGoogle')
                        : t('split.manyAdSets', { n: p.adSetIds.length })}
                    </span>
            )}
          </li>
        ))}
      </ul>

      {err && <p className="mt-3 text-[11px] text-rose-300">{err}</p>}

      {/* The plan does not land overnight and says so. Claiming otherwise
          would be a lie about what Meta allows. */}
      {(data.overCapAed ?? 0) > 0 && (
        <p className="mt-4 text-[10px] text-amber-200">
          {t('split.overCap', { over: aed(data.overCapAed ?? 0), cap: aed(data.capAed ?? 0) })}
        </p>
      )}
      {data.capIsConfigured === false && (
        <p className="mt-2 text-[10px] text-slate-500">{t('split.noCap')}</p>
      )}
    </div>
  )
}
