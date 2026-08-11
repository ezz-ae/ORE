'use client'

/**
 * ONE CAMPAIGN, ON THE LIVE SCREEN — and the zoom underneath it.
 *
 * The row this replaces was a name, a spend and a lead count. It could not say
 * whether Meta was delivering the campaign, whether the same people were
 * seeing it for the fifth time, whether anyone had rated the leads, or which
 * of two ad sets was buying at six times the price. And nothing on it was
 * pressable except the name.
 *
 * TWO LEVELS, BECAUSE ONE SCREEN CANNOT BE BOTH.
 *
 *   CLOSED  the line a colleague would say, and the button that fixes it.
 *   OPEN    every ad set with its own spend, reach, cost per thousand and
 *           leads, side by side — which is the only way the finding a campaign
 *           total cannot contain becomes visible, and the only real A/B this
 *           product can show: two audiences, same week, same country.
 *
 * THE FIX IS WHERE THE FAULT IS. A screen that names a problem and sends you
 * somewhere else to solve it has moved the work, not done it. So `Turn off`
 * stops the named ad set from this row, in place, and reports what Meta then
 * holds rather than reloading and hoping.
 *
 * THE ZOOM IS LAZY. Ad-set numbers are a Graph call per campaign; fetching
 * them for every row would make a list of ten campaigns ten times slower to
 * answer the question nine of them were not asked.
 */
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Loader2, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { signalsFor, type LiveFacts, type LiveSignal } from '@/lib/freehold/live-signals'

