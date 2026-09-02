import Link from 'next/link'
import { formatInstant } from '@/lib/freehold/clock'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { FileText, Plus, AlertCircle, ArrowUpRight, CheckCircle2, Users, Zap, Facebook } from 'lucide-react'
import { MetaConfigError, MetaApiError, getAccountAdInsights, isMetaConfigured } from '@/lib/meta/client'
import { readFunnel, adviseForm } from '@/lib/freehold/form-funnel'
import { listLeadFormsMerged } from '@/lib/meta/form-registry'
import { groupFormsByPage } from '@/lib/meta/form-templates'
import type { MetaLeadForm } from '@/lib/meta/types'
import { getServerT } from '@/lib/i18n/server'
import { answerOutcomes, type AnswerOutcome } from '@/lib/freehold/answer-outcomes'
import { query } from '@/lib/db'
import { buildLadder, RATING_BAND_IDS, isSeedBand, BAND_AUDIENCE } from '@/lib/freehold/rating-ladder'
import { DemoNotice } from '@/components/freehold/demo-badge'
import { FormsSyncControls } from './_sync'
import { FormAudienceBuilder } from './_audience'

interface FormsResponse {
  forms: MetaLeadForm[]
  error?: string
  demo?: boolean
}

async function getForms(): Promise<FormsResponse> {
  try {
    // Meta's paginated list merged with locally-registered (platform-created)
    // forms — Meta's list edge omits DRAFT forms, so without the merge a form
    // created here could silently vanish from this page.
    const forms = await listLeadFormsMerged()
    return { forms }
  } catch (err) {
    // Not connected → nothing fake: an empty list plus the connect notice.
    if (err instanceof MetaConfigError) return { forms: [], demo: true }
    if (err instanceof MetaApiError)    return { forms: [], error: err.message }
    return { forms: [], error: 'Unexpected error loading forms' }
  }
}

// Honest status rendering: only DELETED is red. DRAFT/PAUSED get an amber
// "goes live when attached to a running ad" badge, and any status we don't
// recognize renders neutral with Meta's raw text (labelKey null) — never
// defaulting to "deleted".
function statusConfig(s: string): { dot: string; text: string; badge: string; labelKey: string | null } {
  if (s === 'ACTIVE')   return { dot: 'bg-emerald-400', text: 'text-emerald-300', badge: 'border-emerald-500/25 bg-emerald-500/10', labelKey: 'lm.forms.status.active'   }
  if (s === 'DRAFT' || s === 'PAUSED')
    return                     { dot: 'bg-amber-400',   text: 'text-amber-300',  badge: 'border-amber-400/20 bg-amber-400/10',   labelKey: 'lm.forms.status.draft'    }
  if (s === 'ARCHIVED') return { dot: 'bg-slate-500',   text: 'text-slate-400',  badge: 'border-slate-500/20 bg-slate-500/10',   labelKey: 'lm.forms.status.archived' }
  if (s === 'DELETED')  return { dot: 'bg-red-400',     text: 'text-red-300',    badge: 'border-red-400/20 bg-red-400/10',       labelKey: 'lm.forms.status.deleted'  }
  return                       { dot: 'bg-slate-500',   text: 'text-slate-400',  badge: 'border-slate-500/20 bg-slate-500/10',   labelKey: null                       }
}

/**
 * Per-form CRM truth: how many of each Meta form's leads made it into the CRM,
 * how many a human has value-rated, and the average value — the form's RATE,
 * visible from outside without opening it. Plus the portfolio totals that
 * power the all-forms audience builder.
 */
interface FormCrmStats { n: number; rated: number; avg: number | null; contactable: number; qualified: number }
interface AllFormsStats { n: number; rated: number; avg: number | null; contactable: number; qualified: number }

const CONTACTABLE_SQL =
  `(length(regexp_replace(coalesce(phone, ''), '\\D', '', 'g')) >= 7 OR (email IS NOT NULL AND position('@' in email) > 0))`

