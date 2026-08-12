'use client'

/**
 * WHAT GOOGLE IS DOING WITH THIS CAMPAIGN — and one tap to where it is fixed.
 *
 * Replaces the green dot every Google screen drew from `status === 'ENABLED'`.
 * That dot reported the switch we set, not the serving state, so a campaign
 * with no active keywords, every ad disapproved, or a budget exhausted by noon
 * all read exactly like one that was working.
 *
 * The blockers are the point. Google names them — BUDGET_CONSTRAINED,
 * NO_KEYWORDS, HAS_ADS_DISAPPROVED — and each one has a screen in this
 * product where it is fixed, so the chip carries the route. An error that is
 * only reported hands the work back; an error carrying its own fix path is the
 * tool doing the work.
 *
 * LIMITED IS NOT A FAULT AND NOT A SUCCESS. It is the most common real state
 * in a live Search account — running, and losing auctions it could win — so it
 * gets its own amber word rather than being folded into either green or red.
 */
import Link from 'next/link'
import { useT } from '@/lib/i18n/provider'
import { googleDeliveryOf, fixRouteFor, type GoogleDeliveryState } from '@/lib/google/delivery'

const TONE: Record<GoogleDeliveryState, string> = {
  delivering:    'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  learning:      'border-sky-400/30 bg-sky-400/10 text-sky-300',
  limited:       'border-amber-400/30 bg-amber-400/10 text-amber-200',
  inReview:      'border-sky-400/30 bg-sky-400/10 text-sky-300',
  misconfigured: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  notDelivering: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  paused:        'border-line-strong bg-surface-2 text-slate-400',
  ended:         'border-line-strong bg-surface-2 text-slate-500',
  unknown:       'border-line-strong bg-surface-2 text-slate-400',
}

export default function GoogleDeliveryChip({ campaign, showBlockers = true }: {
  campaign: { id: string; status?: string | null; primaryStatus?: string | null; primaryStatusReasons?: string[] }
  /** The list shows the word only; a campaign page shows the fix links too. */
  showBlockers?: boolean
}) {
  const t = useT()
  const d = googleDeliveryOf({
    status: campaign.status,
    primaryStatus: campaign.primaryStatus,
    reasons: campaign.primaryStatusReasons,
  })

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE[d.state]}`}>
        {t(`gdel.state.${d.state}`)}
      </span>
      {showBlockers && d.blockers.map((b) => (
        <Link
          key={b}
          href={fixRouteFor(b, campaign.id)}
          className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-gold/40 hover:text-white"
        >
          {t(`gdel.block.${b}`)} →
        </Link>
      ))}
    </span>
  )
}
