'use client'

/**
 * The authority log.
 *
 * "logs are a must on that type of systems — it always has a day when it will
 * be the word between 2." This screen is that day. It answers, in one place:
 * who did what, to whom, when, and whether the system allowed it.
 *
 * The refusals matter more than the grants. A leader saying "I never touched
 * that lead" and a leader who tried and was blocked look identical in the data
 * unless denials are recorded too — so they are, and they are filterable on
 * their own, because "show me what was refused" is the actual question someone
 * asks on that day.
 *
 * Scope is the server's, not this page's: management reads everything, a leader
 * reads only their own actions no matter what filter they send, and a broker
 * cannot reach the route at all. The page renders `scope` back to the reader so
 * a leader is never left thinking they are seeing the whole company.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ScrollText, AlertTriangle, ShieldCheck, ShieldX, Filter, RotateCw, User, Users,
} from 'lucide-react'
import { PageHeader, Panel, EmptyState, SegmentPill, buttonClass, fieldClass } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { load, ROLE_CHIP } from '../_lib'

interface LogRow {
  id: string
  actorEmail: string
  actorRole: string
  action: string
  targetType: string
  targetId: string
  decision: 'allowed' | 'denied'
  reason: string
  detail: string | null
  createdAt: string
}

/** Every action the authority layer records. Kept in sync with AuthorityAction. */
const ACTIONS = ['lead.reassign', 'lead.delete', 'campaign.delete', 'campaign.edit', 'member.role', 'member.suspend'] as const
type Outcome = 'all' | 'allowed' | 'denied'

const PAGE_SIZE = 200

export default function AuthorityLogPage() {
  const t = useT()
  const [rows, setRows] = useState<LogRow[]>([])
  const [scope, setScope] = useState<'all' | 'self'>('self')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [outcome, setOutcome] = useState<Outcome>('all')
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (outcome !== 'all') params.set('decision', outcome)
    if (action) params.set('action', action)
    if (actor.trim()) params.set('actor', actor.trim())
    const res = await load<{ entries: LogRow[]; scope: 'all' | 'self' }>(`/api/freehold/authority-log?${params}`)
    if (res.ok) { setRows(res.data.entries ?? []); setScope(res.data.scope); setError(null) }
    else { setError(res.error); setRows([]) }
    setLoading(false)
  }, [outcome, action, actor])

  useEffect(() => { void refresh() }, [refresh])

  const deniedCount = rows.filter((r) => r.decision === 'denied').length

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
      <PageHeader
        eyebrow={t('alog.eyebrow')}
        title={t('alog.title')}
        subtitle={t('alog.subtitle')}
        actions={
          <button onClick={() => void refresh()} disabled={loading} className={buttonClass('ghost', 'sm')}>
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('alog.refresh')}
          </button>
        }
      />

      {/* Say whose log this is. A leader seeing 12 entries should know that is
          twelve of THEIRS, not twelve in the company. */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-slate-400">
        {scope === 'all' ? <Users className="h-3.5 w-3.5 text-slate-500" /> : <User className="h-3.5 w-3.5 text-slate-500" />}
        {scope === 'all' ? t('alog.scope.all') : t('alog.scope.self')}
      </div>

      {/* ── Filters ── */}
      <Panel className="mb-4">
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Filter className="h-3.5 w-3.5" /> {t('alog.filters')}
          </div>

          <div className="flex gap-1.5">
            {(['all', 'denied', 'allowed'] as Outcome[]).map((o) => (
              <SegmentPill key={o} selected={outcome === o} onClick={() => setOutcome(o)}>
                {t(`alog.outcome.${o}`)}
              </SegmentPill>
            ))}
          </div>

          <div className="min-w-[180px]">
            <select value={action} onChange={(e) => setAction(e.target.value)} className={fieldClass('sm')}>
              <option value="">{t('alog.action.any')}</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{t(`alog.action.${a}`)}</option>)}
            </select>
          </div>

          {/* Only management may filter by another person — for a leader the
              server pins the actor to themselves and this would be a lie. */}
          {scope === 'all' && (
            <div className="min-w-[200px] flex-1">
              <input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder={t('alog.actorPlaceholder')}
                className={fieldClass('sm')}
              />
            </div>
          )}
        </div>
      </Panel>

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-red-100">{t('alog.failed')}</div>
            <div className="truncate text-xs text-red-200/80">{error}</div>
          </div>
          <button onClick={() => void refresh()} className={`${buttonClass('ghost', 'sm')} ms-auto shrink-0`}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
        </div>
      ) : rows.length === 0 && !error ? (
        <EmptyState
          Icon={ScrollText}
          title={t('alog.emptyTitle')}
          description={t('alog.emptyBody')}
        />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              {rows.length === PAGE_SIZE
                // Never imply completeness the query cannot promise.
                ? t('alog.countCapped', { n: PAGE_SIZE })
                : t('alog.count', { n: rows.length })}
            </span>
            {deniedCount > 0 && (
              <span className="text-amber-300/90">{t('alog.deniedCount', { n: deniedCount })}</span>
            )}
          </div>

          <Panel>
            <ul className="divide-y divide-line">
              {rows.map((r) => <LogEntry key={r.id} row={r} t={t} />)}
            </ul>
          </Panel>
        </>
      )}
    </div>
  )
}

function LogEntry({ row, t }: { row: LogRow; t: (k: string, v?: Record<string, string | number>) => string }) {
  const denied = row.decision === 'denied'
  const when = (() => {
    const ms = Date.parse(row.createdAt)
    return Number.isNaN(ms) ? row.createdAt : new Date(ms).toLocaleString()
  })()

  // Leads link to the real CRM route; members to their Team profile. Anything
  // else stays plain text rather than guessing a URL.
  const href =
    row.targetType === 'lead' ? `/freehold-intelligence/crm/leads/${encodeURIComponent(row.targetId)}`
    : row.targetType === 'member' ? `/freehold-intelligence/team/${encodeURIComponent(row.targetId)}`
    : null

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
          denied ? 'border-amber-400/30 bg-amber-400/10' : 'border-emerald-400/25 bg-emerald-400/10'
        }`}
      >
        {denied ? <ShieldX className="h-3.5 w-3.5 text-amber-300" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-slate-100">{row.actorEmail}</span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${ROLE_CHIP[row.actorRole] ?? 'border-line-strong bg-surface-2 text-slate-400'}`}>
            {row.actorRole}
          </span>
          <span className="text-slate-400">{t(`alog.action.${row.action}`)}</span>
          {href ? (
            <Link href={href} className="truncate text-slate-300 underline-offset-2 hover:text-white hover:underline">
              {row.targetId}
            </Link>
          ) : (
            <span className="truncate text-slate-400">{row.targetType} · {row.targetId}</span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className={denied ? 'text-amber-300/90' : 'text-emerald-300/90'}>
            {denied ? t('alog.denied') : t('alog.allowed')}
          </span>
          {/* The reason code is the whole point — it is why the answer was what
              it was, in the system's own words rather than a paraphrase. */}
          <span className="text-slate-500">· {t(`alog.reason.${row.reason}`)}</span>
          {row.detail && <span className="truncate text-slate-600">· {row.detail}</span>}
        </div>
      </div>

      <time className="shrink-0 text-xs tabular-nums text-slate-600">{when}</time>
    </li>
  )
}
