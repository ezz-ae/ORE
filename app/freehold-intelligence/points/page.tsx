'use client'

/**
 * WHAT RATING HAS EARNED — in dirhams of ad spend, not in tokens.
 *
 * The scheme only works if people can see it. A broker who rates fifty leads
 * and cannot tell which calls came back is being asked to take a payout on
 * faith, and the first month somebody suspects it is not paying is the month
 * they stop rating — which is exactly the failure the points were introduced to
 * fix.
 *
 * SO EVERY VERDICT IS ON THIS PAGE, including the ones that paid nothing.
 * "You earned 4 points" without "and 6 calls were wrong" is a scoreboard with
 * half the score missing, and the half it hides is the half that would teach
 * somebody to rate better.
 *
 * AND IT IS SHOWN IN MONEY. The ledger counts whole units because an INTEGER
 * column is what keeps a balance safe from rounding — that is a storage
 * decision, and it had leaked out as the vocabulary. "4 points" is a token
 * nobody can price; "AED 40 of ad spend" is the same fact in the currency the
 * person works in, and it is ten times the number, because a unit is AED 10.
 *
 * Never a bare "AED 40" beside a balance, always "of ad spend": this is
 * advertising budget somebody earned the right to spend, not cash they can
 * withdraw, and the difference has to survive being screenshotted.
 *
 * The rules are pure and live in lib/freehold/points.ts. This screen reads.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Coins, Loader2, ArrowUpRight } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { CLAIM_VERDICTS, type ClaimVerdict } from '@/lib/freehold/points'
import { aedText } from '@/lib/freehold/credits-shared'

interface Points {
  paid: number
  open: number
  settled: number
  byVerdict: Record<string, number>
  perRating: number
  balance: number | null
  ceiling: number
  remaining: number
}

/** Paid first, then the near misses, then the ones that were never in play. */
const ORDER: ClaimVerdict[] = [
  'paid', 'cappedOut', 'wrong', 'notWorked', 'noForecast', 'knewTheAnswer', 'notFirst', 'tooEarly',
]

const TONE: Record<ClaimVerdict, string> = {
  paid: 'text-emerald-300',
  // Earned but unpaid this month — an amber "you are owed this", never grey.
  cappedOut: 'text-amber-200',
  wrong: 'text-slate-400',
  notWorked: 'text-amber-200',
  noForecast: 'text-slate-500',
  knewTheAnswer: 'text-slate-500',
  notFirst: 'text-slate-500',
  tooEarly: 'text-slate-500',
}

export default function PointsPage() {
  const t = useT()
  const [data, setData] = useState<Points | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const d = await fetch('/api/freehold/points', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    if (!d) { setFailed(true); return }
    setData(d)
  }, [])
  useEffect(() => { void load() }, [load])

  if (failed) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-400">{t('points.unavailable')}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const rated = data.settled + data.open
  // Only the calls that were actually judged count towards a hit rate. Ratings
  // still ripening, or never in play, are not misses — including them would
  // report a falling score to somebody who had done nothing wrong.
  const judged = (data.byVerdict.paid ?? 0) + (data.byVerdict.wrong ?? 0)
  const hitRate = judged > 0 ? Math.round(((data.byVerdict.paid ?? 0) / judged) * 100) : null

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <PageHeader
        Icon={Coins}
        eyebrow={t('points.eyebrow')}
        title={t('points.title')}
        subtitle={t('points.sub', { per: aedText(data.perRating) })}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('points.stat.balance')}
          value={data.balance === null ? '—' : aedText(data.balance)}
          hint={data.balance === null ? t('points.stat.noAccount') : undefined} />
        <StatCard label={t('points.stat.earned')} value={aedText(data.paid)}
          hint={t('points.stat.earnedHint', { rated })} />
        {/* A hit rate on nothing is not 0% — it is a number nobody has yet. */}
        <StatCard label={t('points.stat.hitRate')}
          value={hitRate === null ? '—' : `${hitRate}%`}
          hint={hitRate === null ? t('points.stat.notJudgedYet') : t('points.stat.ofJudged', { n: judged })} />
        <StatCard label={t('points.stat.waiting')} value={data.open.toLocaleString('en-US')}
          hint={t('points.stat.waitingHint')} />
      </div>

      {/* THE CEILING, said before somebody notices accurate calls stopped
          paying and assumes the scheme is broken. */}
      <p className="mt-4 text-[12px] text-slate-500">
        {data.ceiling > 0
          ? t('points.ceiling', {
              earned: aedText(data.paid), ceiling: aedText(data.ceiling), left: aedText(data.remaining),
            })
          : t('points.ceilingNone')}
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-white">{t('points.breakdown')}</h2>
        <p className="mt-1 text-[12px] text-slate-500">{t('points.breakdownSub')}</p>

        {rated === 0 ? (
          <p className="mt-6 text-[13px] text-slate-400">{t('points.none')}</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {ORDER.map((v) => {
                // 'tooEarly' is the only verdict never written to a row — it is
                // "still open and not yet carrying a verdict", so it is counted
                // from what is open MINUS the capped ones, which are also open
                // but have already been judged right.
                const n = v === 'tooEarly'
                  ? Math.max(0, data.open - (data.byVerdict.cappedOut ?? 0))
                  : (data.byVerdict[v] ?? 0)
                if (n === 0) return null
                return (
                  // The number here is a COUNT OF LEADS, never money — "6 calls
                  // were wrong" is the fact, and AED 60 would read as a debt.
                  <li key={v} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className={`w-10 shrink-0 text-right text-[15px] font-semibold tabular-nums ${TONE[v]}`}>
                      {n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] ${TONE[v]}`}>{t(`points.verdict.${v}`)}</span>
                      <span className="block text-[11px] leading-snug text-slate-500">
                        {t(`points.why.${v}`)}
                      </span>
                    </span>
                  </li>
                )
              })}
          </ul>
        )}
      </div>

      <Link href="/freehold-intelligence/crm"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-4 py-2 text-[13px] font-semibold text-slate-200 transition hover:border-gold/40 hover:text-white">
        {t('points.rateMore')} <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

/** Kept beside the render so a new verdict cannot ship without a word for it —
 *  the dynamic-key guard walks CLAIM_VERDICTS against `points.verdict.*`. */
export const VERDICTS_RENDERED = CLAIM_VERDICTS
