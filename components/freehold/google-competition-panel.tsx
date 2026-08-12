'use client'

/**
 * THE AUCTION, READ OUT LOUD.
 *
 * Google separates the two reasons you did not show — outranked, or out of
 * money — and they have opposite fixes:
 *
 *   OUTRANKED   raise the bid, or fix the ad and the landing page. More budget
 *               buys nothing; those auctions were never winnable at any spend.
 *   OUT OF MONEY the auctions were already won and the money ran out. A bid
 *               rise makes it strictly worse, spending the same budget faster.
 *
 * Getting that backwards is the single most expensive mistake in Search, and
 * it is invisible unless somebody goes looking in a report nobody opens. So
 * this panel says which one, in one line, with the number under it.
 *
 * BOUNDS, NOT POINT ESTIMATES. Google clamps every impression share at 0.9 and
 * 0.0999 — those are edges of its own reporting, not measurements — so a
 * clamped value reads "over 90%", never "90%". Same rule as min-evidence.ts.
 */
import { useT } from '@/lib/i18n/provider'
import {
  competitionOf, sharePct, MIN_IMPRESSIONS_FOR_SHARE,
  type CompetitionInput, type Share,
} from '@/lib/google/competition'

const TONE: Record<string, string> = {
  winning:        'text-emerald-300',
  losingToBudget: 'text-amber-200',
  losingToRank:   'text-amber-200',
  losingToBoth:   'text-rose-300',
  thin:           'text-slate-500',
  unknown:        'text-slate-500',
}

function Pct({ s, t }: { s: Share | null; t: ReturnType<typeof useT> }) {
  const p = sharePct(s)
  if (!p) return <span className="text-slate-600">—</span>
  if (p.bound === 'over') return <>{t('gcomp.over', { pct: p.pct })}</>
  if (p.bound === 'under') return <>{t('gcomp.under', { pct: 10 })}</>
  return <>{p.pct}%</>
}

export default function GoogleCompetitionPanel({ input, title }: {
  input: CompetitionInput
  title?: string
}) {
  const t = useT()
  const c = competitionOf(input)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-white">{title ?? t('gcomp.title')}</h3>

      {/* The verdict first, because it is the only line that names an action. */}
      <p className={`mt-1 text-[12px] leading-relaxed ${TONE[c.verdict]}`}>
        {t(`gcomp.verdict.${c.verdict}`, {
          share: sharePct(c.share)?.pct ?? 0,
          rank: Math.round((c.ofLoss?.rank ?? 0) * 100),
          budget: Math.round((c.ofLoss?.budget ?? 0) * 100),
          need: MIN_IMPRESSIONS_FOR_SHARE,
          impressions: c.impressions,
        })}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        <Row label={t('gcomp.share')} v={<Pct s={c.share} t={t} />} />
        <Row label={t('gcomp.lostRank')} v={<Pct s={c.rankLost} t={t} />} />
        <Row label={t('gcomp.lostBudget')} v={<Pct s={c.budgetLost} t={t} />} />
        <Row label={t('gcomp.top')} v={<Pct s={c.topShare} t={t} />} />
        <Row label={t('gcomp.absTop')} v={<Pct s={c.absoluteTopShare} t={t} />} />
      </dl>

      {/* Said once, plainly: this is not the competitor report people expect,
          and that report does not exist in the API for anyone. */}
      <p className="mt-4 text-[10px] leading-relaxed text-slate-600">{t('gcomp.note')}</p>
    </div>
  )
}

function Row({ label, v }: { label: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-slate-200">{v}</dd>
    </div>
  )
}
