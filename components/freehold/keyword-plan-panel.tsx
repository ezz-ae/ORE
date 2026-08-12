'use client'

/**
 * THE BUY, WRITTEN FROM THIS COMPANY'S OWN RECORDS.
 *
 * The keywords page offered a hand-written library of forty UAE property
 * phrases — the same forty for every account, blind to which projects this
 * company sells, which are worth money this week, and which have a page to
 * send a click to.
 *
 * This panel is the plan instead: ranked by the opportunity score, one tight
 * ad group per buying intent, each pointed at the project's own landing page.
 *
 * WHAT IS MISSING IS SHOWN AS LOUDLY AS WHAT IS THERE. A group withheld for a
 * blank payment-plan field is a gap in the buy AND a job for somebody — it is
 * usually one field on one project record away from being bought. A screen
 * that only showed the good half would hide the cheapest work available.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { KeywordPlan, PlannedKeyword } from '@/lib/google/keyword-plan'

interface PlanResponse {
  plans: KeywordPlan[]
  negatives: PlannedKeyword[]
  skipped: { belowFloor: string[]; unscored: string[] }
  totals: { projects: number; groups: number; keywords: number }
}

export default function KeywordPlanPanel() {
  const t = useT()
  const [data, setData] = useState<PlanResponse | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await fetch('/api/google/keyword-plan', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setData(d)
  }, [])
  useEffect(() => { void load() }, [load])

  if (!data) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }

  const { plans, totals, skipped, negatives } = data

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-white">{t('gkw.title')}</h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t('gkw.sub')}</p>

      {plans.length === 0 ? (
        <p className="mt-4 text-[12px] text-slate-400">{t('gkw.empty')}</p>
      ) : (
        <>
          <p className="mt-3 text-[11px] text-slate-400">
            {t('gkw.totals', { projects: totals.projects, groups: totals.groups, keywords: totals.keywords })}
          </p>

          <div className="mt-4 space-y-2">
            {plans.map((p) => {
              const isOpen = open === p.slug
              const kwCount = p.groups.reduce((n, g) => n + g.keywords.length, 0)
              return (
                <div key={p.slug} className="rounded-xl border border-line bg-surface-2">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : p.slug)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">{p.slug}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {p.blocked
                        ? t(`gkw.why.${p.blocked}`)
                        : t('gkw.groupCount', { groups: p.groups.length, keywords: kwCount })}
                    </span>
                  </button>

                  {isOpen && !p.blocked && (
                    <div className="space-y-3 border-t border-line px-4 py-3">
                      {p.groups.map((g) => (
                        <div key={g.kind}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-300">{t(`gkw.kind.${g.kind}`)}</span>
                            {/* The page this group's clicks land on — the whole
                                reason the buy is cheap. Shown, not assumed. */}
                            <a href={g.landingUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-gold">
                              {g.landingUrl.replace(/^https?:\/\/[^/]+/, '')}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {g.keywords.map((k) => (
                              <span key={`${k.text}|${k.matchType}`}
                                className="rounded border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] text-slate-400">
                                {k.matchType === 'EXACT' ? `[${k.text}]` : `"${k.text}"`}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* The cheapest work on the screen: each one is usually a
                          single blank field on the project record. */}
                      {p.withheld.length > 0 && (
                        <div className="border-t border-line pt-2">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">{t('gkw.notBought')}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            {p.withheld.map((w) => (
                              <span key={w.kind} className="text-[10px] text-slate-500">
                                {t(`gkw.kind.${w.kind}`)} — {t(`gkw.why.${w.why}`)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Projects the machine did not plan for. Two different reasons with two
          different answers: score it, or do not buy it. */}
      {(skipped.unscored.length > 0 || skipped.belowFloor.length > 0) && (
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          {t('gkw.skipped', { unscored: skipped.unscored.length, below: skipped.belowFloor.length })}
        </p>
      )}

      <p className="mt-3 text-[11px] text-slate-500">
        {t('gkw.negatives', { n: negatives.length })}
      </p>
    </div>
  )
}
