'use client'

/**
 * FILTERS THAT COST NOTHING UNTIL SOMEBODY IS LOOKING.
 *
 * "i dont want them to be taking space i want them smart — when user put his
 *  mouse on search to write, this dropdown appear."
 *
 * A row of permanent filter chips is unreadable by the fifth one, so people
 * stop reading it and scroll instead. This panel occupies zero pixels until
 * the search box is focused, which is the moment somebody is already looking
 * for something.
 *
 * ── IT DOES NOT STEAL THE KEYBOARD ───────────────────────────────────────
 *
 * The search box keeps focus the whole time. Options are toggled on
 * `onMouseDown` with the default prevented, so the input never blurs and
 * typing continues straight through a click — filter, then keep typing, in
 * one movement. A panel that swallowed focus would make the fast path
 * (type three letters, click a filter, type more) impossible.
 *
 * Closing is on blur, not on select: choosing two filters is one gesture, and
 * a panel that shut after the first would be worse than the chips it replaced.
 *
 * The rules — what each filter means, OR within a group and AND between them
 * — are in lib/freehold/crm-filters.ts, pure and tested. This file is only
 * the surface.
 */
import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import {
  CRM_FILTER_GROUPS, filtersInGroup, filterCounts,
  type CrmFilterId, type FilterableLead,
} from '@/lib/freehold/crm-filters'

export default function SmartFilters({ leads, selected, onToggle, onClear, open }: {
  leads: readonly FilterableLead[]
  selected: readonly CrmFilterId[]
  onToggle: (id: CrmFilterId) => void
  onClear: () => void
  open: boolean
}) {
  const t = useT()
  // Frozen at mount. "Today" must not shift under a list somebody is reading
  // because a clock ticked past midnight mid-session, and re-reading Date.now()
  // on every render would also re-run every count on every keystroke.
  const [nowMs] = useState(() => Date.now())
  const counts = useMemo(
    () => filterCounts(leads, selected, nowMs),
    [leads, selected, nowMs],
  )
  if (!open) return null

  return (
    <div
      className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-xl border border-line-strong bg-surface-2 p-3 shadow-xl"
      // The input keeps focus: no blur, so typing continues through a click.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {CRM_FILTER_GROUPS.map((group) => (
          <div key={group} className="min-w-[9rem] flex-1">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t(`crm.filter.group.${group}`)}
            </div>
            <div className="flex flex-col gap-0.5">
              {filtersInGroup(group).map((f) => {
                const on = selected.includes(f.id)
                const n = counts[f.id]
                return (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onToggle(f.id) }}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition ${
                      on ? 'bg-gold/15 text-gold' : 'text-slate-300 hover:bg-surface-3'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Check className={`h-3 w-3 ${on ? 'opacity-100' : 'opacity-0'}`} />
                      {t(`crm.filter.${f.id}`)}
                    </span>
                    {/* A zero is shown, never hidden. "Nothing here" is an
                        answer; a missing option is a question. */}
                    <span className={`tabular-nums text-[10px] ${on ? 'text-gold/70' : 'text-slate-500'}`}>
                      {n}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onClear() }}
          className="mt-2.5 w-full rounded-lg border border-line px-2 py-1.5 text-[11px] text-slate-400 transition hover:text-slate-200"
        >
          {t('crm.filter.clear', { n: selected.length })}
        </button>
      )}
    </div>
  )
}
