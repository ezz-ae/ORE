'use client'

/**
 * WHAT WOULD STOP THIS LAUNCH — visible from the first screen.
 *
 * Every check that can refuse a launch already existed. They all fired at the
 * END, inside the launch route, after somebody had picked a project, written
 * an ad and set a budget. A missing Trakheesi permit and an unpublished
 * landing page are both knowable the moment the project is chosen.
 *
 * A wizard that fails on the last click teaches people to fear that button,
 * and the way people avoid a feared button is to stop using the tool.
 *
 * So the strip sits above the steps and fills in as they go. Nothing chosen
 * yet reads PENDING, never failed — a launcher that shows five red rows before
 * you have typed anything is one nobody reads, and then it protects nothing.
 *
 * The headline names ONE thing to do next: a blocker first, then whatever is
 * still unchosen, then a warning. It collapses to that single line until
 * somebody wants the rest.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, AlertTriangle, CircleDashed, ArrowRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/provider'
import {
  readinessOf, readinessHeadline, readinessCounts, canLaunch,
  type LaunchDraft, type ReadinessRow,
} from '@/lib/freehold/launch-readiness'

const TONE: Record<string, string> = {
  ok: 'text-emerald-300', blocked: 'text-rose-300',
  warn: 'text-amber-200', pending: 'text-slate-500',
}

function Icon({ state }: { state: string }) {
  const cls = `h-3.5 w-3.5 ${TONE[state]}`
  if (state === 'ok') return <Check className={cls} />
  if (state === 'blocked') return <AlertTriangle className={cls} />
  if (state === 'warn') return <AlertTriangle className={cls} />
  return <CircleDashed className={cls} />
}

/** The four facts the browser cannot know. undefined on permitExpiry means
 *  NOT LOOKED UP — rendered as pending, not as a missing permit, which is a
 *  different and much louder claim. */
type ServerFacts = Pick<LaunchDraft, 'metaConnected' | 'pageId' | 'permitExpiry' | 'landingVerdict'>

export default function LaunchReadinessStrip({ draft, listingId, landingUrl }: {
  /** Everything the wizard already holds. */
  draft: Omit<LaunchDraft, keyof ServerFacts>
  listingId: string
  landingUrl: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [facts, setFacts] = useState<ServerFacts | null>(null)

  const load = useCallback(async () => {
    const q = new URLSearchParams()
    if (listingId) q.set('listingId', listingId)
    if (landingUrl) q.set('landingUrl', landingUrl)
    const d = await fetch(`/api/meta/launch/readiness?${q}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setFacts(d)
  }, [listingId, landingUrl])
  useEffect(() => { void load() }, [load])

  // Until the server has answered, the account and Page are UNKNOWN rather
  // than broken. Assuming disconnected would paint the strip red for the first
  // second of every visit, and a strip that cries wolf on load is one nobody
  // reads by the second week.
  const rows = readinessOf({
    ...draft,
    metaConnected: facts?.metaConnected ?? true,
    pageId: facts ? facts.pageId : 'pending',
    permitExpiry: facts ? facts.permitExpiry : undefined,
    landingVerdict: facts?.landingVerdict ?? null,
  })
  const head = readinessHeadline(rows)
  const counts = readinessCounts(rows)
  const ready = canLaunch(rows)

  return (
    <div className={`rounded-2xl border bg-surface p-4 ${
      !ready ? 'border-rose-400/30' : counts.warn > 0 ? 'border-amber-400/25' : 'border-line'
    }`}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-2.5 text-left">
        <span className="mt-0.5 shrink-0"><Icon state={head?.state ?? 'ok'} /></span>
        <span className="min-w-0 flex-1">
          {/* ONE line, and it names an action rather than a status. */}
          <span className={`block text-[12px] leading-relaxed ${TONE[head?.state ?? 'ok']}`}>
            {head ? t(`ready.said.${head.id}.${head.state}`, head.vars) : t('ready.allClear')}
          </span>
          <span className="mt-0.5 block text-[10px] text-slate-500">
            {t('ready.counts', { ok: counts.ok, left: counts.pending, warn: counts.warn, blocked: counts.blocked })}
          </span>
        </span>
        <ChevronDown className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {rows.map((r) => <Row key={r.id} row={r} t={t} />)}
        </ul>
      )}
    </div>
  )
}

function Row({ row, t }: { row: ReadinessRow; t: ReturnType<typeof useT> }) {
  return (
    <li className="flex flex-wrap items-start gap-2">
      <span className="mt-0.5 shrink-0"><Icon state={row.state} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-slate-300">{t(`ready.check.${row.id}`)}</span>
        {/* An 'ok' row needs no sentence — the label and a tick say it, and
            "your budget is fine" in three languages is copy nobody reads. */}
        {row.state !== 'ok' && (
          <span className={`block text-[10px] leading-snug ${TONE[row.state]}`}>
            {t(`ready.said.${row.id}.${row.state}`, row.vars)}
          </span>
        )}
      </span>
      {/* A blocker with no route is a dead end somebody leaves the screen to
          solve, and they do not come back. */}
      {row.fix && (
        <Link href={row.fix}
          className="shrink-0 rounded-lg border border-line-strong bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-slate-200 transition hover:border-gold/40 hover:text-white">
          {t('ready.fix')} <ArrowRight className="inline h-2.5 w-2.5" />
        </Link>
      )}
    </li>
  )
}
