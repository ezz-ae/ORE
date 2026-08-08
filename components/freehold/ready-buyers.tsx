'use client'

/**
 * READY BUYERS — the client's own market list as a gallery.
 *
 * Every buyer is SINGLE-COUNTRY and SINGLE-LANGUAGE, and every one is a
 * conversion target. Market rules, learned the expensive way:
 *
 *  · Local buys tomorrow. A brokerage here expects the lead to view this week
 *    and sign this month, and that only happens when the target lives where
 *    the property is — or flies in with the money to.
 *  · Every country has its own way. Saudi is its own campaign, its own
 *    creative, its own price talk — a "GCC" blob is how you tell a client
 *    their agency has never sold there. The whole-Gulf card is a deliberate
 *    choice, clearly labeled, never a default.
 *  · One language per audience. Nobody professional runs Russians and
 *    Italians together; each language is its own market.
 *  · Ages 30–65, enforced in the kitchen. Under 30 barely buys here.
 *
 * `cplAed` is a MARKET ESTIMATE band, shown as such — it exists so a budget
 * conversation starts from reality, and it is replaced by this account's own
 * numbers as soon as leads are rated. The suggested budget is not a guess:
 * it is Meta's learning arithmetic (50 events in 7 days) at the mid CPL.
 *
 * Self-contained: fetches its own saved audiences and reach so the targeting
 * page and any future host can drop it in with one tag.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Loader2, Rocket } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { dailyBudgetToLearn } from '@/lib/freehold/learning-phase'

interface Reach { lower: number; upper: number; ready: boolean }

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))
const reachLabel = (r: Reach | null, t: (k: string) => string, connected: boolean) =>
  !connected ? t('lm.aud.reach.connect') : !r ? t('lm.aud.reach.warming') : `${fmt(r.lower)}–${fmt(r.upper)}`

type BuyerGroup = 'uae' | 'gulf' | 'world'
const EXCLUDES = ['agents_and_brokers', 'job_seekers', 'bargain_hunters']

const READY_BUYERS: { id: string; group: BuyerGroup; cplAed: [number, number]; pattern: Record<string, unknown> }[] = [
  // ── The UAE: buyers already here. The property is always in the UAE; these
  //    are the people who can view it this weekend. ──
  { id: 'arabicCashUAE', group: 'uae', cplAed: [250, 450], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'arabicPlanUAE', group: 'uae', cplAed: [120, 250], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['investment'], money: 'payment_plan',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 70 } },
  { id: 'allArabicUAE', group: 'uae', cplAed: [80, 180], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 60 } },
  // End-user motives are whole-market interests on Meta, so this card runs at
  // full strictness: property interest becomes a hard requirement and the
  // mortgage band narrows the age — anything looser quietly buys the whole UAE.
  { id: 'arabicEndUserUAE', group: 'uae', cplAed: [100, 220], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['first_home', 'upgrade'], money: 'mortgage',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'arabicGoldenVisa', group: 'uae', cplAed: [300, 550], pattern: {
      speakers: ['arabic'], residency: ['resident'], motive: ['golden_visa', 'investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'englishMortgage', group: 'uae', cplAed: [150, 300], pattern: {
      speakers: ['english'], residency: ['resident', 'expat'], motive: ['investment'], money: 'mortgage',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 70 } },
  { id: 'englishCash', group: 'uae', cplAed: [280, 500], pattern: {
      speakers: ['english'], residency: ['resident'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'europeanUAE', group: 'uae', cplAed: [140, 280], pattern: {
      speakers: ['english'], residency: ['expat'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'russianCash', group: 'uae', cplAed: [200, 400], pattern: {
      speakers: ['russian'], residency: ['resident'], motive: ['investment', 'holiday_home'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 70 } },

  // ── The Gulf: every country its own campaign, its own creative, its own
  //    price talk. The whole-GCC card is a deliberate choice, never a default. ──
  { id: 'saudiCash', group: 'gulf', cplAed: [90, 200], pattern: {
      speakers: ['arabic'], residency: ['saudi'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'saudiGoldenVisa', group: 'gulf', cplAed: [120, 260], pattern: {
      speakers: ['arabic'], residency: ['saudi'], motive: ['golden_visa', 'investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'qatarInvestor', group: 'gulf', cplAed: [100, 220], pattern: {
      speakers: ['arabic'], residency: ['qatar'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'kuwaitInvestor', group: 'gulf', cplAed: [100, 220], pattern: {
      speakers: ['arabic'], residency: ['kuwait'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'bahrainInvestor', group: 'gulf', cplAed: [90, 190], pattern: {
      speakers: ['arabic'], residency: ['bahrain'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'omanInvestor', group: 'gulf', cplAed: [80, 170], pattern: {
      speakers: ['arabic'], residency: ['oman'], motive: ['investment'], money: 'cash',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 75 } },
  { id: 'gccArabic', group: 'gulf', cplAed: [70, 160], pattern: {
      speakers: ['arabic'], residency: ['gcc'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 60 } },

  // ── The world: buyers who fly in. The property never moves; the money does. ──
  { id: 'internationalEnglish', group: 'world', cplAed: [60, 150], pattern: {
      speakers: ['english'], residency: ['overseas'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 60 } },
  { id: 'arabicFrance', group: 'world', cplAed: [60, 140], pattern: {
      speakers: ['arabic'], residency: ['france'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'russianEgypt', group: 'world', cplAed: [50, 120], pattern: {
      speakers: ['russian'], residency: ['egypt'], motive: ['investment', 'holiday_home'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'englishEurope', group: 'world', cplAed: [70, 160], pattern: {
      speakers: ['english'], residency: ['europe'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
  { id: 'arabicEurope', group: 'world', cplAed: [60, 140], pattern: {
      speakers: ['arabic'], residency: ['europe'], motive: ['investment'], money: 'unknown',
      readiness: 'browsing', lifeStage: [], exclude: EXCLUDES, strictness: 65 } },
]

const BUYER_GROUPS: BuyerGroup[] = ['uae', 'gulf', 'world']

/** Meta's learning arithmetic at the mid CPL — 50 events in 7 days. Real
 *  numbers, not comfortable ones: a budget below this learns slowly or never,
 *  and pretending otherwise is how "cheap" campaigns stay expensive. */
