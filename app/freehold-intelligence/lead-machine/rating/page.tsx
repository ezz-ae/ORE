/**
 * RATING — the whole loop on one screen.
 *
 * "this page has to have every detail on the rate, activities on time rated,
 *  sent, exclude or include… they rate lead by lead, we rate audience and
 *  keywords and interest and behaviour."
 *
 * The rating was scattered across four screens: a distribution on the forms
 * page, cohorts behind an API, latency nowhere, and the audiences it feeds on
 * a page that never mentioned ratings. Nobody could see the loop, so nobody
 * could tell whether it was turning.
 *
 * This is the loop, in the order it actually runs: what the team said, how
 * fast they said it, what each rating then DID, and what that built.
 *
 * ── THE RULE THIS PAGE EXISTS TO MAKE VISIBLE ────────────────────────────
 *
 * Everyone already in the CRM is excluded from every campaign. Always — not a
 * checkbox, not a recommendation. They are not new leads; paying to reach them
 * again buys a duplicate the CRM then spends effort undoing. The launch route
 * applies it unconditionally now, and this page shows whether the list behind
 * it actually exists, because a rule with no list is a sentence.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Star, ShieldMinus, Users, Clock, Gauge, ArrowUpRight } from 'lucide-react'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getServerT } from '@/lib/i18n/server'
import { query } from '@/lib/db'
import { buildLadder } from '@/lib/freehold/rating-ladder'
import { RATING_RULES } from '@/lib/freehold/rating-actions'
import { currentCohorts, ratingAudienceState } from '@/lib/freehold/rating-audiences'
import { crmExclusionAudienceId } from '@/lib/freehold/crm-exclusion'
import { ratingLatency, loopStatus } from '@/lib/freehold/forecast-db'
import RatingAudienceActions from '@/components/freehold/rating-audience-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Per-rating counts across every rated lead. Fail-soft to an empty ladder. */
async function ratingCounts(): Promise<Record<number, number>> {
  try {
    const rows = await query<{ r: string; n: string }>(
      `SELECT value_rating::text AS r, COUNT(*)::text AS n
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE AND value_rating IS NOT NULL
        GROUP BY value_rating`,
    )
    const out: Record<number, number> = {}
    for (const row of rows) {
      const r = Number(row.r)
      if (Number.isFinite(r)) out[r] = Number(row.n) || 0
    }
    return out
  } catch { return {} }
}

