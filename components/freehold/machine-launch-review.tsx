'use client'

/**
 * Ads Machine — launch review. The "run step" preview: before the machine
 * launches anything, the operator sees EXACTLY what will go live — every trial,
 * its channel, source, targeting summary, budget and ad copy — and can edit the
 * three safe levers (include/exclude, daily budget, ad copy) or launch as-is.
 *
 * Everything shown is the real persisted plan (lib/freehold/ads-machine-planner)
 * — nothing invented. Edits are validated on the server by applyPlanEdits under
 * the same honest rules (AED 50/day floor, the hard cap, Google's 3-headline /
 * 2-description minimum) before anything spends.
 */
import { useMemo, useState } from 'react'
import {
  AlertTriangle, ExternalLink, Loader2, Rocket, Save, Search, ShieldCheck, Sparkles, FileText, X,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { MachinePlan, TrialSource } from '@/lib/freehold/ads-machine-planner'
import type { TrialEdit, ProjectEdit } from '@/lib/freehold/ads-machine-plan-edit'
import { normalizePermit, qrApiPath, permitVerificationUrl } from '@/lib/freehold/trakheesi'
import type { MetaCta } from '@/lib/meta/types'

const META_MIN = 50

const CREATIVE_STUDIO = '/freehold-intelligence/creative-studio'
const LANDINGS_HUB = '/freehold-intelligence/lead-machine/landings'

/** The landing editor path for a project — its own landing slug when known,
 * else derived from a `/lp/{slug}` landing URL. Null when it has no landing
 * page yet (the review then offers "create" instead of "edit"). */
function landingEditPath(landingSlug: string | null | undefined, landingUrl: string | undefined): string | null {
  const slug = landingSlug || (landingUrl?.match(/\/lp\/([^/?#]+)/)?.[1] ?? null)
  return slug ? `${LANDINGS_HUB}/${encodeURIComponent(slug)}/edit` : null
}

const SOURCE_KEY: Record<TrialSource, string> = {
  'buyer-match': 'lm.machine.plan.source.buyer-match',
  'saved-audience': 'lm.machine.plan.source.saved-audience',
  'lookalike': 'lm.machine.plan.source.lookalike',
  'advantage-broad': 'lm.machine.plan.source.advantage-broad',
  'google-search': 'lm.machine.plan.source.google-search',
}

const CTAS: MetaCta[] = [
  'LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'BOOK_NOW',
  'APPLY_NOW', 'DOWNLOAD', 'WHATSAPP_MESSAGE', 'CALL_NOW',
]

// Editable per-trial draft — one entry per trial in the plan.
interface Draft {
  include: boolean
  budget: string
  channel: 'meta' | 'google'
  // meta
  headline: string
  primaryText: string
  description: string
  cta: MetaCta
  // google (multiline: one entry per line)
  googleHeadlines: string
  googleDescriptions: string
}

function targetingSummary(t: ReturnType<typeof useT>, trial: Extract<MachinePlan, { viable: true }>['projects'][number]['trials'][number]): string {
  if (trial.channel === 'google' && trial.google) {
    const kws = (trial.google.keywords ?? []).map((k) => k.text).slice(0, 4)
    return kws.length ? kws.map((k) => `“${k}”`).join(', ') : t('lm.machine.review.googleKeywords')
  }
  const tg = trial.targeting
  if (!tg) return '—'
  const parts: string[] = []
  parts.push(`${t('lm.machine.review.ages')} ${tg.ageMin}–${tg.ageMax}`)
  if (tg.interests && tg.interests.length > 0) {
    parts.push(tg.interests.map((i) => i.name).slice(0, 3).join(', '))
  } else {
    parts.push(t('lm.machine.review.advantageAudience'))
  }
  return parts.join(' · ')
}

export function MachineLaunchReview({
  plan, capAed, busy, onClose, onLaunch, onSaveDraft,
}: {
  plan: Extract<MachinePlan, { viable: true }>
  capAed: number
  busy: boolean
  onClose: () => void
  onLaunch: (edits: TrialEdit[], projectEdits: ProjectEdit[]) => void
  onSaveDraft: (edits: TrialEdit[], projectEdits: ProjectEdit[]) => void
}) {
  const t = useT()

  // Per-project Trakheesi permit (seeded from the plan). A project with no valid
  // permit cannot launch — Dubai law requires it on every property ad.
  const [permits, setPermits] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of plan.projects) init[p.slug] = p.permitNumber ?? ''
    return init
  })

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {}
    for (const p of plan.projects) {
      for (const tr of p.trials) {
        init[tr.id] = {
          include: true,
          budget: String(tr.dailyBudgetAed),
          channel: tr.channel === 'google' ? 'google' : 'meta',
          headline: tr.creative?.headline ?? '',
          primaryText: tr.creative?.primaryText ?? '',
          description: tr.creative?.description ?? '',
          cta: tr.creative?.cta ?? 'LEARN_MORE',
          googleHeadlines: (tr.google?.headlines ?? []).join('\n'),
          googleDescriptions: (tr.google?.descriptions ?? []).join('\n'),
        }
      }
    }
    return init
  })

  const set = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  // Which projects still have an included trial (so we know whose permit matters).
  const includedSlugByProject = useMemo(() => {
    const set = new Set<string>()
    for (const p of plan.projects) {
      if (p.trials.some((tr) => drafts[tr.id]?.include)) set.add(p.slug)
    }
    return set
  }, [drafts, plan.projects])

  // Live total of the INCLUDED trials, per-trial validity, and the compliance
  // gate: every project that still has an included trial needs a valid permit.
  const { total, includedCount, overCap, permitMissing } = useMemo(() => {
    let total = 0
    let includedCount = 0
    for (const d of Object.values(drafts)) {
      if (!d.include) continue
      includedCount++
      const b = Math.floor(Number(d.budget))
      if (Number.isFinite(b)) total += b
    }
    const permitMissing = [...includedSlugByProject].some((slug) => !normalizePermit(permits[slug]))
    return { total, includedCount, overCap: total > capAed, permitMissing }
  }, [drafts, capAed, permits, includedSlugByProject])

  const blocked = overCap || includedCount === 0 || permitMissing

  // Build the edit payloads the server understands.
  function buildEdits(): { edits: TrialEdit[]; projectEdits: ProjectEdit[] } {
    const edits: TrialEdit[] = []
    for (const [trialId, d] of Object.entries(drafts)) {
      if (!d.include) { edits.push({ trialId, include: false }); continue }
      const edit: TrialEdit = { trialId, include: true, dailyBudgetAed: Math.floor(Number(d.budget)) }
      if (d.channel === 'google') {
        edit.googleHeadlines = d.googleHeadlines.split('\n').map((s) => s.trim()).filter(Boolean)
        edit.googleDescriptions = d.googleDescriptions.split('\n').map((s) => s.trim()).filter(Boolean)
      } else {
        edit.headline = d.headline
        edit.primaryText = d.primaryText
        edit.description = d.description
        edit.cta = d.cta
      }
      edits.push(edit)
    }
    const projectEdits: ProjectEdit[] = plan.projects.map((p) => ({ projectSlug: p.slug, permitNumber: permits[p.slug] ?? '' }))
    return { edits, projectEdits }
  }

  const inputCls = 'w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-white outline-none transition focus:border-gold/40'
  const labelCls = 'text-[10px] uppercase tracking-wider text-slate-500'

  return (
    <div className="fixed inset-0 z-[210] flex items-stretch justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-app sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">{t('lm.machine.review.title')}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t('lm.machine.review.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('lm.machine.review.close')}
            className="rounded-lg p-1.5 text-slate-500 transition hover:text-white disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable trial list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {plan.projects.map((p) => {
              const permitVal = permits[p.slug] ?? ''
              const permitOk = normalizePermit(permitVal)
              const projectActive = includedSlugByProject.has(p.slug)
              return (
              <div key={p.slug}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{p.listingName}</div>
                  <div className="text-xs text-slate-500">{p.area}</div>
                </div>

                {/* ── Trakheesi permit — Dubai law requires it on every ad ── */}
                <div className={[
                  'mt-3 rounded-[14px] border p-3.5',
                  permitOk ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
                    : projectActive ? 'border-red-400/30 bg-red-400/[0.05]' : 'border-line bg-surface-2/40',
                ].join(' ')}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                        <ShieldCheck className={`h-3.5 w-3.5 ${permitOk ? 'text-emerald-400' : 'text-slate-500'}`} />
                        {t('lm.machine.review.permit')}
                      </div>
                      <input
                        value={permitVal}
                        onChange={(e) => setPermits((prev) => ({ ...prev, [p.slug]: e.target.value }))}
                        placeholder={t('lm.machine.review.permitPlaceholder')}
                        className={`${inputCls} mt-1.5 font-mono ${!permitOk && projectActive ? 'border-red-400/50' : ''}`}
                        dir="ltr"
                      />
                      {permitOk ? (
                        <a href={permitVerificationUrl(permitOk)} target="_blank" rel="noreferrer"
                          className="mt-1.5 inline-block text-[11px] text-emerald-300/80 underline-offset-2 hover:underline">
                          {t('lm.machine.review.permitVerify')}
                        </a>
                      ) : (
                        <p className={`mt-1.5 text-[11px] ${projectActive ? 'text-red-300' : 'text-slate-500'}`}>
                          {t('lm.machine.review.permitRequired')}
                        </p>
                      )}
                    </div>
                    {/* QR — real, server-rendered from the permit's DLD verification URL */}
                    {permitOk && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrApiPath(permitOk)}
                        alt={t('lm.machine.review.permitQrAlt')}
                        width={64}
                        height={64}
                        className="h-16 w-16 shrink-0 rounded-md border border-line bg-white p-1"
                      />
                    )}
                  </div>
                </div>

                {/* Deep-link into the full landing editor for this project. */}
                {(() => {
                  const editPath = landingEditPath(p.landingSlug, p.landingUrl)
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {editPath ? (
                        <a href={editPath} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-gold/80 transition hover:text-gold">
                          <ExternalLink className="h-3 w-3" /> {t('lm.machine.review.editLanding')}
                        </a>
                      ) : (
                        <a href={LANDINGS_HUB} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition hover:text-white">
                          <ExternalLink className="h-3 w-3" /> {t('lm.machine.review.createLanding')}
                        </a>
                      )}
                    </div>
                  )
                })()}

                <div className="mt-3 space-y-3">
                  {p.trials.map((tr) => {
                    const d = drafts[tr.id]
                    if (!d) return null
                    const budgetNum = Math.floor(Number(d.budget))
                    const budgetBad = d.include && (!Number.isFinite(budgetNum) || budgetNum < META_MIN)
                    return (
                      <div
                        key={tr.id}
                        className={[
                          'rounded-[16px] border p-4 transition',
                          d.include ? 'border-line bg-surface' : 'border-line/50 bg-surface-2/30 opacity-60',
                        ].join(' ')}
                      >
                        {/* Row 1: source badge, channel, include toggle */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                              {SOURCE_KEY[tr.source] ? t(SOURCE_KEY[tr.source]) : tr.source}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              {tr.channel === 'google'
                                ? <><Search className="h-3 w-3" /> Google</>
                                : <>Meta</>}
                            </span>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-400">
                            <input
                              type="checkbox"
                              checked={d.include}
                              onChange={(e) => set(tr.id, { include: e.target.checked })}
                              className="h-3.5 w-3.5 accent-gold"
                            />
                            {t('lm.machine.review.include')}
                          </label>
                        </div>

                        {/* Targeting summary (read-only) */}
                        <div className="mt-2.5 text-[11px] text-slate-500">
                          <span className={labelCls}>{t('lm.machine.review.targeting')}: </span>
                          {targetingSummary(t, tr)}
                        </div>
                        {tr.savedAudienceName && (
                          <div className="mt-1 truncate text-[11px] text-slate-400">“{tr.savedAudienceName}”</div>
                        )}

                        {/* Editable fields — only when included */}
                        {d.include && (
                          <div className="mt-3 space-y-3">
                            {/* Budget */}
                            <div className="flex items-end gap-3">
                              <div className="w-32">
                                <div className={labelCls}>{t('lm.machine.review.budget')}</div>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="text-xs text-slate-500">AED</span>
                                  <input
                                    value={d.budget}
                                    onChange={(e) => set(tr.id, { budget: e.target.value.replace(/[^\d]/g, '') })}
                                    inputMode="numeric"
                                    className={`${inputCls} ${budgetBad ? 'border-red-400/50' : ''}`}
                                  />
                                </div>
                              </div>
                              <span className="pb-2 text-[11px] text-slate-500">{t('lm.machine.review.perDay')}</span>
                            </div>
                            {budgetBad && (
                              <p className="text-[11px] text-red-300">{t('lm.machine.review.budgetFloor', { n: String(META_MIN) })}</p>
                            )}

                            {/* Copy */}
                            {tr.channel === 'google' ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <div className={labelCls}>{t('lm.machine.review.googleHeadlines')}</div>
                                  <textarea
                                    value={d.googleHeadlines}
                                    onChange={(e) => set(tr.id, { googleHeadlines: e.target.value })}
                                    rows={4}
                                    className={`${inputCls} mt-1 resize-y font-normal`}
                                  />
                                  <p className="mt-1 text-[10px] text-slate-500">{t('lm.machine.review.googleHeadlinesHint')}</p>
                                </div>
                                <div>
                                  <div className={labelCls}>{t('lm.machine.review.googleDescriptions')}</div>
                                  <textarea
                                    value={d.googleDescriptions}
                                    onChange={(e) => set(tr.id, { googleDescriptions: e.target.value })}
                                    rows={4}
                                    className={`${inputCls} mt-1 resize-y`}
                                  />
                                  <p className="mt-1 text-[10px] text-slate-500">{t('lm.machine.review.googleDescriptionsHint')}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className={labelCls}>{t('lm.machine.review.headline')}</div>
                                    <span className="text-[10px] text-slate-600">{d.headline.length}/40</span>
                                  </div>
                                  <input
                                    value={d.headline}
                                    maxLength={40}
                                    onChange={(e) => set(tr.id, { headline: e.target.value })}
                                    className={`${inputCls} mt-1`}
                                  />
                                </div>
                                <div>
                                  <div className={labelCls}>{t('lm.machine.review.primaryText')}</div>
                                  <textarea
                                    value={d.primaryText}
                                    onChange={(e) => set(tr.id, { primaryText: e.target.value })}
                                    rows={3}
                                    className={`${inputCls} mt-1 resize-y`}
                                  />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <div className={labelCls}>{t('lm.machine.review.description')}</div>
                                      <span className="text-[10px] text-slate-600">{d.description.length}/30</span>
                                    </div>
                                    <input
                                      value={d.description}
                                      maxLength={30}
                                      onChange={(e) => set(tr.id, { description: e.target.value })}
                                      className={`${inputCls} mt-1`}
                                    />
                                  </div>
                                  <div>
                                    <div className={labelCls}>{t('lm.machine.review.cta')}</div>
                                    <select
                                      value={d.cta}
                                      onChange={(e) => set(tr.id, { cta: e.target.value as MetaCta })}
                                      className={`${inputCls} mt-1`}
                                    >
                                      {CTAS.map((c) => (
                                        <option key={c} value={c}>{t(`lm.machine.review.cta.${c}`)}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                  {tr.copySource === 'gemini'
                                    ? <><Sparkles className="h-3 w-3 text-gold/70" /> {t('lm.machine.plan.copy.gemini')}</>
                                    : <><FileText className="h-3 w-3 text-slate-500" /> {t('lm.machine.plan.copy.template')}</>}
                                </div>
                              </div>
                            )}

                            {/* Deep-link into the full ad designer for richer edits. */}
                            <a href={CREATIVE_STUDIO} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-gold/80 transition hover:text-gold">
                              <ExternalLink className="h-3 w-3" /> {t('lm.machine.review.openDesigner')}
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })}
          </div>
        </div>

        {/* Footer: live cap meter + actions */}
        <div className="border-t border-line px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-400">
              <span className={overCap ? 'font-semibold text-red-300' : 'font-semibold text-white'}>
                {t('lm.machine.review.total', { n: total.toLocaleString() })}
              </span>
              <span className="mx-1.5 text-slate-600">/</span>
              <span>{t('lm.machine.review.cap', { n: capAed.toLocaleString() })}</span>
              <span className="ms-2 text-slate-500">{t('lm.machine.review.trialsIncluded', { n: String(includedCount) })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {overCap && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t('lm.machine.review.overCap')}
                </span>
              )}
              {permitMissing && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t('lm.machine.review.permitBlocked')}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { const e = buildEdits(); onSaveDraft(e.edits, e.projectEdits) }}
              disabled={busy || overCap || includedCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t('lm.machine.review.save')}
            </button>
            <button
              type="button"
              onClick={() => { const e = buildEdits(); onLaunch(e.edits, e.projectEdits) }}
              disabled={busy || blocked}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              {t('lm.machine.review.launch')}
            </button>
          </div>
          <p className="mt-2 text-end text-[10px] text-slate-500">{t('lm.machine.review.launchNote', { n: capAed.toLocaleString() })}</p>
        </div>
      </div>
    </div>
  )
}
