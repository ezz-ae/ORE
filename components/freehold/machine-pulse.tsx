'use client'

/**
 * What the machine is doing, on the page you land on.
 *
 * The Lead Machine hub opened with inventory readiness — how many projects
 * have a landing page. Useful, and not the subject. The subject is a machine
 * spending money on decisions it can explain, and none of that was visible
 * until you clicked into an individual machine.
 *
 * Three things, in the order an operator asks them:
 *
 *   1. Is it on, and what is it spending?
 *   2. What does it need from me? (things it cannot fix itself)
 *   3. What did it decide? (and why — the log already carries the reason)
 *
 * The decision feed is the point. Every line is the machine committing or
 * withholding real money with its evidence attached, and it was the most
 * compelling artefact in the product with nowhere to be seen.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity, AlertTriangle, Loader2, Play, Pause, TrendingUp, Rocket, MessageSquare,
  ClipboardList, ShieldAlert, RefreshCw, Layers,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DismissControl } from '@/components/freehold/dismiss-control'
import { raiseAgentWaiting, clearAgentWaiting, agentWaiting } from '@/lib/freehold/agent-signal'

type Entry = { id: string; kind: string; detail: string; at: string; machine: string; repeats?: number }
type Pulse = {
  machines: { total: number; running: number; names: string[] }
  spend: { committedAed: number; capAed: number; liveCampaigns: number }
  lastActivityAt: string | null
  decisions: Entry[]
  alarms: Entry[]
  /** Duplicate alarm rows folded away on the server. */
  alarmsSuppressed?: number
}

/** One icon per kind, so the feed can be scanned rather than read. */
const KIND_ICON: Record<string, typeof Play> = {
  launched: Rocket, planned: ClipboardList, google_draft_prepared: ClipboardList,
  budget_shift: TrendingUp, trial_paused: Pause, trial_resumed: Play,
  permit_blocked: ShieldAlert, permit_warning: ShieldAlert,
  delivery_blocked: AlertTriangle, machine_stalled: AlertTriangle,
  creative_fatigue: RefreshCw, placement_drain: Layers,
  cap_enforced: AlertTriangle, error: AlertTriangle,
}

function ago(iso: string, t: ReturnType<typeof useT>): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return t('lm.pulse.justNow')
  if (mins < 60) return t('lm.pulse.minsAgo', { n: mins })
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return t('lm.pulse.hrsAgo', { n: hrs })
  return t('lm.pulse.daysAgo', { n: Math.round(hrs / 24) })
}


/**
 * Putting the note away, without being able to lose a live problem.
 *
 * A dismissal is stored against WHAT WAS SHOWN, not against a date. The
 * signature is the set of alarms by identity — so "I have read these" stays
 * true only while "these" is true. One new alarm, or one that changes its
 * wording because its numbers moved, and the note is back on its own.
 *
 * That is the difference between a close button being safe and being a way to
 * make a real problem disappear by clicking it once on a Friday.
 */
const PUT_AWAY_KEY = 'fh.pulse.note.putAway'
const SEEN_KEY = 'fh.pulse.note.seen'
const TOMORROW_MS = 24 * 60 * 60 * 1000

const alarmSignature = (alarms: Entry[]) =>
  alarms.map((a) => `${a.kind}:${a.detail}`).sort().join('|')

function setPutAway(signature: string, forMs?: number) {
  try {
    window.localStorage.setItem(PUT_AWAY_KEY, JSON.stringify({
      signature,
      // No `until` means "until the contents change" — Exit. A date means the
      // same, PLUS it comes back on its own when the date passes — Later.
      until: forMs ? Date.now() + forMs : null,
    }))
  } catch { /* private mode: the note simply stays, which is the safe failure */ }
}

/**
 * ONCE, WHEN YOU ARE THERE. NOT WAITING FOR YOU.
 *
 * A note that sits on the page every visit stops being a note. Read the same
 * sentence three mornings running and it has taught you that nothing here is
 * worth reading — which is a worse outcome than never having said it, because
 * it also costs the NEXT thing its attention.
 *
 * So it appears once per session for a given set of items and then steps
 * aside. The items themselves stay listed on the page; it is the machine
 * SPEAKING that is one-time. Say it, then stop saying it.
 *
 * Session-scoped, not permanent: tomorrow is a new visit and, if it is still
 * true, still worth one sentence.
 */
function alreadySaid(signature: string): boolean {
  try { return window.sessionStorage.getItem(SEEN_KEY) === signature } catch { return false }
}

function markSaid(signature: string) {
  try { window.sessionStorage.setItem(SEEN_KEY, signature) } catch { /* private mode */ }
}

function isPutAway(signature: string): boolean {
  try {
    const raw = window.localStorage.getItem(PUT_AWAY_KEY)
    if (!raw) return false
    const s = JSON.parse(raw) as { signature?: string; until?: number | null }
    if (s.signature !== signature) return false
    if (typeof s.until === 'number') return Date.now() < s.until
    return true
  } catch { return false }
}

