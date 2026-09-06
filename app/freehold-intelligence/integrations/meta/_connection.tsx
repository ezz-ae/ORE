'use client'

/**
 * IS THIS AD ACCOUNT STILL CONNECTED?
 *
 * The Meta integrations page could store credentials and never once say
 * whether they worked. "Connected" meant "a token is saved", which is exactly
 * the state that let a rejected token read as green here while every campaign
 * call failed.
 *
 * ── THREE ANSWERS, NOT ONE LIGHT ─────────────────────────────────────────
 *
 * They fail in different ways and need opposite fixes, so merging them into a
 * single green dot destroys the only useful information:
 *
 *   THE PROBE — does the token work THIS SECOND. One real read against the
 *   ad account, not a check that a string is present.
 *
 *   THE HEARTBEAT — when the machine last actually reached the account. A
 *   green probe beside a stale heartbeat means the CRON stopped, not the
 *   connection.
 *
 *   THE LAST WRITE — when Meta last ACCEPTED something we created. An
 *   audience only lands if the account was genuinely reachable and
 *   permissioned, so this is proof of a working connection at a moment in the
 *   past, which a token that has since been revoked cannot fake.
 *
 * Read-only. Nothing here changes anything on the account.
 */

import { useCallback, useEffect, useState } from 'react'

interface Heartbeat {
  lastReadAt: string | null
  campaignsSeen: number | null
  lastSystemWriteAt: string | null
}

interface StatusRow {
  id?: string
  name?: string
  state?: 'connected' | 'partial' | 'missing' | 'error'
  detail?: string | null
  missing?: string[]
}

/** How long ago, in plain words. Null in means null out — "never" is a real
 *  answer and must not render as "just now". */
export function agoWords(iso: string | null | undefined, nowMs: number): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const mins = Math.floor((nowMs - t) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 90) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 36) return `${hours} hours ago`
  return `${Math.floor(hours / 24)} days ago`
}

/**
 * A heartbeat older than this is stale enough to mean something stopped.
 *
 * The guard runs daily, so anything past two days is a missed run rather than
 * a slow one — long enough not to cry wolf over one skipped cron, short enough
 * that a fortnight of silence is never mistaken for normal.
 */
export const STALE_HEARTBEAT_HOURS = 48

export function heartbeatIsStale(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return true
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return true
  return nowMs - t > STALE_HEARTBEAT_HOURS * 3_600_000
}

const dot = (tone: 'good' | 'warn' | 'bad') =>
  `inline-block h-2 w-2 rounded-full ${
    tone === 'good' ? 'bg-emerald-400' : tone === 'warn' ? 'bg-amber-400' : 'bg-red-400'
  }`

export default function MetaConnectionPanel() {
  const [meta, setMeta] = useState<StatusRow | null>(null)
  const [beat, setBeat] = useState<Heartbeat | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/freehold/integrations/status')
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'Could not read status')
      const rows: StatusRow[] = body.integrations ?? body.rows ?? []
      setMeta(rows.find((r) => /meta/i.test(String(r.id ?? r.name ?? ''))) ?? null)
      setBeat(body.metaHeartbeat ?? null)
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read status')
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const state = meta?.state ?? 'missing'
  const probeTone = state === 'connected' ? 'good' : state === 'error' ? 'bad' : 'warn'
  const readAgo = agoWords(beat?.lastReadAt, now)
  const writeAgo = agoWords(beat?.lastSystemWriteAt, now)
  const stale = heartbeatIsStale(beat?.lastReadAt, now)

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Connection</h2>
        <button onClick={load} disabled={busy}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40">
          {busy ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <dl className="mt-4 space-y-3 text-sm">
        {/* THE PROBE — a real call, not a stored string. */}
        <div className="flex items-start gap-3">
          <span className={`${dot(probeTone)} mt-1.5`} />
          <div>
            <dt className="text-slate-200">
              {state === 'connected' ? 'Meta answered just now'
                : state === 'error' ? 'Meta rejected the connection'
                : 'Not fully configured'}
            </dt>
            {meta?.detail && <dd className="text-xs text-slate-500">{meta.detail}</dd>}
            {meta?.missing?.length ? (
              <dd className="text-xs text-slate-500">Missing: {meta.missing.join(', ')}</dd>
            ) : null}
          </div>
        </div>

        {/* THE HEARTBEAT — a green probe beside a stale heartbeat means the
            cron stopped, not the connection. Different fix entirely. */}
        <div className="flex items-start gap-3">
          <span className={`${dot(stale ? 'warn' : 'good')} mt-1.5`} />
          <div>
            <dt className="text-slate-200">
              {readAgo ? `Account last read ${readAgo}` : 'The machine has never read this account'}
            </dt>
            <dd className="text-xs text-slate-500">
              {beat?.campaignsSeen !== null && beat?.campaignsSeen !== undefined
                ? `${beat.campaignsSeen} campaigns seen on that run`
                : 'No monitoring run recorded yet'}
              {stale && readAgo ? ' — no run in the last two days.' : ''}
            </dd>
          </div>
        </div>

        {/* THE LAST WRITE — proof Meta accepted something, which a revoked
            token cannot fake retrospectively. */}
        <div className="flex items-start gap-3">
          <span className={`${dot(writeAgo ? 'good' : 'warn')} mt-1.5`} />
          <div>
            <dt className="text-slate-200">
              {writeAgo ? `Meta last accepted a write ${writeAgo}` : 'Nothing has been written to this account'}
            </dt>
            <dd className="text-xs text-slate-500">
              An audience only lands if the account was reachable and permissioned.
            </dd>
          </div>
        </div>
      </dl>
    </section>
  )
}
