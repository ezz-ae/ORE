'use client'

import { Sparkles, FileText, Search, Lightbulb, Scale } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { MachinePlan, TrialSource } from '@/lib/freehold/ads-machine-planner'

// The machine's blueprint — shared by the create flow (home page) and the
// machine dashboard, so "what the machine is creating" is visible in both.
const SOURCE_KEY: Record<TrialSource, string> = {
  'buyer-match': 'lm.machine.plan.source.buyer-match',
  'saved-audience': 'lm.machine.plan.source.saved-audience',
  'lookalike': 'lm.machine.plan.source.lookalike',
  'advantage-broad': 'lm.machine.plan.source.advantage-broad',
  'google-search': 'lm.machine.plan.source.google-search',
}

/** The persisted plan, rendered per project: trial cards with real source,
 * budget split, copy headline + honest copy origin — the Google Search trial
 * renders like the others with its own source badge. Legacy plans (pre-live
 * Google) still show their draft note; a dropped Google trial shows the
 * planner's honest reason; the advisory shows when the learning loop produced
 * one. */
export function MachinePlanPreview({ plan }: { plan: MachinePlan }) {
  const t = useT()
  if (!plan.viable) {
    return (
      <div className="rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-4 text-sm text-slate-300">
        {plan.reason}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {plan.projects.map((p) => (
        <div key={p.slug} className="rounded-[20px] border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-white">{p.listingName}</div>
              <div className="mt-0.5 text-xs text-slate-500">{p.area}</div>
            </div>
            <div className="text-xs font-medium text-gold">{t('lm.machine.plan.perDay', { n: p.dailyBudgetAed.toLocaleString() })}</div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.trials.map((trial) => (
              <div key={trial.id} className="rounded-[16px] border border-line bg-surface-2/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                    {SOURCE_KEY[trial.source] ? t(SOURCE_KEY[trial.source]) : trial.source}
                  </span>
                  <span className="text-xs font-medium text-slate-300">
                    {t('lm.machine.plan.perDay', { n: trial.dailyBudgetAed.toLocaleString() })}
                  </span>
                </div>
                {trial.savedAudienceName && (
                  <div className="mt-2 truncate text-[11px] text-slate-400">“{trial.savedAudienceName}”</div>
                )}
                <div className="mt-3 text-[10px] uppercase tracking-wider text-slate-500">{t('lm.machine.plan.headline')}</div>
                <div className="mt-1 text-sm text-white">{trial.creative?.headline ?? trial.google?.headlines?.[0] ?? ''}</div>
                <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                  {trial.copySource === 'gemini'
                    ? <><Sparkles className="h-3 w-3 text-gold/70" /> {t('lm.machine.plan.copy.gemini')}</>
                    : <><FileText className="h-3 w-3 text-slate-500" /> {t('lm.machine.plan.copy.template')}</>}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{trial.rationale}</p>
              </div>
            ))}
          </div>

          {/* Legacy plans only (built before Google went live as a channel). */}
          {p.googleDraft && (
            <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-line bg-surface-2/40 px-3.5 py-2.5">
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                {t('lm.machine.plan.googleDraft', { n: p.googleDraft.dailyBudgetAED.toLocaleString() })}
              </p>
            </div>
          )}

          {/* The planner's honest reason when the split couldn't fund the
              Google Search trial for this project — verbatim, like the
              plan-level viability reason. */}
          {p.googleSkipped && (
            <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-orange-400/20 bg-orange-400/[0.04] px-3.5 py-2.5">
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400/70" />
              <p className="text-[11px] leading-relaxed text-slate-400">{p.googleSkipped}</p>
            </div>
          )}

          {/* Why THIS project got its share of the cap — the planner's honest
              opportunity-weighted (or equal-split) reasoning, verbatim. */}
          {p.budgetRationale && (
            <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-line bg-surface-2/40 px-3.5 py-2.5">
              <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                <span className="font-semibold text-slate-300">{t('lm.machine.plan.budgetRationale')}: </span>
                {p.budgetRationale}
              </p>
            </div>
          )}

          {p.advisory && (
            <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-gold/15 bg-gold/[0.04] px-3.5 py-2.5">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/70" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                <span className="font-semibold text-gold/80">{t('lm.machine.plan.advisory')}: </span>
                {p.advisory}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
