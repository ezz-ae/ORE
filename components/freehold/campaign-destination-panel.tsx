'use client'

/**
 * WHERE THE LEADS GO — the card the campaign page never had.
 *
 * Spend, delivery, placements and results were all on this page. The one thing
 * that decides whether any of them mean anything was not: whether a person who
 * fills something in at the other end arrives in the CRM with this campaign's
 * name on them.
 *
 * This account has already run that failure. 571 rows read "General enquiry"
 * because the landing URLs carried no utm_id — so the cost per lead, the lead
 * quality score, the rating loop and the budget rotation were all computed
 * against an attribution that silently was not happening.
 *
 * THE FIX PATH SITS WHERE THE FAULT IS EXPOSED. A broken link is not merely
 * reported: the corrected URL is right there, one copy away from being pasted
 * into the ad. Reporting a fault and leaving the work is how a tool becomes a
 * thing people resent.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import {
  correctedUrl, type DestinationRead, type AttributionState,
} from '@/lib/freehold/campaign-destination'

interface Response {
  connected: boolean
  reads?: DestinationRead[]
  headline?: AttributionState
  unattributedLive?: number
  mistaggedLive?: number
  capped?: number
  error?: string
}

const TONE: Record<AttributionState, string> = {
  attributed:   'text-emerald-300',
  conversation: 'text-sky-300',
  anonymous:    'text-rose-300',
  offCrm:       'text-rose-300',
  unknown:      'text-slate-500',
}

export default function CampaignDestinationPanel({ campaignId }: { campaignId: string }) {
  const t = useT()
  const [data, setData] = useState<Response | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await fetch(`/api/meta/campaigns/${campaignId}/destination`, { cache: 'no-store' })
      .then((r) => r.json()).catch(() => null)
    setData(d)
  }, [campaignId])
  useEffect(() => { void load() }, [load])

  if (!data) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }
  if (!data.connected || data.error || !data.reads) return null

  const { reads, headline = 'unknown', unattributedLive = 0, capped = 0 } = data

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-white">{t('dest.title')}</h3>

      {/* The headline is the WORST live state, never the commonest — one
          broken live ad invalidates this campaign's numbers whatever the
          others are doing. */}
      <p className={`mt-1 text-[12px] leading-relaxed ${TONE[headline]}`}>
        {t(`dest.said.${headline}`, { n: unattributedLive })}
      </p>

      <ul className="mt-4 space-y-2.5">
        {reads.map((r) => {
          const fix = correctedUrl(r, campaignId)
          return (
            <li key={r.adId} className="flex flex-wrap items-start gap-2">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                r.attribution === 'attributed' ? 'bg-emerald-400'
                  : r.attribution === 'conversation' ? 'bg-sky-400'
                  : r.attribution === 'unknown' ? 'bg-slate-600' : 'bg-rose-400'
              }`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="truncate text-[12px] text-slate-200">{r.adName}</span>
                  <span className="text-[10px] text-slate-500">{t(`dest.kind.${r.kind}`)}</span>
                  {/* A paused ad's destination is still worth reporting — it is
                      what will run when somebody turns it back on. */}
                  {!r.active && <span className="text-[10px] text-slate-600">{t('dest.paused')}</span>}
                </div>
                {/* An instant form has no url to show — the form opens inside
                    Facebook, and the link on the creative is a display link or
                    Meta's own stub. It used to be printed here under the ad's
                    name, which read as "this is where the click lands" about a
                    place nobody goes. `readDestination` drops it; what a person
                    can act on is WHICH FORM, so that is what this says. */}
                {r.formName && (
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">{r.formName}</div>
                )}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[10px] text-slate-500 transition hover:text-gold">
                    <span className="truncate">{r.url.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  </a>
                )}
                <div className={`text-[11px] ${TONE[r.attribution]}`}>
                  {r.mistagged ? t('dest.mistagged') : t(`dest.row.${r.attribution}`)}
                </div>
              </div>

              {/* THE FIX, WHERE THE FAULT IS. Not a link to a help page. */}
              {fix && (
                <button type="button"
                  onClick={() => { void navigator.clipboard.writeText(fix); setCopied(r.adId) }}
                  className="shrink-0 rounded-lg border border-line-strong bg-surface-2 px-2 py-1 text-[10px] font-semibold text-slate-200 transition hover:border-gold/40 hover:text-white">
                  {copied === r.adId
                    ? <span className="inline-flex items-center gap-1"><Check className="h-2.5 w-2.5" />{t('dest.copied')}</span>
                    : <span className="inline-flex items-center gap-1"><Copy className="h-2.5 w-2.5" />{t('dest.fix')}</span>}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {capped > 0 && <p className="mt-3 text-[10px] text-slate-500">{t('dest.capped', { n: capped })}</p>}
    </div>
  )
}