const suggestedDailyAed = ([lo, hi]: [number, number]) =>
  Math.round(dailyBudgetToLearn((lo + hi) / 2) / 50) * 50

export default function ReadyBuyers() {
  const t = useT()
  const [audiences, setAudiences] = useState<{ id: string; name: string }[]>([])
  const [connected, setConnected] = useState(false)
  const [readySaving, setReadySaving] = useState<string | null>(null)
  const [readyReach, setReadyReach] = useState<Record<string, Reach | null>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/freehold/ads/audiences')
      const data = await res.json()
      setAudiences(Array.isArray(data.audiences) ? data.audiences : [])
      setConnected(data.meta?.connected === true)
    } catch { /* section still renders; reach shows connect-hint */ }
  }, [])
  useEffect(() => { void load() }, [load])

  // One preview call per card, in parallel, once. The number is Meta's own
  // estimate for the card's real targeting — never a decoration figure.
  useEffect(() => {
    let alive = true
    Promise.all(READY_BUYERS.map(async ({ id, pattern }) => {
      try {
        const res = await fetch('/api/freehold/ads/audiences/pattern', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pattern: { ...pattern, name: id } }),
        })
        const d = await res.json()
        return [id, (d?.reach ?? null) as Reach | null] as const
      } catch { return [id, null] as const }
    })).then((pairs) => { if (alive) setReadyReach(Object.fromEntries(pairs)) })
    return () => { alive = false }
  }, [])

  /** Save a ready buyer as a real audience. Once saved it lives in "Your
   *  audiences" like anything else — same kitchen, same launch path. Guarded
   *  by name so a second click cannot create a twin. */
  async function saveReadyBuyer(id: string, pattern: Record<string, unknown>) {
    const name = t(`lm.aud.ready.${id}.name`)
    if (audiences.some((a) => a.name === name)) return
    setReadySaving(id)
    try {
      const res = await fetch('/api/freehold/ads/audiences/pattern', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: true, name, pattern: { ...pattern, name } }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed')
      await load()
    } catch { /* the card simply stays unsaved */ }
    finally { setReadySaving(null) }
  }

  const useHref = (id: string) => `/freehold-intelligence/lead-machine/campaigns/new?audience=${encodeURIComponent(id)}`

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
        <Users className="h-4 w-4 text-gold" /> {t('lm.aud.ready.title')}
      </div>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-400">{t('lm.aud.ready.sub')}</p>
      {BUYER_GROUPS.map((group) => (
        <div key={group} className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t(`lm.aud.ready.g.${group}`)}</div>
          <div className="mt-2.5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {READY_BUYERS.filter((b) => b.group === group).map(({ id, pattern, cplAed }) => {
              const name = t(`lm.aud.ready.${id}.name`)
              const saved = audiences.find((a) => a.name === name)
              return (
                <div key={id} className="flex flex-col rounded-xl border border-line bg-surface-2 p-4">
                  <div className="text-[13px] font-semibold text-white">{name}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{t(`lm.aud.ready.${id}.desc`)}</p>
                  <div className="mt-3 flex-1 space-y-1.5 border-t border-line pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-slate-500">{t('lm.aud.ready.reach')}</span>
                      <span className="text-[12px] font-semibold text-white">{reachLabel(readyReach[id] ?? null, t, connected)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-slate-500">{t('lm.aud.ready.cpl')}</span>
                      <span className="text-[12px] font-semibold text-white">AED {cplAed[0]}–{cplAed[1]}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-slate-500">{t('lm.aud.ready.budget')}</span>
                      <span className="text-[12px] font-semibold text-gold">AED {suggestedDailyAed(cplAed).toLocaleString()}{t('lm.aud.ready.perDay')}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    {saved ? (
                      <Link href={useHref(saved.id)} className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold text-black">
                        <Rocket className="h-3 w-3" /> {t('lm.aud.mine.use')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void saveReadyBuyer(id, pattern)}
                        disabled={readySaving !== null}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
                      >
                        {readySaving === id && <Loader2 className="h-3 w-3 animate-spin" />}
                        {t('lm.aud.ready.save')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {/* Where the numbers come from, said once in small print rather than
          letting an estimate read as a promise on every card. */}
      <p className="mt-4 max-w-2xl text-[10.5px] leading-relaxed text-slate-600">{t('lm.aud.ready.estimateNote')}</p>
    </section>
  )
}