/**
 * OPENS PER FORM, WITHOUT ASKING META WHICH ADS BELONG TO WHICH FORM.
 *
 * Meta reports opens per AD. Mapping ads to forms through the Graph means
 * reading every ad's creative to find its lead_gen_form_id — a request per ad,
 * on a page that already loads slowly.
 *
 * The mapping is already in our own database. Every synced lead carries both
 * meta_ad_id and meta_form_id, so the ads that belong to a form are the ads
 * its leads came through. That is one cheap query against data we own, and it
 * is exact for any form that has ever produced a lead.
 *
 * Its one limit, stated because it decides how the result is read: a form that
 * has produced NO leads has no rows here, so no ads, so no opens — and it will
 * read as "not reported" rather than as 0%. That is the honest answer. A form
 * with opens and no submissions is exactly the case worth knowing about, and
 * this mapping cannot see it; a Graph-side lookup would be needed for that and
 * it is not worth a request per ad to catch it.
 */
async function getAdsByForm(): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  try {
    const rows = await query<{ form: string; ad: string }>(
      `SELECT DISTINCT meta_form_id AS form, meta_ad_id AS ad
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND meta_form_id IS NOT NULL AND meta_form_id <> ''
          AND meta_ad_id IS NOT NULL AND meta_ad_id <> ''`,
    )
    for (const r of rows) out.set(r.form, [...(out.get(r.form) ?? []), r.ad])
  } catch { /* no mapping means no funnel, which reads as not reported */ }
  return out
}

/**
 * HOW MANY OF A FORM'S SUBMITTERS ANSWERED EACH QUESTION, IN THE FORM'S ORDER.
 *
 * The advice half of the funnel. Knowing a form leaks says fix it; knowing
 * WHICH question people stop at says how. Without this the only honest advice
 * is "ask less", which is true of every long form and useful about none of
 * them.
 *
 * meta_answers has stored the resolved answers on every synced lead since the
 * sync existed, so the rates come from our own rows rather than another Graph
 * request. Position is preserved with ordinality: a question's ORDER is the
 * whole point — a weak question buried in the middle can be moved, and one
 * that is already first can only be dropped.
 *
 * Fail-soft to an empty map: no per-question data means the generic advice,
 * not a wrong specific one.
 */
async function getAnsweredRatesByForm(): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  try {
    const rows = await query<{ form: string; pos: string; answered: string; total: string }>(
      `WITH per_lead AS (
         SELECT id, meta_form_id,
                a.ord AS pos,
                NULLIF(trim(a.item ->> 'answer'), '') AS answer
           FROM freehold_site_leads l
           CROSS JOIN LATERAL jsonb_array_elements(l.meta_answers) WITH ORDINALITY AS a(item, ord)
          WHERE l.archived IS NOT TRUE
            AND l.meta_form_id IS NOT NULL AND l.meta_form_id <> ''
            AND jsonb_typeof(l.meta_answers) = 'array'
       )
       SELECT meta_form_id AS form, pos::text,
              COUNT(answer)::text AS answered,
              COUNT(*)::text AS total
         FROM per_lead
        GROUP BY meta_form_id, pos
        ORDER BY meta_form_id, pos`,
    )
    for (const r of rows) {
      const pos = Number(r.pos)
      const total = Number(r.total) || 0
      if (!Number.isFinite(pos) || total <= 0) continue
      const list = out.get(r.form) ?? []
      list[pos - 1] = (Number(r.answered) || 0) / total
      out.set(r.form, list)
    }
    // A hole (a question nobody answered at all) reads as 0, never undefined —
    // it is the strongest possible signal about that question.
    for (const [k, v] of out) out.set(k, Array.from(v, (n) => (Number.isFinite(n) ? n : 0)))
  } catch { /* no per-question data means generic advice, not wrong advice */ }
  return out
}