/** How many rated outcomes actually reached Meta, and how many are waiting. */
async function reportedCounts(): Promise<{ sent: number; waiting: number }> {
  try {
    const [row] = await query<{ sent: string; waiting: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE coalesce(array_length(meta_reported_stages, 1), 0) > 0)::text AS sent,
         COUNT(*) FILTER (WHERE coalesce(array_length(meta_reported_stages, 1), 0) = 0
                            AND value_rating >= 6)::text AS waiting
       FROM freehold_site_leads
      WHERE archived IS NOT TRUE AND value_rating IS NOT NULL`,
    )
    return { sent: Number(row?.sent) || 0, waiting: Number(row?.waiting) || 0 }
  } catch { return { sent: 0, waiting: 0 } }
}

export default async function RatingPage() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) redirect('/freehold-intelligence/login')
  const { t } = await getServerT()

  const [counts, cohorts, audiences, exclusionId, latency, loop, reported] = await Promise.all([
    ratingCounts(),
    currentCohorts().catch(() => null),
    ratingAudienceState().catch(() => ({ seed: null, avoid: null })),
    crmExclusionAudienceId().catch(() => null),
    ratingLatency().catch(() => ({ rated: 0, medianHours: null, p75Hours: null, sameDayShare: null })),
    loopStatus().catch(() => null),
    reportedCounts(),
  ])
  const ladder = buildLadder(counts)

  const stat = (label: string, value: string, tone = 'text-white') => (
    <div className="rounded-[14px] border border-line bg-surface px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  )

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-gold/25 bg-gold/10">
          <Star className="h-4 w-4 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{t('lm.rating.title')}</h1>
          <p className="text-xs text-slate-500">{t('lm.rating.sub')}</p>
        </div>
      </div>

      {/* ── THE RULE, FIRST, BECAUSE IT IS UNCONDITIONAL ─────────────────── */}
      <section className={`mt-6 rounded-[20px] border p-5 ${
        exclusionId ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-amber-400/30 bg-amber-400/[0.06]'}`}>
        <div className="flex flex-wrap items-start gap-3">
          <ShieldMinus className={`mt-0.5 h-4 w-4 shrink-0 ${exclusionId ? 'text-emerald-300' : 'text-amber-300'}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{t('lm.rating.rule.title')}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{t('lm.rating.rule.body')}</p>
            <p className={`mt-2 text-xs font-medium ${exclusionId ? 'text-emerald-300' : 'text-amber-200'}`}>
              {exclusionId ? t('lm.rating.rule.on') : t('lm.rating.rule.missing')}
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT THE TEAM SAID, AND HOW FAST ─────────────────────────────── */}
      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {stat(t('lm.rating.stat.rated'), String(ladder.rated))}
        {stat(t('lm.rating.stat.median'),
          latency.medianHours === null ? '—' : t('lm.rating.hours', { n: String(latency.medianHours) }),
          (latency.medianHours ?? 0) > 48 ? 'text-amber-300' : 'text-white')}
        {stat(t('lm.rating.stat.sameDay'),
          latency.sameDayShare === null ? '—' : `${latency.sameDayShare}%`)}
        {stat(t('lm.rating.stat.sent'), String(reported.sent),
          reported.waiting > 0 ? 'text-amber-300' : 'text-white')}
      </section>
      {/* Latency is the loop's real constraint — an outcome that reaches Meta
          the same day steers an ad set still learning; a week later it lands
          after the budget is spent. Said only when it is actually slow. */}
      {(latency.medianHours ?? 0) > 48 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-200">
          <Clock className="h-3 w-3" /> {t('lm.rating.slowLoop', { n: String(latency.medianHours) })}
        </p>
      )}

      {/* ── WHAT EACH RATING DOES ────────────────────────────────────────── */}
      <section className="mt-6 rounded-[20px] border border-line bg-surface p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lm.rating.table.title')}</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('lm.rating.table.note')}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 text-start font-semibold">{t('lm.forms.ladder.colRate')}</th>
                <th className="pb-2 text-end font-semibold">{t('lm.forms.ladder.colLeads')}</th>
                <th className="pb-2 ps-4 text-start font-semibold">{t('lm.rating.table.action')}</th>
                <th className="pb-2 text-end font-semibold">{t('lm.rating.table.weight')}</th>
              </tr>
            </thead>
            <tbody>
              {RATING_RULES.map((rule) => {
                const row = ladder.rows.find((r) => r.rating === rule.rating)
                const tone = rule.action === 'exclude' ? 'text-rose-300'
                  : rule.action === 'crmExecution' ? 'text-slate-400' : 'text-emerald-300'
                return (
                  <tr key={rule.rating} className="border-t border-line/50">
                    <td className={`py-1.5 font-semibold tabular-nums ${tone}`}>{rule.rating}</td>
                    <td className={`py-1.5 text-end tabular-nums ${(row?.leads ?? 0) > 0 ? 'text-white' : 'text-slate-600'}`}>
                      {row?.leads ?? 0}
                    </td>
                    <td className={`py-1.5 ps-4 text-[11px] ${tone}`}>{t(`lm.rating.action.${rule.action}`)}</td>
                    <td className="py-1.5 text-end text-[11px] tabular-nums text-slate-500">
                      {rule.weight > 0 ? `+${rule.weight}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── WHAT THAT BUILT ──────────────────────────────────────────────── */}
      <section className="mt-6 rounded-[20px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lm.rating.audiences.title')}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('lm.rating.audiences.note')}</p>
          </div>
          <Link href="/freehold-intelligence/lead-machine/audiences"
            className="inline-flex items-center gap-1 text-xs font-semibold text-gold transition hover:text-gold-bright">
            {t('lm.rating.openAudiences')} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {stat(t('lm.rating.stat.seed'), String(cohorts?.cohorts.seed.length ?? 0), 'text-emerald-300')}
          {stat(t('lm.rating.stat.exclude'), String(cohorts?.cohorts.exclude.length ?? 0), 'text-rose-300')}
          {stat(t('lm.rating.stat.neutral'), String(cohorts?.cohorts.neutral.length ?? 0), 'text-slate-400')}
        </div>

        {/* The lookalike is NOT built early: below Meta's working floor it
            produces something indistinguishable from open targeting. Waiting
            is the honest state and it is said rather than hidden. */}
        <p className="mt-3 text-xs text-slate-500">
          {audiences.seed?.lookalikeId
            ? t('lm.rating.lookalikeReady')
            : t('lm.rating.lookalikeWaiting', { n: String(cohorts?.cohorts.seed.length ?? 0) })}
        </p>

        <div className="mt-4 border-t border-line pt-4">
          <RatingAudienceActions />
        </div>
      </section>

      {/* ── AND WHETHER THE FORECAST DESERVES TO BE BELIEVED ─────────────── */}
      {loop && loop.accuracy.meanAbsoluteError !== null && (
        <section className="mt-6 rounded-[20px] border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-slate-500" />
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lm.rating.accuracy.title')}</div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {t('lm.rating.accuracy.body', {
              err: String(loop.accuracy.meanAbsoluteError),
              n: String(loop.accuracy.rated),
            })}
          </p>
          {loop.calibration.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {loop.calibration.slice(0, 6).map((c) => (
                <div key={c.source} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-line/60 bg-surface-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{c.source}</span>
                  <span className="text-[11px] tabular-nums text-slate-500">{t('lm.rating.ratedN', { n: String(c.rated) })}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    c.verdict === 'underBought' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : c.verdict === 'overBought' ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    : 'border-line-strong bg-surface-2 text-slate-400'}`}>
                    {t(`lm.rating.verdict.${c.verdict}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <Users className="h-3 w-3" />
        <Link href="/freehold-intelligence/crm" className="hover:text-slate-300">{t('lm.rating.openCrm')}</Link>
      </div>
    </main>
  )
}