const FI = '/freehold-intelligence'
const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`

export interface LiveRowData {
  id: string
  name: string
  platform: 'meta' | 'google'
  facts: LiveFacts
  cpl: number | null
}

interface AdSetRow {
  id: string; name: string; status?: string
  spendAED?: number; impressions?: number; leads?: number
  ads?: Array<{ id: string; name: string; status?: string }>
}

const TONE: Record<LiveSignal['tone'], string> = {
  bad:  'text-rose-300',
  warn: 'text-amber-200',
  flat: 'text-slate-500',
  good: 'text-emerald-300/90',
}

export default function LiveRow({ row, onChanged }: { row: LiveRowData; onChanged?: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [adSets, setAdSets] = useState<AdSetRow[] | null>(null)
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState('')

  const signals = signalsFor(row.facts)
  const isMeta = row.platform === 'meta'
  const href = isMeta && row.id ? `${FI}/ads-live/meta/${encodeURIComponent(row.id)}` : `${FI}/ads-live/google`

  async function zoom() {
    const next = !open
    setOpen(next)
    if (!next || adSets !== null || !isMeta) return
    const d = await fetch(`/api/meta/campaigns/${encodeURIComponent(row.id)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setAdSets(Array.isArray(d?.adSets) ? d.adSets : [])
  }

  /** Stop the named ad set from here. Reports what Meta holds afterwards
   *  instead of reloading — a 200 means the write was accepted, which is not
   *  the same as the value having moved. */
  async function pauseAdSet(adSetId: string) {
    if (busy) return
    setBusy(adSetId); setDone('')
    try {
      const r = await fetch(`/api/meta/adsets/${encodeURIComponent(adSetId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAUSED' }),
      })
      if (!r.ok) { setDone(t('lm.live.sig.failed')); return }
      setDone(t('lm.live.sig.stopped'))
      setAdSets((cur) => (cur ?? []).map((a) => (a.id === adSetId ? { ...a, status: 'PAUSED' } : a)))
      onChanged?.()
    } catch { setDone(t('lm.live.sig.failed')) } finally { setBusy('') }
  }

  function ActionButton({ s }: { s: LiveSignal }) {
    if (s.action === 'none') return null
    const cls = 'shrink-0 rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-[10px] font-semibold text-slate-200 transition hover:border-gold/40 hover:text-white disabled:opacity-50'
    if (s.action === 'pauseAdSet' && s.targetId) {
      return (
        <button type="button" onClick={() => void pauseAdSet(s.targetId!)} disabled={!!busy} className={cls}>
          {busy === s.targetId ? <Loader2 className="h-3 w-3 animate-spin" /> : t(`lm.live.act.${s.action}`)}
        </button>
      )
    }
    // Every other door is a screen. `addDesigns` carries ?pool=1 so the
    // campaign page opens the creative pool on arrival rather than making the
    // operator find it — the fix is where the fault was named.
    const to = s.action === 'rate' ? `${FI}/crm`
      : s.action === 'addDesigns' ? `${href}?pool=1`
      : href
    return <Link href={to} className={cls}>{t(`lm.live.act.${s.action}`)}</Link>
  }

  return (
    <div className="border-b border-line last:border-0">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2 px-5 py-3.5">
        <button type="button" onClick={() => void zoom()} aria-expanded={open}
          className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 transition hover:text-white">
          <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
        </button>

        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-sm font-semibold text-slate-100 transition hover:text-white">
            {row.name}
          </Link>
          {/* The lines. Two at most — see live-signals. */}
          <div className="mt-1 space-y-1">
            {signals.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] leading-snug ${TONE[s.tone]}`}>
                  {t(`lm.live.sig.${s.id}`, s.vars)}
                </span>
                <ActionButton s={s} />
              </div>
            ))}
            {done && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> {done}
              </span>
            )}
          </div>
        </div>

        {/* The numbers that matter at a glance. Frequency sits with them
            because creative fatigue is a spend fact, not a footnote. */}
        <div className="flex shrink-0 gap-4 text-end text-[11px]">
          <Num label={t('lm.live.col.spend')} value={row.facts.spendAed > 0 ? aed(row.facts.spendAed) : '—'} />
          <Num label={t('lm.live.col.leads')} value={String(row.facts.leads)} gold />
          <Num label={t('lm.live.col.cpl')} value={row.cpl !== null ? aed(row.cpl) : '—'} />
          <Num label={t('lm.live.col.freq')}
            value={row.facts.frequency !== null ? `${row.facts.frequency.toFixed(1)}×` : '—'} />
        </div>
      </div>

      {/* ── THE ZOOM ───────────────────────────────────────────────────────
          Every ad set with its OWN numbers. A campaign total is an average of
          audiences and describes none of them; this is where two ad sets in
          the same week and the same country can be read against each other,
          which is the only honest A/B this data supports. */}
      {open && (
        <div className="border-t border-line bg-surface/60 px-5 py-3">
          {adSets === null ? (
            <div className="flex items-center gap-2 py-2 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('lm.live.zoom.loading')}
            </div>
          ) : adSets.length === 0 ? (
            <p className="py-1 text-[11px] text-slate-500">{t('lm.live.zoom.none')}</p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-4 text-[10px] uppercase tracking-wider text-slate-600">
                <span className="flex-1">{t('lm.live.zoom.adSet')}</span>
                <span className="w-16 text-end">{t('lm.live.col.spend')}</span>
                <span className="w-16 text-end">{t('lm.live.zoom.cpm')}</span>
                <span className="w-12 text-end">{t('lm.live.col.leads')}</span>
                <span className="w-16 text-end">{t('lm.live.col.cpl')}</span>
              </div>
              {adSets.map((a) => {
                const spend = Number(a.spendAED) || 0
                const impr = Number(a.impressions) || 0
                const leads = Number(a.leads) || 0
                // A cost per thousand from a handful of impressions is a
                // rounding artefact, not a price. Withheld below the floor.
                const cpm = impr >= 100 ? (spend / impr) * 1000 : null
                const live = String(a.status ?? '').toUpperCase() === 'ACTIVE'
                const ads = (a.ads ?? []).filter((x) => String(x.status ?? '').toUpperCase() === 'ACTIVE').length
                return (
                  <div key={a.id} className="flex items-center gap-4 rounded-lg px-1 py-1 text-[11px]">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? 'bg-gold' : 'bg-surface-3'}`} />
                      <span className="truncate text-slate-200">{a.name}</span>
                      <span className="shrink-0 text-slate-600">{t('lm.live.zoom.ads', { n: ads })}</span>
                    </span>
                    <span className="w-16 text-end tabular-nums text-slate-300">{spend > 0 ? aed(spend) : '—'}</span>
                    <span className="w-16 text-end tabular-nums text-slate-300">{cpm !== null ? aed(cpm) : '—'}</span>
                    <span className="w-12 text-end tabular-nums text-gold">{leads}</span>
                    <span className="w-16 text-end tabular-nums text-slate-300">
                      {leads > 0 && spend > 0 ? aed(spend / leads) : '—'}
                    </span>
                  </div>
                )
              })}
              <Link href={href} className="inline-flex items-center gap-1 pt-1 text-[10px] text-gold/70 transition hover:text-gold">
                {t('lm.live.zoom.more')} <ArrowUpRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Num({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <div className={`font-semibold tabular-nums ${gold ? 'text-gold' : 'text-slate-200'}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-600">{label}</div>
    </div>
  )
}