export function MachinePulse() {
  const router = useRouter()
  /** What the operator is typing back to the machine. */
  const [reply, setReply] = useState('')
  /** Re-checked after mount and after every close, so the note disappears and
   *  reappears without a page reload. */
  const [putAwayTick, setPutAwayTick] = useState(0)
  /** Set only AFTER the note has been rendered — marking it said while merely
   *  deciding whether to render would silence it without anyone reading it. */
  const [said, setSaid] = useState<string | null>(null)
  /** Clicked its way back open from the side. */
  const [reopened, setReopened] = useState(false)
  const t = useT()
  const [p, setP] = useState<Pulse | null>(null)
  const [loading, setLoading] = useState(true)

  // Say it once this session. Runs after the note has actually rendered.
  useEffect(() => {
    if (!p || p.alarms.length === 0) return
    const sig = alarmSignature(p.alarms)
    if (isPutAway(sig) || alreadySaid(sig)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this must run
    // AFTER the note has rendered; marking it said while deciding whether to
    // render would silence it unread. One extra pass, then it settles.
    setSaid(sig)
    markSaid(sig)
    // …and let the agent carry it into the chat, wherever the reader goes
    // next. Idempotent on the signature, so walking back onto this page does
    // not re-light anything.
    raiseAgentWaiting({
      line: t('lm.pulse.note', { n: p.alarms.length }),
      // These are things the machine could not do, not things it wants
      // permission for. Marking them 'decide' would let a conversation read
      // as an authorisation.
      kind: 'discuss',
      href: '/freehold-intelligence/lead-machine/ads-machine',
      signature: sig,
    })
  }, [p, t])

  useEffect(() => {
    fetch('/api/freehold/lead-machine/pulse', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setP(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-5 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('lm.pulse.loading')}
      </div>
    )
  }

  // No machine at all is a real state with a real next step, not an error.
  if (!p || p.machines.total === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="h-4 w-4 text-gold" /> {t('lm.pulse.noMachineTitle')}
        </div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-400">{t('lm.pulse.noMachineBody')}</p>
        <Link href="/freehold-intelligence/lead-machine/ads-machine"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:opacity-90">
          <Activity className="h-3.5 w-3.5" /> {t('lm.pulse.noMachineCta')}
        </Link>
      </div>
    )
  }

  const live = p.machines.running > 0
  const pctOfCap = p.spend.capAed > 0 ? Math.min(100, Math.round((p.spend.committedAed / p.spend.capAed) * 100)) : 0

  // Computed in render, not stored: the signature depends on the alarms that
  // just arrived, so a put-away note un-hides itself the moment they differ.
  const signature = alarmSignature(p.alarms)
  const noteHidden = !reopened
    && typeof window !== 'undefined'
    && putAwayTick >= 0
    && (isPutAway(signature) || (alreadySaid(signature) && said !== signature))

  return (
    <div className="mt-6 space-y-4">
      {/* 1 — is it on, and what is it spending */}
      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            live ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                 : 'border-line-strong bg-surface text-slate-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
            {live ? t('lm.pulse.running', { n: p.machines.running }) : t('lm.pulse.idle')}
          </span>
          <span className="text-xs text-slate-400">
            {t('lm.pulse.liveCampaigns', { n: p.spend.liveCampaigns })}
          </span>
          {p.lastActivityAt && (
            <span className="text-xs text-slate-500">{t('lm.pulse.lastCycle', { when: ago(p.lastActivityAt, t) })}</span>
          )}
        </div>

        {/* Committed against the cap — the number that says whether the machine
            has room to act, which is not the same as what it has spent. */}
        {p.spend.capAed > 0 && (
          <div className="mt-3.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-400">{t('lm.pulse.committed')}</span>
              <span className="font-semibold text-white tabular-nums">
                AED {p.spend.committedAed.toLocaleString()}
                <span className="font-normal text-slate-500"> / {p.spend.capAed.toLocaleString()}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${pctOfCap >= 95 ? 'bg-amber-400' : 'bg-gold'}`} style={{ width: `${pctOfCap}%` }} />
            </div>
            {pctOfCap >= 95 && <p className="mt-1.5 text-[11px] text-amber-200/80">{t('lm.pulse.atCap')}</p>}
          </div>
        )}
      </div>

      {/* 2 — what it DID. The work comes first on this page. */}
      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Activity className="h-3.5 w-3.5 text-gold" /> {t('lm.pulse.decisions')}
          </div>
          <Link href="/freehold-intelligence/lead-machine/ads-machine"
            className="text-[11px] text-gold/70 transition hover:text-gold">{t('lm.pulse.openMachine')}</Link>
        </div>

        {p.decisions.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{t('lm.pulse.noDecisions')}</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {p.decisions.map((d) => {
              const Icon = KIND_ICON[d.kind] ?? Activity
              return (
                <div key={d.id} className="flex items-start gap-2.5 border-s-2 border-line ps-3">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-relaxed text-slate-300">{d.detail}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{d.machine} · {ago(d.at, t)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3 — what it is waiting on. LAST, and deliberately not a warning wall.
             A page that opens on amber tells the person reading it they did
             something wrong. They did not — the machine ran, it did work, and a
             couple of things need a human. That is a to-do, not a fault, so it
             reads like one and it sits after the work rather than in front of
             it. Nothing is hidden or softened away: same items, same detail,
             same counts. Only the order and the volume change. */}
      {/* IT IS NOT A NOTIFICATION AND IT IS NOT FURNITURE — IT IS A CHAT.
          So once it has said its line it does not vanish and it does not keep
          talking. It steps to the side of its own block and waits to be
          clicked, the way a person who has already told you something waits
          rather than repeating themselves. Deliberately inline rather than
          another floating button: two corners are already taken, and a third
          thing hovering over the page is exactly the pestering this avoids. */}
      {p.alarms.length > 0 && noteHidden && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setReopened(true)}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-slate-400 transition hover:border-gold/30 hover:text-white"
            aria-label={t('lm.pulse.reopen')}
          >
            <MessageSquare className="h-3.5 w-3.5 text-gold/60 transition group-hover:text-gold" />
            <span className="h-1 w-1 rounded-full bg-gold/70" />
          </button>
        </div>
      )}

      {p.alarms.length > 0 && !noteHidden && (
        <div className="rounded-2xl border border-line bg-surface-2 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-gold/70" /> {t('lm.pulse.fromAgent')}
            </div>
            {/* Later genuinely returns — tomorrow, with the same items if they
                are still true. Exit puts THIS set away, and a set is its
                contents: the moment the machine finds something new, or the
                same thing changes, it comes back on its own. Neither verb can
                lose a live problem, which is the only reason a close button is
                allowed near one. */}
            <DismissControl
              id="machine-pulse-note"
              onExit={() => {
                setPutAway(alarmSignature(p.alarms))
                clearAgentWaiting(alarmSignature(p.alarms))
                // Without this the panel stays open forever once it has been
                // reopened from the side — the storage write lands and the
                // screen ignores it.
                setReopened(false)
                setSaid(null)
                setPutAwayTick((n) => n + 1)
              }}
              onLater={() => {
                setPutAway(alarmSignature(p.alarms), TOMORROW_MS)
                clearAgentWaiting(alarmSignature(p.alarms))
                setReopened(false)
                setSaid(null)
                setPutAwayTick((n) => n + 1)
              }}
            />
          </div>

          {/* THE MACHINE SPEAKS, rather than flashing.
              A list of errors makes the person reading it feel audited. The
              same facts said in the first person — "I found these, I need your
              word before I move" — is the machine reporting to them, which is
              what it actually is. The items are still all here, unedited and
              in full, underneath. */}
          {/* Whatever the agent actually said. The channel carries a line; it
              does not author one, and this panel does not second-guess it —
              the next message through here may not be about alarms at all. */}
          <p className="mt-2.5 text-[13px] leading-relaxed text-slate-200">
            {agentWaiting()?.line ?? t('lm.pulse.note', { n: p.alarms.length })}
          </p>
          {/* IF YOU CAN ANSWER IT, IT IS A CHAT. IF YOU CAN ONLY LOOK AT IT,
              IT IS A MESSAGE — and a button labelled "discuss" that throws you
              onto another page is still just a message with extra steps.
              So the reply happens here. What is typed is carried into the
              conversation verbatim and left UNSENT there, so the person sees
              their own words before the agent answers. Nothing is auto-asked
              on their behalf. */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const said = reply.trim()
              if (!said) return
              router.push(`/freehold-intelligence/notebook?ask=${encodeURIComponent(said)}`)
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t('lm.pulse.replyPlaceholder')}
              aria-label={t('lm.pulse.replyPlaceholder')}
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold/40"
            />
            <button
              type="submit"
              disabled={!reply.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
            >
              <MessageSquare className="h-3 w-3" /> {t('lm.pulse.send')}
            </button>
          </form>
          <div className="mt-2">
            <Link
              href="/freehold-intelligence/lead-machine/ads-machine"
              className="text-[11px] text-slate-500 transition hover:text-slate-300"
            >
              {t('lm.pulse.seeDetail')}
            </Link>
          </div>

          <div className="mt-4 space-y-2 border-t border-line pt-3.5">
            {p.alarms.map((a) => {
              const Icon = KIND_ICON[a.kind] ?? AlertTriangle
              return (
                <div key={a.id} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-300">
                    {a.detail}
                    {/* A standing condition, said once with a count — not the
                        same sentence N times. The number is the useful part:
                        it says how long this has gone unfixed. */}
                    {(a.repeats ?? 1) > 1 && (
                      <span className="ms-1.5 whitespace-nowrap rounded-full border border-line px-1.5 py-0.5 text-[10px] text-slate-500">
                        {t('lm.pulse.seenTimes', { n: a.repeats ?? 1 })}
                      </span>
                    )}
                  </p>
                  <span className="shrink-0 text-[10px] text-slate-600">{ago(a.at, t)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