/**
 * HOW MANY LEADS AT EACH RATING — the distribution the average hides.
 *
 * Two accounts both averaging 5 are opposite businesses when one is all 5s and
 * the other is half 10s and half 0s, and only the second has anything worth
 * building an audience from. See lib/freehold/rating-ladder.ts.
 *
 * Fail-soft to an empty ladder: a table that cannot load shows nothing rated,
 * which is what an empty account looks like anyway.
 */
async function getRatingCounts(): Promise<Record<number, number>> {
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

async function getCrmStatsByForm(): Promise<{ perForm: Map<string, FormCrmStats>; all: AllFormsStats }> {
  const empty: AllFormsStats = { n: 0, rated: 0, avg: null, contactable: 0, qualified: 0 }
  try {
    const rows = await query<{ meta_form_id: string; n: string; rated: string; avg: string | null; contactable: string; qualified: string }>(
      `SELECT meta_form_id, COUNT(*)::text AS n,
              COUNT(value_rating)::text AS rated,
              AVG(value_rating)::text AS avg,
              COUNT(*) FILTER (WHERE ${CONTACTABLE_SQL})::text AS contactable,
              COUNT(*) FILTER (WHERE value_rating >= 6 AND ${CONTACTABLE_SQL})::text AS qualified
         FROM freehold_site_leads
        WHERE meta_form_id IS NOT NULL AND archived IS NOT TRUE
        GROUP BY meta_form_id`,
    )
    const [totals] = await query<{ n: string; rated: string; avg: string | null; contactable: string; qualified: string }>(
      `SELECT COUNT(*)::text AS n,
              COUNT(value_rating)::text AS rated,
              AVG(value_rating)::text AS avg,
              COUNT(*) FILTER (WHERE ${CONTACTABLE_SQL})::text AS contactable,
              COUNT(*) FILTER (WHERE value_rating >= 6 AND ${CONTACTABLE_SQL})::text AS qualified
         FROM freehold_site_leads
        WHERE meta_form_id IS NOT NULL AND archived IS NOT TRUE`,
    )
    return {
      perForm: new Map(rows.map((r) => [r.meta_form_id, {
        n: Number(r.n) || 0,
        rated: Number(r.rated) || 0,
        avg: r.avg === null ? null : Number(r.avg),
        contactable: Number(r.contactable) || 0,
        qualified: Number(r.qualified) || 0,
      }])),
      all: totals
        ? {
            n: Number(totals.n) || 0,
            rated: Number(totals.rated) || 0,
            avg: totals.avg === null ? null : Number(totals.avg),
            contactable: Number(totals.contactable) || 0,
            qualified: Number(totals.qualified) || 0,
          }
        : empty,
    }
  } catch {
    // value_rating / meta columns may not exist before the first sync or the
    // first rating — degrade to counts-only, never to a crashed page.
    try {
      const rows = await query<{ meta_form_id: string; n: string; contactable: string }>(
        `SELECT meta_form_id, COUNT(*)::text AS n,
                COUNT(*) FILTER (WHERE ${CONTACTABLE_SQL})::text AS contactable
           FROM freehold_site_leads
          WHERE meta_form_id IS NOT NULL AND archived IS NOT TRUE
          GROUP BY meta_form_id`,
      )
      return {
        perForm: new Map(rows.map((r) => [r.meta_form_id, { n: Number(r.n) || 0, rated: 0, avg: null, contactable: Number(r.contactable) || 0, qualified: 0 }])),
        all: {
          ...empty,
          n: rows.reduce((s, r) => s + (Number(r.n) || 0), 0),
          contactable: rows.reduce((s, r) => s + (Number(r.contactable) || 0), 0),
        },
      }
    } catch {
      return { perForm: new Map(), all: empty }
    }
  }
}

export default async function FormsPage() {
  // Server-side gate: this page runs live DB + Meta queries and streams every
  // form's lead counts and value stats in the RSC payload. The app's layout
  // guard is client-only (redirects after render), so without this check an
  // unauthenticated or broker request would receive that data before any
  // redirect fired. Operators only — the forms tab is a marketing surface.
  const sessionUser = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  const operatorRoles = new Set<string>([...MANAGEMENT_ROLES, 'marketing'])
  if (!sessionUser || !operatorRoles.has(sessionUser.role)) redirect('/freehold-intelligence')

  const { t }         = await getServerT()
  const data          = await getForms()
  const crmStats      = await getCrmStatsByForm()
  const ladder        = buildLadder(await getRatingCounts())
  // Opens come from the account-wide ad insights call, which was already
  // fetching the actions array and discarding everything but the lead count.
  const [adsByForm, answeredRates, adInsights] = await Promise.all([
    getAdsByForm(),
    getAnsweredRatesByForm(),
    isMetaConfigured().then((ok) => (ok ? getAccountAdInsights() : new Map())).catch(() => new Map()),
  ])
  /** Opens for one form: the sum across its ads, or null when Meta reported
   *  none of them. Null is not zero — a form whose opens were never reported
   *  must not be shown as converting 0%. */
  const formOpensFor = (formId: string): number | null => {
    const ads = adsByForm.get(formId) ?? []
    let total: number | null = null
    for (const ad of ads) {
      const o = adInsights.get(ad)?.formOpens
      if (typeof o === 'number') total = (total ?? 0) + o
    }
    return total
  }
  const answerQs      = await answerOutcomes()
  const crmByForm     = new Map([...crmStats.perForm.entries()].map(([id, s]) => [id, s.n]))
  const isConfigError = data.demo === true
  const forms         = data.forms
  const active        = forms.filter((f) => f.status === 'ACTIVE').length
  const totalLeads    = forms.reduce((s, f) => s + (f.leads_count ?? 0), 0)

  const infoCards = [
    { icon: FileText,     titleKey: 'lm.forms.info.instantTitle', bodyKey: 'lm.forms.info.instantBody' },
    { icon: CheckCircle2, titleKey: 'lm.forms.info.crmTitle',     bodyKey: 'lm.forms.info.crmBody'     },
    { icon: Users,        titleKey: 'lm.forms.info.nativeTitle',  bodyKey: 'lm.forms.info.nativeBody'  },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <FileText className="h-3.5 w-3.5" /> {t('lm.forms.eyebrow')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {t('lm.forms.title')}<br />
            <span className="text-slate-500">
              {isConfigError ? t('lm.forms.titleNotConnected') : t('lm.forms.titleTotal', { n: String(forms.length) })}
            </span>
          </h1>
        </section>

        <Link
          href="/freehold-intelligence/lead-machine/forms/new"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright sm:mt-10"
        >
          <Plus className="h-4 w-4" /> {t('lm.forms.newForm')}
        </Link>
      </div>

      {/* Manual sync + real-time webhook health — lead ingestion must never
          again depend invisibly on a cron env var being configured. */}
      {!isConfigError && <FormsSyncControls />}

      {/* Config error */}
      {isConfigError && (
        <div className="mt-8 rounded-[20px] border border-line bg-surface-2 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold/70" />
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.forms.metaNotConnected')}</div>
              <p className="mt-1 text-sm text-slate-400">{data.error}</p>
              <Link
                href="/freehold-intelligence/integrations/meta"
                className="mt-3 inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold"
              >
                {t('lm.forms.setupMeta')} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* API error */}
      {data.error && !isConfigError && (
        <div className="mt-8 rounded-[18px] border border-line bg-surface-2 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-300">{data.error}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {!isConfigError && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { labelKey: 'lm.forms.stat.activeForms', value: active,      color: 'text-emerald-300' },
            { labelKey: 'lm.forms.stat.totalForms',  value: forms.length, color: 'text-white'       },
            { labelKey: 'lm.forms.stat.totalLeads',  value: totalLeads,  color: totalLeads > 0 ? 'text-gold' : 'text-white' },
          ].map((s) => (
            <div key={s.labelKey} className="rounded-[18px] border border-line bg-surface p-4">
              <div className={`text-[26px] font-semibold leading-none ${s.color}`}>{s.value}</div>
              <div className="mt-1.5 text-sm text-slate-500">{t(s.labelKey)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Portfolio value + the all-forms audience action. The whole form
          estate judged on one line — and one click to turn every rated lead
          across every form into a Custom Audience / ready lookalike. */}
      {!isConfigError && crmStats.all.n > 0 && (
        <section className="mt-6 grid gap-4 sm:grid-cols-[1fr_340px]">
          <div className="rounded-[20px] border border-line bg-surface p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lm.forms.portfolioTitle')}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('lm.forms.portfolioInCrm'), value: String(crmStats.all.n), cls: 'text-white' },
                { label: t('lm.forms.portfolioRated'), value: String(crmStats.all.rated), cls: crmStats.all.rated > 0 ? 'text-white' : 'text-slate-500' },
                {
                  label: t('lm.forms.portfolioAvg'),
                  value: crmStats.all.avg === null ? '—' : crmStats.all.avg.toFixed(1),
                  cls: crmStats.all.avg === null ? 'text-slate-500'
                    : crmStats.all.avg >= 6 ? 'text-emerald-300'
                    : crmStats.all.avg <= 3.5 ? 'text-red-300' : 'text-amber-300',
                },
                { label: t('lm.forms.portfolioQualified'), value: String(crmStats.all.qualified), cls: crmStats.all.qualified > 0 ? 'text-emerald-300' : 'text-slate-500' },
              ].map((s) => (
                <div key={s.label}>
                  <div className={`text-[22px] font-semibold leading-none tabular-nums ${s.cls}`}>{s.value}</div>
                  <div className="mt-1.5 text-[11px] text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">{t('lm.forms.portfolioNote')}</p>
          </div>
          <FormAudienceBuilder
            formId={null}
            formName={t('lm.forms.portfolioSeedName')}
            contactable={crmStats.all.contactable}
            qualified={crmStats.all.qualified}
            forms={forms
              .filter((f) => (crmStats.perForm.get(f.id)?.n ?? 0) > 0)
              .map((f) => {
                const s = crmStats.perForm.get(f.id)!
                return { id: f.id, name: f.name, contactable: s.contactable, qualified: s.qualified }
              })}
            compact
          />
        </section>
      )}

      {/* ── THE RATE LADDER ─────────────────────────────────────────────
          "above the form create lead rate table… 1 2 3 4 5 6 7 8 9 10 this is
          your rows and you tell in every rate how many."

          The page reported one number for the whole account: an average. Two
          accounts both averaging 5 — one where every lead is a 5, one that is
          half 10s and half 0s — are opposite businesses, and only the second
          has anything worth buying more of. The distribution is the finding.

          Absent entirely until something is rated: eleven zero rows would be a
          table that teaches nothing and takes the space the forms need. */}
      {ladder.rated > 0 && (
        <section className="mt-6 rounded-[20px] border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lm.forms.ladder.title')}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('lm.forms.ladder.note')}</p>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-slate-500">
                {t('lm.forms.ladder.rated', { n: String(ladder.rated) })}
              </span>
              {/* The number the average cannot express. */}
              {ladder.polarised >= 40 && (
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  {t('lm.forms.ladder.polarised', { pct: String(ladder.polarised) })}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 text-start font-semibold">{t('lm.forms.ladder.colRate')}</th>
                  <th className="pb-2 text-end font-semibold">{t('lm.forms.ladder.colLeads')}</th>
                  <th className="pb-2 ps-4 text-start font-semibold">{t('lm.forms.ladder.colShare')}</th>
                  <th className="pb-2 text-end font-semibold">{t('lm.forms.ladder.colBand')}</th>
                </tr>
              </thead>
              <tbody>
                {ladder.rows.map((row) => {
                  const tone = row.band === 'deal' ? 'text-gold'
                    : row.band === 'good' ? 'text-emerald-300'
                    : row.band === 'avoid' ? 'text-rose-300'
                    : 'text-slate-400'
                  const bar = row.band === 'deal' ? 'bg-gold'
                    : row.band === 'good' ? 'bg-emerald-400'
                    : row.band === 'avoid' ? 'bg-rose-400'
                    : 'bg-slate-600'
                  return (
                    <tr key={row.rating} className="border-t border-line/50">
                      <td className={`py-1.5 text-start font-semibold tabular-nums ${tone}`}>{row.rating}</td>
                      {/* A zero is printed, not blanked — a gap in this table is
                          a fact about the business. */}
                      <td className={`py-1.5 text-end tabular-nums ${row.leads > 0 ? 'text-white' : 'text-slate-600'}`}>
                        {row.leads}
                      </td>
                      <td className="py-1.5 ps-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-3">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${row.share}%` }} />
                          </div>
                          <span className="w-9 shrink-0 text-[11px] tabular-nums text-slate-500">{row.share}%</span>
                        </div>
                      </td>
                      <td className={`py-1.5 text-end text-[11px] ${tone}`}>{t(`lm.forms.band.${row.band}`)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── AND EACH BAND IS REACHABLE AS AN AUDIENCE ──────────────────
              "connect them in audiences building, match audiences from the crm
              who seem to have same behaviour." A table nobody can act on is a
              report. The middle band is deliberately absent: a lead nobody
              could call is not evidence in either direction, and seeding from
              "we could not tell" hands Meta a cohort defined by our own
              uncertainty. */}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {RATING_BAND_IDS.filter((b) => BAND_AUDIENCE[b] !== null && ladder.byBand[b] > 0).map((b) => (
              <Link
                key={b}
                href={`/freehold-intelligence/lead-machine/audiences?seed=${encodeURIComponent(String(BAND_AUDIENCE[b]))}`}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                  isSeedBand(b)
                    ? 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20'
                    : 'border-rose-400/40 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20'
                }`}
              >
                {t(isSeedBand(b) ? 'lm.forms.ladder.buildFrom' : 'lm.forms.ladder.excludeFrom',
                   { band: t(`lm.forms.band.${b}`), n: String(ladder.byBand[b]) })}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Demo data must never read as real forms/leads. */}
      {isConfigError && forms.length > 0 && (
        <DemoNotice badge={t('lm.demo.badge')} note={t('lm.demo.note')} />
      )}

      {/* Forms list */}
      {forms.length > 0 && (
        <section className="mt-12">
          <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.forms.allForms')}</div>
          {/* GROUPED BY THE PAGE THEY BELONG TO.
              A form is a Page asset — it lives on one Facebook Page, collects
              leads for that Page, and is read with that Page's own token. The
              list mixed every Page's forms into one column, so with two Pages
              there was no way to tell whose form you were about to attach to
              an ad. listLeadForms has tagged each form with its Page all
              along; nothing read the tag. */}
          <div className="mt-4 space-y-6">
            {groupFormsByPage(forms).map((group) => (
              <div key={group.pageId}>
                {group.showHeading && (
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Facebook className="h-3.5 w-3.5 text-slate-500" />
                    {group.pageName}
                  </div>
                )}
                <div className="space-y-3">
            {group.forms.map((form) => {
              const st = statusConfig(form.status)
              return (
                <Link
                  key={form.id}
                  href={`/freehold-intelligence/lead-machine/forms/${form.id}`}
                  className="group flex items-start justify-between gap-4 rounded-[20px] border border-line bg-surface p-5 transition hover:border-gold/25"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                      <h3 className="text-sm font-semibold text-white group-hover:text-white truncate">{form.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.badge} ${st.text}`}>{st.labelKey ? t(st.labelKey) : form.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-slate-300">{t('lm.forms.leadsCapture', { n: String(form.leads_count ?? 0) })}</span>
                      </span>
                      {/* Meta's count vs OURS. This page used to show only
                          Meta's number, so a form reading "47 leads" looked
                          healthy while the CRM held none of them — the exact
                          gap that made "leads aren't showing" invisible here. */}
                      {(() => {
                        const inCrm = crmByForm.get(form.id) ?? 0
                        const missing = (form.leads_count ?? 0) - inCrm
                        return missing > 0 ? (
                          <span className="flex items-center gap-1 font-medium text-amber-300">
                            <AlertCircle className="h-3 w-3" />
                            {t('lm.forms.notInCrm', { n: String(missing) })}
                          </span>
                        ) : (
                          <span className="text-slate-500">{t('lm.forms.inCrm', { n: String(inCrm) })}</span>
                        )
                      })()}
                      {/* The form's RATE, visible without opening it: average
                          value of its rated leads, coloured by zone. Unrated
                          forms say so — never an invented number. */}
                      {(() => {
                        const s = crmStats.perForm.get(form.id)
                        if (!s || s.n === 0) return null
                        if (s.rated === 0 || s.avg === null) {
                          return <span className="text-slate-600">{t('lm.forms.valueUnrated')}</span>
                        }
                        const cls = s.avg >= 6 ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                          : s.avg <= 3.5 ? 'border-red-400/40 bg-red-400/10 text-red-300'
                          : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                        return (
                          <span className={`rounded-full border px-2 py-0.5 font-semibold tabular-nums ${cls}`}>
                            {t('lm.forms.valueAvg', { v: s.avg.toFixed(1), n: String(s.rated), total: String(s.n) })}
                          </span>
                        )
                      })()}
                      {/* ── OPENED vs FINISHED ────────────────────────────
                          The page counted submissions and nothing else, so a
                          form quietly losing four of every five people who
                          opened it read exactly like one that converted
                          everybody. Those two need opposite decisions.

                          Rendered ONLY when Meta actually reported opens: a
                          "0%" over a form that works perfectly well would get
                          it rewritten for nothing. See form-funnel.ts. */}
                      {(() => {
                        const s = crmStats.perForm.get(form.id)
                        const funnel = readFunnel(formOpensFor(form.id), s?.n ?? 0)
                        if (funnel.completion === null) return null
                        const pct = Math.round(funnel.completion * 100)
                        const cls = funnel.verdict === 'leaking'
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                          : funnel.verdict === 'healthy'
                          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                          : 'border-line bg-surface-2 text-slate-400'
                        // Fed the REAL per-question answer rates, so the
                        // advice can name a question rather than only saying
                        // "ask less" — which is true of every long form and
                        // useful about none of them.
                        const advice = adviseForm(funnel, answeredRates.get(form.id) ?? []).advice
                        return (
                          <span className={`rounded-full border px-2 py-0.5 font-semibold tabular-nums ${cls}`}>
                            {t('lm.forms.funnel.rate', { pct: String(pct), opens: String(funnel.opens ?? 0) })}
                            {/* Only a form measurably losing people is told to
                                change — rewriting a working form breaks it. */}
                            {funnel.verdict === 'leaking' && advice !== 'none' && (
                              <span className="ms-1 font-normal">· {t(`lm.forms.funnel.${advice}`)}</span>
                            )}
                          </span>
                        )
                      })()}
                      {form.follow_up_action_url && (
                        <span className="truncate">
                          URL: <span className="font-mono text-slate-400 truncate">{form.follow_up_action_url.replace('https://', '').slice(0, 40)}</span>
                        </span>
                      )}
                      <span>
                        {t('lm.forms.created')} <span className="text-slate-400">{formatInstant(form.created_time, 'en-AE', { dateStyle: 'medium' })}</span>
                      </span>
                      {/* Which Facebook Page this form lives on. The list now
                          spans every accessible Page, so without this two
                          identically-named forms are indistinguishable. */}
                      {form.page_name && (
                        <span className="truncate text-slate-500">{form.page_name}</span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold" />
                </Link>
              )
            })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FORM ANALYSIS, BELOW THE FORMS ──────────────────────────────
          This sat at the TOP of the page and pushed the forms themselves off
          the first screen: "the table about the question answers is huge and
          taking space, this must be smaller and not on the top, make it after
          the forms as a forms analysis". A per-answer breakdown is something
          you read once you have found the form you care about — it is
          reference, not headline.

          WHAT EACH ANSWER IS WORTH. The segmentation questions folded across
          every synced lead: which door the serious buyers actually walk
          through. Absent until at least two answers have real traffic —
          an empty comparison is not rendered as zeros it never earned. */}
      {!isConfigError && answerQs.length > 0 && (
        <section className="mt-6 rounded-[20px] border border-line bg-surface p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('lm.forms.answers.title')}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('lm.forms.answers.note')}</p>
          <div className="mt-4 space-y-5">
            {answerQs.map((qo) => (
              <div key={qo.question}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className="text-sm font-semibold text-white">{qo.question}</div>
                  <span className="text-[11px] text-slate-500">{t('lm.forms.answers.answered', { n: String(qo.leads) })}</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {qo.answers.map((a: AnswerOutcome) => {
                    // Only a verdict the sample supports gets a word — tied and
                    // unknown rows show their counts and claim nothing.
                    const chip = a.verdict === 'better'
                      ? { key: 'lm.forms.answers.better', cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' }
                      : a.verdict === 'worse'
                      ? { key: 'lm.forms.answers.worse', cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' }
                      : a.verdict === 'unanswered'
                      ? { key: 'lm.forms.answers.unanswered', cls: 'border-slate-500/30 bg-slate-500/10 text-slate-400' }
                      : null
                    return (
                      <div key={a.answer} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-line/60 bg-surface-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{a.answer}</span>
                        <span className="text-[11px] tabular-nums text-slate-500">{t('lm.forms.answers.leads', { n: String(a.leads) })}</span>
                        <span className={`text-[11px] tabular-nums ${a.qualified > 0 ? 'text-emerald-300' : 'text-slate-600'}`}>
                          {t('lm.forms.answers.qualified', { n: String(a.qualified) })}
                        </span>
                        {a.won > 0 && (
                          <span className="text-[11px] tabular-nums text-gold">{t('lm.forms.answers.won', { n: String(a.won) })}</span>
                        )}
                        {chip && (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>{t(chip.key)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* Empty state */}
      {!isConfigError && !data.error && forms.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-line bg-surface-2 px-7 py-14 text-center">
          <Zap className="mx-auto h-8 w-8 text-gold/40" />
          <div className="mt-4 text-[18px] font-semibold text-white">{t('lm.forms.emptyTitle')}</div>
          <p className="mt-2 text-[14px] text-slate-500">{t('lm.forms.emptyDesc')}</p>
          <Link
            href="/freehold-intelligence/lead-machine/forms/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright"
          >
            <Plus className="h-4 w-4" /> {t('lm.forms.createFirst')}
          </Link>
        </div>
      )}

      {/* What forms do */}
      {!isConfigError && (
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {infoCards.map(({ icon: Icon, titleKey, bodyKey }) => (
            <div key={titleKey} className="rounded-[18px] border border-line bg-surface p-5">
              <Icon className="h-5 w-5 text-gold/60 mb-3" />
              <div className="text-sm font-semibold text-white">{t(titleKey)}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t(bodyKey)}</p>
            </div>
          ))}
        </section>
      )}


    </div>
  )
}
